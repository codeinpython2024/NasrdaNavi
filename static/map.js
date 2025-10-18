const map = L.map('map').setView([8.989747, 7.386362], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let startMarker, endMarker, routeLayer, stepMarkers = [], poiMarkers = [];
let gpsWatchId = null;

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
          L.marker([lat, lon]).addTo(map).bindPopup(result.name).openPopup();
          searchResults.style.display = 'none';
          searchInput.value = result.name;
        };
        searchResults.appendChild(div);
      });
      searchResults.style.display = 'block';
    });
});

// Load and display POIs
fetch('/api/pois')
  .then(res => res.json())
  .then(data => {
    // Add building markers
    (data.buildings || []).forEach(building => {
      const [lon, lat] = building.coordinates;
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: 'poi-marker',
          html: '🏢',
          iconSize: [30, 30]
        })
      }).addTo(map);
      marker.bindPopup(`<strong>${building.name}</strong><br>${building.department}<br><small>${building.hours}</small>`);
      poiMarkers.push(marker);
    });

    // Add amenity markers
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
      marker.bindPopup(`<strong>${amenity.name}</strong>`);
      poiMarkers.push(marker);
    });
  });

// Directions panel
const directionsPanel = L.control({ position: 'topright' });
directionsPanel.onAdd = function() {
  const div = L.DomUtil.create('div', 'directions');
  div.innerHTML = `
    <b>Turn-by-Turn Directions</b><br>
    <button id="clearRoute" style="margin-top:5px;">Clear Route</button><br>
    Select two points on the map.
  `;
  return div;
};
directionsPanel.addTo(map);

let clickCount = 0;
let startPoint, endPoint;

// Load roads with labels
fetch('/static/roads.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: { color: 'blue', weight: 1 },
      onEachFeature: function (feature, layer) {
        const name = feature.properties?.name || "Unnamed Road";
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
    L.geoJSON(data, { style: { color: 'red', fillOpacity: 1.0 } }).addTo(map);
  });

// Handle map clicks
map.on('click', function(e) {
  clickCount++;

  if (clickCount === 1) {
    startPoint = e.latlng;
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
  } else if (clickCount === 2) {
    endPoint = e.latlng;
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker(endPoint).addTo(map).bindPopup("End").openPopup();

    const accessible = document.getElementById('accessibleMode').checked;
    const url = `/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}&accessible=${accessible}`;
    fetch(url)
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => Promise.reject(err));
        }
        return res.json();
      })
      .then(data => {

        // Clear previous route and markers
        if (routeLayer) map.removeLayer(routeLayer);
        stepMarkers.forEach(m => map.removeLayer(m));
        stepMarkers = [];

        // Draw new route
        routeLayer = L.geoJSON(data.route, { style: { color: 'red', weight: 3 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds());

        // Show step numbers on map
        const coords = data.route.geometry.coordinates;
        const stepCount = Math.min(coords.length, data.directions.length);
        for (let i = 0; i < stepCount; i++) {
          const [lon, lat] = coords[i];
          const marker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: 'step-label',
              html: `<b>${i + 1}</b>`,
              iconSize: [20, 20]
            })
          }).addTo(map);
          stepMarkers.push(marker);
        }

        // Display directions
        const panel = document.querySelector('.directions');
        const minutes = Math.floor(data.estimated_time_seconds / 60);
        const seconds = data.estimated_time_seconds % 60;
        panel.innerHTML = `<b>Turn-by-Turn Directions</b><br>
          Distance: ${data.total_distance_m}m | Time: ${minutes}m ${seconds}s<br>
          <button id="clearRoute">Clear Route</button><br>`;
        data.directions.forEach((step, i) => {
          panel.innerHTML += `${i + 1}. ${step}<br>`;
        });

        // Voice output
        const synth = window.speechSynthesis;
        data.directions.forEach((step, i) => {
          const utter = new SpeechSynthesisUtterance(step);
          utter.rate = 1.0;
          synth.speak(utter);
        });

        // Clear previous GPS watcher
        if (gpsWatchId !== null) {
          navigator.geolocation.clearWatch(gpsWatchId);
          gpsWatchId = null;
        }

        // Live GPS tracking
        if (navigator.geolocation) {
          let currentStep = 0;
          let userMarker = null;
          
          gpsWatchId = navigator.geolocation.watchPosition(
            pos => {
              const userLatLng = [pos.coords.latitude, pos.coords.longitude];
              
              // Remove old marker before adding new one
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
                const utter = new SpeechSynthesisUtterance(`Next: ${data.directions[currentStep]}`);
                synth.speak(utter);
              }
            },
            err => console.error('GPS error:', err),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
          );
        }

        // Clear route button
        document.getElementById('clearRoute').addEventListener('click', () => {
          if (routeLayer) map.removeLayer(routeLayer);
          if (startMarker) map.removeLayer(startMarker);
          if (endMarker) map.removeLayer(endMarker);
          stepMarkers.forEach(m => map.removeLayer(m));
          stepMarkers = [];
          
          if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
          }
          
          startPoint = endPoint = null;
          clickCount = 0;
          const panel = document.querySelector('.directions');
          panel.innerHTML = '<b>Turn-by-Turn Directions</b><br>Select two points on the map.';
        });
      })
      .catch(err => {
        alert("Routing error: " + (err.error || err.message || err));
        clickCount = 0;
      });

    clickCount = 0;
  }
});




