import * as THREE from 'three';

// SATU handler pointer untuk mouse DAN touch (Pointer Events).
// Satu sumber kebenaran: pointer.ndc (-1..1) dan pointer.world (bidang z=0).
export function createInput(camera) {
  const pointer = {
    ndc: new THREE.Vector2(0, 0),
    world: new THREE.Vector3(0, 0, 0),
    active: false,
    down: false,
  };
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function updateFromEvent(e) {
    pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(pointer.ndc, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) pointer.world.copy(hit);
    pointer.active = true;
  }

  // Satu handler untuk pointermove + pointerdown, bukan listener terpisah per device.
  function onPointer(e) { updateFromEvent(e); }
  function onDown(e) { pointer.down = true; updateFromEvent(e); }
  function onUp() { pointer.down = false; }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });

  return { pointer, dispose() {
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  } };
}
