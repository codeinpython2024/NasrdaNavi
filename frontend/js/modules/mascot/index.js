import { voiceAssistant } from '../voice/index.js';

class MascotAnimator {
    constructor() {
        this.splashMascot = null;
        this.voiceMascot = null;
        this.avatar = null;
        this.bubble = null;
        this.isIdle = false;
        this._idleTimeout = null;
        this._idleTween = null;
        this._clickHandler = null;
        this._initialized = false;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    init() {
        if (this._initialized) return;
        
        this.splashMascot = document.getElementById('splashMascot');
        this.voiceMascot = document.getElementById('voiceMascot');
        this.avatar = document.getElementById('voiceMascotAvatar');
        this.bubble = document.getElementById('voiceBubble');
        
        voiceAssistant.setMascotElement(this.avatar);
        this.setupClickHandler();
        this._initialized = true;
    }

    setupClickHandler() {
        if (!this.avatar || this._clickHandler) return;
        
        this._clickHandler = () => {
            const enabled = voiceAssistant.toggle();
            const status = document.getElementById('voiceMascotStatus');
            if (status) {
              status.textContent = enabled ? "Voice On" : "Muted";
              status.classList.toggle("muted", !enabled);
            }
            
            this.showBubble(enabled ? "I'm listening!" : "Voice muted");
            this.playClickAnimation();
            
            // Haptic feedback on mobile
            if (navigator.vibrate) navigator.vibrate(50);
        };
        
        this.avatar.addEventListener('click', this._clickHandler);
    }

    transitionFromSplash() {
        return new Promise(resolve => {
            const splash = document.getElementById('splash');
            
            // Ensure init was called
            if (!this._initialized) this.init();
            
            if (!splash || !this.splashMascot || !this.voiceMascot) {
                if (splash) splash.remove();
                this._showVoiceMascot();
                resolve();
                return;
            }

            // Reduced motion: instant transition
            if (this.prefersReducedMotion) {
                splash.remove();
                this._showVoiceMascot();
                resolve();
                return;
            }

            const splashRect = this.splashMascot.getBoundingClientRect();
            
            // Get target position from actual voice mascot element's computed styles
            // Temporarily make it visible to get correct position
            this.voiceMascot.style.visibility = 'visible';
            this.voiceMascot.style.opacity = '0';
            const targetRect = this.voiceMascot.getBoundingClientRect();
            const targetSize = targetRect.width || 64;
            this.voiceMascot.style.visibility = 'hidden';

            // Create flying mascot clone
            const flyingMascot = document.createElement('img');
            flyingMascot.src = "/static/Vector.webp";
            flyingMascot.alt = "";
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

            // Fly mascot to voice mascot position
            gsap.to(flyingMascot, {
                left: targetRect.left,
                top: targetRect.top,
                width: targetSize,
                height: targetSize,
                rotation: 360,
                duration: 1.2,
                ease: 'power2.inOut',
                onComplete: () => {
                    this._showVoiceMascot();
                    flyingMascot.remove();
                    splash.remove();
                    this.playEntranceAnimation();
                    resolve();
                }
            });
        });
    }
    
    _showVoiceMascot() {
        if (!this.voiceMascot) return;
        gsap.set(this.voiceMascot, { opacity: 1, visibility: 'visible' });
        this.voiceMascot.setAttribute('aria-hidden', 'false');
    }

    playEntranceAnimation() {
        if (!this.avatar || this.prefersReducedMotion) return;

        gsap.fromTo(this.avatar, 
            { scale: 0.5 },
            { scale: 1, duration: 0.4, ease: 'back.out(1.7)' }
        );

        setTimeout(() => this.playWaveAnimation(), 300);
    }

    playWaveAnimation() {
        if (!this.avatar || this.prefersReducedMotion) return;

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
        if (!this.avatar || this.prefersReducedMotion) return;

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
      // Clear any existing timers to prevent duplicate sequences
      if (this.introTimers && this.introTimers.length > 0) {
        this.introTimers.forEach((timer) => clearTimeout(timer))
        this.introTimers = []
      }
      this.introComplete = false

      this.introTimers = []

      const steps = [
        { text: "Hi! I'm Nasrda Navi, your campus guide!", delay: 0 },
        {
          text: "Click the map to set your route. Let's explore!",
          delay: 3000,
        },
      ]

      steps.forEach((step, i) => {
        const timer = setTimeout(() => {
          if (!this.introComplete) {
            voiceAssistant.speak(step.text, step.delay === 0)
          }
          if (i === steps.length - 1) {
            this.introComplete = true
          }
        }, step.delay)
        this.introTimers.push(timer)
      })
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
        if (!this.avatar || this.isIdle || this.prefersReducedMotion) return;

        this.isIdle = true;
        this._idleTween = gsap.to(this.avatar, {
            y: -6,
            duration: 2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1
        });
    }

    stopIdleAnimation() {
        this.isIdle = false;
        if (this._idleTween) {
            this._idleTween.kill();
            this._idleTween = null;
        }
        if (this.avatar) {
            gsap.killTweensOf(this.avatar);
            gsap.set(this.avatar, { y: 0, clearProps: "y" });
        }
    }
    
    destroy() {
        this.stopIdleAnimation();
        this.stopIntroduction();
        if (this._clickHandler && this.avatar) {
            this.avatar.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        this._initialized = false;
    }
}

export const mascotAnimator = new MascotAnimator();
