import * as THREE from 'three';

function createSoftGlowTexture(r, g, b) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
  grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.45)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createArmoredScaleGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.28);
  shape.lineTo(0.24, 0.08);
  shape.lineTo(0.18, -0.24);
  shape.lineTo(0, -0.36);
  shape.lineTo(-0.18, -0.24);
  shape.lineTo(-0.24, 0.08);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function createCurvedHorn(points, rStart, rEnd, tubularSegments = 16) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, rStart, 8, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / 9);
    const t = Math.min(1, ringIdx / tubularSegments);
    curve.getPointAt(t, c);
    v.fromBufferAttribute(pos, i);
    const scale = (rStart * (1 - t) + rEnd * t) / rStart;
    v.sub(c).multiplyScalar(scale).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createDragon3D(materials) {
  const root = new THREE.Group();
  const disposables = [];

  const { obsidianMat, titaniumMat, voltMat, shadowMat } = materials;

  // Custom smoked-obsidian organic wing membrane shader (sleek translucent dark silk + faint volt vein glow)
  const organicMembraneMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        // vUv.y = 0 at wrist/bone, 1 at scalloped trailing edge
        float edgeGlow = smoothstep(0.68, 1.0, vUv.y);
        float ribLine = smoothstep(0.88, 1.0, abs(vUv.x * 2.0 - 1.0));
        float spec = pow(max(0.0, abs(vNormal.z)), 2.0) * 0.25;

        vec3 darkObsidian = vec3(0.045, 0.055, 0.048);
        vec3 deepEmerald = vec3(0.11, 0.16, 0.08);
        vec3 voltRim = vec3(0.824, 1.0, 0.0);

        vec3 col = mix(darkObsidian, deepEmerald, vUv.y * 0.7) + vec3(spec * 0.35);
        col = mix(col, voltRim, edgeGlow * 0.28 + ribLine * 0.16);

        float alpha = mix(0.84, 0.56, vUv.y);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  disposables.push(organicMembraneMat);

  const SEG_COUNT = 38;

  // Proportional spacing & anatomical taper so body & tail are 100% continuous (zero bead gaps!)
  const segScales = [];
  const segLens = [];
  for (let i = 0; i < SEG_COUNT; i++) {
    const frac = i / (SEG_COUNT - 1);
    const chestBulge = Math.exp(-Math.pow((frac - 0.16) / 0.15, 2)) * 0.42;
    const taper = Math.pow(1 - frac, 0.72);
    const sc = Math.max(0.22, (0.56 + chestBulge) * taper + 0.16 * (1 - frac));
    segScales.push(sc);
    segLens.push(0.195 * Math.max(0.46, sc));
  }

  let accX = 0;
  const pts = Array.from({ length: SEG_COUNT }, (_, i) => {
    const p = {
      pos: new THREE.Vector3(accX, 0, 0),
      angle: Math.PI,
      bank: 0,
    };
    accX += segLens[i];
    return p;
  });

  // =========================================================================
  // 1. SCULPTED 3D DRAGON SKULL
  // =========================================================================
  const headGroup = new THREE.Group();

  const skullGeo = new THREE.ConeGeometry(0.25, 0.78, 6);
  skullGeo.rotateZ(-Math.PI / 2);
  skullGeo.scale(1.0, 0.76, 0.72);
  disposables.push(skullGeo);
  const skullMesh = new THREE.Mesh(skullGeo, obsidianMat);
  skullMesh.position.set(0.22, 0, 0.04);
  headGroup.add(skullMesh);

  const crestGeo = new THREE.OctahedronGeometry(0.22, 0);
  crestGeo.scale(1.55, 0.96, 0.55);
  disposables.push(crestGeo);
  const crestMesh = new THREE.Mesh(crestGeo, obsidianMat);
  crestMesh.position.set(-0.04, 0, 0.12);
  headGroup.add(crestMesh);

  const ridgeGeo = new THREE.ConeGeometry(0.048, 0.44, 4);
  ridgeGeo.rotateZ(-Math.PI / 2);
  disposables.push(ridgeGeo);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, titaniumMat);
  ridgeMesh.position.set(0.26, 0, 0.16);
  headGroup.add(ridgeMesh);

  // Articulated lower jaw
  const jawPivot = new THREE.Group();
  jawPivot.position.set(-0.04, 0, -0.06);
  const jawGeo = new THREE.ConeGeometry(0.16, 0.58, 5);
  jawGeo.rotateZ(-Math.PI / 2);
  jawGeo.scale(1.0, 0.72, 0.45);
  disposables.push(jawGeo);
  const jawMesh = new THREE.Mesh(jawGeo, obsidianMat);
  jawMesh.position.set(0.24, 0, -0.02);
  jawPivot.add(jawMesh);
  headGroup.add(jawPivot);

  // Sweeping curved primary & cheek horns + recessed volt eyes
  for (const side of [-1, 1]) {
    const mainHornGeo = createCurvedHorn(
      [
        new THREE.Vector3(-0.05, side * 0.11, 0.14),
        new THREE.Vector3(-0.36, side * 0.25, 0.25),
        new THREE.Vector3(-0.76, side * 0.35, 0.30),
        new THREE.Vector3(-1.08, side * 0.28, 0.38),
      ],
      0.058,
      0.008
    );
    disposables.push(mainHornGeo);
    headGroup.add(new THREE.Mesh(mainHornGeo, titaniumMat));

    const cheekHornGeo = createCurvedHorn(
      [
        new THREE.Vector3(-0.02, side * 0.16, 0.02),
        new THREE.Vector3(-0.26, side * 0.32, 0.04),
        new THREE.Vector3(-0.50, side * 0.38, 0.08),
      ],
      0.032,
      0.006,
      8
    );
    disposables.push(cheekHornGeo);
    headGroup.add(new THREE.Mesh(cheekHornGeo, titaniumMat));

    const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
    eyeGeo.scale(1.4, 0.68, 0.68);
    disposables.push(eyeGeo);
    const eye = new THREE.Mesh(eyeGeo, voltMat);
    eye.position.set(0.16, side * 0.135, 0.105);
    headGroup.add(eye);
  }

  const glowTex = createSoftGlowTexture(210, 255, 0);
  disposables.push(glowTex);
  const eyeGlowMat = new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(eyeGlowMat);
  const headGlow = new THREE.Sprite(eyeGlowMat);
  headGlow.scale.set(0.75, 0.75, 1);
  headGlow.position.set(0.16, 0, 0.12);
  headGroup.add(headGlow);

  root.add(headGroup);

  // Flowing luminous whiskers
  const WHISKER_PTS = 10;
  const whiskers = [-1, 1].map((side) => {
    const arr = new Float32Array(WHISKER_PTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xd2ff00, transparent: true, opacity: 0.68 });
    disposables.push(geo, mat);
    const line = new THREE.Line(geo, mat);
    root.add(line);
    const nodes = Array.from({ length: WHISKER_PTS }, () => new THREE.Vector3());
    return { side, line, geo, nodes };
  });

  // =========================================================================
  // 2. CONTINUOUS OVERLAPPING ARMORED BODY & TAIL + CLAWS + CRESCENT TAIL FIN
  // =========================================================================
  const scaleGeo = createArmoredScaleGeo();
  const spineGeo = new THREE.ConeGeometry(0.036, 0.26, 4);
  spineGeo.rotateX(Math.PI * 0.36);
  const coreRingGeo = new THREE.TorusGeometry(0.13, 0.022, 6, 12);
  coreRingGeo.rotateY(Math.PI / 2);
  const connectorGeo = new THREE.CylinderGeometry(0.15, 0.12, 1, 8);
  const shadowDiscGeo = new THREE.CircleGeometry(0.28, 14);
  disposables.push(scaleGeo, spineGeo, coreRingGeo, connectorGeo, shadowDiscGeo);

  const segmentGroups = [];
  const spineConnectors = [];
  const shadowDiscs = [];

  for (let i = 1; i < SEG_COUNT; i++) {
    const sc = segScales[i];
    const g = new THREE.Group();

    // Sculpted overlapping obsidian armor carapace
    const armor = new THREE.Mesh(scaleGeo, obsidianMat);
    armor.rotation.z = -Math.PI / 2;
    armor.scale.set(sc * 1.25, sc * 1.32, sc * 1.05);
    g.add(armor);

    // Inner continuous armored spine link so even sharp turns never reveal gaps
    const conn = new THREE.Mesh(connectorGeo, obsidianMat);
    root.add(conn);
    spineConnectors.push({ mesh: conn, radius: sc * 0.72 });

    // Glowing volt seam peeking between armor plates
    if (i < SEG_COUNT - 3) {
      const core = new THREE.Mesh(coreRingGeo, voltMat);
      core.scale.setScalar(sc * 0.88);
      core.position.x = -0.05 * sc;
      g.add(core);
    }

    // Swept dorsal spine fin
    if (i < SEG_COUNT - 1) {
      const spike = new THREE.Mesh(spineGeo, i % 3 === 0 ? voltMat : titaniumMat);
      spike.scale.setScalar(sc * (i < 16 ? 1.15 : 0.9));
      spike.position.set(-0.04, 0, 0.14 * sc);
      spike.rotation.y = -0.48;
      g.add(spike);
    }

    // Articulated tucked claws at shoulders & hips
    if (i === 7 || i === 17) {
      for (const side of [-1, 1]) {
        const limb = new THREE.Group();
        limb.position.set(0, side * 0.18 * sc, -0.04);
        const upperGeo = new THREE.CylinderGeometry(0.034, 0.022, 0.36, 6);
        upperGeo.rotateZ(side * 0.65);
        disposables.push(upperGeo);
        const upper = new THREE.Mesh(upperGeo, obsidianMat);
        upper.position.set(-0.10, side * 0.14, -0.02);
        limb.add(upper);

        for (let c = -1; c <= 1; c++) {
          const clawGeo = new THREE.ConeGeometry(0.017, 0.15, 4);
          clawGeo.rotateZ(-Math.PI / 2 + side * 0.4 + c * 0.22);
          disposables.push(clawGeo);
          const claw = new THREE.Mesh(clawGeo, titaniumMat);
          claw.position.set(-0.23, side * 0.27 + c * 0.036, -0.04);
          limb.add(claw);
        }
        g.add(limb);
      }
    }

    // Bladed crescent tail fin
    if (i === SEG_COUNT - 1) {
      const finShape = new THREE.Shape();
      finShape.moveTo(0.22, 0);
      finShape.quadraticCurveTo(-0.08, 0.30, -0.54, 0.32);
      finShape.quadraticCurveTo(-0.26, 0.06, -0.38, 0);
      finShape.quadraticCurveTo(-0.26, -0.06, -0.54, -0.32);
      finShape.quadraticCurveTo(-0.08, -0.30, 0.22, 0);
      const finGeo = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.025,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 1,
      });
      finGeo.center();
      disposables.push(finGeo);
      const fin = new THREE.Mesh(finGeo, obsidianMat);
      fin.position.x = -0.22;
      g.add(fin);

      const tailCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), voltMat);
      tailCore.scale.set(2.4, 0.65, 0.5);
      tailCore.position.x = -0.18;
      disposables.push(tailCore.geometry);
      g.add(tailCore);
    }

    root.add(g);
    segmentGroups.push(g);

    if (i % 4 === 1 && i < SEG_COUNT - 4) {
      const sh = new THREE.Mesh(shadowDiscGeo, shadowMat);
      sh.scale.setScalar(sc * 1.35);
      root.add(sh);
      shadowDiscs.push({ mesh: sh, segIndex: i });
    }
  }

  // =========================================================================
  // 3. ORGANIC SCALLOPED 3D WYVERN WINGS (Curved Scalloped Membranes + Spars + Wing Thumb Claw)
  // =========================================================================
  const wingAnchor = new THREE.Group();
  root.add(wingAnchor);

  const CURVE_SUBS = 6; // Smooth 6-subdivision concave scallops between every pair of wing fingers!
  // 4 scalloped panels (tip0->tip1, tip1->tip2, tip2->tip3, tip3->flank) + 1 inner shoulder web (shoulder->wrist->flank)
  const TRIS_PER_WING = 4 * CURVE_SUBS + 1;

  const wings = [-1, 1].map((side) => {
    const memPositions = new Float32Array(TRIS_PER_WING * 3 * 3);
    const memUvs = new Float32Array(TRIS_PER_WING * 3 * 2);
    const memGeo = new THREE.BufferGeometry();
    memGeo.setAttribute('position', new THREE.BufferAttribute(memPositions, 3));
    memGeo.setAttribute('uv', new THREE.BufferAttribute(memUvs, 2));
    disposables.push(memGeo);
    const memMesh = new THREE.Mesh(memGeo, organicMembraneMat);
    wingAnchor.add(memMesh);

    const sparGeo = new THREE.CylinderGeometry(0.026, 0.014, 1, 7);
    const thumbGeo = new THREE.ConeGeometry(0.025, 0.16, 5);
    disposables.push(sparGeo, thumbGeo);

    const armBone = new THREE.Mesh(sparGeo, obsidianMat);
    const forearmBone = new THREE.Mesh(sparGeo, obsidianMat);
    const thumbClaw = new THREE.Mesh(thumbGeo, titaniumMat);
    const fingerBones = Array.from({ length: 4 }, (_, idx) => {
      const m = new THREE.Mesh(sparGeo, idx === 0 ? obsidianMat : titaniumMat);
      wingAnchor.add(m);
      return m;
    });
    wingAnchor.add(armBone, forearmBone, thumbClaw);

    return { side, memGeo, memPositions, memUvs, armBone, forearmBone, thumbClaw, fingerBones };
  });

  const tmpDir = new THREE.Vector3();
  const tmpMid = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);

  function orientCylinder(mesh, a, b, thickness = 1) {
    tmpDir.subVectors(b, a);
    const len = tmpDir.length() || 0.001;
    tmpMid.addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(tmpMid);
    mesh.scale.set(thickness, len, thickness);
    mesh.quaternion.setFromUnitVectors(upVec, tmpDir.normalize());
  }

  function writeTriUV(posArr, uvArr, triIdx, a, b, c, ua, va, ub, vb, uc, vc) {
    const o = triIdx * 9;
    posArr[o] = a.x; posArr[o + 1] = a.y; posArr[o + 2] = a.z;
    posArr[o + 3] = b.x; posArr[o + 4] = b.y; posArr[o + 5] = b.z;
    posArr[o + 6] = c.x; posArr[o + 7] = c.y; posArr[o + 8] = c.z;
    const uo = triIdx * 6;
    uvArr[uo] = ua; uvArr[uo + 1] = va;
    uvArr[uo + 2] = ub; uvArr[uo + 3] = vb;
    uvArr[uo + 4] = uc; uvArr[uo + 5] = vc;
  }

  // Reusable scallop curve points
  const ctrlPt = new THREE.Vector3();
  const qA = new THREE.Vector3();
  const qB = new THREE.Vector3();

  function writeScallopedPanel(posArr, uvArr, startTri, origin, pStart, pEnd, inwardPull) {
    // Quadratic Bezier control point pulled inward toward the wrist for authentic curved bat/dragon wing edge!
    ctrlPt.addVectors(pStart, pEnd).multiplyScalar(0.5).lerp(origin, inwardPull);

    let tri = startTri;
    for (let s = 0; s < CURVE_SUBS; s++) {
      const t0 = s / CURVE_SUBS;
      const t1 = (s + 1) / CURVE_SUBS;

      const evalQuad = (t, out) => {
        const it = 1 - t;
        out.set(
          it * it * pStart.x + 2 * it * t * ctrlPt.x + t * t * pEnd.x,
          it * it * pStart.y + 2 * it * t * ctrlPt.y + t * t * pEnd.y,
          it * it * pStart.z + 2 * it * t * ctrlPt.z + t * t * pEnd.z
        );
      };

      evalQuad(t0, qA);
      evalQuad(t1, qB);
      writeTriUV(posArr, uvArr, tri++, origin, qA, qB, 0.5, 0.0, t0, 1.0, t1, 1.0);
    }
    return tri;
  }

  // =========================================================================
  // 4. TRAILING VOLT EMBER PARTICLES
  // =========================================================================
  const EMBER_COUNT = 54;
  const emberPos = new Float32Array(EMBER_COUNT * 3);
  const emberState = Array.from({ length: EMBER_COUNT }, () => ({
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0,
  }));
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    map: glowTex,
    color: 0xd2ff00,
    size: 0.22,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(emberGeo, emberMat);
  root.add(new THREE.Points(emberGeo, emberMat));

  let emberCursor = 0;
  let speedSmoothed = 0;
  let wingPhase = 0;
  let prevHeadAngle = Math.PI;
  let bankSmoothed = 0;

  const wShoulder = new THREE.Vector3();
  const wElbow = new THREE.Vector3();
  const wWrist = new THREE.Vector3();
  const wFlank = new THREE.Vector3();
  const wTips = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  function update(dt, t, targetWorld, hasUserMoved, worldBounds, scaleFactor) {
    root.scale.setScalar(scaleFactor);

    const invS = 1 / Math.max(scaleFactor, 0.2);
    const tx = hasUserMoved
      ? targetWorld.x * invS
      : (worldBounds.w * 0.27 + Math.cos(t * 0.85) * worldBounds.w * 0.11) * invS;
    const ty = hasUserMoved
      ? targetWorld.y * invS
      : (worldBounds.h * 0.04 + Math.sin(t * 1.25) * worldBounds.h * 0.16) * invS;

    const head = pts[0];
    const prevX = head.pos.x;
    const prevY = head.pos.y;

    const chase = 1 - Math.pow(0.0005, dt);
    head.pos.x += (tx - head.pos.x) * chase;
    head.pos.y += (ty - head.pos.y) * chase;
    head.pos.z = 0.55 + Math.sin(t * 2.8) * 0.12;

    const moveDist = Math.hypot(head.pos.x - prevX, head.pos.y - prevY);
    speedSmoothed = speedSmoothed * 0.86 + (moveDist / Math.max(dt, 0.008)) * 0.14;
    wingPhase += dt * (4.4 + Math.min(7.5, speedSmoothed * 0.48));

    // Proportional spine follow-the-leader (100% seamless body & tail)
    for (let i = 1; i < SEG_COUNT; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const dx = cur.pos.x - prev.pos.x;
      const dy = cur.pos.y - prev.pos.y;
      const ang = Math.atan2(dy, dx);
      cur.angle = ang;

      const slither =
        Math.sin(t * 6.2 - i * 0.38) *
        (0.011 + Math.min(0.032, speedSmoothed * 0.0022)) *
        Math.pow(i / SEG_COUNT, 0.75);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);

      const len = segLens[i - 1];
      cur.pos.x = prev.pos.x + Math.cos(ang) * len + nx * slither;
      cur.pos.y = prev.pos.y + Math.sin(ang) * len + ny * slither;
      cur.pos.z = 0.52 + Math.sin(t * 2.8 - i * 0.22) * 0.14 * (1 - (i / SEG_COUNT) * 0.35);
    }

    const headAngle = Math.atan2(head.pos.y - pts[1].pos.y, head.pos.x - pts[1].pos.x);
    let angDelta = headAngle - prevHeadAngle;
    while (angDelta > Math.PI) angDelta -= Math.PI * 2;
    while (angDelta < -Math.PI) angDelta += Math.PI * 2;
    prevHeadAngle = headAngle;

    const targetBank = Math.max(-0.75, Math.min(0.75, (angDelta / Math.max(dt, 0.01)) * 0.15));
    bankSmoothed += (targetBank - bankSmoothed) * Math.min(1, dt * 8);
    head.angle = headAngle;
    head.bank = bankSmoothed;

    headGroup.position.copy(head.pos);
    headGroup.rotation.set(bankSmoothed * 0.7, 0, headAngle);
    jawPivot.rotation.y = Math.min(0.32, 0.05 + speedSmoothed * 0.015 + Math.sin(t * 3.2) * 0.03);

    for (const w of whiskers) {
      const anchorX = head.pos.x + Math.cos(headAngle) * 0.36 - Math.sin(headAngle) * w.side * 0.10;
      const anchorY = head.pos.y + Math.sin(headAngle) * 0.36 + Math.cos(headAngle) * w.side * 0.10;
      w.nodes[0].set(anchorX, anchorY, head.pos.z + 0.02);

      for (let k = 1; k < WHISKER_PTS; k++) {
        const p = w.nodes[k - 1];
        const c = w.nodes[k];
        const a = Math.atan2(c.y - p.y, c.x - p.x);
        const wv = Math.sin(t * 8.0 - k * 0.7 + w.side) * 0.024;
        c.x = p.x + Math.cos(a) * 0.11 - Math.sin(a) * wv;
        c.y = p.y + Math.sin(a) * 0.11 + Math.cos(a) * wv;
        c.z = p.z + Math.cos(t * 5.0 - k * 0.5) * 0.02;
      }

      const arr = w.geo.attributes.position.array;
      for (let k = 0; k < WHISKER_PTS; k++) {
        arr[k * 3] = w.nodes[k].x;
        arr[k * 3 + 1] = w.nodes[k].y;
        arr[k * 3 + 2] = w.nodes[k].z;
      }
      w.geo.attributes.position.needsUpdate = true;
    }

    for (let i = 1; i < SEG_COUNT; i++) {
      const prev = pts[i - 1];
      const seg = pts[i];
      const meshGroup = segmentGroups[i - 1];
      meshGroup.position.copy(seg.pos);
      const localBank = bankSmoothed * Math.max(0.12, 1 - i / SEG_COUNT);
      meshGroup.rotation.set(localBank * 0.65, 0, seg.angle + Math.PI);

      // Continuous armored spine connector between prev -> seg
      const conn = spineConnectors[i - 1];
      orientCylinder(conn.mesh, prev.pos, seg.pos, conn.radius);
    }

    for (const s of shadowDiscs) {
      const p = pts[s.segIndex].pos;
      s.mesh.position.set(p.x + 0.14, p.y - 0.18, -0.35);
    }

    // Update organic scalloped 3D wyvern wings
    const shPt = pts[5];
    wingAnchor.position.copy(shPt.pos);
    wingAnchor.rotation.set(bankSmoothed * 0.85, 0, shPt.angle + Math.PI);

    const flap = Math.sin(wingPhase);
    const flapLag = Math.sin(wingPhase - 0.55);
    const sweep = Math.min(0.45, speedSmoothed * 0.03);

    for (const w of wings) {
      const s = w.side;
      wShoulder.set(0.08, s * 0.14, 0.08);
      wElbow.set(-0.22 - sweep * 0.32, s * 0.64, 0.15 + flap * 0.24);
      wWrist.set(0.24 - sweep * 0.52, s * 1.36, 0.24 + flap * 0.56);
      wFlank.set(-1.12, s * 0.10, 0.02);

      // Sleek swept aerodynamic wyvern wing phalanges
      wTips[0].set(0.18 - sweep * 0.88, s * 2.48, 0.26 + flapLag * 0.82);
      wTips[1].set(-0.48 - sweep * 0.72, s * 2.12, 0.16 + flapLag * 0.68);
      wTips[2].set(-0.98 - sweep * 0.45, s * 1.54, 0.08 + flapLag * 0.46);
      wTips[3].set(-1.26 - sweep * 0.22, s * 0.90, 0.02 + flapLag * 0.24);

      orientCylinder(w.armBone, wShoulder, wElbow, 1.45);
      orientCylinder(w.forearmBone, wElbow, wWrist, 1.25);
      w.thumbClaw.position.copy(wWrist).add(new THREE.Vector3(0.08, s * 0.05, 0.05));
      w.thumbClaw.rotation.set(0, 0, -Math.PI * 0.42 * s);

      for (let f = 0; f < 4; f++) {
        orientCylinder(w.fingerBones[f], wWrist, wTips[f], f === 0 ? 1.05 : 0.68);
      }

      // Build curved scalloped wing panels
      let tri = 0;
      tri = writeScallopedPanel(w.memPositions, w.memUvs, tri, wWrist, wTips[0], wTips[1], 0.26);
      tri = writeScallopedPanel(w.memPositions, w.memUvs, tri, wWrist, wTips[1], wTips[2], 0.28);
      tri = writeScallopedPanel(w.memPositions, w.memUvs, tri, wWrist, wTips[2], wTips[3], 0.30);
      tri = writeScallopedPanel(w.memPositions, w.memUvs, tri, wWrist, wTips[3], wFlank, 0.34);
      writeTriUV(w.memPositions, w.memUvs, tri, wShoulder, wWrist, wFlank, 0.0, 0.0, 0.5, 0.0, 0.5, 0.7);

      w.memGeo.attributes.position.needsUpdate = true;
      w.memGeo.attributes.uv.needsUpdate = true;
      w.memGeo.computeVertexNormals();
    }

    const tail = pts[SEG_COUNT - 1].pos;
    if (speedSmoothed > 1.4 || Math.random() < 0.35) {
      const e = emberState[emberCursor];
      emberCursor = (emberCursor + 1) % EMBER_COUNT;
      e.x = tail.x + (Math.random() - 0.5) * 0.12;
      e.y = tail.y + (Math.random() - 0.5) * 0.12;
      e.z = tail.z;
      e.vx = (Math.random() - 0.5) * 0.7;
      e.vy = (Math.random() - 0.5) * 0.7;
      e.vz = 0.2 + Math.random() * 0.4;
      e.life = 1.0;
    }

    for (let i = 0; i < EMBER_COUNT; i++) {
      const e = emberState[i];
      if (e.life > 0) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.z += e.vz * dt;
        e.life = Math.max(0, e.life - dt * 1.45);
        emberPos[i * 3] = e.x;
        emberPos[i * 3 + 1] = e.y;
        emberPos[i * 3 + 2] = e.z;
      } else {
        emberPos[i * 3] = 9999;
        emberPos[i * 3 + 1] = 9999;
        emberPos[i * 3 + 2] = -99;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
  }

  return { group: root, update, dispose };
}
