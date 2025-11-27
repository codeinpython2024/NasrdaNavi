import { CONFIG } from '../../config.js';
import { mapManager } from '../map/index.js';
import { voiceAssistant } from '../voice/index.js';

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
            voiceAssistant.announceStart();
        } else {
            this.setEnd(e.latlng);
            voiceAssistant.announceCalculating();
            this.calculateRoute();
        }
    }

    setStart(latlng) {
        this.startPoint = latlng;
        if (this.startMarker) this.startMarker.remove();
        this.startMarker = new mapboxgl.Marker({ color: CONFIG.colors.markerStart })
            .setLngLat([latlng.lng, latlng.lat])
            .setPopup(new mapboxgl.Popup().setText('Start'))
            .addTo(mapManager.map)
            .togglePopup();
    }

    setEnd(latlng) {
        this.endPoint = latlng;
        if (this.endMarker) this.endMarker.remove();
        this.endMarker = new mapboxgl.Marker({ color: CONFIG.colors.markerEnd })
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
                voiceAssistant.announceError(data.error);
                return;
            }

            this.displayRoute(data);
            this.clickCount = 0;
        } catch (err) {
            voiceAssistant.announceError('Could not calculate route. Please try again.');
        }
    }

    displayRoute(data) {
        // Remove existing route layers
        if (mapManager.map.getLayer('route-glow')) {
            mapManager.map.removeLayer('route-glow');
        }
        if (mapManager.map.getLayer('route-line')) {
            mapManager.map.removeLayer('route-line');
            mapManager.map.removeSource('route');
        }

        // Remove step markers
        this.stepMarkers.forEach(m => m.remove());
        this.stepMarkers = [];

        // Add route source
        mapManager.map.addSource('route', { type: 'geojson', data: data.route });

        // Add glow layer
        mapManager.map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            paint: {
                'line-color': CONFIG.colors.routeGlow,
                'line-width': 12,
                'line-blur': 4
            }
        });

        // Add main route layer
        mapManager.map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
                'line-color': CONFIG.colors.route,
                'line-width': 4
            }
        });

        // Fly to start point with camera facing route direction
        const coords = data.route.geometry.coordinates;
        const start = coords[0];
        const next = coords[Math.min(5, coords.length - 1)];
        const bearing = Math.atan2(next[0] - start[0], next[1] - start[1]) * (180 / Math.PI);
        
        mapManager.map.flyTo({
            center: start,
            zoom: 18,
            pitch: 60,
            bearing: bearing,
            duration: 2000
        });

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

        // Voice navigation with enhanced assistant
        voiceAssistant.speakDirections(data.directions);
    }

    clear() {
        if (mapManager.map.getLayer('route-glow')) {
            mapManager.map.removeLayer('route-glow');
        }
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

        voiceAssistant.announceCleared();

        if (this.onDirectionsUpdate) {
            this.onDirectionsUpdate(null);
        }
    }
}

export const navigationManager = new NavigationManager();
