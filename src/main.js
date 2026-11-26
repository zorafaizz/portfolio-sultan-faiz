import './styles/main.css';
import { initLandoPortrait } from './webgl/landoPortrait.js';
import { initMorphStage } from './webgl/morphStage.js';
import { initCreatures } from './webgl/creatures.js';
import { initChoreography } from './motion/choreography.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1. Lando Norris GPU Ping-Pong Fluid Portrait Reveal (Mouse + Continuous Touch Drag)
const portraitController = initLandoPortrait({
  canvas: document.getElementById('portrait-canvas'),
  stage: document.querySelector('[data-portrait-stage]'),
  reduceMotion,
});

// 2. Articulated IK Dragon & Spider Cursor Companions
const creatureController = initCreatures({
  canvas: document.getElementById('creature-canvas'),
  reduceMotion,
  initialMode: 'dragon',
});

const creatureButtons = Array.from(document.querySelectorAll('[data-creature-mode]'));
creatureButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.creatureMode || 'off';
    creatureController.setMode(mode);
    creatureButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  });
});

// 3. Interactive Three.js 3D Morphing Particle Sculpture (Core Craft)
const morphController = initMorphStage({
  canvas: document.getElementById('craft-canvas'),
  section: document.querySelector('[data-craft-section]'),
  reduceMotion,
});

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

// 4. GSAP + ScrollTrigger + Lenis Motion Choreography
const motionController = initChoreography({ reduceMotion });

// Clean disposal
window.addEventListener('pagehide', () => {
  portraitController.dispose();
  creatureController.dispose();
  morphController.dispose();
  motionController.dispose();
});
