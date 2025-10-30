// --- Initialize Map ---
const map = L.map('map').setView([8.5, 7.5], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// --- Initialize variables ---
let startMarker, endMarker, routeLayer, stepMarkers = [];
let localFeatures = [];
let startPoint = null;
let endPoint = null;
let clickCount = 0;
let speechEnabled = true;
let speechQueue = [];
let isSpeaking = false;
let debounceTimer = null;
let currentHighlightLayer = null;

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
        processSpeechQueue(); // Process next in queue
    };
    
    utterance.onerror = () => {
        isSpeaking = false;
        processSpeechQueue(); // Continue with next even on error
    };
    
    window.speechSynthesis.speak(utterance);
}

// Speech toggle
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

// Cancel button
cancelBtn.addEventListener('click', () => {
    if (startMarker) map.removeLayer(startMarker);
    startMarker = null;
    startPoint = null;
    clickCount = 0;
    updateRouteStatus();
    showStatus('Route selection cancelled', 'warning');
});

// --- Load Roads & Buildings ---
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
        const roadsLayer = L.geoJSON(roads, {
            style: {color: 'black', weight: 2},
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name || 'Unnamed Road';
                layer.bindTooltip(name, {direction: 'center', className: 'road-label'});
            }
        }).addTo(map);

        const buildingsLayer = L.geoJSON(buildings, {
            style: {color: 'coral', fillOpacity: 0.8}
        }).addTo(map);

        const bounds = L.featureGroup([roadsLayer, buildingsLayer]).getBounds();
        map.fitBounds(bounds);
        map.zoomIn(1);

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
    if (routeLayer) map.removeLayer(routeLayer);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (userMarker) map.removeLayer(userMarker);
    stepMarkers.forEach(m => map.removeLayer(m));

    // Stop GPS tracking
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    routeLayer = null;
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
        const layer = L.geoJSON(geom);
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        lat = center.lat;
        lon = center.lng;
    }
    
    if (type === 'start') {
        if (startMarker) map.removeLayer(startMarker);
        startPoint = {lat, lng: lon};
        startMarker = L.marker(startPoint, {
            icon: L.divIcon({
                className: 'marker-start',
                html: '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>',
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup('Start').openPopup();
        clickCount = 1;
        showStatus('Start point set from search', 'success');
    } else {
        if (endMarker) map.removeLayer(endMarker);
        endPoint = {lat, lng: lon};
        endMarker = L.marker(endPoint, {
            icon: L.divIcon({
                className: 'marker-end',
                html: '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>',
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup('End').openPopup();
        
        if (startPoint) {
            // Automatically calculate route
            calculateRoute();
        } else {
            clickCount = 1;
            showStatus('End point set. Set start point to calculate route.', 'info');
        }
    }
    
    map.setView([lat, lon], 17);
    updateRouteStatus();
    highlightFeature(match);
}

function highlightFeature(match) {
    // Remove any previous temporary highlights
    if (currentHighlightLayer) {
        map.removeLayer(currentHighlightLayer);
    }
    
    const geom = match.geometry;
    
    if (geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        map.setView([lat, lon], 17);
        const marker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup(`${match.name} (${match.type})`)
            .openPopup();
        currentHighlightLayer = marker;
    } else {
        const layer = L.geoJSON(geom, { 
            style: { color: 'red', weight: 4 }, 
            tempHighlight: true 
        }).addTo(map);
        map.fitBounds(layer.getBounds());
        layer.bindPopup(`${match.name} (${match.type})`).openPopup();
        currentHighlightLayer = layer;
        setTimeout(() => {
            if (currentHighlightLayer === layer) {
                map.removeLayer(layer);
                currentHighlightLayer = null;
            }
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
                map.fitBounds(L.geoJSON(match.geometry).getBounds());
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

            if (routeLayer) map.removeLayer(routeLayer);
            stepMarkers.forEach(m => map.removeLayer(m));
            stepMarkers = [];

            routeLayer = L.geoJSON(data.route, {style: {color: 'green', weight: 4}}).addTo(map);
            map.fitBounds(routeLayer.getBounds());

            // Plot markers for each turn, but not the final destination
            for (let i = 0; i < data.directions.length - 1; i++) {
                const stepObj = data.directions[i];
                const [lon, lat] = stepObj.location;

                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'step-label bg-danger text-white rounded-circle',
                        html: `<b>${i + 1}</b>`,
                        iconSize: [24, 24],
                    }),
                }).addTo(map);
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

map.on('click', e => {
    if (clickCount === 0) {
        startPoint = e.latlng;
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(startPoint, {
            icon: L.divIcon({
                className: 'marker-start',
                html: '<div style="background-color: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">S</div>',
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup('Start').openPopup();
        clickCount = 1;
        updateRouteStatus();
        showStatus('Start point set. Click again for end point.', 'info');
        return;
    }

    if (clickCount === 1) {
        endPoint = e.latlng;
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(endPoint, {
            icon: L.divIcon({
                className: 'marker-end',
                html: '<div style="background-color: #dc3545; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">E</div>',
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup('End').openPopup();
        
        calculateRoute();
    }
});

// Right-click to cancel route selection
map.on('contextmenu', (e) => {
    if (clickCount === 1) {
        e.originalEvent.preventDefault();
        if (startMarker) map.removeLayer(startMarker);
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

    // Don't repeat the same instruction unless forced
    if (text === lastSpokenInstruction && !force) {
        return;
    }

    window.speechSynthesis.cancel();
    lastSpokenInstruction = text;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.onend = () => {
        // Clear after speaking to allow repeats if needed
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
    
    // Show navigation bar
    if (navBar) navBar.style.display = 'block';
    
    // Update navigation bar
    updateNavigationBar();
}

// Exit navigation mode
function exitNavigationMode() {
    isNavigationMode = false;
    autoRecenter = false;
    
    // Hide navigation bar
    if (navBar) navBar.style.display = 'none';
}

// Recenter map on user location
function recenterMap() {
    autoRecenter = true;
    if (userMarker) {
        map.setView(userMarker.getLatLng(), 18);
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
        const distToNext = distanceToNextInstruction(userMarker.getLatLng(), currentInstructionIndex + 1);
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
                const distToDestination = map.distance(userMarker.getLatLng(), [destLat, destLon]);
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
function distanceToNextInstruction(userLatLng, instructionIndex) {
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
            return map.distance(userLatLng, [lat, lon]);
        }
    }

    // Fallback: estimate based on route coordinates
    // Find closest point on route to user
    let minDist = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = map.distance(userLatLng, [lat, lon]);
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }

    // Calculate distance from closest point to target instruction
    if (instructionIndex < coords.length) {
        const [targetLon, targetLat] = coords[instructionIndex];
        return map.distance(userLatLng, [targetLat, targetLon]);
    }

    return Infinity;
}

// Calculate distance traveled along route
function calculateDistanceTraveled(userLatLng) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return 0;

    const coords = routeData.route.geometry.coordinates;
    if (!coords || coords.length < 2) return 0;

    let minDist = Infinity;
    let closestIndex = 0;

    // Find closest point on route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = map.distance(userLatLng, [lat, lon]);
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
        traveled += map.distance([lat1, lon1], [lat2, lon2]);
    }

    return traveled;
}

// Check if user is off route
function checkOffRoute(userLatLng) {
    if (!routeData || !routeData.route || !routeData.route.geometry) return false;

    const coords = routeData.route.geometry.coordinates;
    if (!coords) return false;

    let minDistance = Infinity;

    // Find minimum distance to any point on the route
    for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const dist = map.distance(userLatLng, [lat, lon]);
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

            // Update user marker
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.circleMarker(userLatLng, { 
                radius: 10,
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.8,
                weight: 3,
                className: 'pulse-marker'
            }).addTo(map);

            // Auto-recenter in navigation mode
            if (isNavigationMode && autoRecenter) {
                map.setView(userLatLng, 18, { animate: true, duration: 0.5 });
            }

            // Update distance traveled and progress
            distanceTraveled = calculateDistanceTraveled(userLatLng);
            updateNavigationBar();

            // Check if off route
            if (checkOffRoute(userLatLng)) {
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
            const distToNext = distanceToNextInstruction(userLatLng, currentInstructionIndex + 1);

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
                const distToDestination = map.distance(userLatLng, [destLat, destLon]);

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
