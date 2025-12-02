import { voiceAssistant } from '../voice/index.js';

class MascotAnimator {
    constructor() {
        this.splashMascot = null;
        this.voiceMascot = null;
        this.avatar = null;
        this.bubble = null;
        this.isIdle = true;
    }

    init() {
        this.splashMascot = document.getElementById('splashMascot');
        this.voiceMascot = document.getElementById('voiceMascot');
        this.avatar = document.getElementById('voiceMascotAvatar');
        this.bubble = document.getElementById('voiceBubble');
        
        voiceAssistant.setMascotElement(this.avatar);
        this.setupClickHandler();
    }

    setupClickHandler() {
        if (!this.avatar) return;
        
        this.avatar.addEventListener('click', () => {
            const enabled = voiceAssistant.toggle();
            const status = document.getElementById('voiceMascotStatus');
            status.textContent = enabled ? 'Voice On' : 'Muted';
            status.classList.toggle('muted', !enabled);
            
            this.showBubble(enabled ? "I'm listening!" : "Voice muted");
            this.playClickAnimation();
        });
    }

    transitionFromSplash() {
        return new Promise(resolve => {
            const splash = document.getElementById('splash');
            if (!splash || !this.splashMascot || !this.voiceMascot) {
                if (splash) splash.remove();
                gsap.set(this.voiceMascot, { opacity: 1 });
                resolve();
                return;
            }

            const splashRect = this.splashMascot.getBoundingClientRect();
            const targetRect = this.voiceMascot.getBoundingClientRect();

            // Create flying mascot clone
            const flyingMascot = document.createElement('img');
            flyingMascot.src = '/static/Vector.png';
            flyingMascot.style.cssText = `
                position: fixed;
                z-index: 10000;
                width: ${splashRect.width}px;
                height: ${splashRect.height}px;
                left: ${splashRect.left}px;
                top: ${splashRect.top}px;
                border-radius: 50%;
                pointer-events: none;
                object-fit: cover;
            `;
            document.body.appendChild(flyingMascot);

            // Hide splash mascot
            this.splashMascot.style.visibility = 'hidden';

            // Fade out splash
            gsap.to(splash, {
                opacity: 0,
                duration: 0.5,
                delay: 0.2
            });

            // Fly mascot to corner
            gsap.to(flyingMascot, {
                left: targetRect.left,
                top: targetRect.top,
                width: 64,
                height: 64,
                rotation: 360,
                duration: 1.2,
                ease: 'power2.inOut',
                onComplete: () => {
                    // Show actual voice mascot
                    gsap.set(this.voiceMascot, { opacity: 1 });
                    flyingMascot.remove();
                    splash.remove();
                    this.playEntranceAnimation();
                    resolve();
                }
            });
        });
    }

    playEntranceAnimation() {
        if (!this.avatar) return;

        gsap.fromTo(this.avatar, 
            { scale: 0.5 },
            { scale: 1, duration: 0.4, ease: 'back.out(1.7)' }
        );

        setTimeout(() => this.playWaveAnimation(), 300);
    }

    playWaveAnimation() {
        if (!this.avatar) return;

        gsap.to(this.avatar, {
            rotation: 8,
            duration: 0.1,
            yoyo: true,
            repeat: 5,
            ease: 'power1.inOut',
            onComplete: () => gsap.set(this.avatar, { rotation: 0 })
        });
    }

    playClickAnimation() {
        if (!this.avatar) return;

        gsap.to(this.avatar, {
            scale: 0.9,
            duration: 0.1,
            yoyo: true,
            repeat: 1
        });
    }

    showBubble(text, duration = 3000) {
        if (!this.bubble) return;

        this.bubble.textContent = text;
        gsap.killTweensOf(this.bubble);
        gsap.fromTo(this.bubble,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.3 }
        );
        gsap.to(this.bubble, {
            opacity: 0,
            delay: duration / 1000,
            duration: 0.3
        });
    }

    introduce() {
        this.introTimers = [];
        this.introComplete = false;

        const steps = [
            { text: "Hi! I'm Nasrda Navi, your campus guide!", delay: 0 },
            { text: "Click the map to set your route. Let's explore!", delay: 3000 }
        ];

        steps.forEach((step, i) => {
            const timer = setTimeout(() => {
                if (!this.introComplete) {
                    voiceAssistant.speak(step.text, step.delay === 0);
                }
                if (i === steps.length - 1) {
                    this.introComplete = true;
                }
            }, step.delay);
            this.introTimers.push(timer);
        });
    }

    stopIntroduction() {
        this.introComplete = true;
        if (this.introTimers) {
            this.introTimers.forEach(t => clearTimeout(t));
            this.introTimers = [];
        }
        voiceAssistant.stop();
    }

    startIdleAnimation() {
        if (!this.avatar || !this.isIdle) return;

        const float = () => {
            if (!this.isIdle) return;
            gsap.to(this.avatar, {
                y: -6,
                duration: 2,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    if (this.isIdle) setTimeout(float, 1000);
                }
            });
        };
        float();
    }

    stopIdleAnimation() {
        this.isIdle = false;
        gsap.killTweensOf(this.avatar);
        gsap.set(this.avatar, { y: 0 });
    }
}

export const mascotAnimator = new MascotAnimator();
