class SplashAnimator {
    constructor() {
        this.timeline = null;
    }

    animate() {
      const stars = document.querySelector(".splash-stars")
      const glow = document.querySelector(".mascot-glow")
      const mascot = document.getElementById("splashMascot")
      const brand = document.querySelector(".splash-brand")
      const loader = document.querySelector(".splash-loader")
      const orbit = document.querySelector(".splash-orbit")
      const particle = document.querySelector(".splash-particle")

      if (!stars || !glow || !mascot || !brand || !orbit || !particle) {
        console.warn("Missing required splash elements")
        return null
      }

      this.timeline = gsap.timeline()

      // Stars background animation
      this.timeline.to(
        stars,
        {
          backgroundPosition: "200px 200px",
          duration: 20,
          repeat: -1,
          ease: "none",
        },
        0
      )

      // Glow
      this.timeline.to(glow, { opacity: 1, scale: 1, duration: 0.8 }, 0.2)
      gsap.to(glow, {
        scale: 1.1,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      })

      // Orbit
      this.timeline.to(orbit, { opacity: 1, duration: 0.5 }, 0.3)
      gsap.to(orbit, { rotation: 360, duration: 8, repeat: -1, ease: "none" })
      gsap.set(particle, { x: 150, y: 0 })

      // Mascot entrance
      this.timeline.fromTo(
        mascot,
        { opacity: 0, scale: 0.3, rotation: -180 },
        {
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 1,
          ease: "back.out(1.7)",
        },
        0.4
      )

      // Mascot float
      gsap.to(mascot, {
        y: -10,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        delay: 1.5,
      })

      // Brand
      this.timeline.fromTo(
        brand,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8 },
        0.8
      )

      // Footer with logo
      const footer = document.querySelector(".splash-footer")
      if (footer) {
        this.timeline.fromTo(
          footer,
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          1.2
        )
      }

      return this.timeline
    }

    showStartButton() {
        const loader = document.querySelector('.splash-loader');
        const startBtn = document.getElementById('splashStartBtn');

        if (loader) {
            gsap.to(loader, { opacity: 0, y: -10, duration: 0.3 });
        }

        if (startBtn) {
            gsap.fromTo(startBtn,
                { opacity: 0, y: 20, scale: 0.9 },
                { opacity: 1, y: 0, scale: 1, duration: 0.5, delay: 0.2, ease: 'back.out(1.7)' }
            );
        }
    }

    kill() {
        if (this.timeline) this.timeline.kill();
        gsap.killTweensOf('.splash-stars');
        gsap.killTweensOf('.mascot-glow');
        gsap.killTweensOf('.splash-orbit');
        gsap.killTweensOf('#splashMascot');
        gsap.killTweensOf(".splash-brand")
        gsap.killTweensOf(".splash-footer")
        gsap.killTweensOf(".splash-loader")
        gsap.killTweensOf("#splashStartBtn")
    }
}

export const splashAnimator = new SplashAnimator();
