/**
 * PWA Module - Handles Progressive Web App functionality
 * - Service worker registration
 * - Online/offline detection
 * - Install prompt management
 * - Network quality detection
 */

// Connection quality levels
const ConnectionQuality = {
  OFFLINE: "offline",
  SLOW: "slow", // 2g, slow-2g
  MODERATE: "moderate", // 3g
  FAST: "fast", // 4g, wifi
}

class PWAManager {
  constructor() {
    this.deferredPrompt = null
    this.isOnline = navigator.onLine
    this.swRegistration = null
    this.onOnlineStatusChange = null
    this.onInstallPromptAvailable = null
    this.onOfflineTilesActive = null
    this.onConnectionQualityChange = null
    this.offlineTilesActive = false
    this.connectionQuality = ConnectionQuality.FAST
    this.connectionInfo = null
  }

  /**
   * Initialize PWA functionality
   */
  async init() {
    this.setupOnlineDetection()
    this.setupNetworkQualityDetection()
    this.setupServiceWorkerMessages()
    await this.registerServiceWorker()
    this.setupInstallPrompt()
    console.log("[PWA] Initialized")
  }

  /**
   * Setup Network Information API detection
   */
  setupNetworkQualityDetection() {
    if (!("connection" in navigator)) {
      console.log("[PWA] Network Information API not supported")
      return
    }

    const connection = navigator.connection
    this.connectionInfo = connection

    const updateConnectionQuality = () => {
      const prevQuality = this.connectionQuality
      this.connectionQuality = this.getQualityLevel(connection.effectiveType)

      console.log(
        "[PWA] Connection quality:",
        this.connectionQuality,
        `(${connection.effectiveType}, ${connection.downlink}Mbps, RTT: ${connection.rtt}ms)`
      )

      this.updateSlowConnectionUI()

      // Notify service worker of connection quality
      this.notifyServiceWorkerConnectionQuality()

      if (
        prevQuality !== this.connectionQuality &&
        this.onConnectionQualityChange
      ) {
        this.onConnectionQualityChange(this.connectionQuality, {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        })
      }
    }

    connection.addEventListener("change", updateConnectionQuality)

    // Initial check
    updateConnectionQuality()
  }

  /**
   * Get quality level from effective connection type
   */
  getQualityLevel(effectiveType) {
    if (!this.isOnline) return ConnectionQuality.OFFLINE

    switch (effectiveType) {
      case "slow-2g":
      case "2g":
        return ConnectionQuality.SLOW
      case "3g":
        return ConnectionQuality.MODERATE
      case "4g":
      default:
        return ConnectionQuality.FAST
    }
  }

  /**
   * Check if connection is slow (should prefer cached content)
   */
  isSlowConnection() {
    return (
      this.connectionQuality === ConnectionQuality.SLOW ||
      this.connectionQuality === ConnectionQuality.OFFLINE ||
      this.connectionInfo?.saveData === true
    )
  }

  /**
   * Update UI for slow connection
   */
  updateSlowConnectionUI() {
    let indicator = document.getElementById("slow-connection-indicator")
    const shouldShow =
      this.connectionQuality === ConnectionQuality.SLOW && this.isOnline

    if (shouldShow) {
      if (!indicator) {
        indicator = document.createElement("div")
        indicator.id = "slow-connection-indicator"
        indicator.className = "slow-connection-indicator"
        indicator.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          <span>Slow connection - using cached data</span>
        `
        document.body.appendChild(indicator)
      }
      indicator.classList.add("visible")
    } else if (indicator) {
      indicator.classList.remove("visible")
    }
  }

  /**
   * Notify service worker of current connection quality
   */
  notifyServiceWorkerConnectionQuality() {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({
        type: "CONNECTION_QUALITY",
        quality: this.connectionQuality,
        saveData: this.connectionInfo?.saveData || false,
      })
    }
  }

  /**
   * Setup listener for service worker messages
   */
  setupServiceWorkerMessages() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "OFFLINE_TILES_ACTIVE") {
          this.handleOfflineTilesActive()
        }
      })
    }
  }

  /**
   * Handle notification that offline tiles are being served
   */
  handleOfflineTilesActive() {
    if (this.offlineTilesActive) return // Already showing

    this.offlineTilesActive = true
    console.log("[PWA] Offline tiles are being served")
    this.showOfflineMapIndicator()

    if (this.onOfflineTilesActive) {
      this.onOfflineTilesActive()
    }
  }

  /**
   * Show indicator that map is using offline/cached tiles
   */
  showOfflineMapIndicator() {
    let indicator = document.getElementById("offline-map-indicator")

    if (!indicator) {
      indicator = document.createElement("div")
      indicator.id = "offline-map-indicator"
      indicator.className = "offline-map-indicator"
      indicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <path d="M3 9h18M9 21V9"></path>
        </svg>
        <span>Using cached map tiles</span>
      `

      // Add to map container
      const mapContainer = document.getElementById("map")
      if (mapContainer) {
        mapContainer.appendChild(indicator)
      }
    }

    indicator.classList.add("visible")
  }

  /**
   * Hide offline map indicator
   */
  hideOfflineMapIndicator() {
    this.offlineTilesActive = false
    const indicator = document.getElementById("offline-map-indicator")
    if (indicator) {
      indicator.classList.remove("visible")
    }
  }

  /**
   * Register the service worker
   */
  async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] Service workers not supported")
      return null
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      })

      console.log("[PWA] Service worker registered:", this.swRegistration.scope)

      // Handle updates - auto-apply
      this.swRegistration.addEventListener("updatefound", () => {
        const newWorker = this.swRegistration.installing

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("[PWA] New version available, applying update...")
            newWorker.postMessage({ type: "SKIP_WAITING" })
          }
        })
      })

      // Reload once when new service worker takes control
      let refreshing = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })

      return this.swRegistration
    } catch (error) {
      console.error("[PWA] Service worker registration failed:", error)
      return null
    }
  }

  /**
   * Setup online/offline detection
   */
  setupOnlineDetection() {
    const updateOnlineStatus = () => {
      const wasOnline = this.isOnline
      this.isOnline = navigator.onLine

      if (wasOnline !== this.isOnline) {
        console.log("[PWA] Online status changed:", this.isOnline)
        this.updateOfflineUI()

        // Hide offline map indicator when back online
        if (this.isOnline) {
          this.hideOfflineMapIndicator()
        }

        if (this.onOnlineStatusChange) {
          this.onOnlineStatusChange(this.isOnline)
        }
      }
    }

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    // Initial check
    this.updateOfflineUI()
  }

  /**
   * Update UI based on online/offline status
   */
  updateOfflineUI() {
    let indicator = document.getElementById("offline-indicator")

    if (!this.isOnline) {
      if (!indicator) {
        indicator = document.createElement("div")
        indicator.id = "offline-indicator"
        indicator.className = "offline-indicator"
        indicator.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
          <span>Offline Mode</span>
        `
        document.body.appendChild(indicator)
      }
      indicator.classList.add("visible")
    } else {
      if (indicator) {
        indicator.classList.remove("visible")
      }
    }
  }

  /**
   * Setup install prompt handling
   */
  setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("[PWA] Install prompt available")
      e.preventDefault()
      this.deferredPrompt = e

      if (this.onInstallPromptAvailable) {
        this.onInstallPromptAvailable()
      }

      this.showInstallButton()
    })

    window.addEventListener("appinstalled", () => {
      console.log("[PWA] App installed")
      this.deferredPrompt = null
      this.hideInstallButton()
    })
  }

  /**
   * Show install button
   */
  showInstallButton() {
    let installBtn = document.getElementById("pwa-install-btn")

    if (!installBtn) {
      installBtn = document.createElement("button")
      installBtn.id = "pwa-install-btn"
      installBtn.className = "pwa-install-btn"
      installBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Install App</span>
      `
      installBtn.addEventListener("click", () => this.promptInstall())

      // Add to sidebar footer
      const sidebarFooter = document.querySelector(".sidebar-footer")
      if (sidebarFooter) {
        sidebarFooter.insertBefore(installBtn, sidebarFooter.firstChild)
      }
    }

    installBtn.style.display = "flex"
  }

  /**
   * Hide install button
   */
  hideInstallButton() {
    const installBtn = document.getElementById("pwa-install-btn")
    if (installBtn) {
      installBtn.style.display = "none"
    }
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log("[PWA] No install prompt available")
      return false
    }

    this.deferredPrompt.prompt()
    const result = await this.deferredPrompt.userChoice

    console.log("[PWA] Install prompt result:", result.outcome)
    this.deferredPrompt = null

    return result.outcome === "accepted"
  }

  /**
   * Show notification when new version is available
   */
  showUpdateNotification() {
    // Create update notification
    const notification = document.createElement("div")
    notification.className = "pwa-update-notification"
    notification.innerHTML = `
      <p>A new version is available!</p>
      <button id="pwa-update-btn">Update Now</button>
      <button id="pwa-dismiss-btn">Later</button>
    `
    document.body.appendChild(notification)

    document.getElementById("pwa-update-btn")?.addEventListener("click", () => {
      this.applyUpdate()
      notification.remove()
    })

    document
      .getElementById("pwa-dismiss-btn")
      ?.addEventListener("click", () => {
        notification.remove()
      })
  }

  /**
   * Apply service worker update
   */
  async applyUpdate() {
    if (this.swRegistration?.waiting) {
      this.swRegistration.waiting.postMessage({ type: "SKIP_WAITING" })
      window.location.reload()
    }
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    if (!this.swRegistration?.active) {
      return null
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel()
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data)
      }

      this.swRegistration.active.postMessage({ type: "GET_CACHE_STATUS" }, [
        messageChannel.port2,
      ])
    })
  }

  /**
   * Clear all caches
   */
  async clearCaches() {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({ type: "CLEAR_CACHES" })
    }
  }

  /**
   * Check if app is installed (standalone mode)
   */
  isInstalled() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    )
  }
}

// Export singleton instance and connection quality constants
export const pwaManager = new PWAManager()
export { ConnectionQuality }
