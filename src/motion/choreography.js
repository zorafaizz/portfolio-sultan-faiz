import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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

export function initChoreography({ reduceMotion }) {
  const cleanups = [];
  let lenis = null;
  let scrollVelocity = 0;

  // 1. Sole smooth-scroll engine: Lenis (bypassed on reduced motion)
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

    const tick = (time) => lenis.raf(time * 1000);
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
        lenis.scrollTo(target, { offset: -20, duration: 1.2 });
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
      if (lenis) lenis.scrollTo(0, { duration: 1.35 });
      else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    topBtn.addEventListener('click', topHandler);
    anchorHandlers.push([topBtn, topHandler]);
  }
  cleanups.push(() => anchorHandlers.forEach(([el, fn]) => el.removeEventListener('click', fn)));

  // 2. Fine-pointer interactive suite: Custom Cursor, Magnetic Controls, 3D Card Tilt & Spotlights
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (isFinePointer && !reduceMotion) {
    const cursorRoot = document.querySelector('[data-cursor]');
    const dot = document.querySelector('[data-cursor-dot]');
    const ring = document.querySelector('[data-cursor-ring]');
    const label = document.querySelector('[data-cursor-label]');

    if (cursorRoot && dot && ring && label) {
      cursorRoot.classList.add('is-enabled');
      const setDotX = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3.out' });
      const setDotY = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3.out' });
      const setRingX = gsap.quickTo(ring, 'x', { duration: 0.34, ease: 'power3.out' });
      const setRingY = gsap.quickTo(ring, 'y', { duration: 0.34, ease: 'power3.out' });

      const onMove = (e) => {
        setDotX(e.clientX);
        setDotY(e.clientY);
        setRingX(e.clientX);
        setRingY(e.clientY);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => window.removeEventListener('pointermove', onMove));

      const labelCleanups = [];
      document.querySelectorAll('[data-cursor-text]').forEach((el) => {
        const onEnter = () => {
          label.textContent = el.dataset.cursorText || '';
          cursorRoot.classList.add('is-labeled');
        };
        const onLeave = () => cursorRoot.classList.remove('is-labeled');
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
        labelCleanups.push(() => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
      cleanups.push(() => labelCleanups.forEach((fn) => fn()));
    }

    // Magnetic hover pull
    const magnetCleanups = [];
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.42, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.42, ease: 'power3.out' });
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.24);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.24);
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

    // Cursor-tracking spotlight on work, epoch, and stack cards
    const spotCleanups = [];
    document.querySelectorAll('[data-spotlight-card], [data-tilt-card]').forEach((card) => {
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      };
      card.addEventListener('pointermove', onMove, { passive: true });
      spotCleanups.push(() => card.removeEventListener('pointermove', onMove));
    });
    cleanups.push(() => spotCleanups.forEach((fn) => fn()));

    // Subtle 3D perspective tilt on Work cards
    const tiltCleanups = [];
    document.querySelectorAll('[data-tilt-card]').forEach((card) => {
      const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.45, ease: 'power3.out' });
      const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.45, ease: 'power3.out' });
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        rotX(-ny * 4.5);
        rotY(nx * 4.5);
      };
      const onLeave = () => {
        rotX(0);
        rotY(0);
      };
      card.style.transformPerspective = '1100px';
      card.addEventListener('pointermove', onMove, { passive: true });
      card.addEventListener('pointerleave', onLeave);
      tiltCleanups.push(() => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
      });
    });
    cleanups.push(() => tiltCleanups.forEach((fn) => fn()));
  }

  if (reduceMotion) {
    const loader = document.querySelector('[data-preloader]');
    if (loader) loader.remove();
    return {
      dispose() {
        cleanups.forEach((fn) => fn());
      },
    };
  }

  // 3. GSAP Context: Preloader, Scroll Progress, Dual Marquees, Scrubbed Words, Counters, Sticky Stack, Horizontal Timeline, Footer
  const ctx = gsap.context(() => {
    // 3a. Top Scroll Progress Hairline
    const progressBar = document.querySelector('[data-scroll-progress]');
    if (progressBar) {
      gsap.to(progressBar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      });
    }

    // 3b. Preloader -> Hero Reveal
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
          { yPercent: 0, autoAlpha: 1, duration: 1.0, stagger: 0.07 }
        );
      }
      if (heroEnterItems.length) {
        heroTl.fromTo(
          heroEnterItems,
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.8 },
          '-=0.55'
        );
      }
    };

    if (loader && bar && countEl) {
      const counter = { val: 0 };
      gsap
        .timeline({
          onComplete: () => {
            loader.remove();
            playHeroEntrance();
          },
        })
        .to(counter, {
          val: 100,
          duration: 0.72,
          ease: 'power2.inOut',
          onUpdate: () => {
            countEl.textContent = String(Math.round(counter.val)).padStart(2, '0');
          },
        })
        .to(bar, { scaleX: 1, duration: 0.72, ease: 'power2.inOut' }, 0)
        .to(loader, { yPercent: -100, duration: 0.75, ease: 'power4.inOut' }, '+=0.05');
    } else {
      playHeroEntrance();
    }

    // 3c. Hero Giant Backdrop Parallax
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

    // 3d. Dual Opposing Velocity-Reactive Kinetic Marquees
    const marqueeTracks = Array.from(document.querySelectorAll('[data-marquee-track]')).map((el) => ({
      el,
      dir: Number(el.dataset.marqueeDir || 1),
      pos: 0,
    }));

    if (marqueeTracks.length) {
      const tickMarquees = () => {
        const boost = Math.min(7.5, Math.abs(scrollVelocity) * 0.2);
        const scrollDir = scrollVelocity < -0.8 ? -1 : 1;
        const skew = gsap.utils.clamp(-4.5, 4.5, scrollVelocity * 0.12);

        for (const item of marqueeTracks) {
          const halfW = item.el.scrollWidth / 2;
          if (!halfW) continue;
          const base = item.dir === 1 ? 0.85 : 0.62;
          item.pos -= (base + boost) * item.dir * scrollDir;
          if (item.pos <= -halfW) item.pos += halfW;
          if (item.pos > 0) item.pos -= halfW;
          item.el.style.transform = `translate3d(${item.pos.toFixed(2)}px, 0, 0) skewX(${(skew * item.dir).toFixed(2)}deg)`;
        }
        scrollVelocity *= 0.92;
      };
      gsap.ticker.add(tickMarquees);
      cleanups.push(() => gsap.ticker.remove(tickMarquees));
    }

    // 3e. Scroll-Scrubbed Manifesto Word Illumination
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
          start: 'top 80%',
          end: 'bottom 45%',
          scrub: 0.6,
        },
      });
    });

    // 3f. Animated Stat Counters
    document.querySelectorAll('[data-count-to]').forEach((el) => {
      const targetVal = Number(el.dataset.countTo || 0);
      const decimals = Number(el.dataset.decimals || 0);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const obj = { val: 0 };

      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: targetVal,
            duration: 1.35,
            ease: 'power3.out',
            onUpdate: () => {
              el.textContent = `${prefix}${obj.val.toFixed(decimals)}${suffix}`;
            },
          });
        },
      });
    });

    // 3g. Split-Word Section Headings & Section Stagger Reveals
    gsap.utils.toArray('[data-split-reveal]').forEach((el) => {
      const words = splitElementWords(el);
      if (!words.length) return;
      gsap.fromTo(
        words,
        { yPercent: 112, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.05,
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
        }
      );
    });

    gsap.utils.toArray('[data-story-section]').forEach((section) => {
      const items = section.querySelectorAll('[data-reveal-item]');
      if (!items.length) return;
      gsap.fromTo(
        items,
        { y: 26, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.85,
          ease: 'power4.out',
          stagger: 0.06,
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            once: true,
          },
        }
      );
    });

    // 3h. Desktop-Only Sticky Depth Card Stack + Horizontal Pinned Journey Gallery
    const mm = gsap.matchMedia();
    mm.add('(min-width: 961px)', () => {
      // Sticky Card Stack Depth
      gsap.utils.toArray('[data-sticky-stack]').forEach((stack) => {
        const cards = gsap.utils.toArray(stack.querySelectorAll('[data-stack-card]'));
        cards.forEach((card, index) => {
          const nextCard = cards[index + 1];
          if (!nextCard) return;

          gsap.to(card, {
            scale: 0.92 + index * 0.016,
            opacity: 0.56,
            y: -24,
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

      // Horizontal Scrubbed Journey Timeline
      const hSection = document.querySelector('[data-horizontal-section]');
      const hTrack = document.querySelector('[data-horizontal-track]');
      const hBar = document.querySelector('[data-horizontal-bar]');

      if (hSection && hTrack) {
        const getScrollDistance = () => Math.max(0, hTrack.scrollWidth - window.innerWidth + 48);

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: hSection,
            start: 'top top',
            end: () => `+=${Math.max(400, getScrollDistance() * 1.15)}`,
            scrub: 0.9,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        tl.to(hTrack, {
          x: () => -getScrollDistance(),
          ease: 'none',
        });

        if (hBar) {
          tl.to(hBar, { scaleX: 1, ease: 'none' }, 0);
        }
      }
    });

    // 3i. Card Image Parallax
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

    // 3j. Footer Parallax Curtain
    const footer = document.querySelector('[data-footer-parallax]');
    if (footer) {
      gsap.fromTo(
        footer.querySelector('.footer__inner'),
        { y: -44, opacity: 0.72 },
        {
          y: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: footer,
            start: 'top bottom',
            end: 'top 40%',
            scrub: 0.9,
          },
        }
      );
    }
  });

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
