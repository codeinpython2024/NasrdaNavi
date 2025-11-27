import { mapManager } from './modules/map/index.js';
import { navigationManager } from './modules/navigation/index.js';
import { uiManager } from './modules/ui/index.js';
import { voiceAssistant } from './modules/voice/index.js';
import { mascotAnimator } from './modules/mascot/index.js';
import { splashAnimator } from './modules/splash/index.js';

async function init() {
    // Start splash animations
    splashAnimator.animate();

    const token = document.getElementById('mapbox-token')?.value;
    if (!token) {
        console.error('Mapbox token not found');
        return;
    }

    // Initialize mascot animator
    mascotAnimator.init();

    // Initialize map
    mapManager.init('map', token);

    // Load layers and features
    const { roads, buildings } = await mapManager.loadLayers();
    uiManager.setFeatures(roads, buildings);

    navigationManager.onDirectionsUpdate = (dirs) => uiManager.updateDirections(dirs);
    mapManager.onClick(e => navigationManager.handleMapClick(e));

    // Search
    const searchBox = document.getElementById('searchBox');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('searchResults');

    const doSearch = () => {
        const matches = uiManager.search(searchBox.value.trim());
        uiManager.showSearchResults(matches, resultsDiv, searchBox);
    };

    searchBox.addEventListener('input', doSearch);
    searchBtn.addEventListener('click', doSearch);

    // Clear
    document.getElementById('clearBtn').addEventListener('click', () => navigationManager.clear());

    // Nearest
    document.getElementById('nearestBtn').addEventListener('click', () => {
        voiceAssistant.speak("Click on the map to find the nearest feature.", true);
    });

    // Toggle directions
    const toggleBtn = document.getElementById('toggleDirections');
    const directionsBody = document.getElementById('directionsBody');
    if (toggleBtn && directionsBody) {
        toggleBtn.addEventListener('click', () => {
            directionsBody.classList.toggle('collapsed');
            toggleBtn.textContent = directionsBody.classList.contains('collapsed') ? '+' : '−';
        });
    }

    // Show start button after loading
    splashAnimator.showStartButton();

    // Handle start button click
    const startBtn = document.getElementById('splashStartBtn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            // Disable button
            startBtn.disabled = true;
            startBtn.style.pointerEvents = 'none';

            // Kill splash animations and transition
            splashAnimator.kill();
            await mascotAnimator.transitionFromSplash();

            // Introduce Navi
            setTimeout(() => {
                mascotAnimator.introduce();
                mascotAnimator.startIdleAnimation();
            }, 600);
        });
    }
}

init().catch(err => {
    console.error('Init error:', err);
    document.getElementById('splash')?.remove();
});
