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

// --- Load Roads & Buildings ---
Promise.all([
    fetch('/static/roads.geojson').then(r => r.json()),
    fetch('/static/buildings.geojson').then(r => r.json())
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
                    departments: f.properties.departments || [] // add department list
                });
        });

    })
    .catch(err => console.error('Error loading GeoJSON:', err));


// --- Smooth Collapse Helpers ---
function collapseDirections(hide = false) {
    const collapseEl = document.getElementById('directionsBody');
    const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, {toggle: false});
    if (hide) bsCollapse.hide(); else bsCollapse.show();
}


// --- Update Directions Panel (HTML version) ---
function updateDirectionsPanel(directions) {
    const container = document.querySelector('#directionsPanel .directions');
    container.innerHTML = '';

    if (!directions || directions.length === 0) {
        container.innerHTML = `<p class="text-muted mb-0">No route loaded yet.</p>`;
        collapseDirections(true);
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';
    directions.forEach((stepObj, i) => {
        const li = document.createElement('li');
        li.className = 'list-group-item p-1';
        li.innerHTML = `<strong>${i + 1}.</strong> ${stepObj.text}`;
        ul.appendChild(li);
    });
    container.appendChild(ul);

    // Smoothly open the panel
    collapseDirections(false);
}


// --- Clear Route Function ---
function clearRoute() {
    if (routeLayer) map.removeLayer(routeLayer);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    stepMarkers.forEach(m => map.removeLayer(m));

    routeLayer = null;
    startMarker = null;
    endMarker = null;
    stepMarkers = [];
    startPoint = null;
    endPoint = null;
    clickCount = 0;

    const container = document.querySelector('#directionsPanel .directions');
    if (container)
        container.innerHTML = `<p class="text-muted mb-0">No route loaded yet.</p>`;

    // Smoothly collapse the panel
    collapseDirections(true);

    window.speechSynthesis.cancel();
    console.log('✅ Cleared route, markers, and directions.');
}

// Attach to Clear button
document.getElementById('clearBtn').addEventListener('click', clearRoute);


// --- Search Logic ---
const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('searchResults');

function performSearch() {
    const query = searchBox.value.trim().toLowerCase();
    resultsDiv.innerHTML = '';
    if (!query) return (resultsDiv.style.display = 'none');

    const matches = localFeatures.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
    if (matches.length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'p-1 border-bottom';
        item.textContent = `${match.name} (${match.type})`;
       item.onclick = () => {
    const geom = match.geometry;

    // Remove any previous temporary highlights
    map.eachLayer(layer => {
        if (layer instanceof L.GeoJSON && layer.options.tempHighlight) map.removeLayer(layer);
    });

    if (geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        map.setView([lat, lon], 17);
        L.marker([lat, lon])
            .addTo(map)
            .bindPopup(`${match.name} (${match.type})`)
            .openPopup();
    } else {
        const layer = L.geoJSON(geom, { style: { color: 'orange', weight: 3 }, tempHighlight: true }).addTo(map);
        map.fitBounds(layer.getBounds());
        layer.bindPopup(`${match.name} (${match.type})`).openPopup();
        setTimeout(() => map.removeLayer(layer), 6000);
    }

    // Display department list if building has departments
    const departmentList = document.getElementById('departmentList');
    const departmentsUl = document.getElementById('departments');
    if (match.type === 'building' && match.departments?.length) {
        departmentsUl.innerHTML = '';
        match.departments.forEach(dep => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.textContent = dep;
            li.onclick = () => {
                alert(`Selected department: ${dep} in ${match.name}`);
                // Optionally: center map again
                map.fitBounds(L.geoJSON(match.geometry).getBounds());
            };
            departmentsUl.appendChild(li);
        });
        departmentList.style.display = 'block';
    } else {
        departmentsUl.innerHTML = '';
        departmentList.style.display = 'none';
    }

    // Hide search results after selection
    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'none';
    searchBox.value = '';
};

        resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = 'block';
}

searchBox.addEventListener('input', performSearch);
searchBtn.addEventListener('click', performSearch);


// --- Routing Logic ---
map.on('click', e => {
    if (clickCount === 0) {
        startPoint = e.latlng;
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(startPoint).addTo(map).bindPopup('Start').openPopup();
        clickCount = 1;
        return;
    }

    if (clickCount === 1) {
        endPoint = e.latlng;
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(endPoint).addTo(map).bindPopup('End').openPopup();

        const url = `/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.error) return alert('Error: ' + data.error);

                if (routeLayer) map.removeLayer(routeLayer);
                stepMarkers.forEach(m => map.removeLayer(m));
                stepMarkers = [];

                routeLayer = L.geoJSON(data.route, {style: {color: 'red', weight: 3}}).addTo(map);
                map.fitBounds(routeLayer.getBounds());

                // Plot markers for each *turn*, but not the final destination
                // (which already has an 'End' marker)
                for (let i = 0; i < data.directions.length - 1; i++) {
                    const stepObj = data.directions[i];

                    // Get the location from our new data object
                    // Python sends (lon, lat), Leaflet needs [lat, lon]
                    const [lon, lat] = stepObj.location;

                    const marker = L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: 'step-label bg-danger text-white rounded-circle',
                            html: `<b>${i + 1}</b>`, // The instruction number
                            iconSize: [24, 24],
                        }),
                    }).addTo(map);
                    stepMarkers.push(marker);
                }

                updateDirectionsPanel(data.directions);

                const synth = window.speechSynthesis;
                data.directions.forEach(stepObj => // <-- Use stepObj.text
                    synth.speak(new SpeechSynthesisUtterance(stepObj.text))
                );

                clickCount = 0;
            })
            .catch(err => alert('Routing error: ' + err));
    }
});
