import { CONFIG } from '../../config.js';
import { mapManager } from '../map/index.js';

class NavigationManager {
    constructor() {
        this.startMarker = null;
        this.endMarker = null;
        this.stepMarkers = [];
        this.startPoint = null;
        this.endPoint = null;
        this.clickCount = 0;
        this.onDirectionsUpdate = null;
    }

    handleMapClick(e) {
        if (this.clickCount === 0) {
            this.setStart(e.latlng);
            this.clickCount = 1;
        } else {
            this.setEnd(e.latlng);
            this.calculateRoute();
        }
    }

    setStart(latlng) {
        this.startPoint = latlng;
        if (this.startMarker) this.startMarker.remove();
        this.startMarker = new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat([latlng.lng, latlng.lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(mapManager.map)
            .togglePopup();
    }

    setEnd(latlng) {
        this.endPoint = latlng;
        if (this.endMarker) this.endMarker.remove();
        this.endMarker = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([latlng.lng, latlng.lat])
            .setPopup(new mapboxgl.Popup().setText('End'))
            .addTo(mapManager.map)
            .togglePopup();
    }

    async calculateRoute() {
        const url = `${CONFIG.api.route}?start=${this.startPoint.lng},${this.startPoint.lat}&end=${this.endPoint.lng},${this.endPoint.lat}`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            this.displayRoute(data);
            this.clickCount = 0;
        } catch (err) {
            alert('Routing error: ' + err);
        }
    }

    displayRoute(data) {
        // Remove existing route layer
        if (mapManager.map.getLayer('route-line')) {
            mapManager.map.removeLayer('route-line');
            mapManager.map.removeSource('route');
        }

        // Remove step markers
        this.stepMarkers.forEach(m => m.remove());
        this.stepMarkers = [];

        // Add route layer
        mapManager.map.addSource('route', { type: 'geojson', data: data.route });
        mapManager.map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: { 'line-color': CONFIG.colors.route, 'line-width': 4 }
        });

        // Fit to route
        const coords = data.route.geometry.coordinates;
        const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
        mapManager.fitBounds(bounds);

        // Add step markers (except last)
        for (let i = 0; i < data.directions.length - 1; i++) {
            const [lon, lat] = data.directions[i].location;
            const el = document.createElement('div');
            el.className = 'step-marker';
            el.innerHTML = `<b>${i + 1}</b>`;
            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([lon, lat])
                .addTo(mapManager.map);
            this.stepMarkers.push(marker);
        }

        if (this.onDirectionsUpdate) {
            this.onDirectionsUpdate(data.directions);
        }

        // Voice navigation
        data.directions.forEach(step => {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(step.text));
        });
    }

    clear() {
        if (mapManager.map.getLayer('route-line')) {
            mapManager.map.removeLayer('route-line');
            mapManager.map.removeSource('route');
        }
        if (this.startMarker) this.startMarker.remove();
        if (this.endMarker) this.endMarker.remove();
        this.stepMarkers.forEach(m => m.remove());

        this.startMarker = null;
        this.endMarker = null;
        this.stepMarkers = [];
        this.startPoint = null;
        this.endPoint = null;
        this.clickCount = 0;

        window.speechSynthesis.cancel();

        if (this.onDirectionsUpdate) {
            this.onDirectionsUpdate(null);
        }
    }
}

export const navigationManager = new NavigationManager();
