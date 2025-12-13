/**
 * Loading State Manager
 * Provides loading spinners, skeleton screens, and loading indicators
 */

class LoadingManager {
  constructor() {
    this.activeLoaders = new Map()
    this.spinnerContainer = null
    this.init()
  }

  init() {
    // Add CSS if not already present
    if (!document.getElementById("loading-styles")) {
      this.injectStyles()
    }
  }

  /**
   * Inject loading styles into document
   */
  injectStyles() {
    const style = document.createElement("style")
    style.id = "loading-styles"
    style.textContent = `
      /* Spinner Overlay */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 12, 16, 0.8);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        animation: fadeIn 0.2s ease forwards;
      }

      .loading-overlay.fade-out {
        animation: fadeOut 0.2s ease forwards;
      }

      @keyframes fadeIn {
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        to { opacity: 0; }
      }

      /* Spinner */
      .loading-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(255, 140, 0, 0.2);
        border-top-color: #FF8C00;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-spinner.small {
        width: 20px;
        height: 20px;
        border-width: 2px;
      }

      .loading-spinner.large {
        width: 64px;
        height: 64px;
        border-width: 5px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Loading text */
      .loading-text {
        margin-top: 16px;
        color: #B0B8C4;
        font-size: 14px;
        text-align: center;
      }

      /* Inline spinner */
      .inline-spinner {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .inline-spinner .loading-spinner {
        width: 16px;
        height: 16px;
        border-width: 2px;
      }

      /* Button loading state */
      .btn-loading {
        position: relative;
        pointer-events: none;
        color: transparent !important;
      }

      .btn-loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 16px;
        height: 16px;
        margin: -8px 0 0 -8px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      /* Skeleton screens */
      .skeleton {
        background: linear-gradient(90deg, 
          rgba(255, 255, 255, 0.05) 25%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0.05) 75%
        );
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.5s infinite;
        border-radius: 4px;
      }

      @keyframes skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .skeleton-text {
        height: 14px;
        margin-bottom: 8px;
        border-radius: 4px;
      }

      .skeleton-text.short {
        width: 60%;
      }

      .skeleton-text.medium {
        width: 80%;
      }

      .skeleton-text.long {
        width: 100%;
      }

      .skeleton-circle {
        border-radius: 50%;
      }

      .skeleton-rect {
        border-radius: 4px;
      }

      /* Directions skeleton */
      .skeleton-directions {
        padding: 12px 0;
      }

      .skeleton-direction-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .skeleton-direction-item:last-child {
        border-bottom: none;
      }

      .skeleton-direction-number {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }

      .skeleton-direction-text {
        flex: 1;
      }

      /* Route calculating indicator */
      .route-calculating {
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 12, 16, 0.95);
        border: 1px solid rgba(255, 140, 0, 0.3);
        border-radius: 24px;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .route-calculating .loading-spinner {
        width: 20px;
        height: 20px;
        border-width: 2px;
      }

      .route-calculating-text {
        color: #B0B8C4;
        font-size: 13px;
      }

      /* Map loading overlay */
      .map-loading {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 12, 16, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;
      }

      /* Progress bar */
      .loading-progress {
        width: 200px;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 16px;
      }

      .loading-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #FF8C00, #FF6B00);
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .loading-progress-indeterminate .loading-progress-bar {
        width: 30%;
        animation: progressIndeterminate 1.5s ease-in-out infinite;
      }

      @keyframes progressIndeterminate {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Show a full-screen loading overlay
   * @param {string} id - Unique identifier for this loader
   * @param {string} message - Loading message to display
   * @param {boolean} showProgress - Whether to show progress bar
   * @returns {object} - Controller with update/hide methods
   */
  showOverlay(id, message = "Loading...", showProgress = false) {
    // Remove existing overlay with same id
    this.hideOverlay(id)

    const overlay = document.createElement("div")
    overlay.className = "loading-overlay"
    overlay.id = `loading-${id}`
    overlay.setAttribute("role", "status")
    overlay.setAttribute("aria-live", "polite")

    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text"></div>
      ${
        showProgress
          ? '<div class="loading-progress loading-progress-indeterminate"><div class="loading-progress-bar"></div></div>'
          : ""
      }
    `
    overlay.querySelector(".loading-text").textContent = message

    document.body.appendChild(overlay)
    this.activeLoaders.set(id, overlay)

    return {
      update: (newMessage) => {
        const textEl = overlay.querySelector(".loading-text")
        if (textEl) textEl.textContent = newMessage
      },
      setProgress: (percent) => {
        const progressEl = overlay.querySelector(".loading-progress")
        const barEl = overlay.querySelector(".loading-progress-bar")
        if (progressEl && barEl) {
          progressEl.classList.remove("loading-progress-indeterminate")
          barEl.style.width = `${percent}%`
        }
      },
      hide: () => this.hideOverlay(id),
    }
  }

  /**
   * Hide a loading overlay
   * @param {string} id - Identifier of the loader to hide
   */
  hideOverlay(id) {
    const overlay = this.activeLoaders.get(id)
    if (overlay) {
      overlay.classList.add("fade-out")
      setTimeout(() => overlay.remove(), 200)
      this.activeLoaders.delete(id)
    }
  }

  /**
   * Show route calculating indicator
   * @param {string} message - Message to display
   * @returns {function} - Function to hide the indicator
   */
  showRouteCalculating(message = "Calculating route...") {
    this.hideRouteCalculating()

    const indicator = document.createElement("div")
    indicator.className = "route-calculating"
    indicator.id = "route-calculating"
    indicator.setAttribute("role", "status")
    indicator.setAttribute("aria-live", "polite")

    indicator.innerHTML = `
      <div class="loading-spinner"></div>
      <span class="route-calculating-text"></span>
    `
    indicator.querySelector(".route-calculating-text").textContent = message

    document.body.appendChild(indicator)

    return () => this.hideRouteCalculating()
  }

  /**
   * Hide route calculating indicator
   */
  hideRouteCalculating() {
    const indicator = document.getElementById("route-calculating")
    if (indicator) {
      indicator.style.animation = "fadeOut 0.2s ease forwards"
      setTimeout(() => indicator.remove(), 200)
    }
  }

  /**
   * Add loading state to a button
   * @param {HTMLElement} button - Button element
   * @param {boolean} loading - Whether to show loading state
   */
  setButtonLoading(button, loading) {
    if (loading) {
      button.classList.add("btn-loading")
      button.disabled = true
    } else {
      button.classList.remove("btn-loading")
      button.disabled = false
    }
  }

  /**
   * Create skeleton placeholder elements
   * @param {string} type - Type of skeleton (directions, list, text)
   * @param {number} count - Number of skeleton items
   * @returns {string} - HTML string
   */
  createSkeleton(type, count = 3) {
    switch (type) {
      case "directions":
        return `
          <div class="skeleton-directions" role="status" aria-label="Loading directions">
            ${Array(count)
              .fill(0)
              .map(
                () => `
              <div class="skeleton-direction-item">
                <div class="skeleton skeleton-circle skeleton-direction-number"></div>
                <div class="skeleton-direction-text">
                  <div class="skeleton skeleton-text long"></div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `

      case "list":
        return `
          <div role="status" aria-label="Loading">
            ${Array(count)
              .fill(0)
              .map(
                () => `
              <div class="skeleton skeleton-rect" style="height: 40px; margin-bottom: 8px;"></div>
            `
              )
              .join("")}
          </div>
        `

      case "text":
        return `
          <div role="status" aria-label="Loading">
            <div class="skeleton skeleton-text long"></div>
            <div class="skeleton skeleton-text medium"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
        `

      default:
        return `<div class="skeleton skeleton-rect" style="height: 100%; width: 100%;"></div>`
    }
  }

  /**
   * Show skeleton in an element
   * @param {HTMLElement} element - Container element
   * @param {string} type - Type of skeleton
   * @param {number} count - Number of items
   */
  showSkeleton(element, type = "text", count = 3) {
    element.innerHTML = this.createSkeleton(type, count)
  }

  /**
   * Create inline spinner DOM element
   * @param {string} text - Text to show next to spinner
   * @param {string} size - Size (small, medium, large)
   * @returns {HTMLSpanElement} - DOM element
   */
  createInlineSpinner(text = "", size = "small") {
    const container = document.createElement("span")
    container.className = "inline-spinner"
    container.setAttribute("role", "status")

    const spinner = document.createElement("span")
    spinner.className = `loading-spinner ${size}`
    container.appendChild(spinner)

    if (text) {
      const textSpan = document.createElement("span")
      textSpan.textContent = text
      container.appendChild(textSpan)
    }

    return container
  }
}

export const loadingManager = new LoadingManager()
