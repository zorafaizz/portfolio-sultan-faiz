import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uPortrait;
  uniform sampler2D uTrail;
  uniform vec2 uResolution;
  uniform vec2 uImgSize;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uIdlePresence;
  uniform float uWaveProgress;
  uniform float uWaveStrength;

  // Compact 2D Simplex Noise for organic liquid-blob reveal edges
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  vec2 getPortraitUv(vec2 uv) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    float imgAspect = uImgSize.x / max(uImgSize.y, 1.0);
    bool isPortraitScreen = screenAspect < 0.78;

    float targetH = isPortraitScreen ? 0.66 : 0.90;
    float targetW = targetH * (imgAspect / screenAspect);
    if (targetW > 0.94) {
      float shrink = 0.94 / targetW;
      targetW *= shrink;
      targetH *= shrink;
    }

    // Subtle tactile 3D parallax shifted by smooth pointer
    vec2 parallax = (uPointer - 0.5) * vec2(-0.020, -0.012);
    vec2 shifted = uv + parallax;

    // On mobile portrait viewports, lift portrait slightly so headline sits cleanly below face
    float yOffset = isPortraitScreen ? 0.20 : 0.0;

    vec2 pUv;
    pUv.x = (shifted.x - 0.5) / targetW + 0.5;
    pUv.y = (shifted.y - yOffset) / targetH;
    return pUv;
  }

  float inBounds(vec2 uv) {
    return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  }

  void main() {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 aspectUv = vec2(vUv.x * screenAspect, vUv.y);
    vec2 pUv = getPortraitUv(vUv);

    if (inBounds(pUv) < 0.5) {
      discard;
    }

    // Organic noise fields for Lando-style viscous liquid edge
    float n1 = snoise(aspectUv * 3.6 + vec2(uTime * 0.22, -uTime * 0.16));
    float n2 = snoise(aspectUv * 7.8 + vec2(-uTime * 0.30, uTime * 0.24));
    float organic = n1 * 0.20 + n2 * 0.07;

    // Fluid trail from pointer movement
    float trail = texture2D(uTrail, vUv).r;

    // Gentle idle breathing spotlight around the face before user moves pointer
    float idleY = screenAspect < 0.78 ? 0.66 : 0.62;
    vec2 idleCenter = vec2(0.5 + sin(uTime * 0.65) * 0.028, idleY + cos(uTime * 0.5) * 0.020);
    float idleDist = length((vUv - idleCenter) * vec2(screenAspect, 1.0));
    float idleBlob = smoothstep(0.20, 0.05, idleDist) * 0.44 * uIdlePresence;

    // Expanding radial liquid shockwave triggered on click / tap
    vec2 waveCenter = vec2(0.5, screenAspect < 0.78 ? 0.62 : 0.56);
    float waveDist = length((vUv - waveCenter) * vec2(screenAspect, 1.0)) + organic * 0.10;
    float waveRadius = uWaveProgress * 1.15;
    float waveFill = smoothstep(waveRadius + 0.05, waveRadius - 0.04, waveDist) *
                     (1.0 - smoothstep(0.68, 0.96, uWaveProgress)) * uWaveStrength;

    float combinedField = max(max(trail, idleBlob), waveFill);
    float field = combinedField + organic * 0.65 * smoothstep(0.05, 0.36, combinedField);

    // Crisp, velvety viscous reveal mask + razor-thin editorial meniscus hairline
    float reveal = smoothstep(0.29, 0.37, field);
    float meniscus = smoothstep(0.265, 0.325, field) * (1.0 - smoothstep(0.325, 0.385, field));

    // Optical refraction along the liquid edge
    vec2 refractOffset = vec2(n1, n2) * meniscus * 0.011;
    vec2 sampleUv = clamp(pUv + refractOffset, 0.001, 0.999);

    vec4 tex = texture2D(uPortrait, sampleUv);
    float alpha = tex.a * inBounds(pUv);

    if (alpha < 0.01) {
      discard;
    }

    // Subtle bottom fade so suit shoulders melt seamlessly into obsidian stage
    float bottomFade = smoothstep(0.0, 0.16, pUv.y);
    alpha *= bottomFade;

    // --- LAYER A: UNREVEALED SCULPTED EDITORIAL MONOCHROME / TOPOGRAPHIC SILHOUETTE ---
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float contrastLum = smoothstep(0.08, 0.92, lum);

    // Subtle topographic contour lines carved across the monochrome portrait
    float contourWave = abs(sin(contrastLum * 28.0 + n1 * 1.2 + uTime * 0.35));
    float contourLine = smoothstep(0.92, 0.99, contourWave) * 0.14;

    // Micro halftone dot screen for editorial print texture
    vec2 gridCell = fract(gl_FragCoord.xy * 0.24) - 0.5;
    float dotGrain = smoothstep(0.45, 0.18, length(gridCell)) * 0.06;

    // Edge rim detection along portrait contours
    vec2 px = vec2(2.2) / uImgSize;
    float aL = texture2D(uPortrait, clamp(pUv - vec2(px.x, 0.0), 0.0, 1.0)).a;
    float aR = texture2D(uPortrait, clamp(pUv + vec2(px.x, 0.0), 0.0, 1.0)).a;
    float aU = texture2D(uPortrait, clamp(pUv + vec2(0.0, px.y), 0.0, 1.0)).a;
    float aD = texture2D(uPortrait, clamp(pUv - vec2(0.0, px.y), 0.0, 1.0)).a;
    float silhouetteRim = clamp(abs(aL - aR) + abs(aU - aD), 0.0, 1.0);

    vec3 obsidianShadow = vec3(0.055, 0.062, 0.056);
    vec3 titaniumMid = vec3(0.24, 0.26, 0.24);
    vec3 alabasterHi = vec3(0.58, 0.61, 0.56);
    vec3 voltAccent = vec3(0.824, 1.0, 0.0); // #D2FF00

    vec3 sculpted = mix(obsidianShadow, titaniumMid, smoothstep(0.0, 0.55, contrastLum));
    sculpted = mix(sculpted, alabasterHi, smoothstep(0.55, 1.0, contrastLum) * 0.55);
    sculpted += vec3(contourLine + dotGrain);
    sculpted += mix(vec3(0.75, 0.80, 0.72), voltAccent, 0.45) * silhouetteRim * 0.65;

    // --- LAYER B: REVEALED REAL STUDIO PORTRAIT (Full Color + Filmic Grade) ---
    // Tiny chromatic split right on the liquid meniscus for optical glass feel
    float ca = meniscus * 0.0045;
    float rCh = texture2D(uPortrait, clamp(sampleUv + vec2(ca, 0.0), 0.001, 0.999)).r;
    float gCh = tex.g;
    float bCh = texture2D(uPortrait, clamp(sampleUv - vec2(ca, 0.0), 0.001, 0.999)).b;
    vec3 realColor = vec3(rCh, gCh, bCh);

    // Subtle editorial studio color grade (rich contrast, warm natural skin)
    realColor = pow(max(realColor, 0.0), vec3(1.04));
    realColor = mix(vec3(dot(realColor, vec3(0.3, 0.59, 0.11))), realColor, 1.08);
    realColor *= vec3(1.02, 1.01, 0.99);
    // Subtle studio rim highlight on revealed portrait
    realColor += vec3(0.95, 0.98, 0.88) * silhouetteRim * 0.28;

    // Compose Layer A -> Layer B via viscous fluid mask + refined silver-volt liquid meniscus
    vec3 meniscusColor = mix(vec3(0.92, 0.96, 0.85), voltAccent, 0.72);
    vec3 finalRgb = mix(sculpted, realColor, reveal);
    finalRgb = mix(finalRgb, meniscusColor, meniscus * 0.48);

    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

export function initLandoPortrait({ canvas, stage, pulseButton, reduceMotion }) {
  if (!canvas || !stage || reduceMotion) {
    return { dispose() {}, triggerWave() {} };
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
    return { dispose() {}, triggerWave() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Offscreen fluid trail canvas (velvety velocity-driven organic mask)
  const TRAIL_SIZE = 512;
  const trailCanvas = document.createElement('canvas');
  trailCanvas.width = TRAIL_SIZE;
  trailCanvas.height = TRAIL_SIZE;
  const trailCtx = trailCanvas.getContext('2d');
  trailCtx.fillStyle = '#000000';
  trailCtx.fillRect(0, 0, TRAIL_SIZE, TRAIL_SIZE);

  const trailTex = new THREE.CanvasTexture(trailCanvas);
  trailTex.minFilter = THREE.LinearFilter;
  trailTex.magFilter = THREE.LinearFilter;
  trailTex.wrapS = THREE.ClampToEdgeWrapping;
  trailTex.wrapT = THREE.ClampToEdgeWrapping;

  const uniforms = {
    uPortrait: { value: null },
    uTrail: { value: trailTex },
    uResolution: { value: new THREE.Vector2(stage.clientWidth || 1, stage.clientHeight || 1) },
    uImgSize: { value: new THREE.Vector2(1086, 1448) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uIdlePresence: { value: 1.0 },
    uWaveProgress: { value: 0.0 },
    uWaveStrength: { value: 0.0 },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let portraitTex = null;
  let isReady = false;
  let isVisible = true;
  let isDisposed = false;
  let rafId = 0;

  // Pointer & velocity state
  const targetPtr = { x: 0.5, y: 0.5 };
  const smoothPtr = { x: 0.5, y: 0.5 };
  const lastDraw = { x: 0.5, y: 0.5, initialized: false };
  let pointerActive = false;
  let idleFadeTarget = 1.0;
  let lastMoveTs = 0;

  // Radial click wave state
  let waveActive = false;
  let waveProgress = 0;

  const loader = new THREE.TextureLoader();
  loader.load(
    '/portrait.png',
    (tex) => {
      if (isDisposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      portraitTex = tex;
      uniforms.uPortrait.value = tex;
      if (tex.image?.naturalWidth && tex.image?.naturalHeight) {
        uniforms.uImgSize.value.set(tex.image.naturalWidth, tex.image.naturalHeight);
      }
      isReady = true;
      stage.classList.add('is-webgl-ready');
      resize();
    },
    undefined,
    () => {
      // Static HTML fallback remains cleanly visible on load failure
    }
  );

  function resize() {
    if (isDisposed) return;
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
  }

  function paintBlob(nx, ny, radiusPx, strength) {
    const cx = nx * TRAIL_SIZE;
    const cy = (1 - ny) * TRAIL_SIZE;
    const grad = trailCtx.createRadialGradient(cx, cy, radiusPx * 0.08, cx, cy, radiusPx);
    grad.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
    grad.addColorStop(0.55, `rgba(255, 255, 255, ${strength * 0.55})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    trailCtx.globalCompositeOperation = 'lighter';
    trailCtx.fillStyle = grad;
    trailCtx.beginPath();
    trailCtx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    trailCtx.fill();
  }

  function updatePointerFromEvent(e) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = 1.0 - (e.clientY - rect.top) / rect.height;
    if (nx < -0.1 || nx > 1.1 || ny < -0.1 || ny > 1.1) return;

    targetPtr.x = Math.min(1, Math.max(0, nx));
    targetPtr.y = Math.min(1, Math.max(0, ny));
    pointerActive = true;
    idleFadeTarget = 0.0;
    lastMoveTs = performance.now();
  }

  function triggerWave() {
    waveActive = true;
    waveProgress = 0.0;
    uniforms.uWaveStrength.value = 1.0;
  }

  function onPointerMove(e) {
    updatePointerFromEvent(e);
  }

  function onPointerDown(e) {
    updatePointerFromEvent(e);
    if (e.target.closest('a, button')) return;
    triggerWave();
  }

  function onWindowBlur() {
    pointerActive = false;
  }

  function onContextLost(e) {
    e.preventDefault();
    stage.classList.remove('is-webgl-ready');
  }

  function onContextRestored() {
    if (isReady) stage.classList.add('is-webgl-ready');
  }

  const observer = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0.02 }
  );
  observer.observe(stage);

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  stage.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('blur', onWindowBlur);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const onPulseClick = () => triggerWave();
  if (pulseButton) {
    pulseButton.addEventListener('click', onPulseClick);
  }

  resize();

  const clock = new THREE.Clock();

  function render() {
    if (isDisposed) return;
    rafId = requestAnimationFrame(render);

    if (document.hidden || !isVisible || !isReady) {
      clock.getDelta();
      return;
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    uniforms.uTime.value += dt;

    // Re-enable gentle ambient breathing after 4.5s of no pointer movement
    if (pointerActive && now - lastMoveTs > 4500) {
      idleFadeTarget = 0.85;
    }
    uniforms.uIdlePresence.value += (idleFadeTarget - uniforms.uIdlePresence.value) * Math.min(1, dt * 2.2);

    // Spring-damped pointer interpolation
    const ease = 1 - Math.pow(0.0008, dt);
    smoothPtr.x += (targetPtr.x - smoothPtr.x) * ease;
    smoothPtr.y += (targetPtr.y - smoothPtr.y) * ease;
    uniforms.uPointer.value.set(smoothPtr.x, smoothPtr.y);

    // Smooth viscous decay of previous trail strokes
    trailCtx.globalCompositeOperation = 'source-over';
    trailCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.18, dt * 1.55)})`;
    trailCtx.fillRect(0, 0, TRAIL_SIZE, TRAIL_SIZE);

    if (pointerActive) {
      if (!lastDraw.initialized) {
        lastDraw.x = smoothPtr.x;
        lastDraw.y = smoothPtr.y;
        lastDraw.initialized = true;
      }

      const dx = smoothPtr.x - lastDraw.x;
      const dy = smoothPtr.y - lastDraw.y;
      const dist = Math.hypot(dx, dy);

      // Paint continuous velvety strokes along fast sweeps
      const isNarrow = window.innerWidth < 768;
      const baseR = isNarrow ? 54 : 68;
      const velocityBoost = Math.min(48, dist * 420);
      const radius = baseR + velocityBoost;

      if (dist > 0.001) {
        const steps = Math.min(18, Math.max(1, Math.ceil(dist * 75)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          paintBlob(lastDraw.x + dx * t, lastDraw.y + dy * t, radius, 0.24);
        }
        lastDraw.x = smoothPtr.x;
        lastDraw.y = smoothPtr.y;
      } else if (now - lastMoveTs < 900) {
        // Maintain soft liquid pool while hovering over portrait
        paintBlob(smoothPtr.x, smoothPtr.y, baseR * 0.92, 0.12);
      }
    }

    // Update radial shockwave reveal
    if (waveActive) {
      waveProgress += dt * 0.72;
      uniforms.uWaveProgress.value = waveProgress;
      if (waveProgress >= 1.0) {
        waveActive = false;
        waveProgress = 0.0;
        uniforms.uWaveProgress.value = 0.0;
        uniforms.uWaveStrength.value = 0.0;
      }
    }

    trailTex.needsUpdate = true;
    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(render);

  function dispose() {
    isDisposed = true;
    cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    stage.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('blur', onWindowBlur);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (pulseButton) {
      pulseButton.removeEventListener('click', onPulseClick);
    }
    geometry.dispose();
    material.dispose();
    trailTex.dispose();
    if (portraitTex) portraitTex.dispose();
    renderer.dispose();
  }

  return { dispose, triggerWave };
}
