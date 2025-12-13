class VoiceAssistant {
  constructor() {
    // Check for Web Speech API support
    this.isSupported = this.checkSupport()
    this.synth = this.isSupported ? window.speechSynthesis : null
    this.queue = []
    this.isSpeaking = false
    this.voice = null
    this.mascotEl = null
    this.enabled = true
    this.directions = []
    this.currentStep = 0
    this.initialized = false

    // Browser detection for compatibility fixes
    this.browserInfo = this.detectBrowser()

    // Chrome's 15-second pause bug workaround
    this.chromePauseTimer = null
    this.CHROME_PAUSE_INTERVAL = 10000 // Resume every 10 seconds

    // Retry configuration
    this.maxRetries = 3
    this.retryCount = 0

    // African language codes in order of preference
    this.africanLangCodes = [
      "en-NG", // Nigerian English
      "en-GH", // Ghanaian English
      "en-KE", // Kenyan English
      "en-ZA", // South African English
      "en-TZ", // Tanzanian English
      "en-ZW", // Zimbabwean English
      "yo-NG", // Yoruba (Nigeria)
      "ha-NG", // Hausa (Nigeria)
      "ig-NG", // Igbo (Nigeria)
      "sw", // Swahili
      "sw-KE", // Swahili (Kenya)
      "sw-TZ", // Swahili (Tanzania)
      "zu-ZA", // Zulu (South Africa)
      "xh-ZA", // Xhosa (South Africa)
      "af-ZA", // Afrikaans (South Africa)
    ]

    // African voice name patterns (some systems use names instead of proper lang codes)
    this.africanVoicePatterns = [
      /nigeri/i,
      /lagos/i,
      /abuja/i,
      /ghana/i,
      /accra/i,
      /kenya/i,
      /nairobi/i,
      /africa/i,
      /zulu/i,
      /xhosa/i,
      /swahili/i,
      /yoruba/i,
      /hausa/i,
      /igbo/i,
      /tunde/i,
      /ade/i,
      /chidi/i,
      /ngozi/i,
      /amara/i, // Common Nigerian names
    ]

    if (this.isSupported) {
      this.initVoice()
    } else {
      console.warn(
        "Web Speech API not supported in this browser. Voice assistant disabled."
      )
    }
  }

  /**
   * Check if Web Speech API is supported
   * @returns {boolean}
   */
  checkSupport() {
    if (typeof window === "undefined") return false

    // Check for speechSynthesis
    if (!("speechSynthesis" in window)) {
      return false
    }

    // Check for SpeechSynthesisUtterance
    if (!("SpeechSynthesisUtterance" in window)) {
      return false
    }

    return true
  }

  /**
   * Detect browser for compatibility fixes
   * @returns {object} Browser info
   */
  detectBrowser() {
    const ua = navigator.userAgent
    return {
      isChrome: /Chrome/.test(ua) && !/Edge|Edg/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isFirefox: /Firefox/.test(ua),
      isEdge: /Edge|Edg/.test(ua),
      isIOS: /iPhone|iPad|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isMobile: /iPhone|iPad|iPod|Android/.test(ua),
    }
  }

  initVoice() {
    if (!this.isSupported) return

    // Try to get voices immediately
    const voices = this.synth.getVoices()
    if (voices.length) {
      this.setVoice()
    }

    // Also listen for voiceschanged (required for Chrome)
    this.synth.onvoiceschanged = () => {
      if (!this.initialized) {
        this.setVoice()
      }
    }

    // Workaround for browsers that need user gesture
    const primeOnInteraction = () => {
      if (!this.initialized) {
        this.prime()
      }
    }

    // Multiple event listeners for better mobile compatibility
    document.addEventListener("click", primeOnInteraction, { once: true })
    document.addEventListener("touchstart", primeOnInteraction, { once: true })
    document.addEventListener("keydown", primeOnInteraction, { once: true })
  }

  setVoice() {
    if (!this.isSupported) return

    const voices = this.synth.getVoices()

    if (!voices.length) {
      console.warn("No voices available yet")
      return
    }

    // Try to find preferred voices in order
    // 1. Try African English voices first
    for (const langCode of this.africanLangCodes) {
      const africanVoice = voices.find((v) => v.lang === langCode)
      if (africanVoice) {
        this.voice = africanVoice
        this.initialized = true
        console.log(`Voice set to ${africanVoice.name} (${africanVoice.lang})`)
        return
      }
    }

    // 2. Try African voice patterns by name
    for (const pattern of this.africanVoicePatterns) {
      const matchingVoice = voices.find((v) => pattern.test(v.name))
      if (matchingVoice) {
        this.voice = matchingVoice
        this.initialized = true
        console.log(
          `Voice set to ${matchingVoice.name} (${matchingVoice.lang})`
        )
        return
      }
    }

    // 3. Try Samantha (good quality en-US voice on macOS/iOS)
    const samantha = voices.find(
      (v) =>
        v.name.toLowerCase().includes("samantha") && v.lang.startsWith("en")
    )
    if (samantha) {
      this.voice = samantha
      this.initialized = true
      console.log(`Voice set to ${samantha.name} (${samantha.lang})`)
      return
    }

    // 4. Try Google UK English (good quality on Chrome)
    const googleUK = voices.find(
      (v) => v.name.includes("Google UK English") && v.lang.startsWith("en")
    )
    if (googleUK) {
      this.voice = googleUK
      this.initialized = true
      console.log(`Voice set to ${googleUK.name} (${googleUK.lang})`)
      return
    }

    // 5. Fallback to any en-US voice
    const enUS = voices.find((v) => v.lang === "en-US")
    if (enUS) {
      this.voice = enUS
      this.initialized = true
      console.log(`Voice set to ${enUS.name} (${enUS.lang})`)
      return
    }

    // 6. Fallback to any English voice
    const anyEnglish = voices.find((v) => v.lang.startsWith("en"))
    if (anyEnglish) {
      this.voice = anyEnglish
      this.initialized = true
      console.log(`Voice set to ${anyEnglish.name} (${anyEnglish.lang})`)
      return
    }

    // 7. Final fallback - first available voice
    if (voices.length) {
      this.voice = voices[0]
      this.initialized = true
      console.log(`Voice set to ${voices[0].name} (${voices[0].lang})`)
    }
  }

  prime() {
    if (!this.isSupported) return

    // Resume audio context if paused (Chrome fix)
    if (this.synth.paused) {
      this.synth.resume()
    }

    // Cancel any stuck utterances (Safari/iOS fix)
    if (this.synth.speaking) {
      this.synth.cancel()
    }

    // Try to load voices again if not initialized
    if (!this.initialized) {
      const voices = this.synth.getVoices()
      if (voices.length) {
        this.setVoice()
      }
    }

    // iOS requires speaking something short to initialize
    if (this.browserInfo.isIOS && !this.initialized) {
      const silentUtterance = new SpeechSynthesisUtterance("")
      silentUtterance.volume = 0
      this.synth.speak(silentUtterance)
    }
  }

  setMascotElement(el) {
    this.mascotEl = el
  }

  /**
   * Check if voice assistant is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.isSupported && this.initialized
  }

  toggle() {
    this.enabled = !this.enabled
    if (!this.enabled) this.stop()

    // Dispatch event for UI updates
    window.dispatchEvent(
      new CustomEvent("voice-toggled", {
        detail: { enabled: this.enabled },
      })
    )

    return this.enabled
  }

  speak(text, priority = false) {
    if (!this.enabled || !text) return
    if (!this.isSupported) {
      console.log("Voice (fallback):", text)
      return
    }

    // Cancel any ongoing speech for priority
    if (priority) {
      this.synth.cancel()
      this.queue = []
      this.isSpeaking = false
      this.stopChromePauseWorkaround()
    }

    this.queue.push(text)
    this.processQueue()
  }

  setDirections(directions) {
    this.directions = directions || []
    this.currentStep = 0
  }

  speakDirections(directions, totalDistanceMeters) {
    if (!this.enabled || !directions?.length) return

    this.stop()
    this.setDirections(directions)

    // Format distance nicely
    let distanceText
    if (!totalDistanceMeters) {
      distanceText = "distance unknown"
    } else if (totalDistanceMeters >= 1000) {
      const km = (totalDistanceMeters / 1000).toFixed(1)
      distanceText = `${km} kilometers`
    } else {
      distanceText = `${Math.round(totalDistanceMeters)} meters`
    }

    const phrases = [
      `Route found! ${distanceText} total. Let's go!`,
      `Got it! The journey is ${distanceText}. Follow me!`,
      `Route ready! ${distanceText} to your destination.`,
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)

    setTimeout(() => {
      if (this.directions.length > 0) {
        this.speak(this.directions[0].text)
      }
    }, 2000)
  }

  speakNextDirection() {
    if (!this.enabled) return
    this.currentStep++
    if (this.currentStep < this.directions.length) {
      this.speak(this.directions[this.currentStep].text, true)
    }
  }

  repeatCurrentDirection() {
    if (!this.enabled || !this.directions.length) return
    const step = this.directions[this.currentStep]
    if (step) this.speak(step.text, true)
  }

  processQueue() {
    if (!this.isSupported) return
    if (this.isSpeaking || !this.queue.length) return

    // Chrome bug workaround - resume if paused
    if (this.synth.paused) {
      this.synth.resume()
    }

    const text = this.queue.shift()
    const utterance = new SpeechSynthesisUtterance(text)

    if (this.voice) utterance.voice = this.voice

    // Adjust speech parameters based on browser
    if (this.browserInfo.isIOS) {
      // iOS speaks faster, so slow it down slightly
      utterance.rate = 0.9
      utterance.pitch = 1.0
    } else if (this.browserInfo.isAndroid) {
      // Android can be inconsistent
      utterance.rate = 1.0
      utterance.pitch = 1.0
    } else {
      utterance.rate = 1.05
      utterance.pitch = 1.1
    }
    utterance.volume = 1.0

    utterance.onstart = () => {
      this.isSpeaking = true
      this.animateMascot(true)

      // Start Chrome pause workaround
      if (this.browserInfo.isChrome) {
        this.startChromePauseWorkaround()
      }
    }

    utterance.onend = () => {
      this.isSpeaking = false
      this.animateMascot(false)
      this.stopChromePauseWorkaround()
      this.retryCount = 0

      // Small delay before next utterance
      setTimeout(() => this.processQueue(), 300)
    }

    utterance.onerror = (e) => {
      console.warn("Speech error:", e.error)
      this.isSpeaking = false
      this.animateMascot(false)
      this.stopChromePauseWorkaround()

      // Handle specific error types
      if (e.error === "interrupted" || e.error === "canceled") {
        // Normal interruption, continue queue
        setTimeout(() => this.processQueue(), 100)
      } else if (e.error === "network") {
        // Network error - may need online voices
        console.warn("Network error - falling back to local voice")
        this.fallbackToLocalVoice()
        // Re-queue the text
        this.queue.unshift(text)
        setTimeout(() => this.processQueue(), 500)
      } else if (e.error === "not-allowed") {
        // User gesture required
        console.warn("Speech requires user interaction")
        this.showSpeechBlockedHint()
      } else {
        // Other errors - retry logic
        if (this.retryCount < this.maxRetries) {
          this.retryCount++
          console.warn(
            `Retrying speech (${this.retryCount}/${this.maxRetries})`
          )
          this.queue.unshift(text)
          setTimeout(() => this.processQueue(), 500)
        } else {
          this.retryCount = 0
          setTimeout(() => this.processQueue(), 300)
        }
      }
    }

    try {
      this.synth.speak(utterance)

      // Timeout fallback for browsers that don't fire events properly
      this.speechTimeout = setTimeout(() => {
        if (this.isSpeaking) {
          console.warn("Speech timeout - forcing completion")
          this.isSpeaking = false
          this.animateMascot(false)
          this.stopChromePauseWorkaround()
          this.processQueue()
        }
      }, 30000) // 30 second max per utterance
    } catch (e) {
      console.warn("Speech failed:", e)
      this.isSpeaking = false
      this.stopChromePauseWorkaround()
    }
  }

  /**
   * Chrome pauses speech synthesis after ~15 seconds of speaking
   * This workaround resumes it periodically
   */
  startChromePauseWorkaround() {
    this.stopChromePauseWorkaround()
    this.chromePauseTimer = setInterval(() => {
      if (this.synth.speaking && !this.synth.paused) {
        this.synth.pause()
        this.synth.resume()
      }
    }, this.CHROME_PAUSE_INTERVAL)
  }

  stopChromePauseWorkaround() {
    if (this.chromePauseTimer) {
      clearInterval(this.chromePauseTimer)
      this.chromePauseTimer = null
    }
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout)
      this.speechTimeout = null
    }
  }

  /**
   * Fallback to a local (non-network) voice
   */
  fallbackToLocalVoice() {
    if (!this.isSupported) return

    const voices = this.synth.getVoices()
    // Local voices usually don't have "Google" in name
    const localVoice = voices.find(
      (v) => v.lang.startsWith("en") && !v.name.includes("Google")
    )
    if (localVoice) {
      this.voice = localVoice
      console.log(`Fallback to local voice: ${localVoice.name}`)
    }
  }

  /**
   * Show hint when speech is blocked
   */
  showSpeechBlockedHint() {
    // Dispatch event for UI to handle
    window.dispatchEvent(
      new CustomEvent("voice-blocked", {
        detail: { message: "Click anywhere to enable voice assistant" },
      })
    )
  }

  animateMascot(speaking) {
    if (!this.mascotEl) return
    this.mascotEl.classList.toggle("speaking", speaking)

    // Also toggle .active on the ring element (decoupled from DOM order)
    const ring = this.mascotEl
      .closest(".voice-mascot")
      ?.querySelector(".voice-mascot-ring")
    if (ring) {
      ring.classList.toggle("active", speaking)
    }
  }

  stop() {
    if (this.isSupported) {
      this.synth.cancel()
    }
    this.queue = []
    this.isSpeaking = false
    this.animateMascot(false)
    this.stopChromePauseWorkaround()
  }

  greet() {
    const greetings = [
      "Hello! I'm Nasrda Navi, your navigation assistant. Welcome!",
      "Hey there! Nasrda Navi here, ready to guide you. How far?",
      "Welcome! I'm Nasrda Navi, let's navigate together!",
    ]
    const greeting = greetings[Math.floor(Math.random() * greetings.length)]
    this.speak(greeting, true)
  }

  announceStart() {
    const phrases = [
      "Start point set! Now tap where you want to go.",
      "Starting point locked. Click your destination now.",
      "Nice one! Now select your destination.",
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)
  }

  announceCalculating() {
    const phrases = [
      "Calculating your route, one moment.",
      "Finding the best route for you.",
      "Let me find the way for you.",
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)
  }

  announceError(msg) {
    const phrases = [
      `Sorry o, ${msg}`,
      `Ah, there's a problem: ${msg}`,
      `Sorry, ${msg}`,
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)
  }

  announceCleared() {
    this.directions = []
    this.currentStep = 0
    const phrases = [
      "Route cleared! Ready for a new journey.",
      "All cleared. Where to next?",
      "Route cleared, let's start fresh.",
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)
  }

  announceArrival() {
    const phrases = [
      "You have arrived at your destination. Well done!",
      "You don reach! This is your destination.",
      "Destination reached! Safe travels.",
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    this.speak(phrase, true)
  }

  /**
   * Get current status for debugging
   * @returns {object} Status info
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      isInitialized: this.initialized,
      isEnabled: this.enabled,
      isSpeaking: this.isSpeaking,
      queueLength: this.queue.length,
      currentVoice: this.voice?.name || "none",
      browserInfo: this.browserInfo,
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop()
    this.stopChromePauseWorkaround()
    if (this.isSupported) {
      this.synth.onvoiceschanged = null
    }
  }
}

export const voiceAssistant = new VoiceAssistant()
