// ゲート: 凍結中の操作判定（6種）と、その見た目。
// 種類ごとに enter / down / move / up / update / draw / ghost（ヒントの指の動き）/ demo（検証用の操作列）を持つ。
const GateKinds = {};

// ---- ジェスチャ判定の部品 ----
const near = (x1, y1, x2, y2, r) => Math.hypot(x1 - x2, y1 - y2) <= Math.max(r, CONFIG.hitRadiusMin);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  // 線分 AB と CD の交点（なければ null）
  const r1x = bx - ax;
  const r1y = by - ay;
  const r2x = dx - cx;
  const r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
  const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: ax + r1x * t, y: ay + r1y * t } : null;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const L2 = vx * vx + vy * vy;
  const t = L2 ? clamp(((px - ax) * vx + (py - ay) * vy) / L2) : 0;
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}
function blinkRing(ctx, g, x, y, r) {
  // ヒント段階1: 触る場所の輪郭が明滅
  if (g.hint < 1 || g.done) return;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.35 * Math.sin(g.elapsed * 7);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ---- 押す: 盛り上がったボタン ----
GateKinds.tap = {
  enter(g) {
    g.press = 0;
  },
  down(g, p) {
    if (near(p.x, p.y, g.x, g.y, g.r * 1.25)) g.succeed();
    else g.miss();
  },
  update(g, dt) {
    g.press = g.done ? Math.min(1, g.press + dt / 0.05) : 0;
  },
  draw(ctx, g) {
    drawButton(ctx, g);
  },
  ghostPeriod: 1.2,
  ghost(g, k) {
    const off = 90 * (1 - Ease.outCubic(seg(k, 0, 0.35))) + 90 * Ease.inCubic(seg(k, 0.55, 0.9));
    return { x: g.x + off * 0.7, y: g.y + off, down: k >= 0.35 && k < 0.55 };
  },
  demo(g) {
    return [
      ['down', g.x, g.y],
      ['up', g.x, g.y],
    ];
  },
};

// ---- 引いて放す: Y字のパチンコ。g.dir は発射の向き（ラジアン、既定は真上） ----
// 玉はポインタに張り付かず、ゴムの張力（引くほど重い）とバネ・ダンパで遅れてついてくる
(() => {
  const MAX = 260;
  const BALL = 34;
  const K = 600;
  const C = 28;
  const pullVec = g => {
    const a = (g.dir == null ? -Math.PI / 2 : g.dir) + Math.PI;
    return [Math.cos(a), Math.sin(a)];
  };
  GateKinds.pull = {
    enter(g) {
      g.grab = false;
      g.off = { x: 0, y: 0 };
      g.vel = { x: 0, y: 0 };
      g.tgt = { x: 0, y: 0 };
      g.relOff = null;
    },
    down(g, p) {
      const bx = g.x + g.off.x;
      const by = g.y + g.off.y;
      if (near(p.x, p.y, bx, by, BALL * 2)) {
        g.grab = true;
        g.gdx = bx - p.x;
        g.gdy = by - p.y;
        g.hum = Sound.hold();
        g.tick = 0;
      } else g.miss(); // つかんだらゴムの張りの音を鳴らし始める
    },
    move(g, p) {
      if (!g.grab) return;
      const rx = p.x + g.gdx - g.x;
      const ry = p.y + g.gdy - g.y;
      const d = Math.hypot(rx, ry);
      const s = d > 0 ? (MAX * Math.tanh(d / MAX)) / d : 0; // 引くほど伸びにくい（ゴムの張力）
      g.tgt.x = rx * s;
      g.tgt.y = ry * s;
      // 引く強さに応じて音が高く大きく、1割ごとにきしむ
      const k = Math.hypot(g.tgt.x, g.tgt.y) / MAX;
      const step = Math.floor(k * 10);
      if (g.hum) g.hum.set(70 + 560 * k * k, 0.0009 + 0.0075 * k); // 音量はごく控えめに（最初の 1/16）
      if (step > g.tick && Sound.ctx) Sound.tone(500 + step * 140, 0.03, { type: 'triangle', vol: 0.0035 + 0.0025 * k });
      g.tick = step;
    },
    up(g) {
      if (!g.grab) return;
      g.grab = false;
      if (g.hum) {
        g.hum.stop();
        g.hum = null;
      }
      // 判定は玉の遅れに左右されないよう目標の伸びで
      const [px, py] = pullVec(g);
      const d = Math.hypot(g.tgt.x, g.tgt.y);
      const ang = d > 0 ? Math.acos(clamp((g.tgt.x * px + g.tgt.y * py) / d, -1, 1)) : Math.PI;
      if (d >= g.cfg.pullMin && ang <= (g.cfg.pullAngleTol * Math.PI) / 180) {
        g.release = Math.atan2(-g.tgt.y, -g.tgt.x); // ゴムの反対側へ飛ぶ
        g.power = d / MAX;
        g.relOff = { x: g.off.x, y: g.off.y }; // 放した瞬間の玉の位置（区間Bの出だしに使う）
        g.succeed();
      } else if (d < 40) g.miss(); // つつくだけ ＝ 違う操作
      g.tgt.x = 0;
      g.tgt.y = 0; // 引き足りないときはゴムで揺れながら戻る
    },
    update(g, dt) {
      if (g.done) return; // 放した瞬間で止める（ヒットストップ）
      if (!g.grab) {
        // 待機中: 引く向きへ沈んでは戻る
        const [px, py] = pullVec(g);
        const s = Math.pow(Math.sin(g.elapsed * 3), 2) * 10;
        g.tgt.x = px * s;
        g.tgt.y = py * s;
      }
      for (let i = 0, h = dt / 2; i < 2; i++) {
        // バネとダンパで目標へ追従
        g.vel.x += (K * (g.tgt.x - g.off.x) - C * g.vel.x) * h;
        g.vel.y += (K * (g.tgt.y - g.off.y) - C * g.vel.y) * h;
        g.off.x += g.vel.x * h;
        g.off.y += g.vel.y * h;
      }
    },
    draw(ctx, g) {
      const bx = g.x + g.off.x;
      const by = g.y + g.off.y;
      const d = Math.hypot(g.off.x, g.off.y);
      GateKinds.pull.paint(ctx, g, bx, by, { trem: g.grab && d >= g.cfg.pullMin * 0.9 ? Math.sin(FX.time * 70) * 2.5 : 0 });
      blinkRing(ctx, g, bx, by, BALL + 28);
    },
    // 放した位置
    fxPoint(g) {
      return { x: g.x + g.off.x, y: g.y + g.off.y };
    },
    // パチンコ一式を描く（区間Aの組み立て演出からも使う）。o.pieces は部品ごとのずらし [dx, dy, 回転]
    paint(ctx, g, bx, by, o = {}) {
      const c = g.color;
      const fr = g.frame || GREY;
      const P = o.pieces || {};
      const trem = o.trem || 0;
      const band = o.band !== false;
      const slack = !!o.slack;
      const tl = [g.x - 80, g.y];
      const tr = [g.x + 80, g.y];
      const fork = [g.x, g.y + 110];
      const d = Math.hypot(bx - g.x, by - g.y);
      if (band) {
        if (slack) lineW(ctx, tl[0], tl[1], tr[0], tr[1], 6, shade(c, -0.3));
        else lineW(ctx, tl[0], tl[1], bx + trem, by, Math.max(3, 8 - d / 70), shade(c, -0.3));
      }
      const piece = (p, cx, cy, fn) => {
        ctx.save();
        if (p) {
          ctx.translate(p[0] + cx, p[1] + cy);
          ctx.rotate(p[2]);
          ctx.translate(-cx, -cy);
        }
        fn();
        ctx.restore();
      };
      const arm = (x0, y0, qx, qy, x1, y1) => {
        ctx.strokeStyle = fr;
        ctx.lineWidth = 26;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(qx, qy, x1, y1);
        ctx.stroke();
      };
      piece(P.left, (tl[0] + fork[0]) / 2, (tl[1] + fork[1]) / 2, () => arm(tl[0], tl[1] - 12, tl[0], fork[1], fork[0], fork[1]));
      piece(P.right, (tr[0] + fork[0]) / 2, (tr[1] + fork[1]) / 2, () => arm(fork[0], fork[1], tr[0], fork[1], tr[0], tr[1] - 12));
      piece(P.handle, fork[0], fork[1] + 95, () => lineW(ctx, fork[0], fork[1], fork[0], fork[1] + 190, 30, fr));
      if (o.ball !== false) {
        disc(ctx, bx + trem, by, BALL, c);
        disc(ctx, bx + trem - 10, by - 10, 10, 'rgba(255,255,255,0.6)');
      }
      if (band && !slack) lineW(ctx, tr[0], tr[1], bx + trem, by, Math.max(3, 9 - d / 70), c);
    },
    ghostPeriod: 1.8,
    ghost(g, k) {
      const [px, py] = pullVec(g);
      if (k < 0.15) {
        const e = 1 - Ease.outCubic(k / 0.15);
        return { x: g.x + 80 * e, y: g.y + 120 * e, down: false };
      }
      const e = Ease.inOutCubic(seg(k, 0.15, 0.65)) * 190;
      return { x: g.x + px * e, y: g.y + py * e, down: k < 0.65 };
    },
    demo(g) {
      const [px, py] = pullVec(g);
      const ex = g.x + px * 200;
      const ey = g.y + py * 200;
      return [
        ['down', g.x, g.y],
        ['move', ex, ey, 8],
        ['up', ex, ey],
      ];
    },
  };
})();

// ---- 滑らせる: 溝とつまみ、終端に錠。g.len は溝の長さ、g.angle は向き ----
(() => {
  const ends = g => {
    const a = g.angle || 0;
    const h = (g.len || 460) / 2;
    return [g.x - Math.cos(a) * h, g.y - Math.sin(a) * h, g.x + Math.cos(a) * h, g.y + Math.sin(a) * h];
  };
  const knobAt = (g, k) => {
    const [ax, ay, bx, by] = ends(g);
    return { x: lerp(ax, bx, k), y: lerp(ay, by, k) };
  };
  const project = (g, p) => {
    const [ax, ay, bx, by] = ends(g);
    return ((p.x - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
  };
  GateKinds.slide = {
    enter(g) {
      g.prog = 0;
      g.grab = false;
      g.tick = 0;
    },
    down(g, p) {
      const k = knobAt(g, g.prog);
      if (near(p.x, p.y, k.x, k.y, 80)) {
        g.grab = true;
        g.gOff = g.prog - project(g, p);
      } else g.miss();
    },
    move(g, p) {
      if (!g.grab) return;
      g.prog = clamp(project(g, p) + g.gOff);
      const tk = Math.floor(g.prog * 10);
      if (tk > g.tick) {
        g.tick = tk;
        Sound.sfx('tick', { k: g.prog });
        const kp = knobAt(g, g.prog);
        FX.hitSpark(kp.x, kp.y, g.color, 4);
      }
      if (g.prog >= g.cfg.slideDone) {
        g.prog = 1;
        g.grab = false;
        g.succeed();
      }
    },
    up(g) {
      if (g.grab) {
        g.grab = false;
        if (g.prog < 0.05) g.miss();
      }
    },
    update(g, dt) {
      // 途中で離すとバネで戻る
      if (!g.grab && !g.done && g.prog > 0) {
        g.prog = Math.max(0, g.prog - dt * 3.5 * (0.3 + g.prog));
        g.tick = Math.floor(g.prog * 10);
      }
    },
    draw(ctx, g) {
      const [ax, ay, bx, by] = ends(g);
      const c = g.color;
      const a = g.angle || 0;
      lineW(ctx, ax, ay, bx, by, 72, PIT);
      lineW(ctx, ax, ay, bx, by, 52, GREY_D);
      const nudge = !g.grab && !g.done && g.prog === 0 ? (16 * Math.pow(Math.max(0, Math.sin(g.elapsed * 4)), 8)) / (g.len || 460) : 0;
      const kp = knobAt(g, Math.min(1, g.prog + nudge));
      if (g.prog > 0.001) lineW(ctx, ax, ay, kp.x, kp.y, 30, c);
      // 終端の錠（成功で掛け金が外れる）
      const lx = bx + Math.cos(a) * 90;
      const ly = by + Math.sin(a) * 90;
      const open = g.done ? Ease.outBack(clamp(g.doneAge / 0.08)) * 24 : 0;
      ctx.strokeStyle = GREY;
      ctx.lineWidth = 9;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(lx - 19, ly - 6 - open);
      ctx.arc(lx, ly - 30 - open, 19, Math.PI, 0);
      ctx.lineTo(lx + 19, ly - 6);
      ctx.stroke();
      ctx.fillStyle = GREY;
      rrect(ctx, lx - 32, ly - 12, 64, 50, 10);
      ctx.fill();
      if (!g.done) {
        // 閉ざされている: 錠が赤く脈打つ
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(FX.time * 6);
        ctx.fillStyle = '#ff3b3b';
        rrect(ctx, lx - 32, ly - 12, 64, 50, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      disc(ctx, lx, ly + 10, 7, PIT);
      ctx.save();
      ctx.translate(kp.x, kp.y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      rrect(ctx, -44, -50, 88, 116, 18);
      ctx.fill();
      ctx.fillStyle = shade(c, 0.25);
      rrect(ctx, -44, -58, 88, 116, 18);
      ctx.fill();
      ctx.strokeStyle = shade(c, -0.35);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (const gx of [-16, 0, 16]) {
        ctx.beginPath();
        ctx.moveTo(gx, -34);
        ctx.lineTo(gx, 34);
        ctx.stroke();
      }
      ctx.restore();
      blinkRing(ctx, g, kp.x, kp.y, 92);
    },
    ghostPeriod: 1.6,
    ghost(g, k) {
      if (k < 0.1) {
        const p = knobAt(g, 0);
        return { x: p.x, y: p.y + 70 * (1 - k / 0.1), down: false };
      }
      const p = knobAt(g, Ease.inOutCubic(seg(k, 0.1, 0.7)));
      return { x: p.x, y: p.y, down: k < 0.7 };
    },
    demo(g) {
      const p0 = knobAt(g, 0);
      const p1 = knobAt(g, 1);
      return [
        ['down', p0.x, p0.y],
        ['move', p1.x, p1.y, 10],
        ['up', p1.x, p1.y],
      ];
    },
    // 錠の位置
    fxPoint(g) {
      const [, , bx, by] = ends(g);
      const a = g.angle || 0;
      return { x: bx + Math.cos(a) * 90, y: by + Math.sin(a) * 90 };
    },
  };
})();

// ---- 切る: 斜めに張った縄（中央がほつれて細い）。g.len は長さ、g.angle は向き ----
(() => {
  const ends = g => {
    const a = g.angle == null ? -0.5 : g.angle;
    const h = (g.len || 900) / 2;
    return [g.x - Math.cos(a) * h, g.y - Math.sin(a) * h, g.x + Math.cos(a) * h, g.y + Math.sin(a) * h];
  };
  const normal = g => {
    const [ax, ay, bx, by] = ends(g);
    const L = Math.hypot(bx - ax, by - ay);
    return [-(by - ay) / L, (bx - ax) / L];
  };
  const stroke = g => {
    const [ux, uy] = normal(g);
    return [g.x + ux * 240, g.y + uy * 240, g.x - ux * 240, g.y - uy * 240];
  };
  GateKinds.swipe = {
    enter(g) {
      g.trail = [];
      g.stroke = null;
      g.cut = null;
      g.bend = 0;
      g.cutAge = 0;
    },
    down(g, p) {
      g.stroke = { moved: 0, slow: false };
      g.trail.push({ x: p.x, y: p.y, t: g.elapsed });
    },
    move(g, p) {
      if (!g.stroke || !p.prev) return;
      g.trail.push({ x: p.x, y: p.y, t: g.elapsed });
      const d = Math.hypot(p.x - p.prev.x, p.y - p.prev.y);
      g.stroke.moved += d;
      const [ax, ay, bx, by] = ends(g);
      const hit = segCross(ax, ay, bx, by, p.prev.x, p.prev.y, p.x, p.y);
      if (!hit) return;
      const speed = d / Math.max(1, (p.time - p.prev.time) * 1000); // 論理単位/ms
      // ゆっくり横切る ＝ たわむだけ
      if (speed >= g.cfg.swipeSpeed) {
        g.cut = hit;
        g.succeed();
      } else {
        g.bend = 1;
        if (!g.stroke.slow) {
          g.stroke.slow = true;
          g.miss();
        }
      }
    },
    up(g, p) {
      if (g.stroke && g.stroke.moved < 20) {
        const [ax, ay, bx, by] = ends(g);
        if (distToSeg(p.x, p.y, ax, ay, bx, by) < 90) g.miss();
      }
      g.stroke = null;
    },
    update(g, dt) {
      g.bend = Math.max(0, g.bend - dt * 3);
      g.trail = g.trail.filter(q => g.elapsed - q.t < 0.18);
      if (g.done) g.cutAge += dt;
    },
    draw(ctx, g) {
      const [ax, ay, bx, by] = ends(g);
      const [ux, uy] = normal(g);
      const c = g.color;
      for (const [x, y] of [
        [ax, ay],
        [bx, by],
      ]) {
        disc(ctx, x, y, 30, GREY_D);
        disc(ctx, x, y, 14, GREY);
      }
      if (g.done && g.cut) {
        const k = Ease.outCubic(clamp(g.cutAge / 0.12));
        const cx = g.cut.x;
        const cy = g.cut.y;
        lineW(ctx, ax, ay, lerp(cx, ax, 0.55 * k) + ux * 60 * k, lerp(cy, ay, 0.55 * k) + uy * 60 * k, 16, c);
        lineW(ctx, bx, by, lerp(cx, bx, 0.55 * k) - ux * 60 * k, lerp(cy, by, 0.55 * k) - uy * 60 * k, 16, c);
        ctx.globalAlpha = 1 - k;
        lineW(ctx, cx - ux * 220, cy - uy * 220, cx + ux * 220, cy + uy * 220, 12, '#ffffff');
        ctx.globalAlpha = 1;
      } else {
        const vib = Math.sin(FX.time * 45) * 2.5 + g.bend * 45;
        const N = 24;
        const P = t => {
          const b = Math.sin(Math.PI * t) * vib;
          return [lerp(ax, bx, t) + ux * b, lerp(ay, by, t) + uy * b];
        };
        for (let i = 0; i < N; i++) {
          // 中央ほど細い
          const tm = (i + 0.5) / N;
          const w = 26 - 16 * Math.pow(1 - Math.abs(2 * tm - 1), 6);
          const [x0, y0] = P(i / N);
          const [x1, y1] = P((i + 1) / N);
          lineW(ctx, x0, y0, x1, y1, w, i % 2 ? c : shade(c, -0.25));
        }
        const [mx, my] = P(0.5);
        ctx.strokeStyle = shade(c, 0.35);
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1 + 0.4;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + Math.cos(a) * 26, my + Math.sin(a) * 26);
          ctx.stroke();
        }
        blinkRing(ctx, g, mx, my, 70);
      }
      if (g.trail.length > 1) {
        // 指の後ろの斬撃の軌跡
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        g.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
    },
    ghostPeriod: 1.2,
    ghost(g, k) {
      const [sx, sy, ex, ey] = stroke(g);
      if (k < 0.25) return { x: sx, y: sy, down: false };
      const e = Ease.inOutCubic(seg(k, 0.25, 0.4));
      return { x: lerp(sx, ex, e), y: lerp(sy, ey, e), down: k < 0.4 };
    },
    demo(g) {
      const [sx, sy, ex, ey] = stroke(g);
      return [
        ['down', sx, sy],
        ['move', ex, ey, 2],
        ['up', ex, ey],
      ];
    },
    // 切った位置
    fxPoint(g) {
      return g.cut ? { x: g.cut.x, y: g.cut.y } : { x: g.x, y: g.y };
    },
  };
})();

// ---- 回す: 持ち手つきの大ダイヤルと噛み合う歯車。時計回りに累積 ----
(() => {
  const handleR = g => (g.r || 190) * 0.62;
  GateKinds.rotate = {
    enter(g) {
      g.turned = 0;
      g.grab = false;
      g.lastA = 0;
      g.tick = 0;
      g.spin = 0;
      g.lock = 0;
      g.lockMissed = false;
    },
    down(g, p) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d <= (g.r || 190) * 1.35 && d > 25) {
        g.grab = true;
        g.lastA = Math.atan2(p.y - g.y, p.x - g.x);
        g.lockMissed = false;
        g.turn0 = g.turned;
      } else g.miss();
    },
    move(g, p) {
      if (!g.grab || Math.hypot(p.x - g.x, p.y - g.y) < 25) return; // 中心付近は角度が暴れるので無視
      const a = Math.atan2(p.y - g.y, p.x - g.x);
      const da = wrapAngle(a - g.lastA);
      g.lastA = a;
      if (da < -0.02) {
        // 反時計回り ＝ ロックして進まない
        g.lock = 0.2;
        if (!g.lockMissed) {
          g.lockMissed = true;
          g.miss();
          Sound.sfx('lock');
        }
        return;
      }
      g.turned += Math.max(0, da);
      const tk = Math.floor(g.turned / (TAU / 12));
      if (tk > g.tick) {
        g.tick = tk;
        Sound.sfx('tick', { k: g.turned / TAU });
        const ha = g.turned - Math.PI / 2;
        FX.hitSpark(g.x + Math.cos(ha) * handleR(g), g.y + Math.sin(ha) * handleR(g), g.color, 4);
      }
      if (g.turned >= (g.cfg.rotateDeg * Math.PI) / 180) {
        g.grab = false;
        g.succeed();
      }
    },
    up(g) {
      // 回さずに離した（つついただけ）＝ 違う操作
      if (g.grab && !g.lockMissed && g.turned - g.turn0 < 0.05) g.miss();
      g.grab = false;
    },
    update(g, dt) {
      g.lock = Math.max(0, g.lock - dt);
      if (g.done) g.spin += dt * 25;
    },
    draw(ctx, g) {
      const R = g.r || 190;
      const c = g.color;
      const rock = !g.grab && !g.done && g.turned === 0 ? Math.sin(g.elapsed * 2.4) * 0.087 : 0; // ±5° の揺れ
      const ang = g.turned + rock + (g.lock > 0 ? Math.sin(g.lock * 90) * 0.04 : 0) + g.spin;
      gear(ctx, g.x + R * 1.08, g.y - R * 0.78, R * 0.42, 10, -ang / 0.42, GREY_D);
      gear(ctx, g.x - R * 1.02, g.y + R * 0.82, R * 0.36, 9, -ang / 0.36, GREY_D);
      if (g.turned > 0) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(g.x, g.y, R + 34, -Math.PI / 2, -Math.PI / 2 + Math.min(g.turned, TAU));
        ctx.stroke();
      }
      gear(ctx, g.x, g.y, R, 36, ang, GREY, 10);
      disc(ctx, g.x, g.y, R * 0.84, '#2a2d45');
      const hx = g.x + Math.cos(ang - Math.PI / 2) * handleR(g);
      const hy = g.y + Math.sin(ang - Math.PI / 2) * handleR(g);
      lineW(ctx, g.x, g.y, hx, hy, 22, shade(c, -0.3));
      disc(ctx, hx, hy, 36, c);
      disc(ctx, hx - 10, hy - 10, 10, 'rgba(255,255,255,0.6)');
      disc(ctx, g.x, g.y, 30, GREY);
      blinkRing(ctx, g, hx, hy, 62);
    },
    ghostPeriod: 2.0,
    ghost(g, k) {
      const a = -Math.PI / 2 + Ease.inOutCubic(seg(k, 0.1, 0.9)) * TAU * 1.02;
      const R = handleR(g);
      return { x: g.x + Math.cos(a) * R, y: g.y + Math.sin(a) * R, down: k < 0.9 };
    },
    demo(g) {
      const R = handleR(g);
      const acts = [['down', g.x, g.y - R]];
      for (let i = 1; i <= 28; i++) {
        const a = -Math.PI / 2 + (i / 28) * TAU * 1.08;
        acts.push(['move', g.x + Math.cos(a) * R, g.y + Math.sin(a) * R, 1]);
      }
      const last = acts[acts.length - 1];
      acts.push(['up', last[1], last[2]]);
      return acts;
    },
  };
})();

// ---- 連打: ひびから光が漏れるコア。1.5 秒空くとひびが戻る ----
GateKinds.mash = {
  enter(g) {
    g.hits = 0;
    g.lastHit = -9;
    g.decayAcc = 0;
    g.hitFx = 0;
    g.cracks = [];
    const R = rng(97);
    for (let i = 0; i < 12; i++) {
      const a = (((i * 5) % 12) / 12) * TAU + R() * 0.4;
      const pts = [];
      for (let j = 0; j <= 4; j++) {
        const rr = 0.1 + j * 0.22;
        const aa = a + (R() - 0.5) * 0.4;
        pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]);
      }
      g.cracks.push(pts);
    }
  },
  down(g, p) {
    if (!near(p.x, p.y, g.x, g.y, (g.r || 130) * 1.3)) {
      g.miss();
      return;
    }
    g.hits++;
    g.lastHit = g.elapsed;
    g.hitFx = 1;
    const k = g.hits / g.cfg.mashCount; // 叩くたびにエネルギーが溜まる（大げさに）
    FX.addTrauma(0.12 + 0.05 * g.hits);
    FX.flash(0.06 + 0.05 * k);
    FX.shock(g.x, g.y, g.color, (g.r || 130) * (1.4 + 1.6 * k), 0.32, { width: 10 + 14 * k, live: true });
    // 叩くたびにまわりの粒をコアが吸い込む
    FX.absorb(g.x, g.y, 18 + 4 * g.hits, {
      r: [(g.r || 130) * 2.2, (g.r || 130) * 3.8],
      life: [0.3, 0.55],
      size: [10, 20],
      colors: [g.color, '#ffffff', CONFIG.colors.spark, CONFIG.colors.cyan],
    });
    if (Sound.ctx)
      // 叩くたびに音程が上がる
      Sound.tone(180 * Math.pow(1.19, g.hits), 0.22, {
        type: 'sawtooth',
        vol: 0.09,
        to: 360 * Math.pow(1.19, g.hits),
        glide: 0.18,
        lp: 2400,
      });
    FX.hitSpark(
      g.x + (Math.random() - 0.5) * (g.r || 130) * 0.8,
      g.y + (Math.random() - 0.5) * (g.r || 130) * 0.8,
      g.color,
      8 + g.hits * 2,
    );
    Sound.sfx('hit', { k: g.hits / g.cfg.mashCount });
    if (g.hits >= g.cfg.mashCount) g.succeed();
  },
  update(g, dt) {
    g.hitFx = Math.max(0, g.hitFx - dt * 6);
    if (!g.done) {
      // 叩いていない間も粒が流れ込み続ける（溜まるほど多く）
      g.absorbAcc = (g.absorbAcc || 0) + dt * (5 + 6 * g.hits);
      while (g.absorbAcc >= 1) {
        g.absorbAcc -= 1;
        FX.absorb(g.x, g.y, 1, {
          r: [(g.r || 130) * 2.6, (g.r || 130) * 4.4],
          life: [0.6, 1.0],
          size: [7, 14],
          colors: [g.color, CONFIG.colors.cyan, '#ffffff'],
        });
      }
    }
    if (!g.done && g.hits > 0 && g.elapsed - g.lastHit > g.cfg.mashDecay) {
      g.decayAcc += dt;
      if (g.decayAcc >= 0.4) {
        g.decayAcc = 0;
        g.hits--;
      }
    } else g.decayAcc = 0;
  },
  draw(ctx, g) {
    const R = g.r || 130;
    const c = g.color;
    const k = g.hits / g.cfg.mashCount;
    const ck = g.done && Game.phase === 'BURST' && Game.chargeLeft > 0 ? Game.chargeK : 0; // 溜めの進み（0→1）
    const beat = 1 + 0.05 * Math.sin(g.elapsed * (4 + g.elapsed * 1.5 + k * 10)); // 脈動がだんだん速くなる
    const r = R * beat * (1 + 0.06 * g.hitFx) * (1 - 0.2 * ck); // 溜めるほど殻が縮こまる
    // 溜めるほど激しく震える
    if (ck > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 14 * ck, (Math.random() - 0.5) * 14 * ck);
    }
    drawSpark(
      ctx,
      g.x,
      g.y,
      r *
        (0.55 + 1.3 * k + (g.done ? 0.8 : 0)) *
        (1 + 0.5 * g.hitFx + 0.12 * FX.absorbPulse + 1.1 * ck * (1 + 0.2 * Math.sin(FX.time * (30 + 70 * ck)))),
      c,
    ); // 粒が届くたびに光がふくらむ／溜めで明滅しながら膨らむ
    if (ck > 0) {
      // 溜め: 輪が速く回り、白い芯が膨らむ
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10 + 10 * ck;
      const a0 = FX.time * (6 + 30 * ck);
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, R * (1.5 - 0.35 * ck), a0 + (n * TAU) / 3, a0 + (n * TAU) / 3 + 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (k > 0 && !g.done) {
      // 溜まったエネルギーの輪（叩くたびに伸びる）
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexA('#ffffff', 0.35);
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(g.x, g.y, R * 1.45, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 12 + 8 * g.hitFx;
      ctx.beginPath();
      ctx.arc(g.x, g.y, R * 1.45, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      ctx.lineTo(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#2a2d45';
    ctx.fill();
    ctx.strokeStyle = GREY;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = shade(c, 0.4);
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    for (let i = 0; i < Math.min(g.cracks.length, g.hits + 1); i++) {
      ctx.beginPath();
      g.cracks[i].forEach(([x, y], j) => (j ? ctx.lineTo(g.x + x * r, g.y + y * r) : ctx.moveTo(g.x + x * r, g.y + y * r)));
      ctx.stroke();
    }
    drawSpark(ctx, g.x, g.y, 10 + 30 * k + 90 * ck * ck, '#ffffff');
    blinkRing(ctx, g, g.x, g.y, r + 30);
    if (ck > 0) ctx.restore();
  },
  chargeStart(g, dur) {
    // 越えた瞬間: 唸りが上がり始める
    Sound.sfx('charge');
    if (Sound.ctx) Sound.tone(110, dur + 0.05, { type: 'sawtooth', vol: 0.11, to: 1760, glide: dur, lp: 3200 });
    FX.shock(g.x, g.y, '#ffffff', (g.r || 130) * 2, 0.25, { width: 12, live: true });
  },
  charging(g, k, dt) {
    // 溜め: まわりの粒が加速しながらどっと吸い込まれ、揺れが強まる
    const R = g.r || 130;
    g.chargeAcc = (g.chargeAcc || 0) + dt * (50 + 260 * k);
    while (g.chargeAcc >= 1) {
      g.chargeAcc -= 1;
      FX.absorb(g.x, g.y, 1, {
        r: [R * 2.4, R * 6],
        life: [0.18 + 0.2 * (1 - k), 0.3 + 0.25 * (1 - k)],
        size: [10, 24],
        colors: [g.color, '#ffffff', CONFIG.colors.spark, CONFIG.colors.cyan, CONFIG.colors.magenta],
      });
    }
    FX.addTrauma(dt * (0.8 + 3 * k));
    if (Math.random() < dt * (2 + 10 * k)) FX.shock(g.x, g.y, g.color, R * (1.2 + 1.5 * Math.random()), 0.2, { width: 8, live: true });
  },
  ghostPeriod: 0.32,
  ghost(g, k) {
    return { x: g.x + 30, y: g.y + 20 + (k < 0.45 ? 0 : 30), down: k < 0.45 };
  },
  demo(g) {
    const a = [];
    for (let i = 0; i < g.cfg.mashCount; i++) a.push(['down', g.x, g.y], ['up', g.x, g.y]);
    return a;
  },
};

// ---- ゲートの共通部分。opts はステージが渡す位置・大きさ・色・向き・本番の見た目（art） ----
function makeGate(id, opts) {
  const cfg = CONFIG.gates[id];
  const kind = GateKinds[cfg.kind] || GateKinds.tap;
  const g = Object.assign({ x: 0, y: 0, r: 110, color: CONFIG.colors.spark, art: null }, opts);
  return Object.assign(g, {
    id,
    cfg,
    kindName: GateKinds[cfg.kind] ? cfg.kind : 'tap',
    done: false,
    elapsed: 0,
    reaction: 0,
    misses: 0,
    hint: 0,
    wobble: 0,
    doneAge: 0,
    t0: 0,

    enter() {
      this.done = false;
      this.elapsed = 0;
      this.reaction = 0;
      this.misses = 0;
      this.hint = 0;
      this.wobble = 0;
      this.doneAge = 0;
      this.t0 = performance.now(); // 反応時間はフレームに依らず実時間で測る
      if (kind.enter) kind.enter(this);
    },
    update(dt) {
      if (this.done) this.doneAge += dt;
      else {
        this.elapsed += dt;
        this.hint = this.elapsed >= CONFIG.hint.ghostAt ? 2 : this.elapsed >= CONFIG.hint.emphasizeAt ? 1 : 0;
      }
      this.wobble = Math.max(0, this.wobble - dt);
      if (kind.update) kind.update(this, dt);
    },
    down(p) {
      if (!this.done && kind.down) kind.down(this, p);
    },
    move(p) {
      if (!this.done && kind.move) kind.move(this, p);
    },
    up(p) {
      if (!this.done && kind.up) kind.up(this, p);
    },
    succeed() {
      if (this.done) return;
      this.done = true;
      this.reaction = (performance.now() - this.t0) / 1000;
    },
    miss() {
      this.misses++;
      this.wobble = 0.3;
      Sound.sfx('miss');
    },
    draw(ctx) {
      ctx.save();
      if (this.wobble > 0) ctx.translate(Math.sin(this.wobble * 60) * 12 * (this.wobble / 0.3), 0);
      (this.art || kind.draw)(ctx, this);
      ctx.restore();
    },
    // ヒント段階2: 半透明の指が操作を実演（押している間の軌跡つき）
    drawHint(ctx) {
      if (this.hint < 2 || this.done || !kind.ghost) return;
      const P = kind.ghostPeriod || 1.2;
      const k = ((this.elapsed - CONFIG.hint.ghostAt) % P) / P;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let on = false;
      for (let i = 14; i >= 0; i--) {
        const kk = k - i * 0.02;
        if (kk < 0) continue;
        const q = kind.ghost(this, kk);
        if (!q.down) {
          on = false;
          continue;
        }
        if (on) ctx.lineTo(q.x, q.y);
        else {
          ctx.moveTo(q.x, q.y);
          on = true;
        }
      }
      ctx.stroke();
      const q = kind.ghost(this, k);
      ctx.globalAlpha = q.down ? 0.75 : 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.down ? 28 : 36, 0, TAU);
      ctx.fill();
      if (q.down) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 46, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
  });
}
