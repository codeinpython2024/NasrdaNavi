export const CONFIG = {
    map: {
        defaultCenter: [7.387, 8.99],
        defaultZoom: 16,
        style: 'mapbox://styles/mapbox/standard',
        lightPreset: 'dusk',
        theme: 'monochrome',
        styles: [
            { id: 'standard', name: 'Standard', url: 'mapbox://styles/mapbox/standard' },
            { id: 'satellite', name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
            { id: 'terrain', name: 'Terrain', url: 'mapbox://styles/mapbox/outdoors-v12' }
        ]
    },
    api: {
        route: '/api/v1/route',
        roads: '/static/data/roads.geojson',
        buildings: '/static/data/buildings.geojson'
    },
    colors: {
        road: '#B8C8D8',
        building: '#FF8C00',
        buildingOutline: '#FFA500',
        route: '#FF8C00',
        routeGlow: 'rgba(255, 140, 0, 0.4)',
        highlight: '#008751',
        markerStart: '#008751',
        markerEnd: '#E15B4F'
    }
};
