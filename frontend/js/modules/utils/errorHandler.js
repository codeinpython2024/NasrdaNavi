/**
 * Global Error Handler
 * Catches unhandled errors and provides user-friendly feedback
 */

class ErrorHandler {
  constructor() {
    this.toastContainer = null
    this.initialized = false
  }

  /**
   * Initialize the error handler
   */
  init() {
    if (this.initialized) return

    this.createToastContainer()
    this.setupGlobalHandlers()
    this.initialized = true

    console.log("Error handler initialized")
  }

  /**
   * Create toast container for error messages
   */
  createToastContainer() {
    if (!document.body) {
      console.error(
        "Cannot create toast container: document.body not available"
      )
      return
    }
    this.toastContainer = document.createElement("div")
    this.toastContainer.id = "error-toast-container"
    this.toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
            pointer-events: none;
        `
    document.body.appendChild(this.toastContainer)
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Handle uncaught errors
    window.addEventListener("error", (event) => {
      this.handleError(
        event.error || new Error(event.message),
        "Uncaught Error"
      )
      // Don't prevent default so console still shows error
    })

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError(event.reason, "Unhandled Promise Rejection")
    })
  }

  /**
   * Handle an error
   * @param {Error|string} error - The error to handle
   * @param {string} context - Context where the error occurred
   */
  handleError(error, context = "") {
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(`[${context}]`, error)

    // Show user-friendly message
    this.showToast(this.getUserFriendlyMessage(errorMessage), "error")

    // Log to backend (if endpoint exists)
    this.logError(error, context)
  }

  /**
   * Convert error message to user-friendly message
   * @param {string} message - Original error message
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(message) {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
      return "Unable to connect to the server. Please check your internet connection."
    }

    if (lowerMessage.includes("mapbox") || lowerMessage.includes("map")) {
      return "There was an issue loading the map. Please refresh the page."
    }

    if (lowerMessage.includes("route") || lowerMessage.includes("path")) {
      return "Unable to calculate route. Please try different locations."
    }

    if (
      lowerMessage.includes("permission") ||
      lowerMessage.includes("denied")
    ) {
      return "Permission denied. Please enable the required permissions."
    }

    if (lowerMessage.includes("timeout")) {
      return "The request took too long. Please try again."
    }

    // Generic message for unknown errors
    return "Something went wrong. Please try again or refresh the page."
  }

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type (error, warning, success, info)
   * @param {number} duration - Duration in ms
   */
  showToast(message, type = "error", duration = 5000) {
    if (!this.toastContainer) {
      this.createToastContainer()
    }

    const toast = document.createElement("div")
    toast.className = `error-toast error-toast-${type}`

    const colors = {
      error: { bg: "rgba(225, 91, 79, 0.95)", icon: "⚠️" },
      warning: { bg: "rgba(255, 215, 0, 0.95)", icon: "⚡" },
      success: { bg: "rgba(0, 135, 81, 0.95)", icon: "✓" },
      info: { bg: "rgba(74, 158, 255, 0.95)", icon: "ℹ️" },
    }

    const color = colors[type] || colors.error

    toast.style.cssText = `
            background: ${color.bg};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 14px;
            font-family: var(--font-sans, system-ui, sans-serif);
            display: flex;
            align-items: flex-start;
            gap: 10px;
            pointer-events: auto;
            animation: toastSlideIn 0.3s ease;
            cursor: pointer;
        `

    const iconSpan = document.createElement("span")
    iconSpan.style.fontSize = "18px"
    iconSpan.textContent = color.icon

    const messageSpan = document.createElement("span")
    messageSpan.style.flex = "1"
    messageSpan.textContent = message

    const closeBtn = document.createElement("button")
    closeBtn.style.cssText =
      "background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; line-height: 1;"
    closeBtn.textContent = "×"

    toast.appendChild(iconSpan)
    toast.appendChild(messageSpan)
    toast.appendChild(closeBtn)

    // Close on click
    toast.addEventListener("click", () => {
      this.removeToast(toast)
    })

    this.toastContainer.appendChild(toast)

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(toast)
    }, duration)

    // Add animation styles if not already present
    if (!document.getElementById("error-toast-styles")) {
      const style = document.createElement("style")
      style.id = "error-toast-styles"
      style.textContent = `
                @keyframes toastSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes toastSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `
      document.head.appendChild(style)
    }
  }

  /**
   * Remove a toast from the container
   * @param {HTMLElement} toast - Toast element to remove
   */
  removeToast(toast) {
    if (!toast || !toast.parentElement) return

    toast.style.animation = "toastSlideOut 0.3s ease forwards"
    setTimeout(() => {
      toast.remove()
    }, 300)
  }

  /**
   * Log error to backend (optional)
   * @param {Error} error - Error to log
   * @param {string} context - Error context
   */
  async logError(error, context) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    try {
      // Sanitize URL: send only origin + pathname (no query string or fragment)
      const sanitizedUrl = window.location.origin + window.location.pathname

      // Only log in production or if endpoint exists
      // This is a non-blocking fire-and-forget request
      await fetch("/api/v1/log-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
          context: context,
          url: sanitizedUrl,
          platform: navigator.platform || "unknown",
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      })
    } catch {
      // Silently fail - we don't want logging errors to cause more errors
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Show a warning toast
   * @param {string} message - Warning message
   */
  warn(message) {
    this.showToast(message, "warning")
  }

  /**
   * Show a success toast
   * @param {string} message - Success message
   */
  success(message) {
    this.showToast(message, "success", 3000)
  }

  /**
   * Show an info toast
   * @param {string} message - Info message
   */
  info(message) {
    this.showToast(message, "info", 4000)
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler()

// Auto-initialize when module loads
if (typeof window !== "undefined") {
  errorHandler.init()
}
