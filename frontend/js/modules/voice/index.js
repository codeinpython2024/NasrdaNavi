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
        this.initVoice();
    }

    initVoice() {
        const setVoice = () => {
            const voices = this.synth.getVoices();
            this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
                         voices.find(v => v.lang.startsWith('en')) ||
                         voices[0];
        };

        if (this.synth.getVoices().length) {
            setVoice();
        } else {
            this.synth.onvoiceschanged = setVoice;
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
        if (!this.enabled) return;

        if (priority) {
            this.stop();
            this.queue = [text];
        } else {
            this.queue.push(text);
        }

        this.processQueue();
    }

    setDirections(directions) {
        this.directions = directions || [];
        this.currentStep = 0;
    }

    speakDirections(directions) {
        if (!this.enabled || !directions?.length) return;

        this.stop();
        this.setDirections(directions);

        // Only announce route found and first direction
        const total = directions[directions.length - 1]?.text.match(/(\d+) meters/)?.[1] || '';
        this.speak(`Route found! ${total} meters total.`, true);
        
        // Speak first direction after brief pause
        setTimeout(() => {
            if (this.directions.length > 0) {
                this.speak(this.directions[0].text);
            }
        }, 500);
    }

    // Call this when user reaches next waypoint
    speakNextDirection() {
        if (!this.enabled) return;
        
        this.currentStep++;
        if (this.currentStep < this.directions.length) {
            this.speak(this.directions[this.currentStep].text, true);
        }
    }

    // Call this to repeat current direction
    repeatCurrentDirection() {
        if (!this.enabled || !this.directions.length) return;
        
        const step = this.directions[this.currentStep];
        if (step) {
            this.speak(step.text, true);
        }
    }

    processQueue() {
        if (this.isSpeaking || !this.queue.length) return;

        const text = this.queue.shift();
        const utterance = new SpeechSynthesisUtterance(text);

        if (this.voice) utterance.voice = this.voice;
        utterance.rate = 0.95;
        utterance.pitch = 1.05;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.animateMascot(true);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.animateMascot(false);
            this.processQueue();
        };

        utterance.onerror = () => {
            this.isSpeaking = false;
            this.animateMascot(false);
            this.processQueue();
        };

        this.synth.speak(utterance);
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
        this.speak("Hello! I'm Navi, your navigation assistant. Click on the map to set your start and end points.", true);
    }

    announceStart() {
        this.speak("Start point set. Now click on your destination.", true);
    }

    announceCalculating() {
        this.speak("Calculating your route...", true);
    }

    announceError(msg) {
        this.speak(`Sorry, ${msg}`, true);
    }

    announceCleared() {
        this.directions = [];
        this.currentStep = 0;
        this.speak("Route cleared. Ready for a new journey!", true);
    }
}

export const voiceAssistant = new VoiceAssistant();
