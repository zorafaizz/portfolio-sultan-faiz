import * as THREE from 'three';

// Laba-laba procedural: badan ellipsoid + 8 kaki.
// Tiap kaki punya target di sekeliling badan; saat badan bergerak cukup jauh,
// kaki melangkah (angkat lalu maju) ke target baru.
export function createSpider(scene, pointer) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.4, metalness: 0.4, emissive: 0x4c1d95, emissiveIntensity: 0.5 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), bodyMat);
  body.scale.set(1, 0.7, 1.25);
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), bodyMat);
  head.position.set(0, 0.08, 0.62); group.add(head);

  const legs = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const hip = new THREE.Vector3(side * 0.45, 0, -0.45 + i * 0.3);
      const angle = side * (0.5 + i * 0.22);
      const target = new THREE.Vector3();
      const foot = new THREE.Vector3();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1, 8), legMat);
      group.add(mesh);
      legs.push({ side, hip, angle, target, foot, mesh, stepping: false, stepT: 0, from: new THREE.Vector3() });
    }
  }
  scene.add(group);
  const pos = new THREE.Vector3(0, 0, 0);
  let lastStepCheck = new THREE.Vector3(0, 0, 0);

  function placeLeg(leg) {
    const dir = new THREE.Vector3(Math.sin(leg.angle) * leg.side, 0, Math.cos(leg.angle)).normalize();
    leg.target.copy(pos).add(new THREE.Vector3(leg.hip.x, -0.35, leg.hip.z)).add(dir.multiplyScalar(1.1));
    leg.foot.copy(leg.target);
  }
  legs.forEach(placeLeg);

  function update(dt, t) {
    const k = 1 - Math.pow(0.001, dt);
    pos.lerp(pointer.world, Math.min(1, k * 1.3));
    // Badan sedikit bobbing
    group.position.set(pos.x, pos.y + Math.sin(t * 6) * 0.05, pos.z);
    group.rotation.y = Math.atan2(pointer.world.x - pos.x, pointer.world.z - pos.z + 0.001);

    // Langkah: jika badan sudah bergeser > 0.35 dari cek terakhir, angkat kaki bergantian
    if (pos.distanceTo(lastStepCheck) > 0.35) {
      lastStepCheck.copy(pos);
      legs.forEach((leg, idx) => {
        if (idx % 2 === 0 && !leg.stepping) { leg.stepping = true; leg.stepT = 0; leg.from.copy(leg.foot); placeLeg(leg); }
        else if (idx % 2 === 1) { /* kaki ganjil melangkah di giliran berikutnya via timer */ }
      });
      // Sederhanakan: semua kaki yang belum stepping ikut melangkah berselang
      legs.forEach((leg) => { if (!leg.stepping && Math.random() < 0.5) { leg.stepping = true; leg.stepT = 0; leg.from.copy(leg.foot); placeLeg(leg); } });
    }
    for (const leg of legs) {
      if (leg.stepping) {
        leg.stepT += dt * 6;
        const s = Math.min(1, leg.stepT);
        leg.foot.lerpVectors(leg.from, leg.target, s);
        leg.foot.y = leg.target.y + Math.sin(s * Math.PI) * 0.35;
        if (s >= 1) leg.stepping = false;
      }
      // Gambar kaki sebagai silinder dari hip (relatif grup) ke foot (dunia -> lokal grup)
      const hipWorld = new THREE.Vector3(leg.hip.x, leg.hip.y, leg.hip.z).applyMatrix4(group.matrixWorld);
      const mid = new THREE.Vector3().addVectors(hipWorld, leg.foot).multiplyScalar(0.5);
      // Karena mesh adalah anak group, posisikan dalam koordinat lokal:
      const localMid = group.worldToLocal(mid.clone());
      const localFoot = group.worldToLocal(leg.foot.clone());
      const localHip = new THREE.Vector3(leg.hip.x, leg.hip.y, leg.hip.z);
      const len = localHip.distanceTo(localFoot) || 0.001;
      leg.mesh.position.copy(localMid);
      leg.mesh.scale.set(1, len, 1);
      leg.mesh.lookAt(group.worldToLocal(leg.foot.clone()));
      leg.mesh.rotateX(Math.PI / 2);
    }
  }
  return { group, update, setVisible(v) { group.visible = v; } };
}
