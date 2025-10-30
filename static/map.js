// --- Initialize Map with Mapbox GL JS ---
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [7.5, 8.5], // [lng, lat]
    zoom: 14
});

// Wait for map to load before adding layers
map.on('load', () => {
    loadGeoJSONLayers();
});

// --- Initialize variables ---
let startMarker, endMarker, stepMarkers = [];
let localFeatures = [];
let startPoint = null;
let endPoint = null;
let clickCount = 0;
let speechEnabled = true;
let speechQueue = [];
let isSpeaking = false;
let debounceTimer = null;
let currentHighlightLayer = null;

// Mapbox layer IDs
const LAYER_IDS = {
    roads: 'roads-layer',
    buildings: 'buildings-layer',
    route: 'route-layer',
    highlight: 'highlight-layer',
    userLocation: 'user-location-layer'
};

// --- Turn-by-Turn Navigation Variables ---
let gpsWatchId = null;
let userMarker = null;
let isNavigationMode = false;
let autoRecenter = true;
let currentInstructionIndex = 0;
let routeData = null;
let distanceTraveled = 0;
let isOffRoute = false;
let advanceWarningGiven = false;
let lastSpokenInstruction = null;

// --- UI Elements ---
const routeStatusEl = document.getElementById('routeStatus');
const cancelBtn = document.getElementById('cancelBtn');
const statusMessageEl = document.getElementById('statusMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const speechToggle = document.getElementById('speechToggle');
const routeSummaryEl = document.getElementById('routeSummary');
const routeDistanceEl = document.getElementById('routeDistance');
const navBar = document.getElementById('navBar');
const currentInstructionEl = document.getElementById('currentInstruction');
const distanceToTurnEl = document.getElementById('distanceToTurn');
const routeProgressEl = document.getElementById('routeProgress');
const recenterBtn = document.getElementById('recenterBtn');
const exitNavBtn = document.getElementById('exitNavBtn');

// --- Utility Functions ---
function showStatus(message, type = 'info', duration = 3000) {
    statusMessageEl.textContent = message;
    statusMessageEl.className = `alert alert-${type} position-absolute top-0 start-50 translate-middle-x mt-2`;
    statusMessageEl.style.display = 'block';
    statusMessageEl.classList.add('fade-in');
    
    setTimeout(() => {
        statusMessageEl.style.display = 'none';
    }, duration);
}

function showLoading(show = true) {
    loadingSpinner.style.display = show ? 'block' : 'none';
}

function updateRouteStatus() {
    if (clickCount === 0) {
        routeStatusEl.style.display = 'none';
        cancelBtn.style.display = 'none';
    } else if (clickCount === 1) {
        routeStatusEl.textContent = '✓ Start point set. Click on map for end point.';
        routeStatusEl.className = 'route-status waiting-end';
        routeStatusEl.style.display = 'block';
        cancelBtn.style.display = 'block';
    }
}

// Calculate distance between two points using Turf.js
function calculateDistance(point1, point2) {
    const from = turf.point([point1.lng || point1[0], point1.lat || point1[1]]);
    const to = turf.point([point2.lng || point2[0], point2.lat || point2[1]]);
    return turf.distance(from, to, { units: 'meters' }) * 1000; // Convert to meters
}

// Get bounds from GeoJSON
function getBoundsFromGeoJSON(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        // Return default bounds if invalid
        return [[7.0, 8.0], [8.0, 9.0]];
    }
    try {
        const bbox = turf.bbox(geojson);
        // Validate bbox values
        if (bbox.some(v => !isFinite(v) || isNaN(v))) {
            return [[7.0, 8.0], [8.0, 9.0]];
        }
        return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } catch (e) {
        console.warn('Error calculating bounds:', e);
        return [[7.0, 8.0], [8.0, 9.0]];
    }
}

// Get center from GeoJSON
function getCenterFromGeoJSON(geojson) {
    if (!geojson) {
        return [7.5, 8.5]; // Default center
    }
    try {
        const center = turf.center(geojson);
        const coords = center.geometry.coordinates; // [lng, lat]
        // Validate coordinates
        if (!isFinite(coords[0]) || !isFinite(coords[1]) || isNaN(coords[0]) || isNaN(coords[1])) {
            return [7.5, 8.5]; // Default center
        }
        return coords;
    } catch (e) {
        console.warn('Error calculating center:', e);
        return [7.5, 8.5]; // Default center
    }
}

// --- Speech Synthesis with Queue ---
function speakSequentially(text) {
    if (!speechEnabled) return;
    
    speechQueue.push(text);
    processSpeechQueue();
}

function processSpeechQueue() {
    if (isSpeaking || speechQueue.length === 0) return;
    
    isSpeaking = true;
    const text = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onend = () => {
        isSpeaking = false;
        processSpeechQueue();
    };
    
    utterance.onerror = () => {
        isSpeaking = false;
        processSpeechQueue();
    };
    
    window.speechSynthesis.speak(utterance);
}

// Speech toggle
if (speechToggle) {
    speechToggle.addEventListener('click', () => {
        speechEnabled = !speechEnabled;
        if (!speechEnabled) {
            window.speechSynthesis.cancel();
            speechQueue = [];
            isSpeaking = false;
            speechToggle.textContent = '🔇';
            speechToggle.classList.add('text-muted');
        } else {
            speechToggle.textContent = '🔊';
            speechToggle.classList.remove('text-muted');
        }
    });
}

// Cancel button
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        if (startMarker) startMarker.remove();
        startMarker = null;
        startPoint = null;
        clickCount = 0;
        updateRouteStatus();
        showStatus('Route selection cancelled', 'warning');
    });
}

// --- Load Roads & Buildings ---
function loadGeoJSONLayers() {
    console.log('Loading GeoJSON layers...');
    Promise.all([
        fetch('/static/roads.geojson').then(r => {
            if (!r.ok) throw new Error(`Failed to load roads: ${r.statusText}`);
            return r.json();
        }),
        fetch('/static/buildings.geojson').then(r => {
            if (!r.ok) throw new Error(`Failed to load buildings: ${r.statusText}`);
            return r.json();
        })
    ])
        .then(([roads, buildings]) => {
            console.log(`Loaded ${roads.features?.length || 0} roads and ${buildings.features?.length || 0} buildings`);
            
            // Validate data
            if (!roads || !roads.features || roads.features.length === 0) {
                console.warn('No road features found in GeoJSON');
            }
            if (!buildings || !buildings.features || buildings.features.length === 0) {
                console.warn('No building features found in GeoJSON');
            }
            // Add roads layer
            map.addSource('roads-source', {
                type: 'geojson',
                data: roads
            });

            map.addLayer({
                id: LAYER_IDS.roads,
                type: 'line',
                source: 'roads-source',
                paint: {
                    'line-color': '#000000',
                    'line-width': 2
                }
            });

            // Add road labels (hover tooltips) - use midpoint for LineStrings
            roads.features.forEach(feature => {
                if (feature.properties?.name && feature.geometry) {
                    try {
                        let lon, lat;
                        
                        // For LineString, get midpoint
                        if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 0) {
                            const coords = feature.geometry.coordinates;
                            const midIndex = Math.floor(coords.length / 2);
                            [lon, lat] = coords[midIndex];
                        } else if (feature.geometry.type === 'MultiLineString' && feature.geometry.coordinates.length > 0) {
                            // For MultiLineString, get midpoint of first line segment
                            const firstLine = feature.geometry.coordinates[0];
                            if (firstLine && firstLine.length > 0) {
                                const midIndex = Math.floor(firstLine.length / 2);
                                [lon, lat] = firstLine[midIndex];
                            } else {
                                // Fallback to center calculation
                                const center = getCenterFromGeoJSON({ type: 'FeatureCollection', features: [feature] });
                                [lon, lat] = center;
                            }
                        } else if (feature.geometry.type === 'Point') {
                            [lon, lat] = feature.geometry.coordinates;
                        } else {
                            // For other types, use center
                            const center = getCenterFromGeoJSON({ type: 'FeatureCollection', features: [feature] });
                            [lon, lat] = center;
                        }
                        
                        // Validate coordinates before creating marker
                        if (isFinite(lon) && isFinite(lat) && !isNaN(lon) && !isNaN(lat) && lon !== undefined && lat !== undefined) {
                            const el = document.createElement('div');
                            el.className = 'road-label';
                            el.textContent = feature.properties.name;
                            el.style.cssText = 'background: rgba(255, 255, 255, 0.7); padding: 2px 6px; border-radius: 3px; font-size: 10px; pointer-events: none;';
                            
                            new mapboxgl.Marker({ element: el })
                                .setLngLat([lon, lat])
                                .addTo(map);
                        } else {
                            console.warn('Invalid coordinates for road label:', feature.properties.name, {lon, lat});
                        }
                    } catch (e) {
                        console.warn('Error creating road label:', e, feature);
                    }
                }
            });

            // Add buildings layer
            map.addSource('buildings-source', {
                type: 'geojson',
                data: buildings
            });

            map.addLayer({
                id: LAYER_IDS.buildings,
                type: 'fill',
                source: 'buildings-source',
                paint: {
                    'fill-color': 'coral',
                    'fill-opacity': 0.8
                }
            });

            map.addLayer({
                id: LAYER_IDS.buildings + '-outline',
                type: 'line',
                source: 'buildings-source',
                paint: {
                    'line-color': 'coral',
                    'line-width': 2
                }
            });

            // Fit bounds to show all features
            const allFeatures = {
                type: 'FeatureCollection',
                features: [...roads.features, ...buildings.features]
            };
            
            // Only fit bounds if we have valid features
            if (allFeatures.features.length > 0) {
                try {
                    const bounds = getBoundsFromGeoJSON(allFeatures);
                    // Validate bounds before using
                    if (bounds && bounds[0] && bounds[1] && 
                        bounds[0][0] !== bounds[1][0] && bounds[0][1] !== bounds[1][1]) {
                        map.fitBounds(bounds, { padding: 50 });
                        map.zoomIn(1);
                    }
                } catch (e) {
                    console.warn('Error fitting bounds:', e);
                }
            }

            // Prepare offline search data
            roads.features.forEach(f => {
                if (f.properties.name)
                    localFeatures.push({name: f.properties.name, type: 'road', geometry: f.geometry});
            });
            buildings.features.forEach(f => {
                if (f.properties.name)
                    localFeatures.push({
                        name: f.properties.name,
                        type: 'building',
                        geometry: f.geometry,
                        departments: f.properties.departments || []
                    });
            });

            showStatus('Map loaded successfully', 'success', 2000);
        })
        .catch(err => {
            console.error('Error loading GeoJSON:', err);
            showStatus('Error loading map data: ' + err.message, 'danger', 5000);
        });
}

// --- Smooth Collapse Helpers ---
function collapseDirections(hide = false) {
    const collapseEl = document.getElementById('directionsBody');
    const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, {toggle: false});
    if (hide) bsCollapse.hide(); else bsCollapse.show();
}

// --- Update Directions Panel ---
function updateDirectionsPanel(directions, totalDistance = null) {
    const container = document.querySelector('#directionsPanel .directions');
    container.innerHTML = '';

    if (!directions || directions.length === 0) {
        container.innerHTML = `<p class="text-muted mb-0">No route loaded yet.</p>`;
        collapseDirections(true);
        routeSummaryEl.style.display = 'none';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';
    directions.forEach((stepObj, i) => {
        const li = document.createElement('li');
        li.className = `list-group-item p-2 ${i === currentInstructionIndex ? 'active' : ''}`;
        li.id = `instruction-${i}`;
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        li.innerHTML = `<strong>${i + 1}.</strong> ${stepObj.text || stepObj}`;
        ul.appendChild(li);
    });
    container.appendChild(ul);

    // Show route summary
    if (totalDistance !== null) {
        routeDistanceEl.textContent = totalDistance.toLocaleString();
        routeSummaryEl.style.display = 'block';
    }

    // Smoothly open the panel
    collapseDirections(false);
    
    // Scroll active instruction into view
    updateActiveInstruction(currentInstructionIndex);
}

// --- Update Active Instruction Highlight ---
function updateActiveInstruction(index) {
    if (!routeData || !routeData.directions) return;
    
    // Remove previous highlight
    const prevEl = document.getElementById(`instruction-${currentInstructionIndex}`);
    if (prevEl) {
        prevEl.classList.remove('active');
    }
    
    // Add new highlight
    currentInstructionIndex = index;
    const newEl = document.getElementById(`instruction-${index}`);
    if (newEl) {
        newEl.classList.add('active');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update navigation bar
    updateNavigationBar();
}

// --- Clear Route Function ---
function clearRoute() {
    // Remove route layer
    if (map.getLayer(LAYER_IDS.route)) {
        map.removeLayer(LAYER_IDS.route);
    }
    if (map.getSource('route-source')) {
        map.removeSource('route-source');
    }

    // Remove markers
    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();
    if (userMarker) userMarker.remove();
    stepMarkers.forEach(m => m.remove());

    // Stop GPS tracking
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    startMarker = null;
    endMarker = null;
    userMarker = null;
    stepMarkers = [];
    startPoint = null;
    endPoint = null;
    clickCount = 0;
    routeData = null;
    currentInstructionIndex = 0;
    distanceTraveled = 0;
    isOffRoute = false;
    advanceWarningGiven = false;
    lastSpokenInstruction = null;

    // Exit navigation mode
    exitNavigationMode();

    const container = document.querySelector('#directionsPanel .directions');
    if (container)
        container.innerHTML = `<p class="text-muted mb-0">Click on the map to set start point, then click again for end point.</p>`;

    // Smoothly collapse the panel
    collapseDirections(true);
    routeSummaryEl.style.display = 'none';
    updateRouteStatus();

    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;
    
    showStatus('Route cleared', 'info', 2000);
}

// Attach to Clear button
document.getElementById('clearBtn').addEventListener('click', clearRoute);

// --- Search Logic with Debouncing ---
const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('searchResults');

function performSearch() {
    const query = searchBox.value.trim().toLowerCase();
    resultsDiv.innerHTML = '';
    if (!query) {
        resultsDiv.style.display = 'none';
        return;
    }

    const matches = localFeatures.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
    if (matches.length === 0) {
        resultsDiv.innerHTML = '<div class="p-2 text-muted">No results found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${match.name} (${match.type})`;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'search-result-actions';
        
        const setStartBtn = document.createElement('button');
        setStartBtn.className = 'btn btn-sm btn-success';
        setStartBtn.textContent = 'Start';
        setStartBtn.onclick = (e) => {
            e.stopPropagation();
            setLocationFromSearch(match, 'start');
        };
        
        const setEndBtn = document.createElement('button');
        setEndBtn.className = 'btn btn-sm btn-danger';
        setEndBtn.textContent = 'End';
        setEndBtn.onclick = (e) => {
            e.stopPropagation();
            setLocationFromSearch(match, 'end');
        };
        
        actionsDiv.appendChild(setStartBtn);
        actionsDiv.appendChild(setEndBtn);
        
        item.appendChild(nameSpan);
        item.appendChild(actionsDiv);
        
        item.onclick = () => {
            highlightFeature(match);
        };
        
        resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = 'block';
}

function setLocationFromSearch(match, type) {
    const geom = match.geometry;
    let lat, lon;
    
    if (geom.type === 'Point') {
        [lon, lat] = geom.coordinates;
    } else {
        // Get centroid for polygons/lines
        const center = getCenterFromGeoJSON({ type: 'Feature', geometry: geom });
        [lon, lat] = center;
    }
    
    // Validate coordinates
    if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
        showStatus('Invalid location coordinates', 'error');
        return;
    }
    
    if (type === 'start') {
        if (startMarker) startMarker.remove();
        startPoint = {lat, lng: lon};
        const el = document.createElement('div');
        el.className = 'marker-start';
        el.innerHTML = '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>';
        startMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(map);
        startMarker.togglePopup();
        clickCount = 1;
        showStatus('Start point set from search', 'success');
    } else {
        if (endMarker) endMarker.remove();
        endPoint = {lat, lng: lon};
        const el = document.createElement('div');
        el.className = 'marker-end';
        el.innerHTML = '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>';
        endMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setText('End'))
            .addTo(map);
        endMarker.togglePopup();
        
        if (startPoint) {
            // Automatically calculate route
            calculateRoute();
        } else {
            clickCount = 1;
            showStatus('End point set. Set start point to calculate route.', 'info');
        }
    }
    
    map.flyTo({ center: [lon, lat], zoom: 17 });
    updateRouteStatus();
    highlightFeature(match);
}

function highlightFeature(match) {
    // Remove any previous temporary highlights
    if (map.getLayer(LAYER_IDS.highlight)) {
        map.removeLayer(LAYER_IDS.highlight);
    }
    if (map.getSource('highlight-source')) {
        map.removeSource('highlight-source');
    }
    
    const geom = match.geometry;
    
    if (geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        // Validate coordinates
        if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
            showStatus('Invalid point coordinates', 'error');
            return;
        }
        map.flyTo({ center: [lon, lat], zoom: 17 });
        const el = document.createElement('div');
        el.innerHTML = '📍';
        el.style.fontSize = '24px';
        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setText(`${match.name} (${match.type})`))
            .addTo(map);
        marker.togglePopup();
        currentHighlightLayer = marker;
    } else {
        map.addSource('highlight-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: geom }
        });
        
        map.addLayer({
            id: LAYER_IDS.highlight,
            type: geom.type === 'Polygon' || geom.type === 'MultiPolygon' ? 'fill' : 'line',
            source: 'highlight-source',
            paint: {
                'line-color': 'red',
                'line-width': 4,
                'fill-color': 'red',
                'fill-opacity': 0.3
            }
        });
        
        const bounds = getBoundsFromGeoJSON({ type: 'Feature', geometry: geom });
        map.fitBounds(bounds, { padding: 50 });
        
        setTimeout(() => {
            if (map.getLayer(LAYER_IDS.highlight)) {
                map.removeLayer(LAYER_IDS.highlight);
            }
            if (map.getSource('highlight-source')) {
                map.removeSource('highlight-source');
            }
            currentHighlightLayer = null;
        }, 6000);
    }

    // Display department list if building has departments
    const departmentList = document.getElementById('departmentList');
    const departmentsUl = document.getElementById('departments');
    
    // Always clear first
    departmentsUl.innerHTML = '';
    
    if (match.type === 'building' && match.departments?.length) {
        match.departments.forEach(dep => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.textContent = dep;
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'button');
            li.onclick = () => {
                showStatus(`Selected department: ${dep} in ${match.name}`, 'info');
                const bounds = getBoundsFromGeoJSON({ type: 'Feature', geometry: match.geometry });
                map.fitBounds(bounds, { padding: 50 });
            };
            departmentsUl.appendChild(li);
        });
        departmentList.style.display = 'block';
    } else {
        departmentList.style.display = 'none';
    }

    // Hide search results after selection
    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'none';
    searchBox.value = '';
}

// Debounced search
searchBox.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, 300);
});

searchBtn.addEventListener('click', performSearch);

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target) && !resultsDiv.contains(e.target) && !searchBtn.contains(e.target)) {
        resultsDiv.style.display = 'none';
    }
});

// Keyboard navigation
searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    } else if (e.key === 'Escape') {
        resultsDiv.style.display = 'none';
        searchBox.blur();
    }
});

// --- Routing Logic ---
function calculateRoute() {
    if (!startPoint || !endPoint) {
        showStatus('Please set both start and end points', 'warning');
        return;
    }
    
    showLoading(true);
    const url = `/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}`;
    
    fetch(url)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            showLoading(false);
            
            if (data.error) {
                showStatus('Error: ' + data.error, 'danger', 5000);
                return;
            }

            // Remove existing route layer
            if (map.getLayer(LAYER_IDS.route)) {
                map.removeLayer(LAYER_IDS.route);
            }
            if (map.getSource('route-source')) {
                map.removeSource('route-source');
            }

            // Remove step markers
            stepMarkers.forEach(m => m.remove());
            stepMarkers = [];

            // Add route layer
            map.addSource('route-source', {
                type: 'geojson',
                data: data.route
            });

            map.addLayer({
                id: LAYER_IDS.route,
                type: 'line',
                source: 'route-source',
                paint: {
                    'line-color': 'green',
                    'line-width': 4
                }
            });

            // Fit bounds to route
            try {
                const bounds = getBoundsFromGeoJSON(data.route);
                // Validate bounds before using
                if (bounds && bounds[0] && bounds[1] && 
                    bounds[0][0] !== bounds[1][0] && bounds[0][1] !== bounds[1][1]) {
                    map.fitBounds(bounds, { padding: 50 });
                }
            } catch (e) {
                console.warn('Error fitting route bounds:', e);
            }

            // Plot markers for each turn
            for (let i = 0; i < data.directions.length - 1; i++) {
                const stepObj = data.directions[i];
                if (!stepObj.location) continue;
                
                const [lon, lat] = stepObj.location;
                
                // Validate coordinates before creating marker
                if (!isFinite(lon) || !isFinite(lat) || isNaN(lon) || isNaN(lat)) {
                    console.warn(`Invalid coordinates for step ${i + 1}:`, stepObj.location);
                    continue;
                }

                const el = document.createElement('div');
                el.className = 'step-label bg-danger text-white rounded-circle';
                el.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;';
                el.textContent = i + 1;

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([lon, lat])
                    .addTo(map);
                stepMarkers.push(marker);
            }

            // Store route data for navigation
            routeData = data;
            currentInstructionIndex = 0;
            distanceTraveled = 0;
            isOffRoute = false;
            advanceWarningGiven = false;
            lastSpokenInstruction = null;

            updateDirectionsPanel(data.directions, data.total_distance_m);

            // Enter navigation mode
            enterNavigationMode();

            // Speak only the first instruction
            if (speechEnabled && data.directions.length > 0) {
                const firstInstruction = typeof data.directions[0] === 'string' 
                    ? data.directions[0] 
                    : data.directions[0].text;
                speakInstruction(firstInstruction, true);
            }

            // Start GPS tracking
            startGPSTracking(data);

            clickCount = 0;
            updateRouteStatus();
            showStatus('Route calculated successfully. Starting navigation...', 'success', 2000);
        })
        .catch(err => {
            showLoading(false);
            console.error('Routing error:', err);
            showStatus('Routing error: ' + err.message, 'danger', 5000);
        });
}

// Map click handler
map.on('click', (e) => {
    if (clickCount === 0) {
        startPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (startMarker) startMarker.remove();
        const el = document.createElement('div');
        el.className = 'marker-start';
        el.innerHTML = '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>';
        startMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([startPoint.lng, startPoint.lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(map);
        startMarker.togglePopup();
        clickCount = 1;
        updateRouteStatus();
        showStatus('Start point set. Click again for end point.', 'info');
        return;
    }

    if (clickCount === 1) {
        endPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (endMarker) endMarker.remove();
        const el = document.createElement('div');
        el.className = 'marker-end';
        el.innerHTML = '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>';
        endMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([endPoint.lng, endPoint.lat])
            .setPopup(new mapboxgl.Popup().setText('End'))
            .addTo(map);
        endMarker.togglePopup();
        
        calculateRoute();
    }
});

// Right-click to cancel route selection
map.on('contextmenu', (e) => {
    if (clickCount === 1) {
        e.preventDefault();
        if (startMarker) startMarker.remove();
        startMarker = null;
        startPoint = null;
        clickCount = 0;
        updateRouteStatus();
        showStatus('Route selection cancelled', 'warning');
    }
});

// --- Turn-by-Turn Navigation Functions ---

// Speak instruction with debouncing
function speakInstruction(text, force = false) {
    if (!speechEnabled || !window.speechSynthesis) return;

    if (text === lastSpokenInstruction && !force) {
        return;
    }

    window.speechSynthesis.cancel();
    lastSpokenInstruction = text;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.onend = () => {
        setTimeout(() => {
            if (lastSpokenInstruction === text) {
                lastSpokenInstruction = null;
            }
        }, 5000);
    };
    window.speechSynthesis.speak(utter);
}

// Enter navigation mode
function enterNavigationMode() {
    isNavigationMode = true;
    autoRecenter = true;
    
    if (navBar) navBar.style.display = 'block';
    updateNavigationBar();
}

// Exit navigation mode
function exitNavigationMode() {
    isNavigationMode = false;
    autoRecenter = false;
    
    if (navBar) navBar.style.display = 'none';
}

// Recenter map on user location
function recenterMap() {
    autoRecenter = true;
    if (userMarker) {
        const lngLat = userMarker.getLngLat();
        map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 18 });
    }
}

// Navigation bar button handlers
if (recenterBtn) {
    recenterBtn.addEventListener('click', recenterMap);
}

if (exitNavBtn) {
    exitNavBtn.addEventListener('click', () => {
        clearRoute();
    });
}

// Update navigation bar with current instruction
function updateNavigationBar() {
    if (!isNavigationMode || !routeData) return;

    if (currentInstructionEl && routeData.directions) {
        const instruction = routeData.directions[currentInstructionIndex];
        const instructionText = typeof instruction === 'string' ? instruction : instruction.text;
        currentInstructionEl.textContent = instructionText || 'Navigation in progress...';
    }

    if (distanceToTurnEl && userMarker && routeData.route) {
        const userLngLat = userMarker.getLngLat();
        const userPoint = { lat: userLngLat.lat, lng: userLngLat.lng };
        const distToNext = distanceToNextInstruction(userPoint, currentInstructionIndex + 1);
        const span = distanceToTurnEl.querySelector('span');
        
        if (distToNext < Infinity && currentInstructionIndex + 1 < routeData.directions.length) {
            if (span) {
                span.textContent = `Next turn in ${Math.round(distToNext)}m`;
            } else {
                distanceToTurnEl.innerHTML = `<i class="fas fa-route"></i> <span>Next turn in ${Math.round(distToNext)}m</span>`;
            }
        } else if (routeData.route.geometry && routeData.route.geometry.coordinates) {
            const coords = routeData.route.geometry.coordinates;
            if (coords.length > 0) {
                const [destLon, destLat] = coords[coords.length - 1];
                const distToDestination = calculateDistance(userPoint, { lat: destLat, lng: destLon });
                if (span) {
                    span.textContent = `${Math.round(distToDestination)}m to destination`;
                } else {
                    distanceToTurnEl.innerHTML = `<i class="fas fa-route"></i> <span>${Math.round(distToDestination)}m to destination</span>`;
                }
            }
        }
    }

    // Update progress bar
    if (routeProgressEl && routeData.total_distance_m) {
        const progressPercent = Math.min(100, (distanceTraveled / routeData.total_distance_m * 100));
        routeProgressEl.style.width = `${progressPercent}%`;
    }
}

// Calculate distance to next instruction point
function distanceToNextInstruction(userPoint, instructionIndex) {
    if (!routeData || !routeData.route || !routeData.route.geometry) {
        return Infinity;
    }

    const coords = routeData.route.geometry.coordinates;
    if (!coords || instructionIndex >= coords.length) {
        return Infinity;
    }

    // Get the location for this instruction from directions
    if (routeData.directions && routeData.directions[instructionIndex - 1]) {
        const instruction = routeData.directions[instructionIndex - 1];
        if (instruction.location) {
            const [lon, lat] = instruction.location;
            return calculateDistance(userPoint, { lat, lng: lon });
        }
    }

    // Fallback: estimate based on route coordinates
    if (instructionIndex < coords.length) {
        const [targetLon, targetLat] = coords[instructionIndex];
        return calculateDistance(userPoint, { lat: targetLat, lng: targetLon });
    }

    return Infinity;
}

// Calculate distance traveled along route
function calculateDistanceTraveled(userPoint) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return 0;

    const coords = routeData.route.geometry.coordinates;
    if (!coords || coords.length < 2) return 0;

    let minDist = Infinity;
    let closestIndex = 0;

    // Find closest point on route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = calculateDistance(userPoint, { lat, lng: lon });
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }

    // Sum distances from start to closest point
    let traveled = 0;
    for (let i = 0; i < closestIndex; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        traveled += calculateDistance({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
    }

    return traveled;
}

// Check if user is off route
function checkOffRoute(userPoint) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return false;

    const coords = routeData.route.geometry.coordinates;
    if (!coords) return false;

    let minDistance = Infinity;

    // Find minimum distance to any point on the route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = calculateDistance(userPoint, { lat, lng: lon });
        if (dist < minDistance) {
            minDistance = dist;
        }
    }

    // If more than 30m from route, consider off-route
    return minDistance > 30;
}

// GPS tracking with improved instruction management
function startGPSTracking(data) {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    if (!navigator.geolocation) {
        showStatus('Geolocation is not supported by your browser', 'warning', 5000);
        return;
    }

    const geoOptions = {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000
    };

    gpsWatchId = navigator.geolocation.watchPosition(
        pos => {
            const userLatLng = [pos.coords.latitude, pos.coords.longitude];
            const userPoint = { lat: userLatLng[0], lng: userLatLng[1] };

            // Update user marker
            if (userMarker) userMarker.remove();
            const el = document.createElement('div');
            el.className = 'pulse-marker';
            el.style.cssText = 'width: 20px; height: 20px; border-radius: 50%; background-color: #2196F3; border: 3px solid #2196F3; box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);';
            userMarker = new mapboxgl.Marker({ element: el })
                .setLngLat([userLatLng[1], userLatLng[0]])
                .addTo(map);

            // Auto-recenter in navigation mode
            if (isNavigationMode && autoRecenter) {
                map.flyTo({ center: [userLatLng[1], userLatLng[0]], zoom: 18, duration: 500 });
            }

            // Update distance traveled and progress
            distanceTraveled = calculateDistanceTraveled(userPoint);
            updateNavigationBar();

            // Check if off route
            if (checkOffRoute(userPoint)) {
                if (!isOffRoute) {
                    isOffRoute = true;
                    speakInstruction("You are off route. Recalculating...", true);
                }
                return;
            } else {
                if (isOffRoute) {
                    speakInstruction("Back on route.", true);
                }
                isOffRoute = false;
            }

            // Check distance to next instruction
            const distToNext = distanceToNextInstruction(userPoint, currentInstructionIndex + 1);

            // Advance warning (50m before turn)
            if (distToNext < 50 && distToNext > 30 && currentInstructionIndex + 1 < data.directions.length) {
                if (!advanceWarningGiven) {
                    const nextInstruction = data.directions[currentInstructionIndex + 1];
                    const nextText = typeof nextInstruction === 'string' ? nextInstruction : nextInstruction.text;
                    speakInstruction(`In 50 meters, ${nextText}`, true);
                    advanceWarningGiven = true;
                }
            }

            // Move to next instruction when close enough (20m)
            if (distToNext < 20 && currentInstructionIndex + 1 < data.directions.length) {
                currentInstructionIndex++;
                advanceWarningGiven = false;
                updateActiveInstruction(currentInstructionIndex);
                const nextInstruction = data.directions[currentInstructionIndex];
                const nextText = typeof nextInstruction === 'string' ? nextInstruction : nextInstruction.text;
                speakInstruction(nextText, true);
            }

            // Check if arrived at destination
            const coords = data.route.geometry.coordinates;
            if (coords && coords.length > 0) {
                const [destLon, destLat] = coords[coords.length - 1];
                const distToDestination = calculateDistance(userPoint, { lat: destLat, lng: destLon });

                if (distToDestination < 10 && currentInstructionIndex === data.directions.length - 1) {
                    speakInstruction("You have arrived at your destination.", true);
                    setTimeout(() => {
                        exitNavigationMode();
                        showStatus('Arrived at destination!', 'success', 5000);
                    }, 3000);
                }
            }
        },
        err => {
            let errorMsg = 'GPS error: ';
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    errorMsg += 'Location permission denied. Please enable location access.';
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMsg += 'Location unavailable. Please check your device settings.';
                    break;
                case err.TIMEOUT:
                    errorMsg += 'Location request timed out. Retrying...';
                    break;
                default:
                    errorMsg += err.message;
            }
            console.warn(errorMsg);
            showStatus(errorMsg, 'warning', 5000);
        },
        geoOptions
    );
}

// Allow user to disable auto-recenter by dragging map
map.on('dragstart', function () {
    if (isNavigationMode) {
        autoRecenter = false;
    }
});
