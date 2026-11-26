import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Pass 1: True GPU Ping-Pong Fluid Advection + Diffusion + Continuous Segment Brush
// Produces authentic Lando Norris viscous liquid-blob trails for mouse & continuous touch drag
const FLUID_SIM_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uPrev;
  uniform vec2 uAspect;
  uniform vec2 uPointer;
  uniform vec2 uPrevPointer;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uDecay;
  uniform float uTime;

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

  // Exact capsule distance between previous pointer and current pointer (zero gaps on fast swipes)
  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    // Organic curl advection so revealed edges drift and curl smoothly like liquid ink
    float nA = snoise(vUv * uAspect * 3.4 + vec2(uTime * 0.24, -uTime * 0.18));
    float nB = snoise(vUv * uAspect * 3.4 + vec2(-uTime * 0.19, uTime * 0.27) + 17.3);
    vec2 advect = vec2(nA, nB) * 0.0024;

    // Soft 5-tap diffusion blur for silky gooey viscosity
    vec2 texel = vec2(1.0 / 256.0);
    vec2 uvA = clamp(vUv + advect, 0.002, 0.998);
    float c = texture2D(uPrev, uvA).r;
    float l = texture2D(uPrev, clamp(uvA - vec2(texel.x, 0.0), 0.0, 1.0)).r;
    float r = texture2D(uPrev, clamp(uvA + vec2(texel.x, 0.0), 0.0, 1.0)).r;
    float u = texture2D(uPrev, clamp(uvA + vec2(0.0, texel.y), 0.0, 1.0)).r;
    float d = texture2D(uPrev, clamp(uvA - vec2(0.0, texel.y), 0.0, 1.0)).r;

    float prevDensity = (c * 0.52 + (l + r + u + d) * 0.12) * uDecay;

    // Continuous capsule stamp along pointer / touch movement vector
    float dist = sdSegment(vUv * uAspect, uPrevPointer * uAspect, uPointer * uAspect);
    float blob = smoothstep(uRadius, uRadius * 0.12, dist) * uStrength;

    float nextDensity = clamp(max(prevDensity, prevDensity + blob * 0.85), 0.0, 1.0);
    gl_FragColor = vec4(nextDensity, nextDensity, nextDensity, 1.0);
  }
`;

// Pass 2: Editorial Dual-Layer Portrait Composite with Organic Liquid Refraction
const PORTRAIT_COMPOSITE_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uPortrait;
  uniform sampler2D uFluid;
  uniform vec2 uResolution;
  uniform vec2 uImgSize;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uIdlePresence;

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

    float targetH = isPortraitScreen ? 0.66 : 0.89;
    float targetW = targetH * (imgAspect / screenAspect);
    if (targetW > 0.94) {
      float shrink = 0.94 / targetW;
      targetW *= shrink;
      targetH *= shrink;
    }

    vec2 parallax = (uPointer - 0.5) * vec2(-0.018, -0.012);
    vec2 shifted = uv + parallax;
    float yOffset = isPortraitScreen ? 0.21 : 0.0;

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

    // Sample GPU fluid field + compute gradient for realistic liquid surface refraction
    vec2 eps = vec2(0.008, 0.008);
    float fC = texture2D(uFluid, vUv).r;
    float fR = texture2D(uFluid, clamp(vUv + vec2(eps.x, 0.0), 0.0, 1.0)).r;
    float fU = texture2D(uFluid, clamp(vUv + vec2(0.0, eps.y), 0.0, 1.0)).r;
    vec2 fluidGrad = vec2(fC - fR, fC - fU);

    // Subtle organic liquid wobble on mask edge
    float wobble = snoise(aspectUv * 4.5 + vec2(uTime * 0.25, -uTime * 0.20)) * 0.14;

    // Gentle idle breathing peek around upper face when untouched
    float idleY = screenAspect < 0.78 ? 0.65 : 0.61;
    vec2 idleCenter = vec2(0.5 + sin(uTime * 0.55) * 0.025, idleY + cos(uTime * 0.45) * 0.018);
    float idleDist = length((vUv - idleCenter) * vec2(screenAspect, 1.0));
    float idleBlob = smoothstep(0.19, 0.03, idleDist) * 0.48 * uIdlePresence;

    float baseField = max(fC, idleBlob);
    float field = baseField + wobble * smoothstep(0.04, 0.36, baseField);

    // Silky, ultra-smooth Lando Norris gooey mask transition
    float reveal = smoothstep(0.22, 0.36, field);
    float rim = smoothstep(0.19, 0.28, field) * (1.0 - smoothstep(0.28, 0.38, field));

    // Liquid glass UV displacement right along the fluid boundary
    vec2 refractUv = clamp(pUv + fluidGrad * 0.055 * (0.4 + rim * 1.4), 0.001, 0.999);
    vec4 tex = texture2D(uPortrait, refractUv);
    float alpha = tex.a * inBounds(pUv);
    if (alpha < 0.01) discard;

    // Soft bottom hem fade into obsidian canvas
    alpha *= smoothstep(0.0, 0.16, pUv.y);

    // Silhouette edge detection for delicate studio rim light
    vec2 px = vec2(2.0) / uImgSize;
    float aL = texture2D(uPortrait, clamp(pUv - vec2(px.x, 0.0), 0.0, 1.0)).a;
    float aR = texture2D(uPortrait, clamp(pUv + vec2(px.x, 0.0), 0.0, 1.0)).a;
    float aU = texture2D(uPortrait, clamp(pUv + vec2(0.0, px.y), 0.0, 1.0)).a;
    float aD = texture2D(uPortrait, clamp(pUv - vec2(0.0, px.y), 0.0, 1.0)).a;
    float silhouetteRim = clamp(abs(aL - aR) + abs(aU - aD), 0.0, 1.0);

    // LAYER A: Refined Editorial Platinum-Obsidian Monochrome Sculpted Portrait
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float tone = smoothstep(0.06, 0.94, lum);

    float topo = smoothstep(0.93, 0.995, abs(sin(tone * 26.0 + wobble * 3.0 + uTime * 0.25))) * 0.10;
    vec2 cell = fract(gl_FragCoord.xy * 0.26) - 0.5;
    float halftone = smoothstep(0.42, 0.16, length(cell)) * 0.045;

    vec3 darkMatte = vec3(0.055, 0.060, 0.056);
    vec3 silverMid = vec3(0.23, 0.25, 0.235);
    vec3 platinumHi = vec3(0.56, 0.59, 0.55);
    vec3 volt = vec3(0.824, 1.0, 0.0);

    vec3 baseLayer = mix(darkMatte, silverMid, smoothstep(0.0, 0.55, tone));
    baseLayer = mix(baseLayer, platinumHi, smoothstep(0.55, 1.0, tone) * 0.58);
    baseLayer += vec3(topo + halftone);
    baseLayer += mix(vec3(0.85, 0.88, 0.82), volt, 0.32) * silhouetteRim * 0.45;

    // LAYER B: Real Full-Color Studio Portrait with Subtle Optical Chromatic Refraction
    float ca = rim * 0.0038;
    float rC = texture2D(uPortrait, clamp(refractUv + vec2(ca, 0.0), 0.001, 0.999)).r;
    float gC = tex.g;
    float bC = texture2D(uPortrait, clamp(refractUv - vec2(ca, 0.0), 0.001, 0.999)).b;
    vec3 realLayer = vec3(rC, gC, bC);

    realLayer = pow(max(realLayer, 0.0), vec3(1.03));
    realLayer = mix(vec3(dot(realLayer, vec3(0.3, 0.59, 0.11))), realLayer, 1.08);
    realLayer += vec3(0.95, 0.97, 0.90) * silhouetteRim * 0.22;

    // Blend with silky meniscus sheen (restrained, crisp, zero muddy green blotches)
    vec3 meniscusTint = mix(vec3(0.94, 0.96, 0.88), volt, 0.62);
    vec3 outRgb = mix(baseLayer, realLayer, reveal);
    outRgb = mix(outRgb, meniscusTint, rim * 0.34);

    gl_FragColor = vec4(outRgb, alpha);
  }
`;

export function initLandoPortrait({ canvas, stage, reduceMotion }) {
  if (!canvas || !stage || reduceMotion) {
    return { dispose() {} };
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
    return { dispose() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  // GPU Ping-Pong FBO render targets for silky fluid trail advection
  const rtOpts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  };
  let rtA = new THREE.WebGLRenderTarget(256, 256, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(256, 256, rtOpts);

  const simScene = new THREE.Scene();
  const simUniforms = {
    uPrev: { value: rtA.texture },
    uAspect: { value: new THREE.Vector2(1.6, 1.0) },
    uPointer: { value: new THREE.Vector2(-2, -2) },
    uPrevPointer: { value: new THREE.Vector2(-2, -2) },
    uRadius: { value: 0.14 },
    uStrength: { value: 0.0 },
    uDecay: { value: 0.962 },
    uTime: { value: 0 },
  };
  const simMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FLUID_SIM_FRAG,
    uniforms: simUniforms,
    depthTest: false,
    depthWrite: false,
  });
  simScene.add(new THREE.Mesh(quadGeo, simMat));

  const mainScene = new THREE.Scene();
  const mainUniforms = {
    uPortrait: { value: null },
    uFluid: { value: rtB.texture },
    uResolution: { value: new THREE.Vector2(stage.clientWidth || 1, stage.clientHeight || 1) },
    uImgSize: { value: new THREE.Vector2(1086, 1448) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uIdlePresence: { value: 1.0 },
  };
  const mainMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: PORTRAIT_COMPOSITE_FRAG,
    uniforms: mainUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  mainScene.add(new THREE.Mesh(quadGeo, mainMat));

  let portraitTex = null;
  let isReady = false;
  let isVisible = true;
  let isDisposed = false;
  let rafId = 0;

  // Continuous pointer + touch drag state
  const targetPtr = { x: 0.5, y: 0.5 };
  const smoothPtr = { x: 0.5, y: 0.5 };
  const prevSmooth = { x: 0.5, y: 0.5 };
  let hasActiveInput = false;
  let isTouching = false;
  let idleTarget = 1.0;
  let lastInputTime = 0;

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
      mainUniforms.uPortrait.value = tex;
      if (tex.image?.naturalWidth && tex.image?.naturalHeight) {
        mainUniforms.uImgSize.value.set(tex.image.naturalWidth, tex.image.naturalHeight);
      }
      isReady = true;
      stage.classList.add('is-webgl-ready');
      resize();
    },
    undefined,
    () => {}
  );

  function resize() {
    if (isDisposed) return;
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    mainUniforms.uResolution.value.set(w, h);
    simUniforms.uAspect.value.set(w / Math.max(h, 1), 1.0);
  }

  function ingestCoords(clientX, clientY, snapImmediately = false) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (clientX - rect.left) / rect.width;
    const ny = 1.0 - (clientY - rect.top) / rect.height;
    if (nx < -0.15 || nx > 1.15 || ny < -0.15 || ny > 1.15) return;

    const clampedX = Math.min(1, Math.max(0, nx));
    const clampedY = Math.min(1, Math.max(0, ny));
    targetPtr.x = clampedX;
    targetPtr.y = clampedY;

    if (snapImmediately || !hasActiveInput) {
      smoothPtr.x = clampedX;
      smoothPtr.y = clampedY;
      prevSmooth.x = clampedX;
      prevSmooth.y = clampedY;
    }

    hasActiveInput = true;
    idleTarget = 0.0;
    lastInputTime = performance.now();
  }

  // Desktop mouse & pen movement
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return; // handled by dedicated continuous touchmove listener
    ingestCoords(e.clientX, e.clientY, false);
  }

  // Dedicated continuous mobile touch drag tracking (tracks every pixel of finger motion!)
  function onTouchStart(e) {
    if (!e.touches.length) return;
    isTouching = true;
    ingestCoords(e.touches[0].clientX, e.touches[0].clientY, true);
  }

  function onTouchMove(e) {
    if (!e.touches.length) return;
    isTouching = true;
    ingestCoords(e.touches[0].clientX, e.touches[0].clientY, false);
  }

  function onTouchEnd() {
    isTouching = false;
  }

  function onBlur() {
    isTouching = false;
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
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

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
    simUniforms.uTime.value += dt;
    mainUniforms.uTime.value += dt;

    // Gentle idle presence returns smoothly after 4.2s of inactivity
    if (hasActiveInput && !isTouching && now - lastInputTime > 4200) {
      idleTarget = 0.9;
    }
    mainUniforms.uIdlePresence.value += (idleTarget - mainUniforms.uIdlePresence.value) * Math.min(1, dt * 2.0);

    // Ultra-silky spring-damped tracking (snappier on finger drag, velvety glide on mouse)
    const damp = isTouching ? 0.00008 : 0.00045;
    const ease = 1 - Math.pow(damp, dt);
    prevSmooth.x = smoothPtr.x;
    prevSmooth.y = smoothPtr.y;
    smoothPtr.x += (targetPtr.x - smoothPtr.x) * ease;
    smoothPtr.y += (targetPtr.y - smoothPtr.y) * ease;
    mainUniforms.uPointer.value.set(smoothPtr.x, smoothPtr.y);

    const speed = Math.hypot(smoothPtr.x - prevSmooth.x, smoothPtr.y - prevSmooth.y);
    const recentlyActive = hasActiveInput && (isTouching || now - lastInputTime < 950);

    const isMobile = window.innerWidth < 768;
    const baseRadius = isMobile ? 0.145 : 0.175;
    simUniforms.uRadius.value = baseRadius + Math.min(0.11, speed * 2.1);
    simUniforms.uStrength.value = recentlyActive ? (isTouching ? 0.95 : Math.min(0.92, 0.35 + speed * 14.0)) : 0.0;
    simUniforms.uDecay.value = Math.pow(0.962, dt * 60);
    simUniforms.uPrevPointer.value.set(prevSmooth.x, prevSmooth.y);
    simUniforms.uPointer.value.set(smoothPtr.x, smoothPtr.y);

    // Step 1: Ping-pong fluid simulation into rtB
    simUniforms.uPrev.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, camera);

    // Step 2: Render portrait composite to screen
    mainUniforms.uFluid.value = rtB.texture;
    renderer.setRenderTarget(null);
    renderer.render(mainScene, camera);

    // Swap ping-pong buffers
    const tmp = rtA;
    rtA = rtB;
    rtB = tmp;
  }

  rafId = requestAnimationFrame(render);

  function dispose() {
    isDisposed = true;
    cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    quadGeo.dispose();
    simMat.dispose();
    mainMat.dispose();
    rtA.dispose();
    rtB.dispose();
    if (portraitTex) portraitTex.dispose();
    renderer.dispose();
  }

  return { dispose };
}
