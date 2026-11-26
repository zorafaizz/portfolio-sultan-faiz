import * as THREE from 'three';

/**
 * True 3D 2-bone analytical Inverse Kinematics:
 * Solves hip -> elevated 3D knee -> planted tarsus claw on the viewport surface.
 */
function solve3DLegIK(hip, foot, l1, l2, kneeLift, outKnee) {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const dz = foot.z - hip.z;
  const dist = Math.max(0.001, Math.min(l1 + l2 - 0.02, Math.hypot(dx, dy, dz)));

  // Law of cosines for knee bend angle
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  // Forward unit vector along hip -> foot
  const fx = dx / dist;
  const fy = dy / dist;
  const fz = dz / dist;

  // Lift vector pointing up in +Z (toward camera) orthogonalized against forward vector
  const dotUp = fz;
  let ux = -fx * dotUp;
  let uy = -fy * dotUp;
  let uz = 1 - fz * dotUp;
  const uLen = Math.hypot(ux, uy, uz) || 1;
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  const along = l1 * cosA;
  const perp = l1 * sinA * kneeLift;

  outKnee.set(
    hip.x + fx * along + ux * perp,
    hip.y + fy * along + uy * perp,
    hip.z + fz * along + uz * perp
  );
}

export function createSpider3D(materials) {
  const root = new THREE.Group();
  const disposables = [];
  const { obsidianMat, titaniumMat, voltMat, shadowMat } = materials;

  // =========================================================================
  // 1. SCULPTED 3D ARACHNID CHASSIS (Cephalothorax, Abdomen, Fangs, 8 Eyes, Pedipalps)
  // =========================================================================
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Soft cast shadow directly beneath body
  const bodyShadowGeo = new THREE.CircleGeometry(0.92, 20);
  disposables.push(bodyShadowGeo);
  const bodyShadow = new THREE.Mesh(bodyShadowGeo, shadowMat);
  bodyShadow.scale.set(1.25, 0.9, 1);
  root.add(bodyShadow);

  // Sculpted Cephalothorax (Prosoma)
  const cephaGeo = new THREE.SphereGeometry(0.32, 18, 14);
  cephaGeo.scale(1.18, 0.92, 0.68);
  disposables.push(cephaGeo);
  const cepha = new THREE.Mesh(cephaGeo, obsidianMat);
  cepha.position.set(0.24, 0, 0.05);
  bodyGroup.add(cepha);

  // Armored titanium carapace crest on cephalothorax
  const plateGeo = new THREE.OctahedronGeometry(0.20, 1);
  plateGeo.scale(1.25, 0.72, 0.35);
  disposables.push(plateGeo);
  const plate = new THREE.Mesh(plateGeo, titaniumMat);
  plate.position.set(0.20, 0, 0.21);
  bodyGroup.add(plate);

  // Narrow pedicel waist connecting prosoma & abdomen
  const waistGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.22, 8);
  waistGeo.rotateZ(Math.PI / 2);
  disposables.push(waistGeo);
  const waist = new THREE.Mesh(waistGeo, titaniumMat);
  waist.position.set(-0.10, 0, 0.04);
  bodyGroup.add(waist);

  // Sculpted Teardrop Segmented Abdomen (Opisthosoma)
  const abdoGroup = new THREE.Group();
  abdoGroup.position.set(-0.56, 0, 0.14);
  const abdoGeo = new THREE.SphereGeometry(0.46, 22, 16);
  abdoGeo.scale(1.32, 0.96, 0.84);
  disposables.push(abdoGeo);
  const abdoMesh = new THREE.Mesh(abdoGeo, obsidianMat);
  abdoGroup.add(abdoMesh);

  // Layered armored dorsal ribs across abdomen
  for (let r = 0; r < 3; r++) {
    const ribGeo = new THREE.TorusGeometry(0.36 - r * 0.05, 0.022, 6, 16, Math.PI * 1.1);
    ribGeo.rotateY(Math.PI / 2);
    ribGeo.rotateX(-Math.PI * 0.55);
    disposables.push(ribGeo);
    const rib = new THREE.Mesh(ribGeo, titaniumMat);
    rib.position.set(0.16 - r * 0.20, 0, 0.05);
    abdoGroup.add(rib);
  }

  // Signature glowing volt hourglass / chevron reactor core on dorsal abdomen
  const coreShape = new THREE.Shape();
  coreShape.moveTo(0.18, 0);
  coreShape.lineTo(0.02, 0.12);
  coreShape.lineTo(-0.08, 0.04);
  coreShape.lineTo(-0.22, 0.11);
  coreShape.lineTo(-0.14, 0);
  coreShape.lineTo(-0.22, -0.11);
  coreShape.lineTo(-0.08, -0.04);
  coreShape.lineTo(0.02, -0.12);
  coreShape.closePath();
  const coreGeo = new THREE.ExtrudeGeometry(coreShape, { depth: 0.04, bevelEnabled: false });
  coreGeo.center();
  disposables.push(coreGeo);
  const hourglassCore = new THREE.Mesh(coreGeo, voltMat);
  hourglassCore.position.set(-0.02, 0, 0.37);
  abdoGroup.add(hourglassCore);

  // Twin rear spinnerets
  for (const side of [-1, 1]) {
    const spGeo = new THREE.ConeGeometry(0.032, 0.16, 6);
    spGeo.rotateZ(Math.PI / 2);
    disposables.push(spGeo);
    const sp = new THREE.Mesh(spGeo, titaniumMat);
    sp.position.set(-0.62, side * 0.08, -0.02);
    abdoGroup.add(sp);
  }
  bodyGroup.add(abdoGroup);

  // 8 Glossy Arachnid Eyes (2 large primary volt + 6 secondary)
  const eyeGeo = new THREE.SphereGeometry(1, 10, 8);
  disposables.push(eyeGeo);
  const eyeSpecs = [
    [0.57, -0.065, 0.09, 0.046],
    [0.57, 0.065, 0.09, 0.046],
    [0.52, -0.145, 0.08, 0.030],
    [0.52, 0.145, 0.08, 0.030],
    [0.48, -0.095, 0.155, 0.024],
    [0.48, 0.095, 0.155, 0.024],
    [0.43, -0.165, 0.145, 0.020],
    [0.43, 0.165, 0.145, 0.020],
  ];
  for (const [ex, ey, ez, er] of eyeSpecs) {
    const eye = new THREE.Mesh(eyeGeo, voltMat);
    eye.position.set(ex, ey, ez);
    eye.scale.setScalar(er);
    bodyGroup.add(eye);
  }

  // Articulated Chelicerae Fangs & Pedipalps
  const fangs = [];
  const palps = [];
  const fangGeo = new THREE.ConeGeometry(0.036, 0.22, 6);
  fangGeo.rotateZ(-Math.PI / 2);
  const palpGeo = new THREE.CylinderGeometry(0.026, 0.016, 0.34, 6);
  palpGeo.rotateZ(Math.PI / 2);
  disposables.push(fangGeo, palpGeo);

  for (const side of [-1, 1]) {
    const fangPivot = new THREE.Group();
    fangPivot.position.set(0.55, side * 0.08, -0.02);
    const fang = new THREE.Mesh(fangGeo, titaniumMat);
    fang.position.set(0.09, -side * 0.02, -0.03);
    fang.rotation.z = -side * 0.25;
    fangPivot.add(fang);
    bodyGroup.add(fangPivot);
    fangs.push({ side, pivot: fangPivot });

    const palpPivot = new THREE.Group();
    palpPivot.position.set(0.46, side * 0.18, 0.0);
    const palp = new THREE.Mesh(palpGeo, obsidianMat);
    palp.position.set(0.16, side * 0.08, -0.02);
    palp.rotation.z = side * 0.42;
    palpPivot.add(palp);
    bodyGroup.add(palpPivot);
    palps.push({ side, pivot: palpPivot });
  }

  // =========================================================================
  // 2. 8 MULTI-SEGMENT ARTICULATED 3D IK LEGS (Femur -> Patella Armor -> Tibia -> Curved Tarsus Claw)
  // =========================================================================
  const femurGeo = new THREE.CylinderGeometry(0.052, 0.036, 1, 8);
  const tibiaGeo = new THREE.CylinderGeometry(0.036, 0.018, 1, 8);
  const tarsusGeo = new THREE.CylinderGeometry(0.018, 0.004, 1, 6);
  const kneeCapGeo = new THREE.OctahedronGeometry(0.062, 1);
  const kneeCoreGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const ankleGeo = new THREE.SphereGeometry(0.028, 7, 7);
  const footShadowGeo = new THREE.CircleGeometry(0.14, 10);
  disposables.push(femurGeo, tibiaGeo, tarsusGeo, kneeCapGeo, kneeCoreGeo, ankleGeo, footShadowGeo);

  const legSpecs = [
    { side: -1, hipOff: [0.36, -0.22, 0.04], restAng: -0.52, reach: 1.54, group: 0 },
    { side: -1, hipOff: [0.24, -0.26, 0.04], restAng: -1.16, reach: 1.68, group: 1 },
    { side: -1, hipOff: [0.10, -0.26, 0.04], restAng: -1.86, reach: 1.66, group: 0 },
    { side: -1, hipOff: [-0.04, -0.22, 0.04], restAng: -2.48, reach: 1.62, group: 1 },
    { side: 1, hipOff: [0.36, 0.22, 0.04], restAng: 0.52, reach: 1.54, group: 1 },
    { side: 1, hipOff: [0.24, 0.26, 0.04], restAng: 1.16, reach: 1.68, group: 0 },
    { side: 1, hipOff: [0.10, 0.26, 0.04], restAng: 1.86, reach: 1.66, group: 1 },
    { side: 1, hipOff: [-0.04, 0.22, 0.04], restAng: 2.48, reach: 1.62, group: 0 },
  ];

  const legs = legSpecs.map((spec) => {
    const femur = new THREE.Mesh(femurGeo, obsidianMat);
    const tibia = new THREE.Mesh(tibiaGeo, obsidianMat);
    const tarsus = new THREE.Mesh(tarsusGeo, titaniumMat);
    const kneeCap = new THREE.Mesh(kneeCapGeo, obsidianMat);
    const kneeCore = new THREE.Mesh(kneeCoreGeo, voltMat);
    const ankle = new THREE.Mesh(ankleGeo, titaniumMat);
    const fShadow = new THREE.Mesh(footShadowGeo, shadowMat);
    root.add(femur, tibia, tarsus, kneeCap, kneeCore, ankle, fShadow);

    const initX = Math.cos(spec.restAng) * spec.reach;
    const initY = Math.sin(spec.restAng) * spec.reach;

    return {
      ...spec,
      femur,
      tibia,
      tarsus,
      kneeCap,
      kneeCore,
      ankle,
      fShadow,
      foot: new THREE.Vector3(initX, initY, 0),
      start: new THREE.Vector3(initX, initY, 0),
      target: new THREE.Vector3(initX, initY, 0),
      hipWorld: new THREE.Vector3(),
      kneeWorld: new THREE.Vector3(),
      ankleWorld: new THREE.Vector3(),
      stepping: false,
      stepT: 1,
    };
  });

  // Shimmering silk dragline trailing behind spinnerets
  const SILK_PTS = 24;
  const silkArr = new Float32Array(SILK_PTS * 3);
  const silkGeo = new THREE.BufferGeometry();
  silkGeo.setAttribute('position', new THREE.BufferAttribute(silkArr, 3));
  const silkMat = new THREE.LineBasicMaterial({
    color: 0xe6eee0,
    transparent: true,
    opacity: 0.26,
  });
  disposables.push(silkGeo, silkMat);
  const silkLine = new THREE.Line(silkGeo, silkMat);
  root.add(silkLine);
  const silkHistory = Array.from({ length: SILK_PTS }, () => new THREE.Vector3());
  let silkInitialized = false;

  // Kinematic state
  const pos = new THREE.Vector3(0, 0, 0);
  const vel = new THREE.Vector3(0, 0, 0);
  let heading = 0;

  const tmpDir = new THREE.Vector3();
  const tmpMid = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);

  function placeBone(mesh, a, b) {
    tmpDir.subVectors(b, a);
    const len = tmpDir.length() || 0.001;
    tmpMid.addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(tmpMid);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(upVec, tmpDir.normalize());
  }

  function update(dt, t, targetWorld, hasUserMoved, worldBounds, scaleFactor) {
    root.scale.setScalar(scaleFactor);
    const invS = 1 / Math.max(scaleFactor, 0.2);

    const tx = hasUserMoved
      ? targetWorld.x * invS
      : (worldBounds.w * 0.26 + Math.cos(t * 0.7) * worldBounds.w * 0.10) * invS;
    const ty = hasUserMoved
      ? targetWorld.y * invS
      : (worldBounds.h * 0.02 + Math.sin(t * 1.05) * worldBounds.h * 0.14) * invS;

    const prevX = pos.x;
    const prevY = pos.y;
    const chase = 1 - Math.pow(0.0022, dt);
    pos.x += (tx - pos.x) * chase;
    pos.y += (ty - pos.y) * chase;

    vel.set((pos.x - prevX) / Math.max(dt, 0.008), (pos.y - prevY) / Math.max(dt, 0.008), 0);
    const speed = vel.length();

    if (speed > 0.25) {
      const desired = Math.atan2(vel.y, vel.x);
      let diff = desired - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * 8.5);
    }

    // Subtle living suspension bob + pitch into speed
    const bodyZ = 0.44 + Math.sin(t * 5.2) * 0.035 + Math.min(0.08, speed * 0.012);
    bodyGroup.position.set(pos.x, pos.y, bodyZ);
    bodyGroup.rotation.set(0, Math.min(0.18, speed * 0.022), heading);
    bodyShadow.position.set(pos.x + 0.08, pos.y - 0.12, -0.02);

    // Subtle abdomen breath + volt core pulse
    abdoGroup.rotation.y = Math.sin(t * 3.0) * 0.05;
    const corePulse = 1.0 + Math.sin(t * 3.8) * 0.08;
    hourglassCore.scale.setScalar(corePulse);

    // Animate fangs & pedipalps subtly
    const fangSpread = 0.08 + Math.min(0.28, speed * 0.03) + Math.sin(t * 6.0) * 0.04;
    for (const f of fangs) f.pivot.rotation.z = f.side * fangSpread;
    for (const p of palps) p.pivot.rotation.z = p.side * (0.12 + Math.sin(t * 7.2 + p.side) * 0.16);

    // Alternating tetrapod gait
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const groupStepping = [false, false];
    for (const leg of legs) {
      if (leg.stepping) groupStepping[leg.group] = true;
    }

    const leadX = Math.max(-0.52, Math.min(0.52, vel.x * 0.12));
    const leadY = Math.max(-0.52, Math.min(0.52, vel.y * 0.12));

    for (const leg of legs) {
      const worldAng = heading + leg.restAng;
      const idealX = pos.x + Math.cos(worldAng) * leg.reach + leadX;
      const idealY = pos.y + Math.sin(worldAng) * leg.reach + leadY;
      const dist = Math.hypot(leg.foot.x - idealX, leg.foot.y - idealY);
      const otherGroup = leg.group === 0 ? 1 : 0;

      if (!leg.stepping && dist > 0.62 && !groupStepping[otherGroup]) {
        leg.stepping = true;
        leg.stepT = 0;
        leg.start.copy(leg.foot);
        leg.target.set(idealX, idealY, 0);
        groupStepping[leg.group] = true;
      }

      if (leg.stepping) {
        leg.stepT = Math.min(1, leg.stepT + dt * 8.2);
        const s = leg.stepT;
        const ease = s * s * (3 - 2 * s);
        leg.foot.lerpVectors(leg.start, leg.target, ease);
        leg.foot.z = Math.sin(s * Math.PI) * 0.42;
        if (leg.stepT >= 1) {
          leg.foot.z = 0;
          leg.stepping = false;
        }
      }

      // Transform hip local offset to world
      const [hx, hy, hz] = leg.hipOff;
      leg.hipWorld.set(
        pos.x + hx * cosH - hy * sinH,
        pos.y + hx * sinH + hy * cosH,
        bodyZ + hz
      );

      // True 3D 2-bone IK solving high-arched arachnid knee + 3rd tarsus claw bend
      solve3DLegIK(leg.hipWorld, leg.foot, 0.98, 1.24, 1.08, leg.kneeWorld);

      // Compute ankle bend point 68% down from knee toward foot, bowed slightly outward for curved claw
      leg.ankleWorld.lerpVectors(leg.kneeWorld, leg.foot, 0.68);
      leg.ankleWorld.z += 0.14;

      placeBone(leg.femur, leg.hipWorld, leg.kneeWorld);
      placeBone(leg.tibia, leg.kneeWorld, leg.ankleWorld);
      placeBone(leg.tarsus, leg.ankleWorld, leg.foot);

      leg.kneeCap.position.copy(leg.kneeWorld);
      leg.kneeCore.position.copy(leg.kneeWorld);
      leg.kneeCore.position.z += 0.038;
      leg.ankle.position.copy(leg.ankleWorld);

      // Ground contact shadow right beneath each claw
      leg.fShadow.position.set(leg.foot.x + 0.04, leg.foot.y - 0.06, -0.02);
      const shadowScale = Math.max(0.35, 1.0 - leg.foot.z * 1.1);
      leg.fShadow.scale.setScalar(shadowScale);
    }

    // Update trailing silk dragline from spinnerets
    const rearX = pos.x - cosH * 1.12;
    const rearY = pos.y - sinH * 1.12;
    if (!silkInitialized) {
      silkHistory.forEach((v) => v.set(rearX, rearY, 0.08));
      silkInitialized = true;
    } else if (Math.hypot(rearX - silkHistory[0].x, rearY - silkHistory[0].y) > 0.14) {
      for (let i = SILK_PTS - 1; i > 0; i--) {
        silkHistory[i].copy(silkHistory[i - 1]);
      }
      silkHistory[0].set(rearX, rearY, 0.08);
    } else {
      silkHistory[0].set(rearX, rearY, 0.08);
    }

    for (let i = 0; i < SILK_PTS; i++) {
      silkArr[i * 3] = silkHistory[i].x;
      silkArr[i * 3 + 1] = silkHistory[i].y;
      silkArr[i * 3 + 2] = silkHistory[i].z;
    }
    silkGeo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
  }

  return { group: root, update, dispose };
}
