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
    const { roads, buildings, sportArena } = await mapManager.loadLayers()
    uiManager.setFeatures(roads, buildings, sportArena)

    navigationManager.onDirectionsUpdate = (dirs) =>
      uiManager.updateDirections(dirs)
    mapManager.onClick((e) => navigationManager.handleMapClick(e))

    // Search
    const searchBox = document.getElementById("searchBox")
    const searchBtn = document.getElementById("searchBtn")
    const resultsDiv = document.getElementById("searchResults")

    if (searchBox && searchBtn && resultsDiv) {
      const doSearch = () => {
        const matches = uiManager.search(searchBox.value.trim())
        uiManager.showSearchResults(matches, resultsDiv, searchBox)
      }

      searchBox.addEventListener("input", doSearch)
      searchBtn.addEventListener("click", doSearch)
    }

    // Clear
    const clearBtn = document.getElementById("clearBtn")
    if (clearBtn) {
      clearBtn.addEventListener("click", () => navigationManager.clear())
    }

    // Nearest
    const nearestBtn = document.getElementById("nearestBtn")
    if (nearestBtn) {
      nearestBtn.addEventListener("click", () => {
        voiceAssistant.speak(
          "Click on the map to find the nearest feature.",
          true
        )
      })
    }

    // Toggle directions
    const toggleBtn = document.getElementById("toggleDirections")
    const directionsBody = document.getElementById("directionsBody")
    if (toggleBtn && directionsBody) {
      toggleBtn.addEventListener("click", () => {
        directionsBody.classList.toggle("collapsed")
        toggleBtn.textContent = directionsBody.classList.contains("collapsed")
          ? "+"
          : "−"
      })
    }

    // Transport mode toggle
    const btnDriving = document.getElementById("btnDriving")
    const btnWalking = document.getElementById("btnWalking")

    if (btnDriving && btnWalking) {
      btnDriving.addEventListener("click", () => {
        navigationManager.setMode("driving")
        btnDriving.classList.add("active")
        btnWalking.classList.remove("active")
      })

      btnWalking.addEventListener("click", () => {
        navigationManager.setMode("walking")
        btnWalking.classList.add("active")
        btnDriving.classList.remove("active")
      })
    }

    // Navigation point setting buttons
    const btnSetStart = document.getElementById("btnSetStart")
    const btnSetEnd = document.getElementById("btnSetEnd")

    // Update button states when navigation mode changes
    navigationManager.onNavigationModeChange = (mode) => {
      btnSetStart?.classList.toggle("active", mode === "setStart")
      btnSetEnd?.classList.toggle("active", mode === "setEnd")
    }

    if (btnSetStart) {
      btnSetStart.addEventListener("click", () => {
        navigationManager.setNavigationMode("setStart")
      })
    }

    if (btnSetEnd) {
      btnSetEnd.addEventListener("click", () => {
        navigationManager.setNavigationMode("setEnd")
      })
    }

    // Listen for navigation events from feature popups
    window.addEventListener("set-nav-point", (e) => {
      const { type, name, coords } = e.detail
      const latlng = { lat: coords[1], lng: coords[0] }

      if (type === "start") {
        navigationManager.setStart(latlng)
        voiceAssistant.speak(`${name} set as starting point.`, true)
      } else if (type === "end") {
        navigationManager.setEnd(latlng)
        voiceAssistant.speak(`${name} set as destination.`, true)
      }

      // Auto-calculate route if both points are set
      if (navigationManager.startPoint && navigationManager.endPoint) {
        voiceAssistant.announceCalculating()
        navigationManager.calculateRoute()
      }
    })

    // Show start button after loading
    splashAnimator.showStartButton()

    // Handle start button click
    const startBtn = document.getElementById("splashStartBtn")
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        // Disable button
        startBtn.disabled = true
        startBtn.style.pointerEvents = "none"

        // Kill splash animations and transition
        splashAnimator.kill()

        // Start map intro animation slightly before mascot finishes
        // This creates a cinematic effect where map zooms as mascot flies
        mapManager.animateIntro()

        await mascotAnimator.transitionFromSplash()

        // Introduce Navi
        setTimeout(() => {
          mascotAnimator.introduce()
          mascotAnimator.startIdleAnimation()
        }, 600)
      })
    }
}

init().catch(err => {
    console.error('Init error:', err);
    document.getElementById('splash')?.remove();
});
