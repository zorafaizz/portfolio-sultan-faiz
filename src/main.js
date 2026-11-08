import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createScene } from './scene.js';
import { createInput } from './input.js';
import { createDragon } from './dragon.js';
import { createSpider } from './spider.js';
import { createHero3D } from './hero3d.js';

gsap.registerPlugin(ScrollTrigger);

// Lenis smooth scroll, terhubung ke ScrollTrigger
const lenis = new Lenis({ lerp: 0.09 });
lenis.on('scroll', ScrollTrigger.update);
function rafLenis(time) { lenis.raf(time); requestAnimationFrame(rafLenis); }
requestAnimationFrame(rafLenis);

// Anchor: pakai Lenis agar smooth
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -70 }); }
  });
});

// Reveal section
document.querySelectorAll('.reveal').forEach((el) => {
  gsap.fromTo(el, { y: 40, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' },
  });
});

// Scene 3D
const canvas = document.getElementById('scene3d');
const { scene, camera, onUpdate } = createScene(canvas);
const { pointer } = createInput(camera);
const dragon = createDragon(scene, pointer);
const spider = createSpider(scene, pointer);
spider.setVisible(false);
const hero3d = createHero3D(scene, camera, pointer);

let mode = 'dragon';
const toggle = document.getElementById('charToggle');
toggle.addEventListener('click', () => {
  mode = mode === 'dragon' ? 'spider' : 'dragon';
  dragon.setVisible(mode === 'dragon');
  spider.setVisible(mode === 'spider');
  toggle.textContent = mode === 'dragon' ? 'Karakter: Naga 🐉' : 'Karakter: Laba-laba 🕷️';
});

onUpdate((dt, t) => {
  hero3d.update(dt, t);
  if (mode === 'dragon') dragon.update(dt);
  else spider.update(dt, t);
});
