import { mapManager } from './modules/map/index.js';
import { navigationManager } from './modules/navigation/index.js';
import { uiManager } from './modules/ui/index.js';
import { voiceAssistant } from './modules/voice/index.js';

function hideSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 600);
    }
}

function setupVoiceMascot() {
    const mascot = document.getElementById('voiceMascot');
    const avatar = document.getElementById('voiceMascotAvatar');
    const status = document.getElementById('voiceMascotStatus');
    const bubble = document.getElementById('voiceBubble');

    if (!mascot || !avatar) return;

    voiceAssistant.setMascotElement(avatar);

    // Toggle voice on click
    avatar.addEventListener('click', () => {
        const enabled = voiceAssistant.toggle();
        status.textContent = enabled ? 'Voice On' : 'Muted';
        status.classList.toggle('muted', !enabled);

        // Show bubble feedback
        bubble.textContent = enabled ? "I'm listening! Ready to guide you." : "Voice muted. Click me to unmute.";
        bubble.classList.add('visible');
        setTimeout(() => bubble.classList.remove('visible'), 3000);
    });
}

async function init() {
    const token = document.getElementById('mapbox-token')?.value;
    if (!token) {
        console.error('Mapbox token not found');
        hideSplash();
        return;
    }

    mapManager.init('map', token);

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

    // Setup voice mascot
    setupVoiceMascot();

    hideSplash();

    // Greet user after a short delay
    setTimeout(() => voiceAssistant.greet(), 1000);
}

init().catch(err => {
    console.error('Init error:', err);
    hideSplash();
});
