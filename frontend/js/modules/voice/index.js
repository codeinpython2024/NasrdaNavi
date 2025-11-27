class VoiceAssistant {
    constructor() {
        this.synth = window.speechSynthesis;
        this.queue = [];
        this.isSpeaking = false;
        this.voice = null;
        this.mascotEl = null;
        this.enabled = true;
        this.directions = [];
        this.currentStep = 0;
        this.initialized = false;
        this.initVoice();
    }

    initVoice() {
        if (this.synth.getVoices().length) {
            this.setVoice();
        } else {
            this.synth.onvoiceschanged = () => this.setVoice();
        }

        // Workaround for Chrome - needs user gesture, but we can prime it
        document.addEventListener('click', () => {
            if (!this.initialized) {
                this.prime();
            }
        }, { once: true });
    }

    setVoice() {
        const voices = this.synth.getVoices();
        this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
                     voices.find(v => v.lang.startsWith('en')) ||
                     voices[0];
        this.initialized = true;
    }

    prime() {
        // Resume audio context if paused
        if (this.synth.paused) {
            this.synth.resume();
        }
        
        // Try to load voices again if not initialized
        if (!this.initialized) {
            const voices = this.synth.getVoices();
            if (voices.length) {
                this.setVoice();
            }
        }
    }

    setMascotElement(el) {
        this.mascotEl = el;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stop();
        return this.enabled;
    }

    speak(text, priority = false) {
        if (!this.enabled || !text) return;

        // Cancel any ongoing speech for priority
        if (priority) {
            this.synth.cancel();
            this.queue = [];
            this.isSpeaking = false;
        }

        this.queue.push(text);
        this.processQueue();
    }

    setDirections(directions) {
        this.directions = directions || [];
        this.currentStep = 0;
    }

    speakDirections(directions, totalDistanceMeters) {
        if (!this.enabled || !directions?.length) return;

        this.stop();
        this.setDirections(directions);

        const distanceText = totalDistanceMeters ? `${Math.round(totalDistanceMeters)} meters` : 'distance unknown';
        this.speak(`Route found! ${distanceText} total.`, true);
        
        setTimeout(() => {
            if (this.directions.length > 0) {
                this.speak(this.directions[0].text);
            }
        }, 2000);
    }

    speakNextDirection() {
        if (!this.enabled) return;
        this.currentStep++;
        if (this.currentStep < this.directions.length) {
            this.speak(this.directions[this.currentStep].text, true);
        }
    }

    repeatCurrentDirection() {
        if (!this.enabled || !this.directions.length) return;
        const step = this.directions[this.currentStep];
        if (step) this.speak(step.text, true);
    }

    processQueue() {
        if (this.isSpeaking || !this.queue.length) return;

        // Chrome bug workaround - resume if paused
        if (this.synth.paused) {
            this.synth.resume();
        }

        const text = this.queue.shift();
        const utterance = new SpeechSynthesisUtterance(text);

        if (this.voice) utterance.voice = this.voice;
        utterance.rate = 1.05;
        utterance.pitch = 1.1;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.animateMascot(true);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.animateMascot(false);
            // Small delay before next utterance
            setTimeout(() => this.processQueue(), 300);
        };

        utterance.onerror = (e) => {
            console.warn('Speech error:', e.error);
            this.isSpeaking = false;
            this.animateMascot(false);
            setTimeout(() => this.processQueue(), 300);
        };

        try {
            this.synth.speak(utterance);
        } catch (e) {
            console.warn('Speech failed:', e);
            this.isSpeaking = false;
        }
    }

    animateMascot(speaking) {
        if (!this.mascotEl) return;
        this.mascotEl.classList.toggle('speaking', speaking);
    }

    stop() {
        this.synth.cancel();
        this.queue = [];
        this.isSpeaking = false;
        this.animateMascot(false);
    }

    greet() {
        this.speak("Hello! I'm Navi, your navigation assistant.", true);
    }

    announceStart() {
        this.speak("Start point set. Now click your destination.", true);
    }

    announceCalculating() {
        this.speak("Calculating route.", true);
    }

    announceError(msg) {
        this.speak(`Sorry, ${msg}`, true);
    }

    announceCleared() {
        this.directions = [];
        this.currentStep = 0;
        this.speak("Route cleared.", true);
    }
}

export const voiceAssistant = new VoiceAssistant();
