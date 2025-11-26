import { mapManager } from './modules/map/index.js';
import { navigationManager } from './modules/navigation/index.js';
import { uiManager } from './modules/ui/index.js';

async function init() {
    // Get token from page
    const token = document.getElementById('mapbox-token')?.value;
    if (!token) {
        console.error('Mapbox token not found');
        return;
    }

    // Initialize map
    mapManager.init('map', token);

    // Load layers and features
    const { roads, buildings } = await mapManager.loadLayers();
    uiManager.setFeatures(roads, buildings);
    uiManager.init();

    // Connect navigation to UI
    navigationManager.onDirectionsUpdate = (dirs) => uiManager.updateDirections(dirs);

    // Map click handler
    mapManager.onClick(e => navigationManager.handleMapClick(e));

    // Search handlers
    const searchBox = document.getElementById('searchBox');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('searchResults');

    const doSearch = () => {
        const matches = uiManager.search(searchBox.value.trim());
        uiManager.showSearchResults(matches, resultsDiv, searchBox);
    };

    searchBox.addEventListener('input', doSearch);
    searchBtn.addEventListener('click', doSearch);

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => navigationManager.clear());

    // Find nearest button
    document.getElementById('nearestBtn').addEventListener('click', () => {
        alert('Click on the map to find the nearest feature from that location.');
    });
}

init().catch(err => console.error('Init error:', err));
