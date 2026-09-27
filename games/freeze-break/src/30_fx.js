// 画面効果: 粒子・衝撃波・揺れ・ズームの突き・フラッシュ・集中線・凍結の見た目。
// 粒子と衝撃波は2層ある。
//   world: 世界の時間で動く。凍結中とヒットストップ中は空中で止まり、再始動で一気に飛び散る
//   live : 実時間で動く。凍結中の操作への反応（連打の火花など）に使う
const FX = (() => {
  const MAX = 600;
  const F = {
    time: 0,
    parts: [],
    cursor: 0,
    rings: [],
    trauma: 0,
    flashA: 0,
    flashTimes: [],
    freezeK: 0,
    punch: 0,
    punchV: 0,
    lines: null,
    shutter: 0,
    sprites: {},
  };
  const calm = () => (Debug.reducedMotion ? 0.3 : 1);
  const in3D = () => !!(Game.stage.three && World3D.ok && World3D.plane); // 今の区間を3Dで描いている（粒と衝撃波はゲート平面から3Dへ）

  F.reset = () => {
    F.parts.length = 0;
    F.cursor = 0;
    F.rings.length = 0;
    F.trauma = 0;
    F.flashA = 0;
    F.freezeK = 0;
    F.punch = 0;
    F.punchV = 0;
    F.lines = null;
    F.shutter = 0;
    if (World3D.ok) World3D.clearFx();
  };

  // 光の粒のスプライト（shadowBlur を使わず、事前に描いた放射グラデーションを重ねる）
  function sprite(color) {
    if (F.sprites[color]) return F.sprites[color];
    // ディザのない滑らかな光（拡大しても粒々にならない）
    const hx = /^#[0-9a-f]{6}/i.test(color) ? color.slice(1, 7) : 'ffffff';
    const k = parseInt(hx, 16);
    const r = (k >> 16) & 255;
    const gg = (k >> 8) & 255;
    const b = k & 255;
    const c = smoothRadial(96, [
      [0, 255, 255, 255, 255],
      [0.25, r, gg, b, 230],
      [0.6, r, gg, b, 64],
      [1, r, gg, b, 0],
    ]);
    return (F.sprites[color] = c);
  }

  // ---- 生成 ----
  F.spawn = p => {
    const q = Object.assign(
      { vx: 0, vy: 0, life: 0.6, age: 0, size: 10, color: '#ffffff', kind: 'dot', rot: 0, vr: 0, drag: 3, grav: 0, live: false },
      p,
    );
    if ((!q.live || Game.phase !== 'GATE') && in3D()) {
      // 3D の区間: ゲート平面の座標から3Dのきらめく粒へ（凍結中の操作の反応だけ2D）
      World3D.spawn({
        p: World3D.planePoint(q.x, q.y),
        v: World3D.planeVec(q.vx, q.vy),
        g: World3D.planeVec(0, q.grav),
        life: q.life,
        size: q.size * 2.4,
        color: q.color,
        drag: q.drag,
        live: q.live,
      });
      return;
    }
    const o = Game.stage.origin; // ステージの座標 → 世界座標（区間をまたいでも位置がずれない）
    q.x += o[0];
    q.y += o[1];
    if (F.parts.length < MAX) F.parts.push(q);
    else {
      F.parts[F.cursor] = q;
      F.cursor = (F.cursor + 1) % MAX;
    }
  };
  // o: { n, speed:[最小,最大], dir（省略で全方向）, spread, colors, kinds, life:[..], size:[..], drag, grav, live, jitter }
  F.burst = (x, y, o = {}) => {
    const R = Math.random;
    const n = Math.round((o.n || 30) * (Debug.reducedMotion ? 0.5 : 1));
    const cols = o.colors || ['#ffffff'];
    const kinds = o.kinds || ['dot'];
    const [s0, s1] = o.speed || [200, 700];
    const [l0, l1] = o.life || [0.35, 0.8];
    const [z0, z1] = o.size || [6, 16];
    const j = o.jitter || 0;
    for (let i = 0; i < n; i++) {
      const a = o.dir == null ? R() * TAU : o.dir + (R() - 0.5) * (o.spread || 0.6);
      const s = lerp(s0, s1, R());
      F.spawn({
        x: x + (R() - 0.5) * j,
        y: y + (R() - 0.5) * j,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: lerp(l0, l1, R()),
        size: lerp(z0, z1, R()),
        color: cols[i % cols.length],
        kind: kinds[i % kinds.length],
        rot: R() * TAU,
        vr: (R() - 0.5) * 20,
        drag: o.drag == null ? 3 : o.drag,
        grav: o.grav || 0,
        live: !!o.live,
      });
    }
  };
  // 吸い込み: (x, y) のまわりの輪から粒が中心へ吸い込まれる。o: { r:[内,外], life:[..], size:[..], colors }
  F.absorbed = 0;
  F.absorbPulse = 0;
  F.absorb = (x, y, n, o = {}) => {
    const R = Math.random;
    const [r0, r1] = o.r || [300, 520];
    const [l0, l1] = o.life || [0.4, 0.7];
    const [z0, z1] = o.size || [8, 16];
    const cols = o.colors || ['#ffffff'];
    const org = Game.stage.origin;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const r = lerp(r0, r1, R());
      const sx = x + Math.cos(a) * r + org[0];
      const sy = y + Math.sin(a) * r + org[1];
      const q = {
        x: sx,
        y: sy,
        sx,
        sy,
        to: [x + org[0], y + org[1]],
        swirl: (R() < 0.5 ? -1 : 1) * (0.8 + R() * 1.4),
        vx: 0,
        vy: 0,
        life: lerp(l0, l1, R()),
        age: 0,
        size: lerp(z0, z1, R()),
        color: cols[i % cols.length],
        kind: 'dot',
        rot: 0,
        vr: 0,
        drag: 0,
        grav: 0,
        live: true,
      };
      if (F.parts.length < MAX) F.parts.push(q);
      else {
        F.parts[F.cursor] = q;
        F.cursor = (F.cursor + 1) % MAX;
      }
    }
  };
  F.shock = (x, y, color = '#ffffff', size = 600, life = 0.35, o = {}) => {
    if (!o.live && in3D()) {
      World3D.ring(World3D.planePoint(x, y), World3D.planeNormal(), color, size, life);
      return;
    }
    const g = Game.stage.origin;
    F.rings.push({ x: x + g[0], y: y + g[1], color, size, life, age: 0, width: o.width || 26, live: !!o.live });
  };
  F.flash = (a = 0.5) => {
    F.flashTimes = F.flashTimes.filter(t => F.time - t < 1);
    if (F.flashTimes.length >= 2) a *= 0.25; // 強い全画面フラッシュを1秒に3回以上出さない
    F.flashTimes.push(F.time);
    F.flashA = Math.max(F.flashA, a * (Debug.reducedMotion ? 0.4 : 1));
  };
  F.addTrauma = v => {
    F.trauma = Math.min(1, F.trauma + v);
  };
  // ズームの突き（バネで戻る）
  F.kick = v => {
    F.punch += v * calm();
  };
  F.hitSpark = (x, y, color, n = 8) =>
    F.burst(x, y, {
      n,
      colors: [color, '#ffffff'],
      kinds: ['streak', 'dot'],
      speed: [250, 750],
      life: [0.15, 0.35],
      size: [4, 10],
      live: true,
    });

  // ---- 凍結と成功の演出 ----
  F.onFreeze = () => {
    F.shutter = 1;
    F.kick(0.03);
  };
  F.fxPoint = g => {
    const k = GateKinds[g.kindName];
    return k && k.fxPoint ? k.fxPoint(g) : { x: g.x, y: g.y };
  };
  F.onGateSuccess = g => {
    const s = g.cfg.scored ? 0.5 + Game.idx * 0.1 : 0.45; // 後半のゲートほど強く
    const { x, y } = F.fxPoint(g);
    const c = g.color || CONFIG.colors.spark;
    const base = { colors: [c, '#ffffff', CONFIG.colors.spark], kinds: ['dot', 'streak', 'dot'] };
    F.shock(x, y, '#ffffff', 300 + 300 * s, 0.28, { width: 14, live: true }); // すぐ広がる白い輪
    F.shock(x, y, c, 560 + 460 * s, 0.5, { width: 40 }); // 時間が動き出してから広がる色の輪
    switch (g.kindName) {
      case 'pull':
        F.burst(x, y, { ...base, n: 60, dir: g.release == null ? -0.4 : g.release, spread: 0.7, speed: [700, 1800], life: [0.3, 0.7] });
        F.burst(x, y, { ...base, n: 20, speed: [200, 600] });
        break;
      case 'slide':
        F.burst(x, y, { ...base, n: 50, speed: [300, 1200] });
        F.burst(x, y, { n: 14, colors: [GREY], kinds: ['shard'], speed: [300, 900], grav: 900, size: [8, 14], life: [0.5, 0.9] });
        break;
      case 'swipe': {
        const na = (g.angle == null ? -0.5 : g.angle) + Math.PI / 2;
        for (const d of [na, na + Math.PI])
          F.burst(x, y, { ...base, n: 30, dir: d, spread: 0.5, speed: [600, 1600], kinds: ['streak', 'dot'] });
        F.burst(x, y, { n: 20, colors: [c], kinds: ['shard'], speed: [200, 700], grav: 700, size: [4, 9], life: [0.5, 1.0] });
        break;
      }
      case 'rotate': {
        const R = g.r || 190;
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * TAU;
          F.spawn({
            x: x + Math.cos(a) * R,
            y: y + Math.sin(a) * R,
            vx: -Math.sin(a) * 1000 + Math.cos(a) * 250,
            vy: Math.cos(a) * 1000 + Math.sin(a) * 250,
            life: 0.5,
            size: 12,
            color: i % 2 ? c : '#ffffff',
            kind: 'streak',
            drag: 2.5,
          });
        }
        F.burst(x, y, { ...base, n: 30, speed: [200, 700] });
        break;
      }
      case 'mash':
        F.burst(x, y, { ...base, n: 120, speed: [400, 1700], life: [0.4, 1.0], size: [8, 22] });
        F.burst(x, y, { n: 40, colors: [GREY, c], kinds: ['shard'], speed: [400, 1400], grav: 800, size: [10, 20], life: [0.6, 1.2] });
        break;
      default:
        F.burst(x, y, { ...base, n: 50, speed: [300, 1100] });
    }
    F.flash(0.2 + 0.3 * s);
    F.addTrauma(0.25 + 0.55 * s);
    F.kick(0.04 + 0.08 * s);
    F.lines = { age: 0, life: 0.45, strength: 0.5 + 0.5 * s, seed: (Math.random() * 1e9) | 0 };
  };

  // ---- 更新 ----
  F.update = dt => {
    F.time += dt;
    const wdt = Game.phase === 'PLAY' && !Game.hold ? dt * Game.timeScale : 0;
    let j = 0;
    for (let i = 0; i < F.parts.length; i++) {
      const p = F.parts[i];
      const d = p.live ? dt : wdt;
      if (d > 0) {
        p.age += d;
        if (p.to) {
          // 吸い込まれる粒: 近づくほど速く、渦を巻いて中心へ
          const k = Math.min(1, p.age / p.life);
          const e = Math.pow(k, 2.2);
          const a = p.swirl * k;
          const dx = p.sx - p.to[0];
          const dy = p.sy - p.to[1];
          p.x = p.to[0] + (dx * Math.cos(a) - dy * Math.sin(a)) * (1 - e);
          p.y = p.to[1] + (dx * Math.sin(a) + dy * Math.cos(a)) * (1 - e);
          if (p.age >= p.life) {
            F.absorbed++;
            F.absorbPulse = 1;
          }
        } else {
          const k = Math.exp(-p.drag * d);
          p.vx *= k;
          p.vy = p.vy * k + p.grav * d;
          p.x += p.vx * d;
          p.y += p.vy * d;
          p.rot += p.vr * d;
        }
      }
      if (p.age < p.life) F.parts[j++] = p;
    }
    F.parts.length = j;
    World3D.updateFx(dt, wdt);
    for (const r of F.rings) r.age += r.live ? dt : wdt;
    F.rings = F.rings.filter(r => r.age < r.life);
    F.absorbPulse = Math.max(0, (F.absorbPulse || 0) - dt * 8);
    F.trauma = Math.max(0, F.trauma - 1.5 * dt);
    F.flashA = Math.max(0, F.flashA - dt / 0.12);
    F.punchV += (-260 * F.punch - 14 * F.punchV) * dt;
    F.punch += F.punchV * dt;
    if (F.lines && (F.lines.age += dt) >= F.lines.life) F.lines = null;
    F.shutter = Math.max(0, F.shutter - dt / 0.3);
    if (Game.phase === 'GATE' || (Game.phase === 'BURST' && Game.chargeLeft > 0))
      F.freezeK = Math.min(1, F.freezeK + dt / CONFIG.freezeFade); // 溜めている間も世界は止まったまま
    else F.freezeK = Math.max(0, F.freezeK - dt / CONFIG.unfreezeFade);
  };

  F.shakeOffset = () => {
    const s = F.trauma * F.trauma * calm();
    const t = F.time * 60;
    const zoom = 1 + F.punch;
    if (s <= 0) return { x: 0, y: 0, rot: 0, zoom };
    return {
      x: 22 * s * (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.7)),
      y: 22 * s * (Math.cos(t * 1.7) + 0.5 * Math.sin(t * 3.1)),
      rot: 0.03 * s * Math.sin(t * 2.1),
      zoom,
    };
  };

  // ---- 描画 ----
  function drawRings(ctx, live) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of F.rings) {
      if (r.live !== live) continue;
      const k = r.age / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Ease.outCubic(k) * r.size, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawParts(ctx, live) {
    ctx.save();
    for (const p of F.parts) {
      if (p.live !== live) continue;
      const k = p.age / p.life;
      if (p.kind === 'shard') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = p.color;
        const s = p.size * 1.4;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.6);
        ctx.lineTo(s, -s * 0.2);
        ctx.lineTo(-s * 0.3, s * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'streak' && !Game.stage.three) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        const sp = Math.hypot(p.vx, p.vy);
        const len = Math.min(140, 20 + sp * 0.05);
        const ux = sp ? p.vx / sp : 0;
        const uy = sp ? p.vy / sp : 0;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5 * (1 - k * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - ux * len, p.y - uy * len);
        ctx.stroke();
      } else {
        // 虹色に移ろい瞬く十字の粒（3Dの粒と同じ見た目）
        ctx.globalCompositeOperation = 'lighter';
        const seed = p.seed || (p.seed = Math.random());
        const tw = 0.5 + 0.5 * Math.sin(F.time * 17 + seed * 50);
        const col = `hsl(${Math.round(((seed + F.time * 0.4) % 1) * 360)}, 100%, 70%)`;
        const s = p.size * (p.to ? 1.4 - 0.9 * k : 1.6 - k) * (1 + 0.35 * Math.sin(F.time * 11 + seed * 60));
        ctx.globalAlpha = (p.to ? 0.35 + 0.65 * k : 1 - k) * (0.6 + 0.4 * tw);
        ctx.drawImage(sprite(p.color), p.x - s * 0.7, p.y - s * 0.7, s * 1.4, s * 1.4);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - s * 1.6, p.y);
        ctx.lineTo(p.x + s * 1.6, p.y);
        ctx.moveTo(p.x, p.y - s * 1.6);
        ctx.lineTo(p.x, p.y + s * 1.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  F.handOff = () => {
    // 区間が変わる前に、2Dに残った粒を3Dのきらめく粒へ移す（平面が変わってずれないように）
    if (!in3D()) return;
    const o = Game.stage.origin;
    F.parts = F.parts.filter(p => {
      if (p.kind === 'shard' || p.age >= p.life) return p.kind === 'shard';
      World3D.spawn({
        p: World3D.planePoint(p.x - o[0], p.y - o[1]),
        v: World3D.planeVec(p.vx, p.vy),
        g: World3D.planeVec(0, p.grav),
        life: Math.max(0.05, p.life - p.age),
        size: p.size * 2.4,
        color: p.color,
        drag: p.drag,
      });
      return false;
    });
    F.cursor = 0;
  };
  const inWorld = (ctx, fn) => {
    const o = Game.stage.origin;
    ctx.save();
    ctx.translate(-o[0], -o[1]);
    fn();
    ctx.restore();
  };
  F.drawWorld = ctx =>
    inWorld(ctx, () => {
      drawRings(ctx, false);
      drawParts(ctx, false);
    });
  // 操作への反応と、成功した瞬間の物体の閃光（ゲート物体より上に描く）
  F.drawLive = (ctx, g) => {
    inWorld(ctx, () => {
      drawRings(ctx, true);
      drawParts(ctx, true);
    });
    if (g && g.done && g.doneAge < 0.15) {
      const { x, y } = F.fxPoint(g);
      const s = 240 * (1 - g.doneAge / 0.15) + 60;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.drawImage(sprite('#ffffff'), x - s, y - s, s * 2, s * 2);
      ctx.restore();
    }
  };

  // 凍結の見た目: 彩度を抜いて暗くし、操作対象（focus: 論理座標）の周りだけ明るく残す
  F.drawFreeze = (ctx, focus) => {
    const k = F.freezeK;
    if (k <= 0) return;
    const W = View.canvas.width;
    const H = View.canvas.height;
    const d = View.dpr;
    const fx = focus ? (focus.x * View.scale + View.w / 2) * d : W / 2;
    const fy = focus ? (focus.y * View.scale + View.h / 2) * d : H / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.35 * k;
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(fx, fy, Math.min(W, H) * (0.2 + 0.04 * Beat.heart), fx, fy, Math.hypot(W, H) * 0.65); // 心拍で周辺が脈打つ
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.6 * k * (1 + 0.2 * Beat.heart)})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  // 画面効果（論理座標の画面変換で呼ぶ）: 集中線、凍結のシャッター、フラッシュ
  F.drawScreen = ctx => {
    const hw = View.halfW;
    const hh = View.halfH;
    if (F.lines) {
      const L = F.lines;
      const k = L.age / L.life;
      const R = Math.hypot(hw, hh);
      const rnd = rng(L.seed);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = (1 - k) * 0.5 * L.strength * (Debug.reducedMotion ? 0.4 : 1);
      ctx.beginPath();
      for (let i = 0; i < 44; i++) {
        const a = rnd() * TAU;
        const w = (4 + rnd() * 10) * L.strength;
        const r0 = R * (0.42 + rnd() * 0.3) + k * R * 0.25;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ctx.moveTo(ca * r0, sa * r0);
        ctx.lineTo(ca * R * 1.3 - sa * w, sa * R * 1.3 + ca * w);
        ctx.lineTo(ca * R * 1.3 + sa * w, sa * R * 1.3 - ca * w);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
    if (F.shutter > 0) {
      // 時間が止まった瞬間に、画面の縁に白い枠が走る
      const d = 18 + 40 * Ease.outCubic(1 - F.shutter);
      ctx.save();
      ctx.globalAlpha = F.shutter * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 14 * F.shutter + 2;
      ctx.strokeRect(-hw + d, -hh + d, (hw - d) * 2, (hh - d) * 2);
      ctx.restore();
    }
    if (F.flashA > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = F.flashA;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, View.canvas.width, View.canvas.height);
      ctx.globalAlpha = 1;
      View.screenTransform(ctx);
    }
  };

  return F;
})();
