const map = L.map('map').setView([8.989747, 7.386362], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let startMarker, endMarker, routeLayer, stepMarkers = [], poiMarkers = [];
let gpsWatchId = null;
let startPoint = null;
let routingMode = 'set-start';
let currentInstructionIndex = 0;
let routeData = null;
let userMarker = null;
let isOffRoute = false;
let lastSpokenInstruction = null;
let advanceWarningGiven = false;
let distanceTraveled = 0;

// Update UI to show current mode
function updateModeUI() {
  const panel = document.querySelector('.directions');
  if (!panel) return;
  
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

// Directions panel
const directionsPanel = L.control({ position: 'topright' });
directionsPanel.onAdd = function() {
  const div = L.DomUtil.create('div', 'directions');
  div.innerHTML = '<b>Navigation</b><br>Loading...';
  L.DomEvent.disableClickPropagation(div);
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

// Global routing function
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

// Speak instruction with debouncing
function speakInstruction(text, force = false) {
  if (!window.speechSynthesis) return;

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

      routeData = data;
      currentInstructionIndex = 0;
      isOffRoute = false;
      lastSpokenInstruction = null;
      advanceWarningGiven = false;
      distanceTraveled = 0;

      routeLayer = L.geoJSON(data.route, { style: { color: '#2196F3', weight: 4 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds());

      displayDirections(data);

      // Speak only the first instruction
      if (data.directions && data.directions.length > 0) {
        speakInstruction(data.directions[0], true);
      }

      startGPSTracking(data);
    })
    .catch(err => {
      alert("Routing error: " + (err.error || err.message || err));
    });
}

// Display directions in panel
function displayDirections(data) {
  const panel = document.querySelector('.directions');
  const minutes = Math.floor(data.estimated_time_seconds / 60);
  const seconds = data.estimated_time_seconds % 60;
  const remainingDist = data.total_distance_m - distanceTraveled;
  const remainingTime = Math.max(0, Math.floor((remainingDist / 1.4)));

  panel.innerHTML = `<b>Directions</b><br>
    <div style="background:#e3f2fd;padding:5px;border-radius:3px;margin-bottom:5px;">
      <div style="margin-bottom:3px;">
        <strong>Total:</strong> ${data.total_distance_m}m | ${minutes}m ${seconds}s
      </div>
      <div id="progress-info" style="font-size:0.9em;color:#666;">
        <strong>Remaining:</strong> ${Math.round(remainingDist)}m | ${Math.floor(remainingTime / 60)}m ${remainingTime % 60}s
      </div>
      <div style="background:#ddd;height:4px;border-radius:2px;margin-top:5px;overflow:hidden;">
        <div id="progress-bar" style="background:#4CAF50;height:100%;width:${(distanceTraveled / data.total_distance_m * 100).toFixed(1)}%;transition:width 0.3s;"></div>
      </div>
    </div>
    <button onclick="clearRoute(event)" style="padding:5px;background:#f44336;color:white;border:none;cursor:pointer;border-radius:3px;">Clear Route</button>
    <button onclick="changeStartPoint()" style="padding:5px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:3px;margin-left:5px;">Change Start</button><br><br>`;

  if (data.directions && Array.isArray(data.directions)) {
    data.directions.forEach((step, i) => {
      const isActive = i === currentInstructionIndex;
      const bgColor = isActive ? '#fff3cd' : 'transparent';
      const fontWeight = isActive ? 'bold' : 'normal';
      panel.innerHTML += `<div id="instruction-${i}" style="margin-bottom:5px;padding:3px;background:${bgColor};border-radius:3px;font-weight:${fontWeight};">
        <strong>${i + 1}.</strong> ${step}
      </div>`;
    });
  }
}

// Update progress display
function updateProgress() {
  if (!routeData) return;

  const remainingDist = routeData.total_distance_m - distanceTraveled;
  const remainingTime = Math.max(0, Math.floor((remainingDist / 1.4)));
  const progressPercent = (distanceTraveled / routeData.total_distance_m * 100).toFixed(1);

  const progressInfo = document.getElementById('progress-info');
  const progressBar = document.getElementById('progress-bar');

  if (progressInfo) {
    progressInfo.innerHTML = `<strong>Remaining:</strong> ${Math.round(remainingDist)}m | ${Math.floor(remainingTime / 60)}m ${remainingTime % 60}s`;
  }

  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }
}

// Update active instruction highlight
function updateActiveInstruction(index) {
  if (!routeData) return;

  // Remove previous highlight
  const prevEl = document.getElementById(`instruction-${currentInstructionIndex}`);
  if (prevEl) {
    prevEl.style.background = 'transparent';
    prevEl.style.fontWeight = 'normal';
  }

  // Add new highlight
  currentInstructionIndex = index;
  const newEl = document.getElementById(`instruction-${index}`);
  if (newEl) {
    newEl.style.background = '#fff3cd';
    newEl.style.fontWeight = 'bold';
    newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Clear route
window.clearRoute = function (event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  if (routeLayer) map.removeLayer(routeLayer);
  if (endMarker) map.removeLayer(endMarker);
  if (userMarker) map.removeLayer(userMarker);
  stepMarkers.forEach(m => map.removeLayer(m));
  stepMarkers = [];
  
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  routeData = null;
  currentInstructionIndex = 0;
  isOffRoute = false;
  lastSpokenInstruction = null;
  advanceWarningGiven = false;
  distanceTraveled = 0;

  updateModeUI();
};

// Change start point helper
window.changeStartPoint = function () {
  routingMode = 'set-start';
  clearRoute();
};

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
  } else if (e.target.id === 'useLocationBtn') {
    useMyLocation();
  }
});

// Calculate distance to next instruction point
function distanceToNextInstruction(userLatLng, instructionIndex) {
  if (!routeData || !routeData.instruction_coords || instructionIndex >= routeData.instruction_coords.length) {
    return Infinity;
  }

  const coordIndex = routeData.instruction_coords[instructionIndex];
  const coords = routeData.route.geometry.coordinates;

  if (!coords || coordIndex >= coords.length) return Infinity;

  const [targetLon, targetLat] = coords[coordIndex];
  return map.distance(userLatLng, [targetLat, targetLon]);
}

// Calculate distance traveled along route
function calculateDistanceTraveled(userLatLng) {
  if (!routeData) return 0;

  const coords = routeData.route.geometry.coordinates;
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
  if (!routeData) return false;

  const coords = routeData.route.geometry.coordinates;
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

  if (navigator.geolocation) {
    gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        
        // Update user marker
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker(userLatLng, { 
          radius: 8, 
          color: 'green', 
          fillColor: 'green', 
          fillOpacity: 0.8 
        }).addTo(map);
        map.panTo(userLatLng);

        // Update distance traveled and progress
        distanceTraveled = calculateDistanceTraveled(userLatLng);
        updateProgress();

        // Check if off route
        if (checkOffRoute(userLatLng)) {
          if (!isOffRoute) {
            isOffRoute = true;
            speakInstruction("You are off route. Recalculating...", true);
            // Could trigger re-routing here
          }
          return;
        } else {
          if (isOffRoute) {
            // Just got back on route
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
            speakInstruction(`In 50 meters, ${nextInstruction}`, true);
            advanceWarningGiven = true;
          }
        }

        // Move to next instruction when close enough (20m)
        if (distToNext < 20 && currentInstructionIndex + 1 < data.directions.length) {
          currentInstructionIndex++;
          advanceWarningGiven = false; // Reset for next instruction
          updateActiveInstruction(currentInstructionIndex);
          speakInstruction(data.directions[currentInstructionIndex], true);
        }

        // Check if arrived at destination
        const coords = data.route.geometry.coordinates;
        if (coords && coords.length > 0) {
          const [destLon, destLat] = coords[coords.length - 1];
          const distToDestination = map.distance(userLatLng, [destLat, destLon]);

          if (distToDestination < 10 && currentInstructionIndex === data.directions.length - 1) {
            speakInstruction("You have arrived at your destination.", true);
            setTimeout(clearRoute, 3000);
          }
        }
      },
      err => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }
}
