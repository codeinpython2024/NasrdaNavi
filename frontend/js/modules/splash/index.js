class SplashAnimator {
    constructor() {
        this.timeline = null;
        this.elements = null;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    
    _cacheElements() {
        if (this.elements) return this.elements;
        this.elements = {
            stars: document.querySelector(".splash-stars"),
            glow: document.querySelector(".mascot-glow"),
            mascot: document.getElementById("splashMascot"),
            brand: document.querySelector(".splash-brand"),
            orbit: document.querySelector(".splash-orbit"),
            particle: document.querySelector(".splash-particle"),
            footer: document.querySelector(".splash-footer"),
            startBtn: document.getElementById("splashStartBtn")
        };
        return this.elements;
    }

    animate() {
        this.kill();
        const el = this._cacheElements();

        if (!el.stars || !el.glow || !el.mascot || !el.brand || !el.orbit || !el.particle) {
            console.warn("Missing required splash elements");
            return null;
        }

        // Reduced motion: show elements instantly
        if (this.prefersReducedMotion) {
            gsap.set([el.glow, el.mascot, el.brand, el.orbit, el.footer], { opacity: 1 });
            return null;
        }

        this.timeline = gsap.timeline();

        // Stars background animation
        this.timeline.to(el.stars, {
            backgroundPosition: "200px 200px",
            duration: 20,
            repeat: -1,
            ease: "none"
        }, 0);

        // Glow fade-in and pulse
        this.timeline.to(el.glow, { opacity: 1, scale: 1, duration: 0.8 }, 0.2);
        this.timeline.to(el.glow, {
            scale: 1.1,
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        }, 1.0);

        // Orbit
        this.timeline.to(el.orbit, { opacity: 1, duration: 0.5 }, 0.3);
        this.timeline.to(el.orbit, { rotation: 360, duration: 8, repeat: -1, ease: "none" }, 0.8);
        gsap.set(el.particle, { x: 150, y: 0 });

        // Mascot entrance and float
        this.timeline.fromTo(el.mascot,
            { opacity: 0, scale: 0.3, rotation: -180 },
            { opacity: 1, scale: 1, rotation: 0, duration: 1, ease: "back.out(1.7)" },
            0.4
        );
        this.timeline.to(el.mascot, {
            y: -10,
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        }, 1.5);

        // Brand
        this.timeline.fromTo(el.brand,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.8
        );

        // Footer
        if (el.footer) {
            this.timeline.fromTo(el.footer, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.2);
        }

        return this.timeline;
    }

    showStartButton() {
        const el = this._cacheElements();
        if (!el.startBtn) return;

        if (this.prefersReducedMotion) {
            gsap.set(el.startBtn, { opacity: 1 });
            return;
        }

        gsap.fromTo(el.startBtn,
            { opacity: 0, y: 20, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }
        );
    }

    kill() {
        if (this.timeline) {
            this.timeline.kill();
            this.timeline = null;
        }
        gsap.killTweensOf([
            ".splash-stars", ".mascot-glow", ".splash-orbit",
            ".splash-particle", "#splashMascot", ".splash-brand",
            ".splash-footer", "#splashStartBtn"
        ]);
    }
}

export const splashAnimator = new SplashAnimator();
