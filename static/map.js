// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const map = L.map('map').setView([8.989747, 7.386362], 17);

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
let isNavigationMode = false;
let autoRecenter = true;

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
let buildingsLayer;
let buildingData = {};

fetch('/api/pois')
  .then(res => res.json())
  .then(data => {
    // Create lookup by building ID
    (data.buildings || []).forEach(building => {
      buildingData[building.id] = building;
    });

    // Load buildings and bind popups
    return fetch('/static/buildings.geojson');
  })
  .then(res => res.json())
  .then(data => {
    buildingsLayer = L.geoJSON(data, {
      style: { color: 'red', fillOpacity: 0.3, weight: 2 },
      onEachFeature: function (feature, layer) {
        const buildingId = feature.id;
        // Convert numeric ID to string format (e.g., 1 -> "building-1")
        const buildingKey = `building-${buildingId}`;
        const building = buildingData[buildingKey];

        if (building) {
          const [entLon, entLat] = building.entrance;
          const popupContent = `
            <strong>${building.name}</strong><br>
            ${building.department || ''}<br>
            <button onclick="routeToBuilding(${entLon}, ${entLat}, '${building.name.replace(/'/g, "\\'")}')" 
                    style="margin-top:5px;padding:5px;background:#2196F3;color:white;border:none;cursor:pointer;border-radius:3px;">
              Get Directions
            </button>
          `;
          layer.bindPopup(popupContent);

          // Prevent building clicks from triggering map click
          layer.on('click', function (e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            // Open popup manually
            layer.openPopup();
            return false;
          });
        }
      }
    }).addTo(map);

    // Load amenities
    return fetch('/api/pois');
  })
  .then(res => res.json())
  .then(data => {
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

// Global routing function
window.routeToBuilding = function (lon, lat, name) {
  if (!startPoint) {
    showToast('Please set a start point first', 'error');
    updateModeUI();
    return;
  }

  const endPoint = { lng: lon, lat: lat };
  if (endMarker) map.removeLayer(endMarker);
  endMarker = L.marker([lat, lon]).addTo(map).bindPopup(`End: ${name}`).openPopup();

  calculateRoute(startPoint, endPoint);
};

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

// Enter navigation mode
function enterNavigationMode() {
  isNavigationMode = true;
  autoRecenter = true;

  // Hide search box
  const searchBox = document.querySelector('.search-box');
  if (searchBox) searchBox.classList.add('dimmed');

  // Dim controls
  const controls = document.querySelector('.controls');
  if (controls) controls.classList.add('dimmed');

  // Dim building polygons and POI markers
  if (buildingsLayer) buildingsLayer.setStyle({ fillOpacity: 0.1, opacity: 0.3 });
  poiMarkers.forEach(m => m.setOpacity(0.3));

  // Expand directions panel
  const panel = document.querySelector('.directions');
  if (panel) panel.classList.add('nav-mode');

  // Show navigation bar
  const navBar = document.getElementById('nav-bar');
  if (navBar) navBar.style.display = 'block';
}

// Exit navigation mode
window.exitNavigationMode = function () {
  isNavigationMode = false;
  autoRecenter = true;

  // Show search box
  const searchBox = document.querySelector('.search-box');
  if (searchBox) searchBox.classList.remove('dimmed');

  // Show controls
  const controls = document.querySelector('.controls');
  if (controls) controls.classList.remove('dimmed');

  // Restore building polygons and POI markers
  if (buildingsLayer) buildingsLayer.setStyle({ fillOpacity: 0.3, opacity: 1 });
  poiMarkers.forEach(m => m.setOpacity(1));

  // Restore directions panel
  const panel = document.querySelector('.directions');
  if (panel) panel.classList.remove('nav-mode');

  // Hide navigation bar
  const navBar = document.getElementById('nav-bar');
  if (navBar) navBar.style.display = 'none';

  // Clear the route
  clearRoute();
};

// Recenter map on user location
window.recenterMap = function () {
  autoRecenter = true;
  if (userMarker) {
    map.setView(userMarker.getLatLng(), 18);
  }
};

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

      routeLayer = L.geoJSON(data.route, { style: { color: '#2196F3', weight: 6 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds());

      // Enter navigation mode
      enterNavigationMode();

      displayDirections(data);
      updateNavigationBar(data);

      // Speak only the first instruction
      if (data.directions && data.directions.length > 0) {
        speakInstruction(data.directions[0], true);
      }

      startGPSTracking(data);
    })
    .catch(err => {
      showToast("Routing error: " + (err.error || err.message || err), 'error');
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
    <button onclick="changeStartPoint(event)" style="padding:5px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:3px;margin-left:5px;">Change Start</button><br><br>`;

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

  // Update navigation bar
  updateNavigationBar(routeData);
}

// Update navigation bar with current instruction
function updateNavigationBar(data) {
  if (!isNavigationMode || !data) return;

  const currentInstEl = document.getElementById('current-instruction');
  const distanceEl = document.getElementById('distance-to-turn');

  if (currentInstEl && data.directions && data.directions[currentInstructionIndex]) {
    currentInstEl.textContent = data.directions[currentInstructionIndex];
  }

  if (distanceEl && userMarker) {
    const distToNext = distanceToNextInstruction(userMarker.getLatLng(), currentInstructionIndex + 1);
    if (distToNext < Infinity && currentInstructionIndex + 1 < data.directions.length) {
      distanceEl.textContent = `Next turn in ${Math.round(distToNext)}m`;
    } else {
      const coords = data.route.geometry.coordinates;
      if (coords && coords.length > 0) {
        const [destLon, destLat] = coords[coords.length - 1];
        const distToDestination = map.distance(userMarker.getLatLng(), [destLat, destLon]);
        distanceEl.textContent = `${Math.round(distToDestination)}m to destination`;
      }
    }
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
  if (startMarker) map.removeLayer(startMarker);
  stepMarkers.forEach(m => map.removeLayer(m));
  stepMarkers = [];
  
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  startPoint = null;
  routingMode = 'set-start';
  routeData = null;
  currentInstructionIndex = 0;
  isOffRoute = false;
  lastSpokenInstruction = null;
  advanceWarningGiven = false;
  distanceTraveled = 0;

  // Exit navigation mode if active
  if (isNavigationMode) {
    exitNavigationMode();
  }

  updateModeUI();
};

// Change start point helper
window.changeStartPoint = function (event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (startMarker) map.removeLayer(startMarker);
  startPoint = null;
  routingMode = 'set-start';
  clearRoute(event);
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
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  showToast('Getting your location...', 'info');

  const geoOptions = {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 30000
  };

  navigator.geolocation.getCurrentPosition(
    pos => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setStartPoint(latlng);
      map.setView([latlng.lat, latlng.lng], 17);
      showToast('Location set successfully', 'success');
    },
    err => {
      let errorMsg = 'Could not get your location: ';
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMsg += 'Permission denied. Please enable location access in your browser settings.';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMsg += 'Position unavailable. Please check your device settings.';
          break;
        case err.TIMEOUT:
          errorMsg += 'Request timed out. Please try again.';
          break;
        default:
          errorMsg += err.message;
      }
      showToast(errorMsg, 'error');
    },
    geoOptions
  );
}

// Map click handler
map.on('click', function(e) {
  // Don't handle map clicks if we clicked on a building polygon
  if (e.originalEvent && e.originalEvent.target) {
    const target = e.originalEvent.target;
    // Check if clicked element is a building (has red stroke)
    if (target.tagName === 'path' && target.getAttribute('stroke') === 'red') {
      return; // Let the building layer handle it
    }
  }

  if (routingMode === 'set-start') {
    setStartPoint(e.latlng);
  } else if (routingMode === 'ready') {
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

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  // More lenient geolocation options to prevent timeout errors
  const geoOptions = {
    enableHighAccuracy: true,
    maximumAge: 10000,  // Allow cached positions up to 10 seconds old
    timeout: 30000      // Increase timeout to 30 seconds
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
      updateProgress();
      updateNavigationBar(data);

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
          setTimeout(() => {
            exitNavigationMode();
          }, 3000);
        }
      }
    },
    err => {
      // Better error handling with user-friendly messages
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
      showToast(errorMsg, 'warning');
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
