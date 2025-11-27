import { CONFIG } from '../../config.js';

class MapManager {
    constructor() {
        this.map = null;
    }

    init(elementId, accessToken) {
        mapboxgl.accessToken = accessToken;
        this.map = new mapboxgl.Map({
            container: elementId,
            style: CONFIG.map.style,
            center: CONFIG.map.defaultCenter,
            zoom: CONFIG.map.defaultZoom,
            config: {
                basemap: {
                    lightPreset: CONFIG.map.lightPreset,
                    theme: CONFIG.map.theme
                }
            }
        });

        this.addCustomControls();
        return this;
    }

    addCustomControls() {
        // Create custom control container
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'map-controls';
        controlsContainer.innerHTML = `
            <button class="map-control-btn" id="btnZoomIn" title="Zoom in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
            <button class="map-control-btn" id="btnZoomOut" title="Zoom out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
            <div class="map-control-divider"></div>
            <button class="map-control-btn" id="btnCompass" title="Reset bearing">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12,2 19,21 12,17 5,21"></polygon>
                </svg>
            </button>
            <button class="map-control-btn" id="btnPitch" title="Toggle 3D view">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3L2 12h3v8h14v-8h3L12 3z"></path>
                </svg>
            </button>
            <div class="map-control-divider"></div>
            <button class="map-control-btn" id="btnBuildings" title="Toggle buildings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"></path>
                </svg>
            </button>
            <button class="map-control-btn" id="btnRoads" title="Toggle roads">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19L20 5M4 5l16 14"></path>
                </svg>
            </button>
            <div class="map-control-divider"></div>
            <button class="map-control-btn" id="btnLocate" title="My location">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
                </svg>
            </button>
            <button class="map-control-btn" id="btnFitBounds" title="Fit to campus">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                </svg>
            </button>
        `;

        document.getElementById('map').appendChild(controlsContainer);

        // Bind events after map loads
        this.map.on('load', () => this.bindControlEvents());
    }

    bindControlEvents() {
        let buildingsVisible = false;
        let roadsVisible = false;

        document.getElementById('btnBuildings')?.addEventListener('click', (e) => {
            buildingsVisible = !buildingsVisible;
            this.toggleLayer('buildings', buildingsVisible);
            e.currentTarget.classList.toggle('active', buildingsVisible);
        });

        document.getElementById('btnRoads')?.addEventListener('click', (e) => {
            roadsVisible = !roadsVisible;
            this.toggleLayer('roads', roadsVisible);
            e.currentTarget.classList.toggle('active', roadsVisible);
        });

        document.getElementById('btnZoomIn')?.addEventListener('click', () => {
            this.map.zoomIn({ duration: 300 });
        });

        document.getElementById('btnZoomOut')?.addEventListener('click', () => {
            this.map.zoomOut({ duration: 300 });
        });

        document.getElementById('btnCompass')?.addEventListener('click', () => {
            this.map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
        });

        document.getElementById('btnPitch')?.addEventListener('click', () => {
            const currentPitch = this.map.getPitch();
            this.map.easeTo({ pitch: currentPitch > 0 ? 0 : 60, duration: 500 });
        });

        document.getElementById('btnLocate')?.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        this.map.flyTo({
                            center: [pos.coords.longitude, pos.coords.latitude],
                            zoom: 17,
                            duration: 1500
                        });
                    },
                    () => alert('Could not get your location')
                );
            }
        });

        document.getElementById('btnFitBounds')?.addEventListener('click', () => {
            const source = this.map.getSource('roads');
            if (source) {
                const bounds = new mapboxgl.LngLatBounds();
                source._data.features.forEach(f => {
                    if (f.geometry.type === 'LineString') {
                        f.geometry.coordinates.forEach(c => bounds.extend(c));
                    } else if (f.geometry.type === 'MultiLineString') {
                        f.geometry.coordinates.forEach(line => line.forEach(c => bounds.extend(c)));
                    }
                });
                this.map.fitBounds(bounds, { padding: 50, duration: 1000 });
            }
        });

        // Update compass rotation
        this.map.on('rotate', () => {
            const compass = document.querySelector('#btnCompass svg');
            if (compass) {
                compass.style.transform = `rotate(${-this.map.getBearing()}deg)`;
            }
        });
    }

    async loadLayers() {
        const [roads, buildings] = await Promise.all([
            fetch(CONFIG.api.roads).then(r => r.json()),
            fetch(CONFIG.api.buildings).then(r => r.json())
        ]);

        await new Promise(resolve => {
            if (this.map.loaded()) resolve();
            else this.map.on('load', resolve);
        });

        // Add buildings layer (hidden initially)
        this.map.addSource('buildings', { type: 'geojson', data: buildings });
        this.map.addLayer({
            id: 'buildings-fill',
            type: 'fill',
            source: 'buildings',
            paint: { 'fill-color': CONFIG.colors.building, 'fill-opacity': 0.7 },
            layout: { 'visibility': 'none' }
        });
        this.map.addLayer({
            id: 'buildings-outline',
            type: 'line',
            source: 'buildings',
            paint: { 'line-color': CONFIG.colors.buildingOutline, 'line-width': 1.5 },
            layout: { 'visibility': 'none' }
        });

        // Add roads layer (hidden initially)
        this.map.addSource('roads', { type: 'geojson', data: roads });
        this.map.addLayer({
            id: 'roads-line',
            type: 'line',
            source: 'roads',
            paint: { 'line-color': CONFIG.colors.road, 'line-width': 2 },
            layout: { 'visibility': 'none' }
        });

        // Add road labels (hidden initially)
        this.map.addLayer({
            id: 'roads-label',
            type: 'symbol',
            source: 'roads',
            layout: {
                'visibility': 'none',
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-size': 11,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
            },
            paint: { 'text-color': '#E8F0F8', 'text-halo-color': '#0A1628', 'text-halo-width': 1.5 }
        });

        // Fit bounds to data
        const bounds = new mapboxgl.LngLatBounds();
        roads.features.forEach(f => {
            if (f.geometry.type === 'LineString') {
                f.geometry.coordinates.forEach(c => bounds.extend(c));
            } else if (f.geometry.type === 'MultiLineString') {
                f.geometry.coordinates.forEach(line => line.forEach(c => bounds.extend(c)));
            }
        });
        this.map.fitBounds(bounds, { padding: 50 });

        return { roads, buildings };
    }

    onClick(callback) {
        this.map.on('click', e => callback({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } }));
    }

    fitBounds(bounds) {
        this.map.fitBounds(bounds, { padding: 50 });
    }

    setCenter(lngLat, zoom = 17) {
        this.map.flyTo({ center: lngLat, zoom });
    }

    toggleLayer(type, visible) {
        const visibility = visible ? 'visible' : 'none';
        if (type === 'buildings') {
            this.map.setLayoutProperty('buildings-fill', 'visibility', visibility);
            this.map.setLayoutProperty('buildings-outline', 'visibility', visibility);
        } else if (type === 'roads') {
            this.map.setLayoutProperty('roads-line', 'visibility', visibility);
            this.map.setLayoutProperty('roads-label', 'visibility', visibility);
        }
    }
}

export const mapManager = new MapManager();
