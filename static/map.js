const map = L.map('map').setView([8.989747, 7.386362], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let startMarker, endMarker, routeLayer, stepMarkers = [], poiMarkers = [];
let gpsWatchId = null;
let startPoint = null;
let routingMode = 'set-start';

// Update UI to show current mode
function updateModeUI() {
  const panel = document.querySelector('.directions');
  if (!panel) return; // Safety check
  
  if (routingMode === 'set-start') {
    panel.innerHTML = `<b>Navigation</b><br>
      <button id="setStartBtn" style="background:#4CAF50;color:white;padding:8px;border:none;cursor:pointer;border-radius:3px;">Set Start Point</button>
      <button id="useLocationBtn" style="background:#2196F3;color:white;padding:8px;border:none;cursor:pointer;border-radius:3px;margin-left:5px;">Use My Location</button><br>
      <small>Click a button above, then click on the map</small>`;
  } else {
    panel.innerHTML = `<b>Navigation</b><br>
      <div style="background:#e8f5e9;padding:5px;border-radius:3px;margin-bottom:5px;">✓ Start point set</div>
      <button id="changeStartBtn" style="padding:5px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:3px;">Change Start</button><br>
      <small>Click a building or point on map for directions</small>`;
  }
}

// Directions panel - create first
const directionsPanel = L.control({ position: 'topright' });
directionsPanel.onAdd = function() {
  const div = L.DomUtil.create('div', 'directions');
  div.innerHTML = '<b>Navigation</b><br>Loading...';
  return div;
};
directionsPanel.addTo(map);

// Search functionality
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function() {
  const query = this.value.trim();
  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }

  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      if (data.results.length === 0) {
        searchResults.style.display = 'none';
        return;
      }

      searchResults.innerHTML = '';
      data.results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.innerHTML = `<strong>${result.name}</strong><br><small>${result.type}${result.department ? ' - ' + result.department : ''}</small>`;
        div.onclick = () => {
          const [lon, lat] = result.coordinates;
          map.setView([lat, lon], 17);
          
          poiMarkers.forEach(marker => {
            if (Math.abs(marker.getLatLng().lat - lat) < 0.0001 && 
                Math.abs(marker.getLatLng().lng - lon) < 0.0001) {
              marker.openPopup();
            }
          });
          
          searchResults.style.display = 'none';
          searchInput.value = result.name;
        };
        searchResults.appendChild(div);
      });
      searchResults.style.display = 'block';
    });
});

// Load roads
fetch('/static/roads.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: { color: 'blue', weight: 1 },
      onEachFeature: function (feature, layer) {
        const name = feature.properties?.name || "Campus Path";
        layer.bindTooltip(name, {
          permanent: false,
          direction: 'center',
          className: 'road-label'
        });
      }
    }).addTo(map);
  });

// Load buildings
fetch('/static/buildings.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, { style: { color: 'red', fillOpacity: 0.3 } }).addTo(map);
  });

// Global routing function - define before POI markers use it
window.routeToBuilding = function(lon, lat, name) {
  if (!startPoint) {
    alert('Please set a start point first');
    updateModeUI();
    return;
  }
  
  const endPoint = { lng: lon, lat: lat };
  if (endMarker) map.removeLayer(endMarker);
  endMarker = L.marker([lat, lon]).addTo(map).bindPopup(`End: ${name}`).openPopup();
  
  calculateRoute(startPoint, endPoint);
};

// Load and display POIs
fetch('/api/pois')
  .then(res => res.json())
  .then(data => {
    (data.buildings || []).forEach(building => {
      const [lon, lat] = building.coordinates;
      const [entLon, entLat] = building.entrance;
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: 'poi-marker',
          html: '🏢',
          iconSize: [30, 30]
        })
      }).addTo(map);
      
      const popupContent = `
        <strong>${building.name}</strong><br>
        ${building.department || ''}<br>
        <button onclick="routeToBuilding(${entLon}, ${entLat}, '${building.name.replace(/'/g, "\\'")}')" 
                style="margin-top:5px;padding:5px;background:#2196F3;color:white;border:none;cursor:pointer;border-radius:3px;">
          Get Directions
        </button>
      `;
      marker.bindPopup(popupContent);
      poiMarkers.push(marker);
    });

    (data.amenities || []).forEach(amenity => {
      const [lon, lat] = amenity.coordinates;
      const icon = amenity.type === 'parking' ? '🅿️' : amenity.type === 'restroom' ? '🚻' : '📍';
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: 'poi-marker',
          html: icon,
          iconSize: [30, 30]
        })
      }).addTo(map);
      
      const popupContent = `
        <strong>${amenity.name}</strong><br>
        <button onclick="routeToBuilding(${lon}, ${lat}, '${amenity.name.replace(/'/g, "\\'")}')" 
                style="margin-top:5px;padding:5px;background:#2196F3;color:white;border:none;cursor:pointer;border-radius:3px;">
          Get Directions
        </button>
      `;
      marker.bindPopup(popupContent);
      poiMarkers.push(marker);
    });
    
    updateModeUI();
  });

// Calculate and display route
function calculateRoute(start, end) {
  const accessible = document.getElementById('accessibleMode').checked;
  const url = `/route?start=${start.lng},${start.lat}&end=${end.lng},${end.lat}&accessible=${accessible}`;
  
  fetch(url)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => Promise.reject(err));
      }
      return res.json();
    })
    .then(data => {
      if (routeLayer) map.removeLayer(routeLayer);
      stepMarkers.forEach(m => map.removeLayer(m));
      stepMarkers = [];

      routeLayer = L.geoJSON(data.route, { style: { color: '#2196F3', weight: 4 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds());

      const panel = document.querySelector('.directions');
      const minutes = Math.floor(data.estimated_time_seconds / 60);
      const seconds = data.estimated_time_seconds % 60;
      panel.innerHTML = `<b>Directions</b><br>
        <div style="background:#e3f2fd;padding:5px;border-radius:3px;margin-bottom:5px;">
          Distance: ${data.total_distance_m}m | Time: ${minutes}m ${seconds}s
        </div>
        <button id="clearRoute" style="padding:5px;background:#f44336;color:white;border:none;cursor:pointer;border-radius:3px;">Clear Route</button>
        <button id="changeStartBtn" style="padding:5px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:3px;margin-left:5px;">Change Start</button><br><br>`;
      data.directions.forEach((step, i) => {
        panel.innerHTML += `<div style="margin-bottom:5px;"><strong>${i + 1}.</strong> ${step}</div>`;
      });

      const synth = window.speechSynthesis;
      data.directions.forEach(step => {
        const utter = new SpeechSynthesisUtterance(step);
        utter.rate = 1.0;
        synth.speak(utter);
      });

      setTimeout(() => {
        document.getElementById('clearRoute')?.addEventListener('click', clearRoute);
        document.getElementById('changeStartBtn')?.addEventListener('click', () => {
          routingMode = 'set-start';
          clearRoute();
        });
      }, 100);

      startGPSTracking(data);
    })
    .catch(err => {
      alert("Routing error: " + (err.error || err.message || err));
    });
}

// Clear route
function clearRoute() {
  if (routeLayer) map.removeLayer(routeLayer);
  if (endMarker) map.removeLayer(endMarker);
  stepMarkers.forEach(m => map.removeLayer(m));
  stepMarkers = [];
  
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  
  updateModeUI();
}

// Set start point
function setStartPoint(latlng) {
  startPoint = latlng;
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(startPoint, {
    icon: L.divIcon({
      className: 'start-marker',
      html: '📍',
      iconSize: [30, 30]
    })
  }).addTo(map).bindPopup("Start Point").openPopup();
  
  routingMode = 'ready';
  updateModeUI();
}

// Use current location
function useMyLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStartPoint(latlng);
        map.setView([latlng.lat, latlng.lng], 17);
      },
      err => alert('Could not get your location: ' + err.message)
    );
  } else {
    alert('Geolocation is not supported by your browser');
  }
}

// Map click handler
map.on('click', function(e) {
  if (routingMode === 'set-start') {
    setStartPoint(e.latlng);
  } else {
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker(e.latlng).addTo(map).bindPopup("Destination").openPopup();
    calculateRoute(startPoint, e.latlng);
  }
});

// Button handlers
document.addEventListener('click', function(e) {
  if (e.target.id === 'setStartBtn') {
    routingMode = 'set-start';
    updateModeUI();
  } else if (e.target.id === 'changeStartBtn') {
    routingMode = 'set-start';
    clearRoute();
  } else if (e.target.id === 'useLocationBtn') {
    useMyLocation();
  }
});

// GPS tracking
function startGPSTracking(data) {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  if (navigator.geolocation) {
    let currentStep = 0;
    let userMarker = null;
    const coords = data.route.geometry.coordinates;
    
    gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker(userLatLng, { 
          radius: 8, 
          color: 'green', 
          fillColor: 'green', 
          fillOpacity: 0.8 
        }).addTo(map);
        map.panTo(userLatLng);

        const [targetLon, targetLat] = coords[Math.min(currentStep + 1, coords.length - 1)];
        const distance = map.distance(userLatLng, [targetLat, targetLon]);

        if (distance < 20 && currentStep < data.directions.length - 1) {
          currentStep++;
          const synth = window.speechSynthesis;
          const utter = new SpeechSynthesisUtterance(`Next: ${data.directions[currentStep]}`);
          synth.speak(utter);
        }
      },
      err => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }
}
