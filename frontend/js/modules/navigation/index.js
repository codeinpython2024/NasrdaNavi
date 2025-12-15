import { CONFIG } from "../../config.js"
import { mapManager } from "../map/index.js"
import { voiceAssistant } from "../voice/index.js"
import { mascotAnimator } from "../mascot/index.js"
import { loadingManager } from "../utils/index.js"

// Runtime checks for CDN-loaded global dependencies
// These libraries are loaded via <script> tags in index.html
if (typeof mapboxgl === "undefined") {
  throw new Error(
    "[NavigationManager] mapboxgl is not defined. " +
      "Ensure Mapbox GL JS is loaded via <script> before this module. " +
      'Expected: <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>'
  )
}

if (typeof gsap === "undefined") {
  throw new Error(
    "[NavigationManager] gsap is not defined. " +
      "Ensure GSAP is loaded via <script> before this module. " +
      'Expected: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>'
  )
}

class NavigationManager {
  constructor() {
    this.startMarker = null
    this.endMarker = null
    this.stepMarkers = []
    this.mascotMarker = null
    this.startPoint = null
    this.endPoint = null
    this.onDirectionsUpdate = null
    this.currentMode = "driving" // 'driving' or 'walking'
    this.navigationMode = null // null, 'setStart', or 'setEnd'
    this.onNavigationModeChange = null // callback for UI updates
    this._isNavigating = false
  }

  /**
   * Enter focused navigation mode - hides UI clutter
   */
  _enterNavigationMode() {
    if (this._isNavigating) return
    this._isNavigating = true
    document.body.classList.add("navigation-active")
    
    // Close any open popups
    mapManager.popup?.remove()
  }

  /**
   * Exit focused navigation mode - restores UI
   */
  _exitNavigationMode() {
    if (!this._isNavigating) return
    this._isNavigating = false
    document.body.classList.remove("navigation-active")
  }

  setMode(mode) {
    if (mode === "driving" || mode === "walking") {
      this.currentMode = mode
    }
  }

  getMode() {
    return this.currentMode
  }

  /**
   * Set navigation mode for setting start/end points
   * @param {string|null} mode - 'setStart', 'setEnd', or null to exit mode
   * @param {Object} options - Optional configuration
   * @param {boolean} options.silent - If true, skip voice feedback (for programmatic transitions)
   */
  setNavigationMode(mode, options = {}) {
    const { silent = false } = options

    if (mode === this.navigationMode) {
      // Toggle off if same mode clicked
      this.navigationMode = null
    } else {
      this.navigationMode = mode
    }

    // Update cursor based on mode
    const mapCanvas = mapManager.map?.getCanvas()
    if (mapCanvas) {
      if (this.navigationMode) {
        mapCanvas.style.cursor = "crosshair"
      } else {
        mapCanvas.style.cursor = ""
      }
    }

    // Notify UI of mode change
    if (this.onNavigationModeChange) {
      this.onNavigationModeChange(this.navigationMode)
    }

    // Voice feedback (skip if silent flag is set)
    if (!silent) {
      if (this.navigationMode === "setStart") {
        voiceAssistant.speak(
          "Click on the map to set your starting point.",
          true
        )
      } else if (this.navigationMode === "setEnd") {
        voiceAssistant.speak("Click on the map to set your destination.", true)
      }
    }
  }

  getNavigationMode() {
    return this.navigationMode
  }

  handleMapClick(e) {
    // Stop introduction if still playing
    mascotAnimator.stopIntroduction()

    // Only set points when in navigation mode
    if (this.navigationMode === "setStart") {
      this.setStart(e.latlng)

      // Auto-calculate route if both points are set
      if (this.startPoint && this.endPoint) {
        this.setNavigationMode(null) // Exit mode
        voiceAssistant.announceCalculating()
        this.calculateRoute()
      } else {
        // Auto-transition to setEnd mode for seamless UX
        // This allows users to immediately tap their destination
        // Use silent: true to avoid duplicate voice (announceStart provides the feedback)
        this.setNavigationMode("setEnd", { silent: true })
        voiceAssistant.announceStart()
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
    this.startPoint = latlng
    if (this.startMarker) this.startMarker.remove()
    this.startMarker = new mapboxgl.Marker({ color: CONFIG.colors.markerStart })
      .setLngLat([latlng.lng, latlng.lat])
      .setPopup(new mapboxgl.Popup().setText("Start"))
      .addTo(mapManager.map)
      .togglePopup()
  }

  setEnd(latlng) {
    this.endPoint = latlng
    if (this.endMarker) this.endMarker.remove()
    this.endMarker = new mapboxgl.Marker({ color: CONFIG.colors.markerEnd })
      .setLngLat([latlng.lng, latlng.lat])
      .setPopup(new mapboxgl.Popup().setText("End"))
      .addTo(mapManager.map)
      .togglePopup()
  }

  async calculateRoute() {
    const url = `${CONFIG.api.route}?start=${this.startPoint.lng},${this.startPoint.lat}&end=${this.endPoint.lng},${this.endPoint.lat}&mode=${this.currentMode}`

    // Show loading indicator
    const hideLoading = loadingManager.showRouteCalculating(
      this.currentMode === "walking"
        ? "Finding walking path..."
        : "Calculating driving route..."
    )

    // Show skeleton in directions panel
    const directionsBody = document.getElementById("directionsBody")
    if (directionsBody) {
      loadingManager.showSkeleton(directionsBody, "directions", 4)
    }

    try {
      const res = await fetch(url)

      // Check HTTP status before parsing JSON
      if (!res.ok) {
        // Hide loading indicator
        hideLoading()

        // Try to extract error message from response
        let errorMessage = `Server error (${res.status})`
        try {
          const errorData = await res.json()
          if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Response wasn't JSON, use status text
          errorMessage = res.statusText || errorMessage
        }

        voiceAssistant.announceError(errorMessage)
        if (directionsBody) {
          directionsBody.innerHTML =
            '<p class="text-muted">Could not calculate route. Please try different points.</p>'
        }
        return
      }

      const data = await res.json()

      // Hide loading indicator
      hideLoading()

      if (data.error) {
        voiceAssistant.announceError(data.error)
        if (directionsBody) {
          directionsBody.innerHTML =
            '<p class="text-muted">Could not calculate route. Please try different points.</p>'
        }
        return
      }

      this.displayRoute(data)
    } catch (err) {
      hideLoading()
      voiceAssistant.announceError(
        "Could not calculate route. Please try again."
      )
      if (directionsBody) {
        directionsBody.innerHTML =
          '<p class="text-muted">Error calculating route. Please try again.</p>'
      }
    }
  }

  displayRoute(data) {
    // Enter focused navigation mode
    this._enterNavigationMode()

    // Remove existing route layers and source
    this._removeRouteFromMap()

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

    // Define route paint style
    const routePaint = {
      "line-color": routeColor,
      "line-width": 6,
      "line-opacity": 0.9,
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
    if (!coords || coords.length === 0) {
      console.error("Route has no coordinates")
      return
    }
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
      this.onDirectionsUpdate(data.directions, {
        distance: data.total_distance_m,
        estimatedTime: data.estimated_time_seconds,
        mode: data.mode,
      })
    }

    // Add mascot marker at start of route
    this.addMascotMarker(coords[0])

    // Voice navigation with enhanced assistant
    voiceAssistant.speakDirections(
      data.directions,
      data.total_distance_m,
      data.estimated_time_seconds
    )
  }

  /**
   * Remove route layers and source from the map
   * Safely checks for existence before removal
   */
  _removeRouteFromMap() {
    if (mapManager.map.getLayer("route-glow")) {
      mapManager.map.removeLayer("route-glow")
    }
    if (mapManager.map.getLayer("route-line")) {
      mapManager.map.removeLayer("route-line")
    }
    if (mapManager.map.getSource("route")) {
      mapManager.map.removeSource("route")
    }
  }

  addMascotMarker(lngLat) {
    if (this.mascotMarker) this.mascotMarker.remove()

    const el = document.createElement("div")
    el.className = "route-mascot-marker"
    el.innerHTML = '<img src="/static/Vector.webp" alt="Navi"/>'

    this.mascotMarker = new mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(mapManager.map)

    // Animate entrance
    gsap.fromTo(
      el,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }
    )
  }

  clear() {
    // Exit focused navigation mode
    this._exitNavigationMode()

    // Remove route layers and source
    this._removeRouteFromMap()

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
      this.onDirectionsUpdate(null, null)
    }
  }
}

export const navigationManager = new NavigationManager()
