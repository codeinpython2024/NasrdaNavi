import { CONFIG } from '../../config.js';
import { errorHandler } from "../utils/errorHandler.js"

// Runtime check for CDN-loaded global dependency
// Mapbox GL JS is loaded via <script> tag in index.html
if (typeof mapboxgl === "undefined") {
  throw new Error(
    "[MapManager] mapboxgl is not defined. " +
      "Ensure Mapbox GL JS is loaded via <script> before this module. " +
      'Expected: <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>'
  )
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== "string") return str
  const htmlEscapes = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
  }
  return str.replace(/[&<>"'`/]/g, (char) => htmlEscapes[char])
}


class MapManager {
  constructor() {
    this.map = null
    this.containerId = null
    this.currentStyleIndex = 0
    this.layerData = {
      roads: null,
      buildings: null,
      footpath: null,
      grass: null,
      greenArea: null,
      sportArena: null,
    }
    this.layerVisibility = {
      roads: true, // Show by default
      buildings: true, // Show by default
      footpath: true, // Show by default
      grass: true, // Show by default
      greenArea: true, // Show by default
      sportArena: true, // Show by default
    }
    this.popup = null
    this.hoveredSportArenaId = null
    this.hoveredBuildingId = null
    this.userLocationMarker = null
    // Flags to prevent duplicate event listener registration
    this.sportArenaInteractionsSetup = false
    // Callback to check navigation mode (set by main.js)
    this.getNavigationMode = null
    this.buildingInteractionsSetup = false
  }

  /**
   * Setup event delegation for popup action buttons
   * This replaces inline onclick handlers to prevent XSS vulnerabilities
   * @param {mapboxgl.Popup} popup - The popup instance
   */
  _setupPopupEventDelegation(popup) {
    let popupEl = null

    const handlePopupClick = (e) => {
      const btn = e.target.closest(".popup-action-btn")
      if (!btn) return

      const navType = btn.dataset.navType
      const name = btn.dataset.name
      const coords = btn.dataset.coords

      if (navType && coords) {
        const [lng, lat] = coords.split(",").map(Number)
        window.dispatchEvent(
          new CustomEvent("set-nav-point", {
            detail: {
              type: navType,
              name: name || "Unknown",
              coords: [lng, lat],
            },
          })
        )
      }
    }

    popup.on("open", () => {
      popupEl = popup.getElement()
      if (!popupEl) return
      popupEl.addEventListener("click", handlePopupClick)
    })

    popup.on("close", () => {
      if (popupEl) {
        popupEl.removeEventListener("click", handlePopupClick)
        popupEl = null
      }
    })
  }

  init(elementId, accessToken) {
    mapboxgl.accessToken = accessToken
    this.containerId = elementId
    // Start with zoomed-out, flat view for intro animation
    this.map = new mapboxgl.Map({
      container: elementId,
      style: CONFIG.map.style,
      center: CONFIG.map.defaultCenter,
      zoom: 13,
      pitch: 0,
      bearing: 0,
      antialias: true,
      maxBounds: CONFIG.map.maxBounds,
      minZoom: CONFIG.map.minZoom,
    })

    // Set Standard style configuration after map loads
    this.map.on("style.load", () => {
      this.applyBasemapConfig()
    })

    this.addCustomControls()
    return this
  }

  applyBasemapConfig() {
    // Apply light preset and theme for Standard style with 3D buildings
    if (this.map.getConfigProperty) {
      try {
        this.map.setConfigProperty(
          "basemap",
          "lightPreset",
          CONFIG.map.lightPreset
        )
        this.map.setConfigProperty("basemap", "theme", CONFIG.map.theme)
        this.map.setConfigProperty("basemap", "showPointOfInterestLabels", false)
        this.map.setConfigProperty("basemap", "showPlaceLabels", false)
        this.map.setConfigProperty("basemap", "showRoadLabels", false)
        this.map.setConfigProperty("basemap", "showTransitLabels", false)
      } catch (e) {
        console.log("Basemap config not supported for this style")
      }
    }
  }

  addCustomControls() {
    // Create custom control container
    const controlsContainer = document.createElement("div")
    controlsContainer.className = "map-controls"
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
            <button class="map-control-btn active" id="btnGreenArea" title="Toggle green areas">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"></path>
                    <path d="M12 6v12M6 12h12"></path>
                </svg>
            </button>
            <button class="map-control-btn active" id="btnGrass" title="Toggle grass">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v8M8 6v6M16 6v6M4 10v6M20 10v6M12 14v8"></path>
                </svg>
            </button>
            <button class="map-control-btn active" id="btnSportArena" title="Toggle sport facilities">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="6" rx="2" width="20" height="12"></rect>
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M2 12h4M18 12h4"></path>
                    <path d="M6 6v12M18 6v12"></path>
                </svg>
            </button>
            <button class="map-control-btn active" id="btnFootpath" title="Toggle footpaths">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 20L8 16M8 16L12 20M8 16V4"></path>
                    <path d="M16 4L20 8M20 8L16 12M20 8H8"></path>
                </svg>
            </button>
            <div class="map-control-divider"></div>
            <button class="map-control-btn active" id="btnBuildings" title="Toggle buildings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"></path>
                </svg>
            </button>
            <button class="map-control-btn active" id="btnRoads" title="Toggle roads">
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
            <div class="map-control-divider"></div>
            <button class="map-control-btn" id="btnMapStyle" title="Change map style">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                </svg>
            </button>
        `

    document.getElementById(this.containerId).appendChild(controlsContainer)

    // Bind events after map loads
    this.map.on("load", () => {
      this.bindControlEvents()
      // Map starts flat (pitch: 0), so 3D button should not be active initially
    })
  }

  bindControlEvents() {
    document.getElementById("btnGreenArea")?.addEventListener("click", (e) => {
      this.layerVisibility.greenArea = !this.layerVisibility.greenArea
      this.toggleLayer("greenArea", this.layerVisibility.greenArea)
      e.currentTarget.classList.toggle("active", this.layerVisibility.greenArea)
    })

    document.getElementById("btnGrass")?.addEventListener("click", (e) => {
      this.layerVisibility.grass = !this.layerVisibility.grass
      this.toggleLayer("grass", this.layerVisibility.grass)
      e.currentTarget.classList.toggle("active", this.layerVisibility.grass)
    })

    document.getElementById("btnSportArena")?.addEventListener("click", (e) => {
      this.layerVisibility.sportArena = !this.layerVisibility.sportArena
      this.toggleLayer("sportArena", this.layerVisibility.sportArena)
      e.currentTarget.classList.toggle(
        "active",
        this.layerVisibility.sportArena
      )
    })

    document.getElementById("btnFootpath")?.addEventListener("click", (e) => {
      this.layerVisibility.footpath = !this.layerVisibility.footpath
      this.toggleLayer("footpath", this.layerVisibility.footpath)
      e.currentTarget.classList.toggle("active", this.layerVisibility.footpath)
    })

    document.getElementById("btnBuildings")?.addEventListener("click", (e) => {
      this.layerVisibility.buildings = !this.layerVisibility.buildings
      this.toggleLayer("buildings", this.layerVisibility.buildings)
      e.currentTarget.classList.toggle("active", this.layerVisibility.buildings)
    })

    document.getElementById("btnRoads")?.addEventListener("click", (e) => {
      this.layerVisibility.roads = !this.layerVisibility.roads
      this.toggleLayer("roads", this.layerVisibility.roads)
      e.currentTarget.classList.toggle("active", this.layerVisibility.roads)
    })

    document.getElementById("btnZoomIn")?.addEventListener("click", () => {
      this.map.zoomIn({ duration: 300 })
    })

    document.getElementById("btnZoomOut")?.addEventListener("click", () => {
      this.map.zoomOut({ duration: 300 })
    })

    document.getElementById("btnCompass")?.addEventListener("click", () => {
      this.map.easeTo({ bearing: 0, pitch: 0, duration: 500 })
    })

    document.getElementById("btnPitch")?.addEventListener("click", (e) => {
      const currentPitch = this.map.getPitch()
      const newPitch = currentPitch > 0 ? 0 : 60
      this.map.easeTo({ pitch: newPitch, duration: 500 })
      e.currentTarget.classList.toggle("active", newPitch > 0)
    })

    document.getElementById("btnLocate")?.addEventListener("click", () => {
      if (navigator.geolocation) {
        const btn = document.getElementById("btnLocate")
        btn?.classList.add("locating")

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btn?.classList.remove("locating")
            const lngLat = [pos.coords.longitude, pos.coords.latitude]
            this.showUserLocation(lngLat, true)
          },
          () => {
            btn?.classList.remove("locating")
            errorHandler.warn("Could not get your location")
          }
        )
      }
    })

    document.getElementById("btnFitBounds")?.addEventListener("click", () => {
      this.map.fitBounds(CONFIG.map.campusBounds, {
        padding: 50,
        duration: 1000,
      })
    })

    document.getElementById("btnMapStyle")?.addEventListener("click", () => {
      this.cycleMapStyle()
    })

    // Update compass rotation
    this.map.on("rotate", () => {
      const compass = document.querySelector("#btnCompass svg")
      if (compass) {
        compass.style.transform = `rotate(${-this.map.getBearing()}deg)`
      }
    })
  }

  /**
   * Fetch a layer with error handling and response validation
   * @param {string} url - The API endpoint URL
   * @param {string} layerName - Name of the layer for error messages
   * @returns {Promise<Object>} GeoJSON data or empty fallback
   */
  async fetchLayerWithFallback(url, layerName) {
    const emptyGeoJSON = { type: "FeatureCollection", features: [] }

    try {
      const response = await fetch(url)

      if (!response.ok) {
        console.error(
          `Failed to fetch ${layerName}: HTTP ${response.status} ${response.statusText}`
        )
        return { data: emptyGeoJSON, error: `HTTP ${response.status}` }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      console.error(`Error fetching ${layerName}:`, error)
      return { data: emptyGeoJSON, error: error.message }
    }
  }

  async loadLayers() {
    const emptyGeoJSON = { type: "FeatureCollection", features: [] }

    // Define layer configurations
    const layerConfigs = [
      { url: CONFIG.api.roads, name: "roads" },
      { url: CONFIG.api.buildings, name: "buildings" },
      { url: CONFIG.api.footpath, name: "footpath" },
      { url: CONFIG.api.grass, name: "grass" },
      { url: CONFIG.api.greenArea, name: "greenArea" },
      { url: CONFIG.api.sportArena, name: "sportArena" },
    ]

    // Fetch all layers with Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      layerConfigs.map((config) =>
        this.fetchLayerWithFallback(config.url, config.name)
      )
    )

    // Process results and collect errors
    const failedLayers = []
    const layerData = {}

    results.forEach((result, index) => {
      const layerName = layerConfigs[index].name

      if (result.status === "fulfilled") {
        const { data, error } = result.value
        layerData[layerName] = data

        if (error) {
          failedLayers.push(layerName)
        }
      } else {
        // Promise was rejected (shouldn't happen with fetchLayerWithFallback, but handle just in case)
        console.error(`Unexpected rejection for ${layerName}:`, result.reason)
        layerData[layerName] = emptyGeoJSON
        failedLayers.push(layerName)
      }
    })

    // Show user notification if any layers failed
    if (failedLayers.length > 0) {
      const message =
        failedLayers.length === layerConfigs.length
          ? "Unable to load map layers. Please check your connection and refresh."
          : `Some map layers failed to load: ${failedLayers.join(
              ", "
            )}. The map may be incomplete.`

      errorHandler.warn(message)

      // Store failed layers for potential retry
      this.failedLayers = failedLayers
    }

    // Destructure for backward compatibility with rest of method
    const { roads, buildings, footpath, grass, greenArea, sportArena } =
      layerData

    await new Promise((resolve) => {
      if (this.map.loaded()) resolve()
      else this.map.on("load", resolve)
    })

    // Store data for style changes
    this.layerData = {
      roads,
      buildings,
      footpath,
      grass,
      greenArea,
      sportArena,
    }

    // Add green areas layer (visible by default - background)
    this.map.addSource("greenArea", { type: "geojson", data: greenArea })
    this.map.addLayer({
      id: "greenArea-fill",
      type: "fill",
      source: "greenArea",
      paint: { "fill-color": CONFIG.colors.greenArea, "fill-opacity": 0.4 },
      layout: { visibility: "visible" },
    })
    this.map.addLayer({
      id: "greenArea-outline",
      type: "line",
      source: "greenArea",
      paint: {
        "line-color": CONFIG.colors.greenAreaOutline,
        "line-width": 1,
      },
      layout: { visibility: "visible" },
    })

    // Add grass layer (visible by default)
    this.map.addSource("grass", { type: "geojson", data: grass })
    this.map.addLayer({
      id: "grass-fill",
      type: "fill",
      source: "grass",
      paint: { "fill-color": CONFIG.colors.grass, "fill-opacity": 0.5 },
      layout: { visibility: "visible" },
    })
    this.map.addLayer({
      id: "grass-outline",
      type: "line",
      source: "grass",
      paint: { "line-color": CONFIG.colors.grassOutline, "line-width": 1 },
      layout: { visibility: "visible" },
    })

    // Add sport arenas layer (visible by default) with data-driven styling
    this.map.addSource("sportArena", { type: "geojson", data: sportArena })
    this.map.addLayer({
      id: "sportArena-fill",
      type: "fill",
      source: "sportArena",
      paint: {
        "fill-color": [
          "match",
          ["get", "SportType"],
          "football",
          CONFIG.colors.sports.football.fill,
          "basketball",
          CONFIG.colors.sports.basketball.fill,
          "volleyball",
          CONFIG.colors.sports.volleyball.fill,
          "badminton",
          CONFIG.colors.sports.badminton.fill,
          CONFIG.colors.sportArena, // fallback
        ],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.85,
          0.65,
        ],
      },
      layout: { visibility: "visible" },
    })
    this.map.addLayer({
      id: "sportArena-outline",
      type: "line",
      source: "sportArena",
      paint: {
        "line-color": [
          "match",
          ["get", "SportType"],
          "football",
          CONFIG.colors.sports.football.outline,
          "basketball",
          CONFIG.colors.sports.basketball.outline,
          "volleyball",
          CONFIG.colors.sports.volleyball.outline,
          "badminton",
          CONFIG.colors.sports.badminton.outline,
          CONFIG.colors.sportArenaOutline, // fallback
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          3,
          2,
        ],
      },
      layout: { visibility: "visible" },
    })
    this.map.addLayer({
      id: "sportArena-label",
      type: "symbol",
      source: "sportArena",
      layout: {
        visibility: "visible",
        "text-field": ["get", "Name"],
        "text-size": 12,
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#1F2937",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2,
      },
    })

    // Add sport arena interactivity
    this.setupSportArenaInteractions()

    // Add footpath layer (visible by default)
    this.map.addSource("footpath", { type: "geojson", data: footpath })
    this.map.addLayer({
      id: "footpath-line",
      type: "line",
      source: "footpath",
      paint: {
        "line-color": CONFIG.colors.footpath,
        "line-width": 1.5,
        "line-dasharray": [2, 2],
      },
      layout: { visibility: "visible" },
    })

    // Add buildings layer (hidden initially) with hover support
    this.map.addSource("buildings", { type: "geojson", data: buildings })
    this.map.addLayer({
      id: "buildings-fill",
      type: "fill",
      source: "buildings",
      paint: {
        "fill-color": CONFIG.colors.building,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.85,
          0.7,
        ],
      },
      layout: { visibility: "visible" },
    })
    this.map.addLayer({
      id: "buildings-outline",
      type: "line",
      source: "buildings",
      paint: {
        "line-color": CONFIG.colors.buildingOutline,
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2.5,
          1.5,
        ],
      },
      layout: { visibility: "visible" },
    })
    // Add building labels layer to display short titles
    this.map.addLayer({
      id: "buildings-label",
      type: "symbol",
      source: "buildings",
      layout: {
        visibility: "visible",
        "text-field": ["case", ["!=", ["get", "name"], " "], ["get", "name"], ""],
        "text-size": 12,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-max-width": 10,
        "text-letter-spacing": 0.02,
        "text-padding": 8,
      },
      paint: {
        "text-color": "#000000",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2.5,
        "text-halo-blur": 0.5,
      },
      filter: ["!=", ["get", "name"], " "],
    })

    // Add building interactivity
    this.setupBuildingInteractions()

    // Add roads layer (hidden initially)
    this.map.addSource("roads", { type: "geojson", data: roads })
    this.map.addLayer({
      id: "roads-line",
      type: "line",
      source: "roads",
      paint: { "line-color": CONFIG.colors.road, "line-width": 2 },
      layout: { visibility: "visible" },
    })

    // Add road labels with improved styling
    this.map.addLayer({
      id: "roads-label",
      type: "symbol",
      source: "roads",
      layout: {
        visibility: "visible",
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
        "text-letter-spacing": 0.05,
        "symbol-spacing": 300,
        "text-max-angle": 30,
      },
      paint: {
        "text-color": "#1E3A5F",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2.5,
        "text-halo-blur": 0.5,
      },
    })

    // Note: fitBounds removed - intro animation handles initial positioning
    return { roads, buildings, footpath, grass, greenArea, sportArena }
  }

  /**
   * Retry loading failed layers
   * @returns {Promise<Object>} Object with retried layer results
   */
  async retryFailedLayers() {
    if (!this.failedLayers || this.failedLayers.length === 0) {
      errorHandler.info("All layers are already loaded.")
      return {}
    }

    const layerUrlMap = {
      roads: CONFIG.api.roads,
      buildings: CONFIG.api.buildings,
      footpath: CONFIG.api.footpath,
      grass: CONFIG.api.grass,
      greenArea: CONFIG.api.greenArea,
      sportArena: CONFIG.api.sportArena,
    }

    const retriedLayers = {}
    const stillFailed = []

    for (const layerName of this.failedLayers) {
      const url = layerUrlMap[layerName]
      if (!url) continue

      const { data, error } = await this.fetchLayerWithFallback(url, layerName)

      if (!error) {
        retriedLayers[layerName] = data
        // Update the map source with new data
        if (this.map.getSource(layerName)) {
          this.map.getSource(layerName).setData(data)
        }
        // Update stored layer data
        if (this.layerData) {
          this.layerData[layerName] = data
        }
      } else {
        stillFailed.push(layerName)
      }
    }

    // Update failed layers list
    this.failedLayers = stillFailed

    if (stillFailed.length === 0 && Object.keys(retriedLayers).length > 0) {
      errorHandler.success("All layers loaded successfully!")
    } else if (stillFailed.length > 0) {
      errorHandler.warn(
        `Some layers still failed to load: ${stillFailed.join(", ")}`
      )
    }

    return retriedLayers
  }

  onClick(callback) {
    this.map.on("click", (e) => {
      // Synchronously check if any interactive features exist at the click point
      // This prevents the map click when a feature (building, sport arena) is clicked
      const interactiveLayers = ["sportArena-fill", "buildings-fill"]
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: interactiveLayers,
      })

      // Only invoke callback if no features were clicked
      if (features.length === 0) {
        callback({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } })
      }
    })
  }

  setupSportArenaInteractions() {
    // Only register event handlers once to prevent accumulation
    if (this.sportArenaInteractionsSetup) return
    this.sportArenaInteractionsSetup = true

    // Get sport icon based on type
    const getSportIcon = (sportType) => {
      const icons = {
        football: "⚽",
        basketball: "🏀",
        volleyball: "🏐",
        badminton: "🏸",
      }
      return icons[sportType] || "🏟️"
    }

    // Hover effect - change cursor and highlight
    this.map.on("mouseenter", "sportArena-fill", (e) => {
      this.map.getCanvas().style.cursor = "pointer"

      if (e.features.length > 0) {
        // Remove previous hover state
        if (this.hoveredSportArenaId !== null) {
          this.map.setFeatureState(
            { source: "sportArena", id: this.hoveredSportArenaId },
            { hover: false }
          )
        }

        this.hoveredSportArenaId = e.features[0].id
        this.map.setFeatureState(
          { source: "sportArena", id: this.hoveredSportArenaId },
          { hover: true }
        )
      }
    })

    this.map.on("mouseleave", "sportArena-fill", () => {
      this.map.getCanvas().style.cursor = ""

      if (this.hoveredSportArenaId !== null) {
        this.map.setFeatureState(
          { source: "sportArena", id: this.hoveredSportArenaId },
          { hover: false }
        )
      }
      this.hoveredSportArenaId = null
    })

    // Click to show popup with details
    this.map.on("click", "sportArena-fill", (e) => {
      if (e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties
      const coordinates = e.lngLat
      const name = props.Name || "Unknown"

      // If in navigation mode, set point directly instead of showing popup
      const navMode = this.getNavigationMode?.()
      if (navMode === "setStart" || navMode === "setEnd") {
        window.dispatchEvent(new CustomEvent("set-nav-point", {
          detail: {
            type: navMode === "setStart" ? "start" : "end",
            name: name,
            coords: [coordinates.lng, coordinates.lat]
          }
        }))
        return
      }

      const sportType = props.SportType || "unknown"
      const icon = getSportIcon(sportType)
      const sportColor =
        CONFIG.colors.sports[sportType]?.fill || CONFIG.colors.sportArena

      // Close existing popup and create new one with correct class
      if (this.popup) this.popup.remove()
      this.popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: "sport-arena-popup",
        maxWidth: "280px",
        offset: [0, -10],
      })

      // Escape names to prevent XSS
      const safeName = escapeHtml(name)
      const safeSportType = escapeHtml(
        sportType.charAt(0).toUpperCase() + sportType.slice(1)
      )

      const popupContent = `
                <div class="sport-popup-content">
                    <div class="sport-popup-header" style="background: linear-gradient(135deg, ${sportColor}22, ${sportColor}44);">
                        <span class="sport-icon">${icon}</span>
                        <h3 class="sport-name">${safeName}</h3>
                    </div>
                    <div class="sport-popup-body">
                        <div class="sport-detail">
                            <span class="detail-label">Sport</span>
                            <span class="detail-value">${safeSportType}</span>
                        </div>
                        <div class="sport-detail">
                            <span class="detail-label">Status</span>
                            <span class="detail-value status-available">
                                <span class="status-dot"></span>
                                Available
                            </span>
                        </div>
                    </div>
                    <div class="popup-action-buttons">
                        <button class="popup-action-btn start" data-nav-type="start" data-name="${safeName}" data-coords="${coordinates.lng},${coordinates.lat}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                            </svg>
                            Set as Start
                        </button>
                        <button class="popup-action-btn end" data-nav-type="end" data-name="${safeName}" data-coords="${coordinates.lng},${coordinates.lat}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                                <circle cx="12" cy="9" r="2.5" fill="currentColor"></circle>
                            </svg>
                            Set as Destination
                        </button>
                    </div>
                </div>
            `

      this._setupPopupEventDelegation(this.popup)
      this.popup.setLngLat(coordinates).setHTML(popupContent).addTo(this.map)
    })
  }

  setupBuildingInteractions() {
    // Only register event handlers once to prevent accumulation
    if (this.buildingInteractionsSetup) return
    this.buildingInteractionsSetup = true

    // Hover effect - change cursor and highlight
    this.map.on("mouseenter", "buildings-fill", (e) => {
      this.map.getCanvas().style.cursor = "pointer"

      if (e.features.length > 0) {
        // Remove previous hover state
        if (this.hoveredBuildingId !== null) {
          this.map.setFeatureState(
            { source: "buildings", id: this.hoveredBuildingId },
            { hover: false }
          )
        }

        this.hoveredBuildingId = e.features[0].id
        this.map.setFeatureState(
          { source: "buildings", id: this.hoveredBuildingId },
          { hover: true }
        )
      }
    })

    this.map.on("mouseleave", "buildings-fill", () => {
      this.map.getCanvas().style.cursor = ""

      if (this.hoveredBuildingId !== null) {
        this.map.setFeatureState(
          { source: "buildings", id: this.hoveredBuildingId },
          { hover: false }
        )
      }
      this.hoveredBuildingId = null
    })

    // Click to show popup with details
    this.map.on("click", "buildings-fill", (e) => {
      if (e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties
      const buildingName = props.name || "Unknown Building"
      const coordinates = e.lngLat

      // If in navigation mode, set point directly instead of showing popup
      const navMode = this.getNavigationMode?.()
      if (navMode === "setStart" || navMode === "setEnd") {
        window.dispatchEvent(new CustomEvent("set-nav-point", {
          detail: {
            type: navMode === "setStart" ? "start" : "end",
            name: buildingName,
            coords: [coordinates.lng, coordinates.lat]
          }
        }))
        return
      }

      const department = props.Department || ""
      const buildingType = props.type?.trim() || ""

      // Escape names to prevent XSS
      const safeBuildingName = escapeHtml(buildingName)
      const safeDepartment = escapeHtml(department)
      const safeBuildingType = escapeHtml(buildingType)

      // Close existing popup and create new one with correct class
      if (this.popup) this.popup.remove()
      this.popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: "feature-popup",
        maxWidth: "300px",
        offset: [0, -10],
      })

      const popupContent = `
          <div class="feature-popup-content">
            <div class="feature-popup-header building-header">
              <span class="feature-icon">🏢</span>
              <h3 class="feature-name">${safeBuildingName}</h3>
            </div>
            <div class="feature-popup-body">
              ${
                buildingType
                  ? `
              <div class="feature-detail">
                <span class="detail-label">Type</span>
                <span class="detail-value">${safeBuildingType}</span>
              </div>
              `
                  : ""
              }
              ${
                department
                  ? `
              <div class="feature-detail">
                <span class="detail-label">Departments</span>
                <span class="detail-value department-list">${safeDepartment}</span>
              </div>
              `
                  : ""
              }
            </div>
            <div class="popup-action-buttons">
              <button class="popup-action-btn start" data-nav-type="start" data-name="${safeBuildingName}" data-coords="${
        coordinates.lng
      },${coordinates.lat}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                </svg>
                Set as Start
              </button>
              <button class="popup-action-btn end" data-nav-type="end" data-name="${safeBuildingName}" data-coords="${
        coordinates.lng
      },${coordinates.lat}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                  <circle cx="12" cy="9" r="2.5" fill="currentColor"></circle>
                </svg>
                Set as Destination
              </button>
            </div>
          </div>
        `

      this._setupPopupEventDelegation(this.popup)
      this.popup.setLngLat(coordinates).setHTML(popupContent).addTo(this.map)
    })
  }

  fitBounds(bounds) {
    this.map.fitBounds(bounds, { padding: 50 })
  }

  setCenter(lngLat, zoom = 13) {
    this.map.flyTo({ center: lngLat, zoom })
  }

  toggleLayer(type, visible) {
    const visibility = visible ? "visible" : "none"
    this.layerVisibility[type] = visible

    if (type === "buildings") {
      if (this.map.getLayer("buildings-fill")) {
        this.map.setLayoutProperty("buildings-fill", "visibility", visibility)
        this.map.setLayoutProperty(
          "buildings-outline",
          "visibility",
          visibility
        )
        this.map.setLayoutProperty("buildings-label", "visibility", visibility)
      }
    } else if (type === "roads") {
      if (this.map.getLayer("roads-line")) {
        this.map.setLayoutProperty("roads-line", "visibility", visibility)
        this.map.setLayoutProperty("roads-label", "visibility", visibility)
      }
    } else if (type === "footpath") {
      if (this.map.getLayer("footpath-line")) {
        this.map.setLayoutProperty("footpath-line", "visibility", visibility)
      }
    } else if (type === "grass") {
      if (this.map.getLayer("grass-fill")) {
        this.map.setLayoutProperty("grass-fill", "visibility", visibility)
        this.map.setLayoutProperty("grass-outline", "visibility", visibility)
      }
    } else if (type === "greenArea") {
      if (this.map.getLayer("greenArea-fill")) {
        this.map.setLayoutProperty("greenArea-fill", "visibility", visibility)
        this.map.setLayoutProperty(
          "greenArea-outline",
          "visibility",
          visibility
        )
      }
    } else if (type === "sportArena") {
      if (this.map.getLayer("sportArena-fill")) {
        this.map.setLayoutProperty("sportArena-fill", "visibility", visibility)
        this.map.setLayoutProperty(
          "sportArena-outline",
          "visibility",
          visibility
        )
        this.map.setLayoutProperty("sportArena-label", "visibility", visibility)
      }
    }
  }

  cycleMapStyle() {
    this.currentStyleIndex =
      (this.currentStyleIndex + 1) % CONFIG.map.styles.length
    const newStyle = CONFIG.map.styles[this.currentStyleIndex]

    this.map.setStyle(newStyle.url)

    this.map.once("style.load", () => {
      // Apply basemap config if using Standard style
      if (newStyle.id === "standard") {
        this.applyBasemapConfig()
      }
      // Reset interaction flags so listeners are re-registered after style change
      // (map.setStyle removes all layer-specific event handlers)
      this.sportArenaInteractionsSetup = false
      this.buildingInteractionsSetup = false
      this.addDataLayers()
    })
  }

  addDataLayers() {
    const { roads, buildings, footpath, grass, greenArea, sportArena } =
      this.layerData
    if (!roads || !buildings) return

    // Re-add green areas
    if (greenArea && !this.map.getSource("greenArea")) {
      this.map.addSource("greenArea", { type: "geojson", data: greenArea })
      this.map.addLayer({
        id: "greenArea-fill",
        type: "fill",
        source: "greenArea",
        paint: {
          "fill-color": CONFIG.colors.greenArea,
          "fill-opacity": 0.4,
        },
        layout: {
          visibility: this.layerVisibility.greenArea ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "greenArea-outline",
        type: "line",
        source: "greenArea",
        paint: {
          "line-color": CONFIG.colors.greenAreaOutline,
          "line-width": 1,
        },
        layout: {
          visibility: this.layerVisibility.greenArea ? "visible" : "none",
        },
      })
    }

    // Re-add grass
    if (grass && !this.map.getSource("grass")) {
      this.map.addSource("grass", { type: "geojson", data: grass })
      this.map.addLayer({
        id: "grass-fill",
        type: "fill",
        source: "grass",
        paint: { "fill-color": CONFIG.colors.grass, "fill-opacity": 0.5 },
        layout: {
          visibility: this.layerVisibility.grass ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "grass-outline",
        type: "line",
        source: "grass",
        paint: {
          "line-color": CONFIG.colors.grassOutline,
          "line-width": 1,
        },
        layout: {
          visibility: this.layerVisibility.grass ? "visible" : "none",
        },
      })
    }

    // Re-add sport arenas with data-driven styling
    if (sportArena && !this.map.getSource("sportArena")) {
      this.map.addSource("sportArena", {
        type: "geojson",
        data: sportArena,
      })
      this.map.addLayer({
        id: "sportArena-fill",
        type: "fill",
        source: "sportArena",
        paint: {
          "fill-color": [
            "match",
            ["get", "SportType"],
            "football",
            CONFIG.colors.sports.football.fill,
            "basketball",
            CONFIG.colors.sports.basketball.fill,
            "volleyball",
            CONFIG.colors.sports.volleyball.fill,
            "badminton",
            CONFIG.colors.sports.badminton.fill,
            CONFIG.colors.sportArena,
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.85,
            0.65,
          ],
        },
        layout: {
          visibility: this.layerVisibility.sportArena ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "sportArena-outline",
        type: "line",
        source: "sportArena",
        paint: {
          "line-color": [
            "match",
            ["get", "SportType"],
            "football",
            CONFIG.colors.sports.football.outline,
            "basketball",
            CONFIG.colors.sports.basketball.outline,
            "volleyball",
            CONFIG.colors.sports.volleyball.outline,
            "badminton",
            CONFIG.colors.sports.badminton.outline,
            CONFIG.colors.sportArenaOutline,
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            3,
            2,
          ],
        },
        layout: {
          visibility: this.layerVisibility.sportArena ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "sportArena-label",
        type: "symbol",
        source: "sportArena",
        layout: {
          visibility: this.layerVisibility.sportArena ? "visible" : "none",
          "text-field": ["get", "Name"],
          "text-size": 12,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "#1F2937",
          "text-halo-color": "rgba(255, 255, 255, 0.95)",
          "text-halo-width": 2,
        },
      })

      // Re-setup interactions after style change
      this.setupSportArenaInteractions()
    }

    // Re-add footpath
    if (footpath && !this.map.getSource("footpath")) {
      this.map.addSource("footpath", { type: "geojson", data: footpath })
      this.map.addLayer({
        id: "footpath-line",
        type: "line",
        source: "footpath",
        paint: {
          "line-color": CONFIG.colors.footpath,
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
        layout: {
          visibility: this.layerVisibility.footpath ? "visible" : "none",
        },
      })
    }

    // Re-add buildings with hover support
    if (!this.map.getSource("buildings")) {
      this.map.addSource("buildings", { type: "geojson", data: buildings })
      this.map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        paint: {
          "fill-color": CONFIG.colors.building,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.85,
            0.7,
          ],
        },
        layout: {
          visibility: this.layerVisibility.buildings ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "buildings-outline",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": CONFIG.colors.buildingOutline,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            2.5,
            1.5,
          ],
        },
        layout: {
          visibility: this.layerVisibility.buildings ? "visible" : "none",
        },
      })
      // Re-add building labels layer
      this.map.addLayer({
        id: "buildings-label",
        type: "symbol",
        source: "buildings",
        layout: {
          visibility: this.layerVisibility.buildings ? "visible" : "none",
          "text-field": ["case", ["!=", ["get", "name"], " "], ["get", "name"], ""],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-max-width": 10,
          "text-letter-spacing": 0.02,
          "text-padding": 8,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(255, 140, 0, 0.95)",
          "text-halo-width": 2.5,
          "text-halo-blur": 0.5,
        },
        filter: ["!=", ["get", "name"], " "],
      })

      // Re-setup building interactions after style change
      this.setupBuildingInteractions()
    }

    // Re-add roads
    if (!this.map.getSource("roads")) {
      this.map.addSource("roads", { type: "geojson", data: roads })
      this.map.addLayer({
        id: "roads-line",
        type: "line",
        source: "roads",
        paint: { "line-color": CONFIG.colors.road, "line-width": 2 },
        layout: {
          visibility: this.layerVisibility.roads ? "visible" : "none",
        },
      })
      this.map.addLayer({
        id: "roads-label",
        type: "symbol",
        source: "roads",
        layout: {
          visibility: this.layerVisibility.roads ? "visible" : "none",
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-letter-spacing": 0.05,
          "symbol-spacing": 300,
          "text-max-angle": 30,
        },
        paint: {
          "text-color": "#1E3A5F",
          "text-halo-color": "rgba(255, 255, 255, 0.95)",
          "text-halo-width": 2.5,
          "text-halo-blur": 0.5,
        },
      })
    }
  }

  resetView() {
    // Use same camera settings as intro animation
    const campusBounds = CONFIG.map.campusBounds
    const centerLng = (campusBounds[0][0] + campusBounds[1][0]) / 2
    const centerLat = (campusBounds[0][1] + campusBounds[1][1]) / 2
    const latOffset = (campusBounds[1][1] - campusBounds[0][1]) * -0.15
    const lngOffset = (campusBounds[1][0] - campusBounds[0][0]) * 0.25
    const adjustedCenter = [centerLng + lngOffset, centerLat + latOffset]

    this.map.flyTo({
      center: adjustedCenter,
      zoom: 17,
      pitch: 60,
      bearing: -10,
      duration: 1200,
      essential: true,
    })
  }

  /**
   * Animate the map from the initial zoomed-out view to a close-up 3D campus view.
   * Called after the splash screen mascot transition completes.
   * @returns {Promise} Resolves when the animation completes
   */
  animateIntro() {
    return new Promise((resolve) => {
      // Calculate campus center from bounds
      const campusBounds = CONFIG.map.campusBounds
      const centerLng = (campusBounds[0][0] + campusBounds[1][0]) / 2
      const centerLat = (campusBounds[0][1] + campusBounds[1][1]) / 2

      // Compensate for 60° pitch: tilted view makes center appear lower on screen
      // Shift center NORTH (add to lat) so campus appears centered
      const latOffset = (campusBounds[1][1] - campusBounds[0][1]) * -0.15
      // Shift center EAST (add to lng) to account for left sidebar panel
      const lngOffset = (campusBounds[1][0] - campusBounds[0][0]) * 0.25
      const adjustedCenter = [centerLng + lngOffset, centerLat + latOffset]

      this.map.flyTo({
        center: adjustedCenter,
        zoom: 17,
        pitch: 60,
        bearing: -10,
        duration: 2500,
        curve: 1.3,
        essential: true,
        easing: (t) => {
          // Custom easing for smoother deceleration
          return 1 - Math.pow(1 - t, 3)
        },
      })

      this.map.once("moveend", () => {
        // Update 3D button state to reflect new pitch
        document.getElementById("btnPitch")?.classList.add("active")
        resolve()
      })
    })
  }

  /**
   * Show or update the user's current location on the map
   * @param {Array} lngLat - [longitude, latitude] coordinates
   * @param {boolean} flyTo - Whether to fly to the location (default: false)
   */
  showUserLocation(lngLat, flyTo = false) {
    // Remove existing user location marker
    if (this.userLocationMarker) {
      this.userLocationMarker.remove()
    }

    // Create a custom element for the user location marker
    const el = document.createElement("div")
    el.className = "user-location-marker"
    el.innerHTML = `
      <div class="user-location-dot"></div>
      <div class="user-location-pulse"></div>
    `

    this.userLocationMarker = new mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("You are here"))
      .addTo(this.map)

    if (flyTo) {
      this.map.flyTo({
        center: lngLat,
        zoom: 17,
        duration: 1500,
      })
    }

    return this.userLocationMarker
  }

  /**
   * Remove the user location marker from the map
   */
  hideUserLocation() {
    if (this.userLocationMarker) {
      this.userLocationMarker.remove()
      this.userLocationMarker = null
    }
  }
}

export const mapManager = new MapManager();
