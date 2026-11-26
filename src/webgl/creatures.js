import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDragon3D } from './dragon3d.js';
import { createSpider3D } from './spider3d.js';

function createShadowTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.16)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function initCreatures({ canvas, reduceMotion, initialMode = 'dragon' }) {
  if (!canvas || reduceMotion) {
    return { setMode() {}, dispose() {} };
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return { setMode() {}, dispose() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Procedural studio HDRI reflections via RoomEnvironment so dark obsidian armor gleams
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  camera.position.set(0, 0, 18);

  // Sculpted 3-point studio lighting
  const ambient = new THREE.AmbientLight(0xf4f2ec, 0.65);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(6, 9, 14);
  const rimLight = new THREE.DirectionalLight(0xd2ff00, 1.45);
  rimLight.position.set(-8, -5, 8);
  const fillLight = new THREE.DirectionalLight(0xcbd5e1, 0.9);
  fillLight.position.set(-5, 7, 6);
  scene.add(ambient, keyLight, rimLight, fillLight);

  // Shared high-craft PBR materials
  const shadowTex = createShadowTexture();
  const materials = {
    obsidianMat: new THREE.MeshPhysicalMaterial({
      color: 0x171b18,
      metalness: 0.85,
      roughness: 0.24,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.45,
    }),
    titaniumMat: new THREE.MeshStandardMaterial({
      color: 0xe2e8de,
      metalness: 0.92,
      roughness: 0.20,
      envMapIntensity: 1.35,
    }),
    voltMat: new THREE.MeshStandardMaterial({
      color: 0xd2ff00,
      emissive: 0xd2ff00,
      emissiveIntensity: 1.6,
      metalness: 0.2,
      roughness: 0.22,
    }),
    membraneMat: new THREE.MeshPhysicalMaterial({
      color: 0x101410,
      emissive: 0x354600,
      emissiveIntensity: 0.42,
      metalness: 0.35,
      roughness: 0.32,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    }),
    shadowMat: new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    }),
  };

  const dragon = createDragon3D(materials);
  const spider = createSpider3D(materials);
  scene.add(dragon.group, spider.group);

  let mode = initialMode;
  dragon.group.visible = mode === 'dragon';
  spider.group.visible = mode === 'spider';

  const worldBounds = { w: 16, h: 10 };
  const targetWorld = new THREE.Vector3(3, 0, 0);
  let hasUserMoved = false;
  let isDisposed = false;
  let rafId = 0;

  function updateWorldBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    worldBounds.h = 2 * Math.tan(vFovRad / 2) * camera.position.z;
    worldBounds.w = worldBounds.h * camera.aspect;
  }
  updateWorldBounds();

  function screenToWorld(clientX, clientY) {
    const nx = (clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    const ny = -(clientY / Math.max(window.innerHeight, 1)) * 2 + 1;
    targetWorld.set(nx * (worldBounds.w * 0.5), ny * (worldBounds.h * 0.5), 0);
    hasUserMoved = true;
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    screenToWorld(e.clientX, e.clientY);
  }

  function onTouchMove(e) {
    if (!e.touches.length) return;
    screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
  }

  window.addEventListener('resize', updateWorldBounds, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouchMove, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  const clock = new THREE.Clock();

  function animate() {
    if (isDisposed) return;
    rafId = requestAnimationFrame(animate);

    if (document.hidden || mode === 'off') {
      clock.getDelta();
      return;
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const scaleFactor = window.innerWidth < 680 ? 0.68 : 1.0;

    if (mode === 'dragon') {
      dragon.update(dt, t, targetWorld, hasUserMoved, worldBounds, scaleFactor);
    } else if (mode === 'spider') {
      spider.update(dt, t, targetWorld, hasUserMoved, worldBounds, scaleFactor);
    }

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(animate);

  function setMode(nextMode) {
    mode = nextMode;
    dragon.group.visible = mode === 'dragon';
    spider.group.visible = mode === 'spider';
    if (mode === 'off') {
      renderer.clear();
    }
  }

  function dispose() {
    isDisposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', updateWorldBounds);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchstart', onTouchMove);
    window.removeEventListener('touchmove', onTouchMove);
    dragon.dispose();
    spider.dispose();
    Object.values(materials).forEach((m) => m.dispose());
    shadowTex.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return { setMode, dispose };
}
