export const CONFIG = {
    map: {
        defaultCenter: [7.387, 8.99],
        defaultZoom: 16,
        style: 'mapbox://styles/mapbox/standard',
        lightPreset: 'day',
        theme: 'monochrome'
    },
    api: {
        route: '/api/v1/route',
        roads: '/static/data/roads.geojson',
        buildings: '/static/data/buildings.geojson'
    },
    colors: {
        road: '#000000',
        building: '#ff7f50',
        route: '#22c55e',
        highlight: '#ef4444'
    }
};
