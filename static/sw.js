/**
 * NasrdaNavi Service Worker
 * Enables offline functionality and caching for the campus navigation app
 */

const CACHE_VERSION = "v4"
const CACHE_NAME = `nasrdanavi-${CACHE_VERSION}`
const TILE_CACHE_NAME = `nasrdanavi-tiles-${CACHE_VERSION}`
const ROUTE_CACHE_NAME = `nasrdanavi-routes-${CACHE_VERSION}`
const EXTERNAL_CACHE_NAME = `nasrdanavi-external-${CACHE_VERSION}`

// Maximum number of tiles to cache (to prevent storage bloat)
const MAX_TILE_CACHE_SIZE = 500
const MAX_ROUTE_CACHE_SIZE = 50

// Connection quality state (updated via message from client)
let connectionQuality = "fast"
let saveDataMode = false

// External CDN resources to cache for offline use
const EXTERNAL_ASSETS = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css",
  "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js",
  "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js",
  "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0",
]

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/static/css/variables.css",
  "/static/css/main.css",
  "/static/css/splash.css",
  "/static/css/components.css",
  "/static/css/voice.css",
  "/static/css/map.css",
  "/static/css/mobile.css",
  "/static/js/main.js",
  "/static/js/config.js",
  "/static/js/modules/map/index.js",
  "/static/js/modules/navigation/index.js",
  "/static/js/modules/ui/index.js",
  "/static/js/modules/voice/index.js",
  "/static/js/modules/mascot/index.js",
  "/static/js/modules/splash/index.js",
  "/static/js/modules/utils/index.js",
  "/static/js/modules/utils/errorHandler.js",
  "/static/js/modules/utils/loading.js",
  "/static/js/modules/pwa/index.js",
  "/static/data/roads.geojson",
  "/static/data/buildings.geojson",
  "/static/data/Footpath.geojson",
  "/static/data/Grass.geojson",
  "/static/data/Green_area.geojson",
  "/static/data/Sport_arena.geojson",
  "/static/Vector.webp",
  "/static/nasrda-logo.png",
  "/static/favicon.ico",
  "/static/manifest.webmanifest",
  "/static/images/offline-tile.png",
  "/api/v1/map-config",
]

/**
 * Install event - pre-cache essential assets
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...")

  event.waitUntil(
    Promise.all([
      // Cache local assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log("[SW] Pre-caching app shell and assets")
        return cache.addAll(PRECACHE_ASSETS)
      }),
      // Cache external CDN assets (with no-cors for cross-origin)
      caches.open(EXTERNAL_CACHE_NAME).then((cache) => {
        console.log("[SW] Pre-caching external CDN assets")
        return Promise.all(
          EXTERNAL_ASSETS.map((url) =>
            fetch(url, { mode: "cors" })
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response)
                }
                console.warn("[SW] Failed to cache:", url)
              })
              .catch((err) => console.warn("[SW] Failed to fetch:", url, err))
          )
        )
      }),
    ])
      .then(() => {
        console.log("[SW] Pre-cache complete")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("[SW] Pre-cache failed:", error)
      })
  )
})

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...")

  const currentCaches = [
    CACHE_NAME,
    TILE_CACHE_NAME,
    ROUTE_CACHE_NAME,
    EXTERNAL_CACHE_NAME,
  ]

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old version caches
            if (
              cacheName.startsWith("nasrdanavi-") &&
              !currentCaches.includes(cacheName)
            ) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log("[SW] Claiming clients")
        return self.clients.claim()
      })
  )
})

/**
 * Fetch event - handle requests with appropriate caching strategies
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (!url.protocol.startsWith("http")) {
    return
  }

  // Handle Mapbox tile requests
  if (isMapboxTileRequest(url)) {
    event.respondWith(handleTileRequest(event.request))
    return
  }

  // Handle route API requests
  if (url.pathname === "/api/v1/route") {
    event.respondWith(handleRouteRequest(event.request))
    return
  }

  // Handle map config (network-first)
  if (url.pathname === "/api/v1/map-config") {
    event.respondWith(handleNetworkFirst(event.request))
    return
  }

  // Handle static assets (cache-first)
  if (isStaticAsset(url)) {
    event.respondWith(handleCacheFirst(event.request))
    return
  }

  // Handle external CDN assets (cache-first)
  if (isExternalCDNAsset(url)) {
    event.respondWith(handleExternalAsset(event.request))
    return
  }

  // Default: network-first for other requests
  event.respondWith(handleNetworkFirst(event.request))
})

/**
 * Check if request is a Mapbox tile
 */
function isMapboxTileRequest(url) {
  return (
    url.hostname.includes("mapbox.com") &&
    (url.pathname.includes("/tiles/") ||
      url.pathname.includes("/fonts/") ||
      url.pathname.includes("/sprites/"))
  )
}

/**
 * Check if request is a static asset
 */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/static/") ||
    url.pathname === "/" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".geojson") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico")
  )
}

/**
 * Check if request is an external CDN asset
 */
function isExternalCDNAsset(url) {
  const cdnHosts = [
    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "api.mapbox.com",
  ]
  return (
    cdnHosts.some((host) => url.hostname.includes(host)) &&
    !isMapboxTileRequest(url)
  )
}

/**
 * Cache-first strategy for static assets
 */
async function handleCacheFirst(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error("[SW] Network request failed:", error)

    // Return offline fallback for HTML requests
    if (request.headers.get("accept")?.includes("text/html")) {
      return caches.match("/")
    }

    throw error
  }
}

/**
 * Network-first strategy for dynamic content
 */
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url)
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline fallback for HTML
    if (request.headers.get("accept")?.includes("text/html")) {
      return caches.match("/")
    }

    throw error
  }
}

/**
 * Cache-first strategy for external CDN assets
 */
async function handleExternalAsset(request) {
  const cache = await caches.open(EXTERNAL_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request, { mode: "cors" })

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error("[SW] External asset fetch failed:", request.url)
    throw error
  }
}

/**
 * Handle Mapbox tile requests with stale-while-revalidate
 * On slow connections, prefer cached tiles and skip network fetch
 */
async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  // On slow connections with cached data, return cache immediately without network fetch
  if (shouldPreferCache() && cachedResponse) {
    console.log("[SW] Slow connection - returning cached tile")
    return cachedResponse
  }

  // Start network fetch
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        // Limit tile cache size
        await limitCacheSize(TILE_CACHE_NAME, MAX_TILE_CACHE_SIZE)
        cache.put(request, response.clone())
      }
      return response
    })
    .catch((error) => {
      console.log("[SW] Tile fetch failed:", error)
      return null
    })

  // Return cached response immediately if available (stale-while-revalidate)
  if (cachedResponse) {
    return cachedResponse
  }

  // Otherwise wait for network
  const networkResponse = await networkPromise
  if (networkResponse) {
    return networkResponse
  }

  // Return offline fallback tile for image tile requests
  const url = new URL(request.url)
  if (url.pathname.includes("/tiles/")) {
    const fallbackTile = await caches.match("/static/images/offline-tile.png")
    if (fallbackTile) {
      // Notify clients that we're serving offline tiles
      notifyClientsOfflineTiles()
      return fallbackTile
    }
  }

  // Return empty response if both fail
  return new Response(null, { status: 503, statusText: "Offline" })
}

/**
 * Notify all clients that offline tiles are being served
 */
async function notifyClientsOfflineTiles() {
  const clients = await self.clients.matchAll({ type: "window" })
  clients.forEach((client) => {
    client.postMessage({ type: "OFFLINE_TILES_ACTIVE" })
  })
}

/**
 * Handle route API requests - cache successful routes for offline use
 */
async function handleRouteRequest(request) {
  const cache = await caches.open(ROUTE_CACHE_NAME)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Limit route cache size and cache the route
      await limitCacheSize(ROUTE_CACHE_NAME, MAX_ROUTE_CACHE_SIZE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log("[SW] Route request failed, checking cache")
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      console.log("[SW] Returning cached route")
      return cachedResponse
    }

    // Return error response
    return new Response(
      JSON.stringify({
        error: "Offline",
        message:
          "Route calculation is not available offline. Previously calculated routes may still work.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxSize) {
    // Remove oldest entries (first in the list)
    const keysToDelete = keys.slice(0, keys.length - maxSize)
    await Promise.all(keysToDelete.map((key) => cache.delete(key)))
    console.log(`[SW] Trimmed ${keysToDelete.length} items from ${cacheName}`)
  }
}

/**
 * Message handler for cache management
 */
self.addEventListener("message", (event) => {
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        )
      })
    )
  }

  if (event.data.type === "GET_CACHE_STATUS") {
    getCacheStatus().then((status) => {
      event.ports[0].postMessage(status)
    })
  }

  if (event.data.type === "CONNECTION_QUALITY") {
    connectionQuality = event.data.quality
    saveDataMode = event.data.saveData
    console.log(
      "[SW] Connection quality updated:",
      connectionQuality,
      "saveData:",
      saveDataMode
    )
  }
})

/**
 * Check if we should prefer cached content (slow connection or save data mode)
 */
function shouldPreferCache() {
  return (
    connectionQuality === "slow" ||
    connectionQuality === "offline" ||
    saveDataMode
  )
}

/**
 * Get current cache status
 */
async function getCacheStatus() {
  const cacheNames = await caches.keys()
  const status = {}

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    status[cacheName] = keys.length
  }

  return status
}
