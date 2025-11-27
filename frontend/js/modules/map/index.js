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
        this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        return this;
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

        // Add buildings layer
        this.map.addSource('buildings', { type: 'geojson', data: buildings });
        this.map.addLayer({
            id: 'buildings-fill',
            type: 'fill',
            source: 'buildings',
            paint: {
                'fill-color': CONFIG.colors.building,
                'fill-opacity': 0.7
            }
        });
        this.map.addLayer({
            id: 'buildings-outline',
            type: 'line',
            source: 'buildings',
            paint: {
                'line-color': CONFIG.colors.buildingOutline,
                'line-width': 1.5,
                'line-opacity': 0.9
            }
        });

        // Add roads layer
        this.map.addSource('roads', { type: 'geojson', data: roads });
        this.map.addLayer({
            id: 'roads-line',
            type: 'line',
            source: 'roads',
            paint: {
                'line-color': CONFIG.colors.road,
                'line-width': 2,
                'line-opacity': 0.8
            }
        });

        // Add road labels
        this.map.addLayer({
            id: 'roads-label',
            type: 'symbol',
            source: 'roads',
            layout: {
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-size': 11,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
            },
            paint: {
                'text-color': '#E8F0F8',
                'text-halo-color': '#0A1628',
                'text-halo-width': 1.5
            }
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
}

export const mapManager = new MapManager();
