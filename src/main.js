import './styles/main.css';
import { initLandoPortrait } from './webgl/landoPortrait.js';
import { initMorphStage } from './webgl/morphStage.js';
import { initChoreography } from './motion/choreography.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1. Hero Lando-Norris-style WebGL Fluid Portrait Reveal
const portraitController = initLandoPortrait({
  canvas: document.getElementById('portrait-canvas'),
  stage: document.querySelector('[data-portrait-stage]'),
  pulseButton: document.querySelector('[data-portrait-pulse]'),
  reduceMotion,
});

// 2. Interactive 3D Morphing Particle Sculpture (Craft Section)
const morphController = initMorphStage({
  canvas: document.getElementById('craft-canvas'),
  section: document.querySelector('[data-craft-section]'),
  reduceMotion,
});

// Bind discipline tabs to 3D particle morph targets
const craftRows = Array.from(document.querySelectorAll('[data-morph-index]'));
function activateCraft(index) {
  craftRows.forEach((row, i) => {
    const active = i === index;
    row.classList.toggle('is-active', active);
    row.setAttribute('aria-selected', String(active));
  });
  morphController.setShape(index);
}

craftRows.forEach((row) => {
  const idx = Number(row.dataset.morphIndex || 0);
  row.addEventListener('pointerenter', () => activateCraft(idx));
  row.addEventListener('focus', () => activateCraft(idx));
  row.addEventListener('click', () => activateCraft(idx));
});

// 3. GSAP + ScrollTrigger + Lenis Motion System
const motionController = initChoreography({
  reduceMotion,
  onHeroReady: () => {
    // Fire a gentle subtle liquid wave right after preloader finishes so the effect is unmistakably alive
    if (!reduceMotion) {
      setTimeout(() => portraitController.triggerWave(), 240);
    }
  },
});

// Clean disposal on page unload
window.addEventListener('pagehide', () => {
  portraitController.dispose();
  morphController.dispose();
  motionController.dispose();
});
