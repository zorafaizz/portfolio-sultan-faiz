import * as THREE from 'three';

// Naga rantai segmen: head mengejar pointer dengan easing,
// segmen lain dijaga jaraknya dengan constraint follow-the-leader (verlet/IK sederhana).
export function createDragon(scene, pointer) {
  const SEGMENTS = 14, SEG_LEN = 0.55;
  const group = new THREE.Group();
  const points = [];
  for (let i = 0; i < SEGMENTS; i++) points.push(new THREE.Vector3(0, -i * SEG_LEN, 0));

  const mat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.35, metalness: 0.4, emissive: 0x0e7490, emissiveIntensity: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.3, metalness: 0.3, emissive: 0x22d3ee, emissiveIntensity: 0.6 });
  const meshes = points.map((_, i) => {
    const r = i === 0 ? 0.42 : Math.max(0.16, 0.38 - i * 0.016);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), i === 0 ? headMat : mat);
    group.add(m); return m;
  });
  // Mata kepala
  const eyeGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x05060a });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(0.16, 0.14, 0.34);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-0.16, 0.14, 0.34);
  meshes[0].add(e1, e2);
  scene.add(group);

  function update(dt) {
    // Head: easing menuju pointer (lerp berbasis dt, stabil di framerate berbeda)
    const k = 1 - Math.pow(0.001, dt); // ~ cepat tapi halus
    points[0].lerp(pointer.world, Math.min(1, k * 1.6));
    // Constraint: tiap segmen menjaga jarak SEG_LEN dari pendahulunya
    for (let i = 1; i < SEGMENTS; i++) {
      const prev = points[i - 1], cur = points[i];
      const dir = new THREE.Vector3().subVectors(cur, prev);
      const d = dir.length() || 0.0001;
      cur.copy(prev).add(dir.multiplyScalar(SEG_LEN / d));
    }
    points.forEach((p, i) => meshes[i].position.copy(p));
    // Kepala menghadap arah gerak
    if (SEGMENTS > 1) {
      const dir = new THREE.Vector3().subVectors(points[0], points[1]).normalize();
      meshes[0].lookAt(points[0].clone().add(dir));
    }
  }
  return { group, update, setVisible(v) { group.visible = v; } };
}
