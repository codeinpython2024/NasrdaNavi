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
        
        // African language codes in order of preference
        this.africanLangCodes = [
            'en-NG',  // Nigerian English
            'en-GH',  // Ghanaian English  
            'en-KE',  // Kenyan English
            'en-ZA',  // South African English
            'en-TZ',  // Tanzanian English
            'en-ZW',  // Zimbabwean English
            'yo-NG',  // Yoruba (Nigeria)
            'ha-NG',  // Hausa (Nigeria)
            'ig-NG',  // Igbo (Nigeria)
            'sw',     // Swahili
            'sw-KE',  // Swahili (Kenya)
            'sw-TZ',  // Swahili (Tanzania)
            'zu-ZA',  // Zulu (South Africa)
            'xh-ZA',  // Xhosa (South Africa)
            'af-ZA',  // Afrikaans (South Africa)
        ];
        
        // African voice name patterns (some systems use names instead of proper lang codes)
        this.africanVoicePatterns = [
            /nigeri/i, /lagos/i, /abuja/i,
            /ghana/i, /accra/i,
            /kenya/i, /nairobi/i,
            /africa/i, /zulu/i, /xhosa/i,
            /swahili/i, /yoruba/i, /hausa/i, /igbo/i,
            /tunde/i, /ade/i, /chidi/i, /ngozi/i, /amara/i, // Common Nigerian names
        ];
        
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
        
        // Try to find Samantha (en-US)
        const samantha = voices.find(v => v.name.toLowerCase().includes('samantha') && v.lang.startsWith('en'));
        if (samantha) {
            this.voice = samantha;
            this.initialized = true;
            return;
        }
        
        // Fallback to any en-US voice
        const enUS = voices.find(v => v.lang === 'en-US');
        if (enUS) {
            this.voice = enUS;
            this.initialized = true;
            return;
        }
        
        // Final fallback
        this.voice = voices[0];
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

        // Format distance nicely
        let distanceText;
        if (!totalDistanceMeters) {
            distanceText = 'distance unknown';
        } else if (totalDistanceMeters >= 1000) {
            const km = (totalDistanceMeters / 1000).toFixed(1);
            distanceText = `${km} kilometers`;
        } else {
            distanceText = `${Math.round(totalDistanceMeters)} meters`;
        }
        
        const phrases = [
            `Route found! ${distanceText} total. Let's go!`,
            `Got it! The journey is ${distanceText}. Follow me!`,
            `Route ready! ${distanceText} to your destination.`,
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
        
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
        const greetings = [
            "Hello! I'm Nasrda Navi, your navigation assistant. Welcome!",
            "Hey there! Nasrda Navi here, ready to guide you. How far?",
            "Welcome! I'm Nasrda Navi, let's navigate together!",
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        this.speak(greeting, true);
    }

    announceStart() {
        const phrases = [
            "Start point set! Now tap where you want to go.",
            "Starting point locked. Click your destination now.",
            "Nice one! Now select your destination.",
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
    }

    announceCalculating() {
        const phrases = [
            "Calculating your route, one moment.",
            "Finding the best route for you.",
            "Let me find the way for you.",
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
    }

    announceError(msg) {
        const phrases = [
            `Sorry o, ${msg}`,
            `Ah, there's a problem: ${msg}`,
            `Sorry, ${msg}`,
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
    }

    announceCleared() {
        this.directions = [];
        this.currentStep = 0;
        const phrases = [
            "Route cleared! Ready for a new journey.",
            "All cleared. Where to next?",
            "Route cleared, let's start fresh.",
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
    }
    
    announceArrival() {
        const phrases = [
            "You have arrived at your destination. Well done!",
            "You don reach! This is your destination.",
            "Destination reached! Safe travels.",
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, true);
    }
}

export const voiceAssistant = new VoiceAssistant();
