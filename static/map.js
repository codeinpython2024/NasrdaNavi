const map = L.map('map').setView([8.5, 7.5], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let startMarker, endMarker, routeLayer, stepMarkers = [];

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

    const url = `/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert("Error: " + data.error);
          return;
        }

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
        panel.innerHTML = `<b>Turn-by-Turn Directions</b><br><button id="clearRoute">Clear Route</button><br>`;
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

        // Live GPS tracking
        if (navigator.geolocation) {
          let currentStep = 0;
          const watchId = navigator.geolocation.watchPosition(
            pos => {
              const userLatLng = [pos.coords.latitude, pos.coords.longitude];
              const userMarker = L.circleMarker(userLatLng, { radius: 6, color: 'green' }).addTo(map);
              map.panTo(userLatLng);

              const [targetLon, targetLat] = coords[Math.min(currentStep + 1, coords.length - 1)];
              const distance = map.distance(userLatLng, [targetLat, targetLon]);

              if (distance < 30 && currentStep < data.directions.length - 1) {
                currentStep++;
                const utter = new SpeechSynthesisUtterance(`Next: ${data.directions[currentStep]}`);
                synth.speak(utter);
              }
            },
            err => console.error(err),
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
        }

        // Clear route button
        document.getElementById('clearRoute').addEventListener('click', () => {
          if (routeLayer) map.removeLayer(routeLayer);
          if (startMarker) map.removeLayer(startMarker);
          if (endMarker) map.removeLayer(endMarker);
          stepMarkers.forEach(m => map.removeLayer(m));
          stepMarkers = [];
          startPoint = endPoint = null;
          clickCount = 0;
          const panel = document.querySelector('.directions');
          panel.innerHTML = '<b>Turn-by-Turn Directions</b><br>Select two points on the map.';
        });
      })
      .catch(err => alert("Routing error: " + err));

    clickCount = 0;
  }
});




