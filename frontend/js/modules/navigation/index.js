import { CONFIG } from '../../config.js';
import { mapManager } from '../map/index.js';
import { voiceAssistant } from '../voice/index.js';
import { mascotAnimator } from '../mascot/index.js';

class NavigationManager {
    constructor() {
        this.startMarker = null;
        this.endMarker = null;
        this.stepMarkers = [];
        this.mascotMarker = null;
        this.startPoint = null;
        this.endPoint = null
        this.onDirectionsUpdate = null;
        this.currentMode = 'driving'; // 'driving' or 'walking'
        this.navigationMode = null; // null, 'setStart', or 'setEnd'
        this.onNavigationModeChange = null; // callback for UI updates
    }

    setMode(mode) {
        if (mode === 'driving' || mode === 'walking') {
            this.currentMode = mode;
        }
    }

    getMode() {
        return this.currentMode;
    }

    /**
     * Set navigation mode for setting start/end points
     * @param {string|null} mode - 'setStart', 'setEnd', or null to exit mode
     */
    setNavigationMode(mode) {
        if (mode === this.navigationMode) {
            // Toggle off if same mode clicked
            this.navigationMode = null;
        } else {
            this.navigationMode = mode;
        }
        
        // Update cursor based on mode
        const mapCanvas = mapManager.map?.getCanvas();
        if (mapCanvas) {
            if (this.navigationMode) {
                mapCanvas.style.cursor = 'crosshair';
            } else {
                mapCanvas.style.cursor = '';
            }
        }
        
        // Notify UI of mode change
        if (this.onNavigationModeChange) {
            this.onNavigationModeChange(this.navigationMode);
        }
        
        // Voice feedback
        if (this.navigationMode === 'setStart') {
            voiceAssistant.speak('Click on the map to set your starting point.', true);
        } else if (this.navigationMode === 'setEnd') {
            voiceAssistant.speak('Click on the map to set your destination.', true);
        }
    }

    getNavigationMode() {
        return this.navigationMode;
    }

    handleMapClick(e) {
      // Stop introduction if still playing
      mascotAnimator.stopIntroduction()

      // Only set points when in navigation mode
      if (this.navigationMode === "setStart") {
        this.setStart(e.latlng)
        this.setNavigationMode(null) // Exit mode after setting
        voiceAssistant.announceStart()

        // Auto-calculate route if both points are set
        if (this.startPoint && this.endPoint) {
          voiceAssistant.announceCalculating()
          this.calculateRoute()
        }
      } else if (this.navigationMode === "setEnd") {
        this.setEnd(e.latlng)
        this.setNavigationMode(null) // Exit mode after setting

        // Auto-calculate route if both points are set
        if (this.startPoint && this.endPoint) {
          voiceAssistant.announceCalculating()
          this.calculateRoute()
        }
      }
      // If not in navigation mode, do nothing (let feature popups handle it)
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
        const url = `${CONFIG.api.route}?start=${this.startPoint.lng},${this.startPoint.lat}&end=${this.endPoint.lng},${this.endPoint.lat}&mode=${this.currentMode}`

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
                voiceAssistant.announceError(data.error);
                return;
            }

            this.displayRoute(data)
        } catch (err) {
            voiceAssistant.announceError('Could not calculate route. Please try again.');
        }
    }

    displayRoute(data) {
      // Keep start/end markers visible

      // Remove existing route layers
      if (mapManager.map.getLayer("route-glow")) {
        mapManager.map.removeLayer("route-glow")
      }
      if (mapManager.map.getLayer("route-line")) {
        mapManager.map.removeLayer("route-line")
        mapManager.map.removeSource("route")
      }

      // Remove step markers
      this.stepMarkers.forEach((m) => m.remove())
      this.stepMarkers = []

      // Add route source
      mapManager.map.addSource("route", { type: "geojson", data: data.route })

      // Determine route styling based on mode
      const isWalking = data.mode === "walking"
      const routeColor = isWalking
        ? CONFIG.colors.routeWalking
        : CONFIG.colors.route
      const glowColor = isWalking
        ? CONFIG.colors.routeWalkingGlow
        : CONFIG.colors.routeGlow

      // Add glow layer
      mapManager.map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": glowColor,
          "line-width": 12,
          "line-blur": 4,
        },
      })

      // Add main route layer with mode-specific styling
      const routePaint = {
        "line-color": routeColor,
        "line-width": 4,
      }

      // Add dashed style for walking
      if (isWalking) {
        routePaint["line-dasharray"] = [2, 1]
      }

      mapManager.map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: routePaint,
      })

      // Fly to start point with camera facing route direction
      const coords = data.route.geometry.coordinates
      const start = coords[0]
      const next = coords[Math.min(5, coords.length - 1)]
      const bearing =
        Math.atan2(next[0] - start[0], next[1] - start[1]) * (180 / Math.PI)

      mapManager.map.flyTo({
        center: start,
        zoom: 19,
        pitch: 70,
        bearing: bearing,
        duration: 2000,
      })

      if (this.onDirectionsUpdate) {
        this.onDirectionsUpdate(data.directions)
      }

      // Add mascot marker at start of route
      this.addMascotMarker(coords[0])

      // Voice navigation with enhanced assistant
      voiceAssistant.speakDirections(data.directions, data.total_distance_m)
    }

    addMascotMarker(lngLat) {
        if (this.mascotMarker) this.mascotMarker.remove();

        const el = document.createElement('div');
        el.className = 'route-mascot-marker';
        el.innerHTML = '<img src="/static/Vector.png" alt="Navi"/>';

        this.mascotMarker = new mapboxgl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(mapManager.map);

        // Animate entrance
        gsap.fromTo(el, 
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
        );
    }

    clear() {
      if (mapManager.map.getLayer("route-glow")) {
        mapManager.map.removeLayer("route-glow")
      }
      if (mapManager.map.getLayer("route-line")) {
        mapManager.map.removeLayer("route-line")
        mapManager.map.removeSource("route")
      }
      if (this.startMarker) this.startMarker.remove()
      if (this.endMarker) this.endMarker.remove()
      if (this.mascotMarker) this.mascotMarker.remove()
      this.stepMarkers.forEach((m) => m.remove())

      this.startMarker = null
      this.endMarker = null
      this.mascotMarker = null
      this.stepMarkers = []
      this.startPoint = null
      this.endPoint = null
      this.setNavigationMode(null) // Reset navigation mode

      voiceAssistant.announceCleared()
      mapManager.resetView()

      if (this.onDirectionsUpdate) {
        this.onDirectionsUpdate(null)
      }
    }
}

export const navigationManager = new NavigationManager();
