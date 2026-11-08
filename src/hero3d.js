import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Hero 3D: partikel debu/bintang + parallax kamera + loader ikon GLB.
// Ikon GLB dibaca dari /public/models/*.glb. File placeholder di repo ini
// HANYA penanda nama; ganti dengan file .glb asli agar ikon tampil.
export const GLB_ICONS = [
  { key: 'ai', file: '/models/ai.glb', label: 'AI / LLM' },
  { key: 'game', file: '/models/game.glb', label: 'Game Server' },
  { key: 'automation', file: '/models/automation.glb', label: 'Automation' },
  { key: 'financial', file: '/models/financial.glb', label: 'Financial' },
];

export function createHero3D(scene, camera, pointer) {
  // Partikel
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 24;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.06, transparent: true, opacity: 0.8 });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Loader GLB (dipakai saat file asli tersedia; error ditangkap, tidak merusak scene)
  const loader = new GLTFLoader();
  const loaded = {};
  for (const icon of GLB_ICONS) {
    loader.load(icon.file,
      (gltf) => { loaded[icon.key] = gltf.scene; gltf.scene.visible = false; scene.add(gltf.scene); },
      undefined,
      () => { /* file placeholder/belum ada: abaikan, kartu skill tetap tampil di DOM */ });
  }

  function update(dt, t) {
    particles.rotation.y = t * 0.02;
    particles.position.y = Math.sin(t * 0.4) * 0.3;
    // Parallax kamera: kecil saja, mengikuti pointer NDC
    const targetX = pointer.ndc.x * 0.9;
    const targetY = pointer.ndc.y * 0.6;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 3);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 3);
    camera.lookAt(0, 0, 0);
  }
  return { particles, loaded, update };
}
