import * as THREE from 'three';

// Scene 3D utama: renderer, kamera, loop.
// Loop di-pause saat tab hidden, DPR dibatasi maks 2.
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.028);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0x7dd3fc, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xa78bfa, 30, 30);
  rim.position.set(-6, -2, 4);
  scene.add(rim);

  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const updaters = new Set();
  const onUpdate = (fn) => { updaters.add(fn); return () => updaters.delete(fn); };

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    for (const fn of updaters) fn(dt, t);
    renderer.render(scene, camera);
  }

  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      clock.getDelta();
      loop();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  loop();
  return { renderer, scene, camera, onUpdate, dispose() {
    running = false; cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  } };
}
