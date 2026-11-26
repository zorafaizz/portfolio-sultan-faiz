import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Splits plain text nodes inside an element into masked word spans
 * while preserving inline markup (like <span class="serif-italic">) and accessible name.
 */
function splitElementWords(el) {
  if (el.dataset.splitReady === 'true') return [];
  const fullText = (el.textContent || '').replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', fullText);

  const created = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || '';
      if (!value.trim()) return;
      const frag = document.createDocumentFragment();
      const parts = value.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part.trim()) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const mask = document.createElement('span');
        mask.className = 'split-word-mask';
        mask.setAttribute('aria-hidden', 'true');
        const word = document.createElement('span');
        word.className = 'split-word';
        word.textContent = part;
        mask.appendChild(word);
        frag.appendChild(mask);
        created.push(word);
      });
      node.parentNode.replaceChild(frag, node);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(walk);
    }
  }

  Array.from(el.childNodes).forEach(walk);
  el.dataset.splitReady = 'true';
  return created;
}

export function initChoreography({ reduceMotion, onHeroReady }) {
  const cleanups = [];
  let lenis = null;
  let scrollVelocity = 0;

  // 1. Sole smooth-scroll engine: Lenis (bypassed cleanly on reduced motion)
  if (!reduceMotion) {
    lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.92,
    });

    lenis.on('scroll', (e) => {
      scrollVelocity = e.velocity || 0;
      ScrollTrigger.update();
    });

    const tick = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    cleanups.push(() => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    });
  }

  // Smooth anchor scrolling & back-to-top
  const anchorHandlers = [];
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const handler = (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: -24, duration: 1.25 });
      } else {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    link.addEventListener('click', handler);
    anchorHandlers.push([link, handler]);
  });

  const topBtn = document.querySelector('[data-scroll-top]');
  if (topBtn) {
    const topHandler = () => {
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.4 });
      } else {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    topBtn.addEventListener('click', topHandler);
    anchorHandlers.push([topBtn, topHandler]);
  }

  cleanups.push(() => {
    anchorHandlers.forEach(([el, fn]) => el.removeEventListener('click', fn));
  });

  // 2. Live Jakarta Clock (UTC+7)
  const clockEl = document.querySelector('[data-jakarta-clock]');
  if (clockEl) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const updateClock = () => {
      clockEl.textContent = `JKT ${fmt.format(new Date())}`;
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    cleanups.push(() => clearInterval(timer));
  }

  // 3. Custom Spring Cursor & Magnetic Controls (fine pointer + motion allowed)
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (isFinePointer && !reduceMotion) {
    const cursorRoot = document.querySelector('[data-cursor]');
    const dot = document.querySelector('[data-cursor-dot]');
    const ring = document.querySelector('[data-cursor-ring]');
    const label = document.querySelector('[data-cursor-label]');

    if (cursorRoot && dot && ring && label) {
      cursorRoot.classList.add('is-enabled');
      const setDotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
      const setDotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
      const setRingX = gsap.quickTo(ring, 'x', { duration: 0.36, ease: 'power3.out' });
      const setRingY = gsap.quickTo(ring, 'y', { duration: 0.36, ease: 'power3.out' });

      const onMove = (e) => {
        setDotX(e.clientX);
        setDotY(e.clientY);
        setRingX(e.clientX);
        setRingY(e.clientY);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => window.removeEventListener('pointermove', onMove));

      const labelTargets = document.querySelectorAll('[data-cursor-text]');
      const labelCleanups = [];
      labelTargets.forEach((el) => {
        const onEnter = () => {
          label.textContent = el.dataset.cursorText || '';
          cursorRoot.classList.add('is-labeled');
        };
        const onLeave = () => {
          cursorRoot.classList.remove('is-labeled');
        };
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
        labelCleanups.push(() => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
      cleanups.push(() => labelCleanups.forEach((fn) => fn()));
    }

    // Magnetic hover pull on CTAs and nav links
    const magnetCleanups = [];
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });

      const onMove = (e) => {
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - (rect.left + rect.width / 2)) * 0.24;
        const relY = (e.clientY - (rect.top + rect.height / 2)) * 0.24;
        xTo(relX);
        yTo(relY);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      magnetCleanups.push(() => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      });
    });
    cleanups.push(() => magnetCleanups.forEach((fn) => fn()));
  }

  // If reduced motion is requested, bypass preloader & all scroll timelines immediately
  if (reduceMotion) {
    const loader = document.querySelector('[data-preloader]');
    if (loader) loader.remove();
    if (onHeroReady) onHeroReady();
    return {
      dispose() {
        cleanups.forEach((fn) => fn());
      },
    };
  }

  // 4. GSAP Context for automatic ScrollTrigger + tween cleanup
  const ctx = gsap.context(() => {
    // 4a. Preloader -> Hero entrance choreography
    const loader = document.querySelector('[data-preloader]');
    const bar = document.querySelector('[data-preloader-bar]');
    const countEl = document.querySelector('[data-preloader-count]');
    const heroTitle = document.querySelector('[data-hero-title]');
    const heroEnterItems = document.querySelectorAll('[data-hero-enter]');
    const heroWords = heroTitle ? splitElementWords(heroTitle) : [];

    const playHeroEntrance = () => {
      const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      if (heroWords.length) {
        heroTl.fromTo(
          heroWords,
          { yPercent: 112, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 1.05, stagger: 0.075 }
        );
      }
      if (heroEnterItems.length) {
        heroTl.fromTo(
          heroEnterItems,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.85, stagger: 0.1 },
          '-=0.65'
        );
      }
      if (onHeroReady) onHeroReady();
    };

    if (loader && bar && countEl) {
      const counter = { val: 0 };
      const preTl = gsap.timeline({
        onComplete: () => {
          loader.remove();
          playHeroEntrance();
        },
      });
      preTl
        .to(counter, {
          val: 100,
          duration: 0.85,
          ease: 'power2.inOut',
          onUpdate: () => {
            countEl.textContent = String(Math.round(counter.val)).padStart(2, '0');
          },
        })
        .to(bar, { scaleX: 1, duration: 0.85, ease: 'power2.inOut' }, 0)
        .to(loader, { yPercent: -100, duration: 0.82, ease: 'power4.inOut' }, '+=0.08');
    } else {
      playHeroEntrance();
    }

    // 4b. Hero giant background wordmark parallax on scroll
    document.querySelectorAll('[data-hero-parallax]').forEach((el) => {
      const speed = Number(el.dataset.heroParallax || -0.12);
      gsap.to(el, {
        y: () => window.innerHeight * speed * 1.4,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '#hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });
    });

    // 4c. Velocity-reactive kinetic marquee
    const marqueeTrack = document.querySelector('[data-marquee-track]');
    if (marqueeTrack) {
      let xPos = 0;
      const baseSpeed = 0.85;
      const tickMarquee = () => {
        const halfWidth = marqueeTrack.scrollWidth / 2;
        if (!halfWidth) return;
        const boost = Math.min(8, Math.abs(scrollVelocity) * 0.22);
        const dir = scrollVelocity < -1 ? -1 : 1;
        xPos -= (baseSpeed + boost) * dir;
        if (xPos <= -halfWidth) xPos += halfWidth;
        if (xPos > 0) xPos -= halfWidth;
        const skew = gsap.utils.clamp(-5, 5, scrollVelocity * 0.14);
        marqueeTrack.style.transform = `translate3d(${xPos.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
        scrollVelocity *= 0.92;
      };
      gsap.ticker.add(tickMarquee);
      cleanups.push(() => gsap.ticker.remove(tickMarquee));
    }

    // 4d. Scroll-scrubbed Manifesto Word-by-Word Illumination
    document.querySelectorAll('[data-scrub-words]').forEach((el) => {
      const text = (el.textContent || '').trim();
      el.setAttribute('aria-label', text);
      el.textContent = '';
      const words = text.split(/\s+/);
      const spans = words.map((w, idx) => {
        const sp = document.createElement('span');
        sp.className = 'scrub-word';
        sp.setAttribute('aria-hidden', 'true');
        sp.textContent = idx < words.length - 1 ? `${w}\u00A0` : w;
        el.appendChild(sp);
        return sp;
      });

      gsap.to(spans, {
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          end: 'bottom 45%',
          scrub: 0.6,
        },
      });
    });

    // 4e. Split-word kinetic section headings
    gsap.utils.toArray('[data-split-reveal]').forEach((el) => {
      const words = splitElementWords(el);
      if (!words.length) return;
      gsap.fromTo(
        words,
        { yPercent: 112, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: 0.95,
          ease: 'power4.out',
          stagger: 0.055,
          scrollTrigger: {
            trigger: el,
            start: 'top 84%',
            once: true,
          },
        }
      );
    });

    // 4f. Section-by-section subtle reveals
    gsap.utils.toArray('[data-story-section]').forEach((section) => {
      const items = section.querySelectorAll('[data-reveal-item]');
      if (!items.length) return;
      gsap.fromTo(
        items,
        { y: 28, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.075,
          scrollTrigger: {
            trigger: section,
            start: 'top 84%',
            once: true,
          },
        }
      );
    });

    // 4g. Sticky Depth Card Stack (Desktop) + subtle media parallax
    const mm = gsap.matchMedia();
    mm.add('(min-width: 961px)', () => {
      gsap.utils.toArray('[data-sticky-stack]').forEach((stack) => {
        const cards = gsap.utils.toArray(stack.querySelectorAll('[data-stack-card]'));
        cards.forEach((card, index) => {
          const nextCard = cards[index + 1];
          if (!nextCard) return;

          gsap.to(card, {
            scale: 0.91 + index * 0.018,
            opacity: 0.55,
            y: -26,
            ease: 'none',
            scrollTrigger: {
              trigger: nextCard,
              start: 'top 82%',
              end: 'top 18%',
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
        });
      });
    });

    gsap.utils.toArray('[data-card-parallax]').forEach((img) => {
      gsap.fromTo(
        img,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: img.closest('.work-card'),
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.9,
          },
        }
      );
    });

    // 4h. Footer parallax handoff
    const footer = document.querySelector('[data-footer-parallax]');
    if (footer) {
      gsap.fromTo(
        footer.querySelector('.footer__inner'),
        { y: -48, opacity: 0.7 },
        {
          y: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: footer,
            start: 'top bottom',
            end: 'top 38%',
            scrub: 0.9,
          },
        }
      );
    }
  });

  // Refresh measurements after fonts & media settle
  const onLoadRefresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', onLoadRefresh);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  cleanups.push(() => window.removeEventListener('load', onLoadRefresh));

  return {
    dispose() {
      ctx.revert();
      cleanups.forEach((fn) => fn());
    },
  };
}
