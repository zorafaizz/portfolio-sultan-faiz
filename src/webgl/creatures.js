/**
 * Articulated Kinetic Companions:
 * - Dragon: 28-segment IK spine, sinusoidal undulation, swept ribs, speed-reactive wings & embers.
 * - Spider: 8-legged 2-bone analytical Inverse Kinematics with alternating tetrapod stepping gait.
 * Follows both mouse glide and continuous touch drag cleanly across the viewport.
 */

function solveTwoBoneIK(hx, hy, fx, fy, l1, l2, bendDir) {
  const dx = fx - hx;
  const dy = fy - hy;
  const dist = Math.max(0.001, Math.min(l1 + l2 - 0.5, Math.hypot(dx, dy)));
  const baseAngle = Math.atan2(dy, dx);
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const angleA = Math.acos(cosA);
  const jointAngle = baseAngle + bendDir * angleA;
  return {
    kx: hx + Math.cos(jointAngle) * l1,
    ky: hy + Math.sin(jointAngle) * l1,
  };
}

export function initCreatures({ canvas, reduceMotion, initialMode = 'dragon' }) {
  if (!canvas || reduceMotion) {
    return { setMode() {}, dispose() {} };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return { setMode() {}, dispose() {} };

  let mode = initialMode;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = 0;
  let isDisposed = false;

  // Shared pointer/touch target (starts gracefully on right side so hero face is never blocked)
  const target = {
    x: width * 0.78,
    y: height * 0.42,
    hasUserMoved: false,
  };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  // =========================================================================
  // DRAGON STATE (28-segment Verlet spine + dynamic wings + tail embers)
  // =========================================================================
  const SEG_COUNT = 28;
  const SEG_LEN = 11.5;
  const dragonPts = Array.from({ length: SEG_COUNT }, (_, i) => ({
    x: target.x + i * SEG_LEN,
    y: target.y,
    angle: Math.PI,
  }));
  const embers = [];
  let dragonSpeed = 0;
  let wingPhase = 0;

  function updateAndDrawDragon(dt, t) {
    // Gentle figure-8 patrol on right flank until user moves mouse/finger
    const tx = target.hasUserMoved ? target.x : width * 0.78 + Math.cos(t * 0.9) * Math.min(90, width * 0.12);
    const ty = target.hasUserMoved ? target.y : height * 0.44 + Math.sin(t * 1.35) * 62;

    const head = dragonPts[0];
    const prevHx = head.x;
    const prevHy = head.y;

    const chase = 1 - Math.pow(0.0006, dt);
    head.x += (tx - head.x) * chase;
    head.y += (ty - head.y) * chase;

    const stepDist = Math.hypot(head.x - prevHx, head.y - prevHy);
    dragonSpeed = dragonSpeed * 0.86 + (stepDist / Math.max(dt, 0.008)) * 0.14;
    wingPhase += dt * (4.2 + Math.min(9.0, dragonSpeed * 0.012));

    // Follow-the-leader constraints + subtle serpentine undulation
    for (let i = 1; i < SEG_COUNT; i++) {
      const prev = dragonPts[i - 1];
      const cur = dragonPts[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const ang = Math.atan2(dy, dx);
      cur.angle = ang;

      const slitherAmp = Math.sin(t * 6.5 - i * 0.48) * (0.45 + Math.min(1.6, dragonSpeed * 0.002)) * (i / SEG_COUNT);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);

      cur.x = prev.x + Math.cos(ang) * SEG_LEN + nx * slitherAmp;
      cur.y = prev.y + Math.sin(ang) * SEG_LEN + ny * slitherAmp;
    }
    head.angle = Math.atan2(head.y - dragonPts[1].y, head.x - dragonPts[1].x);

    // Emit faint volt ember sparks from tail tip when gliding
    if (dragonSpeed > 90 && Math.random() < 0.45 && embers.length < 28) {
      const tail = dragonPts[SEG_COUNT - 1];
      embers.push({
        x: tail.x,
        y: tail.y,
        vx: (Math.random() - 0.5) * 28,
        vy: (Math.random() - 0.5) * 28 - 10,
        life: 1,
        r: 1.2 + Math.random() * 1.8,
      });
    }

    // Draw fading embers
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) {
        embers.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 255, 0, ${p.life * 0.65})`;
      ctx.fill();
    }

    // Draw articulated swept skeletal wings attached at shoulder segment 4
    const shoulder = dragonPts[4];
    const dirAng = shoulder.angle + Math.PI; // forward heading
    const flap = Math.sin(wingPhase) * 0.36;
    const sweepBack = Math.min(0.45, dragonSpeed * 0.0005);

    for (const side of [-1, 1]) {
      const baseA = dirAng + side * (Math.PI * 0.58 + sweepBack - flap * 0.55);
      const wingSpan = width < 680 ? 48 : 66;
      const midX = shoulder.x + Math.cos(baseA) * (wingSpan * 0.52);
      const midY = shoulder.y + Math.sin(baseA) * (wingSpan * 0.52);
      const tipA = baseA + side * (0.42 + flap * 0.35);
      const tipX = midX + Math.cos(tipA) * (wingSpan * 0.58);
      const tipY = midY + Math.sin(tipA) * (wingSpan * 0.58);

      // Subtle translucent wing membrane
      const anchorTail = dragonPts[11];
      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(midX, midY);
      ctx.lineTo(tipX, tipY);
      ctx.quadraticCurveTo(
        (tipX + anchorTail.x) * 0.5,
        (tipY + anchorTail.y) * 0.5,
        anchorTail.x,
        anchorTail.y
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(14, 17, 14, 0.24)';
      ctx.fill();

      // Crisp dark + silver + volt wing spars
      ctx.strokeStyle = 'rgba(10, 11, 10, 0.65)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(midX, midY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(235, 238, 230, 0.72)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Secondary wing fingers
      for (let f = 0; f < 2; f++) {
        const fA = tipA + side * (0.34 + f * 0.36);
        const fLen = wingSpan * (0.42 - f * 0.1);
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + Math.cos(fA) * fLen, midY + Math.sin(fA) * fLen);
        ctx.strokeStyle = 'rgba(210, 255, 0, 0.35)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    // Draw tapered dorsal ribs along body segments
    for (let i = 2; i < SEG_COUNT - 4; i++) {
      const pt = dragonPts[i];
      const frac = 1 - i / SEG_COUNT;
      const ribLen = Math.sin((i / (SEG_COUNT - 3)) * Math.PI) * (width < 680 ? 14 : 19);
      const perp = pt.angle + Math.PI * 0.5;
      const sweep = pt.angle;

      for (const side of [-1, 1]) {
        const rx = pt.x + Math.cos(perp) * side * ribLen + Math.cos(sweep) * (ribLen * 0.45);
        const ry = pt.y + Math.sin(perp) * side * ribLen + Math.sin(sweep) * (ribLen * 0.45);

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = `rgba(10, 11, 10, ${0.42 * frac})`;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.strokeStyle = `rgba(230, 234, 224, ${0.55 * frac})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    // Draw central articulated spine cord (dark casing + luminous volt filament)
    ctx.beginPath();
    ctx.moveTo(dragonPts[0].x, dragonPts[0].y);
    for (let i = 1; i < SEG_COUNT; i++) {
      ctx.lineTo(dragonPts[i].x, dragonPts[i].y);
    }
    ctx.strokeStyle = 'rgba(10, 11, 10, 0.72)';
    ctx.lineWidth = 4.6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(210, 255, 0, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Draw sculpted vertebrae nodes
    for (let i = SEG_COUNT - 1; i >= 1; i--) {
      const pt = dragonPts[i];
      const r = Math.max(1.4, (1 - i / SEG_COUNT) * 5.2);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#111411';
      ctx.fill();
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(210, 255, 0, 0.85)' : 'rgba(240, 242, 236, 0.65)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Sculpted angular horned Dragon Head
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.angle);

    // Horns sweeping backward
    ctx.strokeStyle = 'rgba(240, 242, 236, 0.85)';
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-2, s * 5);
      ctx.quadraticCurveTo(-11, s * 10, -20, s * 13);
      ctx.stroke();
    }

    // Head crest polygon
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(2, -7.5);
    ctx.lineTo(-9, -5.5);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-9, 5.5);
    ctx.lineTo(2, 7.5);
    ctx.closePath();
    ctx.fillStyle = '#0c0e0c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 242, 236, 0.88)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Glowing volt eyes
    ctx.fillStyle = '#D2FF00';
    ctx.beginPath();
    ctx.arc(4, -3.4, 1.8, 0, Math.PI * 2);
    ctx.arc(4, 3.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // =========================================================================
  // SPIDER STATE (True 8-legged 2-bone IK + alternating tetrapod stepping gait)
  // =========================================================================
  const spider = {
    x: target.x,
    y: target.y,
    vx: 0,
    vy: 0,
    angle: 0,
    legs: [],
  };

  const legConfigs = [
    { side: -1, baseAng: -0.52, reach: 56, group: 0 },
    { side: -1, baseAng: -1.18, reach: 62, group: 1 },
    { side: -1, baseAng: -1.86, reach: 62, group: 0 },
    { side: -1, baseAng: -2.48, reach: 58, group: 1 },
    { side: 1, baseAng: 0.52, reach: 56, group: 1 },
    { side: 1, baseAng: 1.18, reach: 62, group: 0 },
    { side: 1, baseAng: 1.86, reach: 62, group: 1 },
    { side: 1, baseAng: 2.48, reach: 58, group: 0 },
  ];

  legConfigs.forEach((cfg) => {
    const fx = spider.x + Math.cos(cfg.baseAng) * cfg.reach;
    const fy = spider.y + Math.sin(cfg.baseAng) * cfg.reach;
    spider.legs.push({
      ...cfg,
      footX: fx,
      footY: fy,
      startX: fx,
      startY: fy,
      targetX: fx,
      targetY: fy,
      stepping: false,
      stepT: 1,
    });
  });

  function updateAndDrawSpider(dt, t) {
    const tx = target.hasUserMoved ? target.x : width * 0.78 + Math.cos(t * 0.75) * Math.min(80, width * 0.11);
    const ty = target.hasUserMoved ? target.y : height * 0.48 + Math.sin(t * 1.1) * 55;

    const prevX = spider.x;
    const prevY = spider.y;
    const chase = 1 - Math.pow(0.0025, dt);
    spider.x += (tx - spider.x) * chase;
    spider.y += (ty - spider.y) * chase;

    spider.vx = (spider.x - prevX) / Math.max(dt, 0.008);
    spider.vy = (spider.y - prevY) / Math.max(dt, 0.008);
    const spd = Math.hypot(spider.vx, spider.vy);

    if (spd > 12) {
      const desired = Math.atan2(spider.vy, spider.vx);
      let diff = desired - spider.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      spider.angle += diff * Math.min(1, dt * 8);
    }

    const scale = width < 680 ? 0.78 : 1.0;
    const groupStepping = [false, false];
    for (const leg of spider.legs) {
      if (leg.stepping) groupStepping[leg.group] = true;
    }

    // Update each leg with predictive foothold placement + alternating tetrapod gait
    for (const leg of spider.legs) {
      const worldAng = spider.angle + leg.baseAng;
      const leadX = Math.max(-24, Math.min(24, spider.vx * 0.11));
      const leadY = Math.max(-24, Math.min(24, spider.vy * 0.11));
      const idealX = spider.x + Math.cos(worldAng) * leg.reach * scale + leadX;
      const idealY = spider.y + Math.sin(worldAng) * leg.reach * scale + leadY;

      const distToIdeal = Math.hypot(leg.footX - idealX, leg.footY - idealY);
      const otherGroup = leg.group === 0 ? 1 : 0;

      if (!leg.stepping && distToIdeal > 26 * scale && !groupStepping[otherGroup]) {
        leg.stepping = true;
        leg.stepT = 0;
        leg.startX = leg.footX;
        leg.startY = leg.footY;
        leg.targetX = idealX;
        leg.targetY = idealY;
        groupStepping[leg.group] = true;
      }

      if (leg.stepping) {
        leg.stepT = Math.min(1, leg.stepT + dt * 7.8);
        const s = leg.stepT;
        const ease = s * s * (3 - 2 * s);
        const lift = Math.sin(s * Math.PI) * 10 * scale;
        leg.footX = leg.startX + (leg.targetX - leg.startX) * ease;
        leg.footY = leg.startY + (leg.targetY - leg.startY) * ease - lift;
        if (leg.stepT >= 1) leg.stepping = false;
      }

      // Compute hip attachment + 2-bone IK knee joint
      const hipX = spider.x + Math.cos(worldAng) * 10 * scale;
      const hipY = spider.y + Math.sin(worldAng) * 10 * scale;
      const femur = 34 * scale;
      const tibia = 42 * scale;
      const bendDir = leg.side * (Math.abs(leg.baseAng) > Math.PI * 0.5 ? -1 : 1);
      const { kx, ky } = solveTwoBoneIK(hipX, hipY, leg.footX, leg.footY, femur, tibia, bendDir);

      // Draw articulated leg (dark casing + brushed silver highlight + volt joint dot)
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(leg.footX, leg.footY);
      ctx.strokeStyle = 'rgba(10, 11, 10, 0.8)';
      ctx.lineWidth = 3.8 * scale;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.strokeStyle = 'rgba(235, 238, 230, 0.82)';
      ctx.lineWidth = 1.3 * scale;
      ctx.stroke();

      // Knee joint volt pin
      ctx.beginPath();
      ctx.arc(kx, ky, 1.9 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#D2FF00';
      ctx.fill();

      // Tiny foothold spark when planted
      ctx.beginPath();
      ctx.arc(leg.footX, leg.footY, 1.4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = leg.stepping ? 'rgba(210, 255, 0, 0.9)' : 'rgba(244, 242, 236, 0.5)';
      ctx.fill();
    }

    // Draw sleek biomechanical spider chassis
    ctx.save();
    ctx.translate(spider.x, spider.y);
    ctx.rotate(spider.angle);
    ctx.scale(scale, scale);

    // Segmented abdomen
    ctx.beginPath();
    ctx.ellipse(-14, 0, 13, 9.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0e0c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 242, 236, 0.8)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Volt chevron mark on abdomen
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-10, 4);
    ctx.strokeStyle = '#D2FF00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cephalothorax
    ctx.beginPath();
    ctx.ellipse(5, 0, 9.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111411';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 242, 236, 0.85)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 4 luminous volt optics
    ctx.fillStyle = '#D2FF00';
    for (const [ex, ey, er] of [
      [12, -2.6, 1.5],
      [12, 2.6, 1.5],
      [9.5, -5.0, 1.0],
      [9.5, 5.0, 1.0],
    ]) {
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Input listeners (mouse + continuous touch drag)
  function onPointerMove(e) {
    target.x = e.clientX;
    target.y = e.clientY;
    target.hasUserMoved = true;
  }

  function onTouchMove(e) {
    if (!e.touches.length) return;
    target.x = e.touches[0].clientX;
    target.y = e.touches[0].clientY;
    target.hasUserMoved = true;
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouchMove, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  let lastTs = performance.now();

  function frame(now) {
    if (isDisposed) return;
    rafId = requestAnimationFrame(frame);

    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    if (document.hidden) return;

    ctx.clearRect(0, 0, width, height);
    if (mode === 'off') return;

    const t = now * 0.001;
    if (mode === 'dragon') {
      updateAndDrawDragon(dt, t);
    } else if (mode === 'spider') {
      updateAndDrawSpider(dt, t);
    }
  }

  rafId = requestAnimationFrame(frame);

  function setMode(nextMode) {
    mode = nextMode;
    if (mode === 'off') {
      ctx.clearRect(0, 0, width, height);
    }
  }

  function dispose() {
    isDisposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchstart', onTouchMove);
    window.removeEventListener('touchmove', onTouchMove);
  }

  return { setMode, dispose };
}
