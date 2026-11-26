import * as THREE from 'three';
import gsap from 'gsap';

const COUNT = 5200;

const VERT_SHADER = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aScale;
  attribute float aSeed;

  uniform float uMorph;
  uniform float uTime;
  uniform float uPixelRatio;

  varying float vAccent;
  varying float vDepth;

  void main() {
    // Smooth eased morph per particle with slight organic wave delay
    float localProgress = clamp((uMorph * 1.25) - aSeed * 0.25, 0.0, 1.0);
    float eased = localProgress * localProgress * (3.0 - 2.0 * localProgress);

    vec3 pos = mix(aFrom, aTo, eased);

    // Gentle living harmonic breath
    float wave = sin(uTime * 0.9 + aSeed * 12.0 + pos.x * 0.8) * 0.06;
    pos.y += wave;
    pos.z += cos(uTime * 0.7 + aSeed * 9.0 + pos.y * 0.7) * 0.05;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float size = aScale * uPixelRatio * (18.0 / max(-mvPosition.z, 1.2));
    gl_PointSize = clamp(size, 1.2, 11.0);

    vAccent = step(0.84, aSeed);
    vDepth = smoothstep(-9.0, -2.5, mvPosition.z);
  }
`;

const FRAG_SHADER = /* glsl */ `
  precision mediump float;

  varying float vAccent;
  varying float vDepth;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    float soft = smoothstep(0.5, 0.08, d);
    vec3 alabaster = vec3(0.92, 0.93, 0.89);
    vec3 volt = vec3(0.824, 1.0, 0.0);
    vec3 col = mix(alabaster, volt, vAccent);

    float alpha = soft * (0.25 + 0.65 * vDepth);
    gl_FragColor = vec4(col, alpha);
  }
`;

function buildShapes() {
  const shapes = [
    new Float32Array(COUNT * 3), // 0: AI Neural Torus Knot
    new Float32Array(COUNT * 3), // 1: Game Cluster Voxel Lattice
    new Float32Array(COUNT * 3), // 2: TKJ Encrypted WireGuard Rings / Geodesic
    new Float32Array(COUNT * 3), // 3: Quant SMC Harmonic Wave Field
  ];

  // Deterministic pseudo-random so builds are stable and reproducible
  let seed = 42197;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const gridSide = Math.cbrt(COUNT);
  const gridN = Math.ceil(gridSide);

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    const t = (i / COUNT) * Math.PI * 2;

    // 0: Synaptic Torus Knot (p=3, q=5) with cloud dispersion
    const p = 3;
    const q = 5;
    const phi = t * 6.0;
    const rTube = 0.42 * (0.35 + rand() * 0.65);
    const theta = rand() * Math.PI * 2;
    const coreR = 1.65 + 0.52 * Math.cos(q * phi);
    shapes[0][i3] = coreR * Math.cos(p * phi) + Math.cos(theta) * rTube;
    shapes[0][i3 + 1] = coreR * Math.sin(p * phi) + Math.sin(theta) * rTube;
    shapes[0][i3 + 2] = 0.65 * Math.sin(q * phi) + (rand() - 0.5) * 0.55;

    // 1: Precision Crystalline Voxel Lattice (server cluster nodes)
    const gx = i % gridN;
    const gy = Math.floor(i / gridN) % gridN;
    const gz = Math.floor(i / (gridN * gridN));
    const norm = (v) => (v / Math.max(gridN - 1, 1) - 0.5) * 3.1;
    shapes[1][i3] = norm(gx) + (rand() - 0.5) * 0.04;
    shapes[1][i3 + 1] = norm(gy) + (rand() - 0.5) * 0.04;
    shapes[1][i3 + 2] = norm(gz) + (rand() - 0.5) * 0.04;

    // 2: Zero-Trust Concentric Orbital Mesh (WireGuard / Network rings)
    if (i < COUNT * 0.65) {
      // Fibonacci sphere shell
      const idx = i / (COUNT * 0.65);
      const y = 1 - idx * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const golden = i * 2.399963229728653;
      const R = 1.85;
      shapes[2][i3] = Math.cos(golden) * radiusAtY * R;
      shapes[2][i3 + 1] = y * R;
      shapes[2][i3 + 2] = Math.sin(golden) * radiusAtY * R;
    } else {
      // Tilted encrypted tunnel ring
      const ringA = rand() * Math.PI * 2;
      const ringR = 2.45 + (rand() - 0.5) * 0.35;
      shapes[2][i3] = Math.cos(ringA) * ringR;
      shapes[2][i3 + 1] = Math.sin(ringA) * ringR * 0.36;
      shapes[2][i3 + 2] = Math.sin(ringA) * ringR * 0.92;
    }

    // 3: Quantitative SMC Liquidity Wave Strata
    const row = Math.floor(i / 72);
    const col = i % 72;
    const wx = (col / 71 - 0.5) * 5.2;
    const wz = (row / 72 - 0.5) * 3.8;
    const wy =
      Math.sin(wx * 1.45) * 0.58 +
      Math.cos(wz * 1.8 + wx * 0.6) * 0.38 +
      Math.sin((wx - wz) * 2.2) * 0.16;
    shapes[3][i3] = wx;
    shapes[3][i3 + 1] = wy;
    shapes[3][i3 + 2] = wz;
  }

  return shapes;
}

export function initMorphStage({ canvas, section, reduceMotion }) {
  if (!canvas || !section || reduceMotion) {
    return { setShape() {}, dispose() {} };
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
    return { setShape() {}, dispose() {} };
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 40);
  camera.position.set(0, 0, 6.2);

  const shapes = buildShapes();
  const geometry = new THREE.BufferGeometry();

  const fromArr = new Float32Array(shapes[0]);
  const toArr = new Float32Array(shapes[0]);
  const scaleArr = new Float32Array(COUNT);
  const seedArr = new Float32Array(COUNT);

  let s = 91823;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < COUNT; i++) {
    scaleArr[i] = 0.65 + rand() * 1.55;
    seedArr[i] = rand();
  }

  // `position` required for Three.js frustum culling; actual positions come from aFrom/aTo
  geometry.setAttribute('position', new THREE.BufferAttribute(fromArr, 3));
  geometry.setAttribute('aFrom', new THREE.BufferAttribute(fromArr, 3));
  geometry.setAttribute('aTo', new THREE.BufferAttribute(toArr, 3));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scaleArr, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));

  const uniforms = {
    uMorph: { value: 1.0 },
    uTime: { value: 0.0 },
    uPixelRatio: { value: dpr },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT_SHADER,
    fragmentShader: FRAG_SHADER,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let currentIdx = 0;
  let morphTween = null;
  let isVisible = false;
  let isDisposed = false;
  let rafId = 0;

  const targetRot = { x: 0.15, y: 0 };
  const smoothRot = { x: 0.15, y: 0 };

  function resize() {
    if (isDisposed) return;
    const w = section.clientWidth || window.innerWidth;
    const h = section.clientHeight || window.innerHeight;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(nextDpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = nextDpr;

    // Position sculpture elegantly to the right on desktop so left discipline list breathes
    points.position.x = w >= 960 ? 1.55 : 0;
    points.scale.setScalar(w < 680 ? 0.72 : 1.0);
  }

  function setShape(index) {
    const safeIdx = Math.max(0, Math.min(shapes.length - 1, index));
    if (safeIdx === currentIdx && uniforms.uMorph.value >= 0.99) return;

    // Bake current interpolated positions into aFrom before morphing to new target
    const progress = uniforms.uMorph.value;
    const aFrom = geometry.attributes.aFrom.array;
    const aTo = geometry.attributes.aTo.array;

    for (let i = 0; i < COUNT * 3; i++) {
      aFrom[i] = aFrom[i] + (aTo[i] - aFrom[i]) * progress;
      aTo[i] = shapes[safeIdx][i];
    }

    geometry.attributes.aFrom.needsUpdate = true;
    geometry.attributes.aTo.needsUpdate = true;

    currentIdx = safeIdx;
    uniforms.uMorph.value = 0.0;

    if (morphTween) morphTween.kill();
    morphTween = gsap.to(uniforms.uMorph, {
      value: 1.0,
      duration: 1.15,
      ease: 'power3.inOut',
    });
  }

  function onPointerMove(e) {
    if (!isVisible) return;
    const nx = e.clientX / Math.max(window.innerWidth, 1) - 0.5;
    const ny = e.clientY / Math.max(window.innerHeight, 1) - 0.5;
    targetRot.y = nx * 0.75;
    targetRot.x = ny * 0.45 + 0.15;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.02 }
  );
  observer.observe(section);

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  resize();

  const clock = new THREE.Clock();

  function animate() {
    if (isDisposed) return;
    rafId = requestAnimationFrame(animate);

    if (document.hidden || !isVisible) {
      clock.getDelta();
      return;
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;

    const k = 1 - Math.pow(0.01, dt);
    smoothRot.x += (targetRot.x - smoothRot.x) * k;
    smoothRot.y += (targetRot.y - smoothRot.y) * k;

    points.rotation.x = smoothRot.x;
    points.rotation.y = smoothRot.y + uniforms.uTime.value * 0.14;

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(animate);

  function dispose() {
    isDisposed = true;
    cancelAnimationFrame(rafId);
    if (morphTween) morphTween.kill();
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }

  return { setShape, dispose };
}
