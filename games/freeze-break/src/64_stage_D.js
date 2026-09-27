// 区間D 衝撃（10.0–13.5秒）→ G4 回す
// 縄が弾けて重りが落下 → 床が砕けて破片が飛ぶ → 下の機械室へ落ちる（世界が上へ流れる）
// → 歯車が滑り込んで噛み合い、回路線が描かれる → 光点が大ダイヤルの軸に吸い込まれる

// 機械室の部品（区間Eでも使う）
const MachineRoom = (() => {
  const C = CONFIG.colors;
  const DIAL = { x: 0, y: 100 };
  const GEARS = [
    [-420, -220, 170, 18, 1],
    [440, 250, 140, 15, -1],
    [-380, 400, 110, 12, -1],
  ];
  const CIRCUITS = [
    [
      [-560, -260],
      [-300, -260],
      [-300, -40],
      [-190, -40],
    ],
    [
      [560, -300],
      [320, -300],
      [320, -60],
      [190, 20],
    ],
    [
      [-560, 420],
      [-260, 420],
      [-150, 250],
    ],
    [
      [560, 460],
      [240, 460],
      [150, 260],
    ],
    [
      [0, -560],
      [0, -300],
      [-60, -240],
    ],
    [
      [-560, 120],
      [-220, 120],
    ],
  ];
  const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const total = pts => pts.slice(1).reduce((s, p, i) => s + segLen(pts[i], p), 0);
  function pointAt(pts, k) {
    let left = total(pts) * clamp(k);
    for (let i = 1; i < pts.length; i++) {
      const L = segLen(pts[i - 1], pts[i]);
      if (left <= L) {
        const f = L ? left / L : 0;
        return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
      }
      left -= L;
    }
    return pts[pts.length - 1];
  }
  function polyline(ctx, pts, k, color) {
    // 回路線を k（0→1）まで描く
    let left = total(pts) * k;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const L = segLen(pts[i - 1], pts[i]);
      const f = Math.min(1, left / L);
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
      left -= L;
    }
    ctx.stroke();
    disc(ctx, pts[0][0], pts[0][1], 10, color);
    if (k >= 1) {
      const e = pts[pts.length - 1];
      disc(ctx, e[0], e[1], 12, color);
    }
  }
  return {
    C,
    DIAL,
    CIRCUITS,
    GEARS,
    pointAt,
    gears(ctx, slide, ang) {
      // slide(i): 滑り込み 0→1、ang: 回転角
      GEARS.forEach(([x, y, r, n, dir], i) => {
        const gx = x + (x < 0 ? -700 : 700) * (1 - slide(i));
        gear(ctx, gx, y, r, n, dir * ang, '#23263d', r * 0.14);
        disc(ctx, gx, y, r * 0.3, '#1a1c2e');
      });
    },
    circuits(ctx, prog) {
      // prog(i): 伸び 0→1
      CIRCUITS.forEach((pts, i) => {
        const k = prog(i);
        if (k > 0) polyline(ctx, pts, k, i % 2 ? C.coral : shade(C.coral, -0.35));
      });
    },
  };
})();

(() => {
  // 床が砕けるのは 0.25秒（8分）
  const RR = RopeRoom;
  const MR = MachineRoom;
  const C = RR.C;
  const DROP = 1500;
  const DIAL = MR.DIAL;
  const HIT = 1 / 14;
  const scroll = u => DROP * Ease.outCubic(seg(u, 0.03, 0.45)); // カメラは落ちる玉と一緒に機械室へ
  const sec = u => Math.max(0, (u - HIT) * 3.5); // 床が砕けてからの秒数
  const weightY = u =>
    u < HIT
      ? lerp(RR.WEIGHT.y, RR.FLOOR - RR.WEIGHT.h / 2, Ease.inCubic(u / HIT))
      : RR.FLOOR - RR.WEIGHT.h / 2 + 2600 * Math.pow(seg(u, HIT, 0.5), 2);

  const shards = (() => {
    // 床の破片（シード固定）
    const R = rng(21);
    const out = [];
    for (let i = 0; i < 16; i++) {
      const cx = -640 + i * 85 + 40;
      out.push({
        cx,
        w: 80,
        vx: (cx - RR.WEIGHT.x) * 1.6 + (R() - 0.5) * 300,
        vy: -450 - R() * 550,
        spin: (R() - 0.5) * 12,
        color: i % 3 ? '#261d3a' : '#3a2e55',
      });
    }
    return out;
  })();
  const cut = () => {
    const g3 = Timeline[3].gateObj;
    return g3 && g3.cut ? g3.cut : { x: RR.ROPE.x, y: RR.ROPE.y };
  };

  // 玉: 区間Cの終わり (60, −400) から落ち続け、砕けた床を抜ける → 強い磁石に捕まって急ブレーキ、震えながら浮く
  //     → 近づくほど速く、渦を巻いて一気にダイヤルの軸へ吸い寄せられる（3.0秒、拍）
  const B0 = [60, -400];
  const V0Y = 2630;
  const GD = 800;
  const T_CATCH = 0.5;
  const T_PULL = 1.9;
  const T_SNAP = 3.0;
  const HOVER = [-230, DROP - 330];
  const DIALW = [DIAL.x, DIAL.y + DROP];
  function ballWorld(u) {
    // 縄の部屋の座標（y下向き）
    const t = u * 3.5;
    const fall = tt => [B0[0] - 40 * tt, B0[1] + V0Y * tt + 0.5 * GD * tt * tt];
    if (t < T_CATCH) return [...fall(t), 26];
    if (t < T_PULL) {
      const pc = fall(T_CATCH);
      const k = Ease.outCubic(seg(t, T_CATCH, T_CATCH + 0.45));
      const w = seg(t, T_CATCH + 0.3, T_CATCH + 0.6) * (1 - seg(t, T_PULL - 0.2, T_PULL));
      return [lerp(pc[0], HOVER[0], k) + 12 * Math.sin(t * 61) * w, lerp(pc[1], HOVER[1], k) + 9 * Math.cos(t * 53) * w, 26];
    }
    const k = Math.pow(seg(t, T_PULL, T_SNAP), 4);
    const a = 2.2 * k;
    const dx = HOVER[0] - DIALW[0];
    const dy = HOVER[1] - DIALW[1];
    return [
      DIALW[0] + (dx * Math.cos(a) - dy * Math.sin(a)) * (1 - k),
      DIALW[1] + (dx * Math.sin(a) + dy * Math.cos(a)) * (1 - k),
      26 * (1 - seg(t, T_SNAP, T_SNAP + 0.25)),
    ];
  }
  const magnet = u => {
    const t = u * 3.5;
    return t < T_CATCH
      ? 0
      : t < T_PULL
        ? 0.35 + 0.25 * Math.abs(Math.sin(t * 37))
        : t < T_SNAP
          ? 0.5 + 0.5 * seg(t, T_PULL, T_SNAP)
          : 1 - seg(t, T_SNAP, T_SNAP + 0.2);
  };
  function ballPos(u) {
    const [x, y, r] = ballWorld(u);
    return [x, y - scroll(u), r];
  }

  // ---- 3D: 縄が切れて重りが落ち、床が砕ける → 玉と一緒に下の機械室へ落ちる → 歯車・回路・大ダイヤル → G4
  // 平面は区間Cと同じ向き（x=0、+x 側から見る）。2D は世界を DROP だけ上へ流すので、平面も scroll(u) だけ下がる
  // 縄の部屋 / 機械室の2D座標 → 3D
  const P = (x, y) => RR.P3(x, y);
  const PM = (x, y) => RR.P3(x, y + DROP);
  MR.PM = PM; // 区間E（3D）も機械室の平面を使う
  const mat = (color, e = 0.3) => World3D.mat(color, e, 0.6, 0.15);
  function gearGeo(r, n, depth) {
    // 歯車（xy 平面の形を z へ押し出す）
    const sh = new THREE.Shape();
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2;
      const rr = i % 4 < 2 ? r : r * 0.84;
      if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  // 大ダイヤルの絵（ゲートの2Dの絵をそのまま板に描く）
  const DTEX = 512;
  const DSPAN = 620;
  const DK = DTEX / DSPAN;
  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      T.ball = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 18), mat(C.spark, 0.8));
      T.glow = World3D.glow(C.spark, 260);
      T.mag = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 7, 1, 8),
        new THREE.MeshBasicMaterial({ color: C.violet, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      ); // 磁力の線
      T.magGlow = World3D.glow(C.violet, 500);
      grp.add(T.mag, T.magGlow);
      T.ropeL = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 10), mat(C.magenta, 0.45));
      T.ropeR = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 10), mat(C.magenta, 0.45));
      const R = rng(33);
      T.shards = []; // 砕けた床（16列 × 奥行き4）
      shards.forEach(sd => {
        for (let k = 0; k < 4; k++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(170, 70, 80), mat(sd.color, 0.2));
          m.userData = { sd, dx: -310 + k * 175 - 50, vx: (R() - 0.5) * 900 + (k - 1.5) * 260, sa: (R() - 0.5) * 8, sb: (R() - 0.5) * 8 };
          m.visible = false;
          T.shards.push(m);
        }
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1500), mat('#141626', 0.25)); // 機械室の奥の壁
      back.position.set(-120, ...PM(0, 40).slice(1));
      back.rotation.y = Math.PI / 2;
      T.gears = MR.GEARS.map(([x, y, r, n]) => {
        const m = new THREE.Mesh(gearGeo(r, n, 50), mat('#2b2f4d', 0.3));
        m.rotation.y = Math.PI / 2;
        return m;
      });
      T.hubs = MR.GEARS.map(([, , r]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 60, 20), mat('#1a1c2e', 0.2));
        m.rotation.z = Math.PI / 2;
        return m;
      });
      T.circ = MR.CIRCUITS.map((pts, i) => {
        // 回路線: 線分ごとの細い円柱を途中まで伸ばす
        const col = i % 2 ? C.coral : shade(C.coral, -0.35);
        const segs = pts.slice(1).map(() => new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1, 8), mat(col, 0.7)));
        const a = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), mat(col, 0.7));
        const b = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 8), mat(col, 0.9));
        a.position.set(-100, ...PM(...pts[0]).slice(1));
        b.position.set(-100, ...PM(...pts[pts.length - 1]).slice(1));
        return { pts, segs, a, b };
      });
      const cv = document.createElement('canvas');
      cv.width = cv.height = DTEX;
      T.dctx = cv.getContext('2d');
      T.dtex = new THREE.CanvasTexture(cv);
      T.dial = new THREE.Mesh(new THREE.PlaneGeometry(DSPAN, DSPAN), new THREE.MeshBasicMaterial({ map: T.dtex, transparent: true }));
      T.dial.position.set(-60, ...PM(DIAL.x, DIAL.y).slice(1));
      T.dial.rotation.y = Math.PI / 2;
      T.dialBack = new THREE.Mesh(new THREE.CylinderGeometry(215, 215, 40, 48), mat('#23263d', 0.3)); // ダイヤルの台（板の奥）
      T.dialBack.position.set(-85, ...PM(DIAL.x, DIAL.y).slice(1));
      T.dialBack.rotation.z = Math.PI / 2;
      T.back = back;
      [T.ball, T.glow, T.ropeL, T.ropeR, ...T.shards, back, ...T.gears, ...T.hubs, T.dial, T.dialBack].forEach(o => grp.add(o));
      T.circ.forEach(c => {
        c.segs.forEach(m => grp.add(m));
        grp.add(c.a, c.b);
      });
      // 機械室の奥の壁: 歯車の後ろで音の粒が下から立ちのぼる
      T.spec = World3D.addSpectrum({
        parent: grp,
        pos: [-112, ...PM(0, 720).slice(1)],
        x: [0, 0, -1],
        y: [1, 0, 0],
        z: [0, -1, 0],
        size: [820, 60, 1350],
      });
      scene.add(grp);
      this.group = grp;
      this.T = T;
    },
    update(u, o) {
      const T = this.T;
      const S = scroll(u);
      const t = sec(u);
      const CT = StageDefs.C.three;
      if (CT.group) {
        // 区間Cの縄の部屋を使い続ける（上へ流れ去るまで）
        const K = CT.T;
        CT.group.visible = u < 0.75;
        [K.rope, K.ball, K.glow, K.wind].forEach(m => {
          m.visible = false;
        });
        K.floor.visible = K.edge.visible = u < HIT;
        K.weight.visible = K.label.visible = K.hang.visible = u < 0.55; // 重りは機械室の下へ抜けたら消す
        const wy = weightY(u);
        const rot = u < HIT ? 0 : 0.3 * seg(u, HIT, 0.4);
        const W = RR.WEIGHT;
        K.weight.position.set(...P(W.x, wy));
        K.weight.rotation.set(-rot, Math.PI / 4, 0, 'XYZ');
        K.label.position.set(W.w * 0.5 + 4, K.weight.position.y - 16, K.weight.position.z);
        K.label.rotation.set(-rot, Math.PI / 2, 0, 'XYZ');
        World3D.stretch(K.hang, P(u < HIT ? RR.TOP[0] + 40 : W.x, u < HIT ? RR.TOP[1] : wy - 300), P(W.x, wy - W.h / 2 - 36));
        K.wheel.rotation.x = u * 20;
      }
      const c = cut();
      const [nx, ny] = RR.NORMAL;
      const drop = Ease.outCubic(seg(u, 0, 0.25));
      const pull = Ease.inCubic(seg(u, 0, 0.1));
      World3D.stretch(T.ropeL, P(...RR.LOW), P(lerp(c.x, RR.LOW[0], 0.55) + nx * 60, lerp(c.y, RR.LOW[1], 0.55) + ny * 60 + 220 * drop)); // 垂れ下がる左の切れ端
      T.ropeL.visible = u < 0.6;
      T.ropeR.visible = pull < 1 && u < 0.6; // 右の切れ端は滑車へ引き込まれる（縄の部屋が遠ざかったら隠す）
      if (pull < 1)
        World3D.stretch(
          T.ropeR,
          P(...RR.TOP),
          P(lerp(lerp(c.x, RR.TOP[0], 0.55) - nx * 60, RR.TOP[0], pull), lerp(lerp(c.y, RR.TOP[1], 0.55) - ny * 60, RR.TOP[1], pull)),
        );
      T.shards.forEach(m => {
        // 床の破片（2Dの動き＋奥行きの速さと回転）
        const { sd, dx, vx, sa, sb } = m.userData;
        m.visible = u >= HIT && t < 1.6;
        if (!m.visible) return;
        const p = P(sd.cx + sd.vx * t, RR.FLOOR + 35 + sd.vy * t + 1200 * t * t);
        m.position.set(dx + vx * t, p[1], p[2]);
        m.rotation.set(-sd.spin * t, sa * t, sb * t);
      });
      MR.GEARS.forEach(([x, y, r, n, dir], i) => {
        // 歯車が左右から滑り込んで回る
        const gx = x + (x < 0 ? -700 : 700) * (1 - Ease.outBack(seg(u, 0.3 + i * 0.06, 0.55 + i * 0.06)));
        const p = PM(gx, y);
        T.gears[i].position.set(-40, p[1], p[2]);
        T.gears[i].rotation.z = -dir * u * 6;
        T.hubs[i].position.set(-20, p[1], p[2]);
      });
      T.circ.forEach(({ pts, segs, a, b }, i) => {
        // 回路線が伸びる
        const k = Ease.inOutCubic(seg(u, 0.45 + i * 0.04, 0.72 + i * 0.04));
        let left = k * pts.slice(1).reduce((s2, q, j) => s2 + Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1]), 0);
        segs.forEach((m, j) => {
          const p0 = pts[j];
          const p1 = pts[j + 1];
          const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          const f = clamp(left / L);
          m.visible = f > 0.001;
          left -= L;
          if (m.visible) {
            const e0 = PM(...p0);
            const e1 = PM(lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f));
            e0[0] = e1[0] = -100;
            World3D.stretch(m, e0, e1);
          }
        });
        a.visible = k > 0;
        b.visible = k >= 1;
      });
      T.dial.visible = !o.omitGateObject && u > 0.25; // 凍結中はゲートが描く
      if (T.dial.visible) {
        const g = Timeline[4].gateObj;
        const x = T.dctx;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, DTEX, DTEX);
        x.setTransform(DK, 0, 0, DK, (DSPAN / 2 - DIAL.x) * DK, (DSPAN / 2 - DIAL.y) * DK);
        if (g) g.draw(x);
        T.dtex.needsUpdate = true;
      }
      // 磁力: 玉とダイヤルの軸をつなぐ線と、軸の光
      const mg = magnet(u);
      const dc = PM(DIAL.x, DIAL.y);
      T.mag.visible = T.magGlow.visible = mg > 0.01;
      // 玉（2Dの流れない座標 → 3D）
      const [bx, by, br] = ballPos(u);
      const bp = P(bx, by + S);
      if (mg > 0.01) {
        World3D.stretch(T.mag, bp, [dc[0] - 50, dc[1], dc[2]]);
        T.mag.material.opacity = 0.2 + 0.6 * mg * (0.6 + 0.4 * Math.sin(u * 300));
        T.magGlow.position.set(dc[0] - 40, dc[1], dc[2]);
        T.magGlow.scale.setScalar(300 + 500 * mg);
      }
      T.ball.visible = T.glow.visible = br > 0.5;
      T.ball.position.set(...bp);
      T.ball.scale.setScalar(Math.max(0.01, br / 26));
      T.glow.position.set(...bp);
      T.glow.scale.setScalar(260 * (br / 26) * (1 + 0.15 * Beat.pulse));
    },
    camera(u) {
      const d0 = World3D.fitDist(50);
      const S = scroll(u);
      const zoom = 1.05 - 0.05 * Ease.inOutCubic(seg(u, 0.05, 0.4)) + 0.04 * Ease.inOutCubic(seg(u, 0.6, 1));
      const f = [0, RR.RY - S, RR.RZ];
      const R = d0 / zoom;
      // 落ちる間は回り込んで奥行きを見せる
      const yaw = Math.PI / 2 - 0.35 * Math.sin(Math.PI * seg(u, 0.1, 0.8));
      const el = 0.12 * Math.sin(Math.PI * seg(u, 0.08, 0.6));
      const pos = [f[0] + R * Math.sin(yaw) * Math.cos(el), f[1] + R * Math.sin(el), f[2] + R * Math.cos(yaw) * Math.cos(el)];
      return { pos, look: f, up: [0, 1, 0], fov: 50, roll: -0.05 * Math.sin(Math.PI * seg(u, 0.1, 0.6)) };
    },
    plane: u => ({ o: [0, RR.RY - scroll(u), RR.RZ], r: [0, 0, -1], d: [0, -1, 0] }), // 2Dの画面の座標（流れる世界に合わせて下がる）
  };

  defineStage('D', {
    origin: StageB.ORIGIN_NEXT,
    camera: u =>
      Camera.make(
        0,
        0,
        1.05 - 0.05 * Ease.inOutCubic(seg(u, 0.05, 0.4)) + 0.04 * Ease.inOutCubic(seg(u, 0.6, 1)),
        -0.05 * Math.sin(Math.PI * seg(u, 0.1, 0.6)),
      ),
    events: [
      [
        HIT,
        () => {
          // 重りが床に当たる
          FX.addTrauma(0.9);
          FX.kick(0.08);
          FX.flash(0.25);
          FX.shock(RR.WEIGHT.x, RR.FLOOR, '#ffffff', 900, 0.4, { width: 34 });
          FX.burst(RR.WEIGHT.x, RR.FLOOR, {
            n: 50,
            dir: -Math.PI / 2,
            spread: 2.6,
            colors: [C.coral, '#ffffff', C.spark],
            kinds: ['streak', 'dot'],
            speed: [400, 1400],
            life: [0.3, 0.7],
          });
        },
      ],
      [
        1 / 7,
        () => {
          // 磁石に捕まる
          const [x, y] = ballPos(1 / 7);
          FX.addTrauma(0.35);
          FX.shock(x, y, C.violet, 300, 0.3, { width: 14 });
          FX.burst(x, y, { n: 24, colors: [C.violet, C.cyan, '#ffffff'], kinds: ['streak', 'dot'], speed: [300, 900], life: [0.2, 0.45] });
          if (Sound.ctx) Sound.tone(90, 0.3, { type: 'square', vol: 0.12, to: 60, glide: 0.2, lp: 900 });
        },
      ],
      [
        T_PULL / 3.5,
        () => {
          if (Sound.ctx) Sound.tone(160, T_SNAP - T_PULL, { type: 'sawtooth', vol: 0.06, to: 1400, glide: T_SNAP - T_PULL, lp: 3000 });
        },
      ], // 吸い寄せられる唸り
      [9 / 14, () => FX.addTrauma(0.25)],
      [
        6 / 7,
        () => {
          FX.shock(DIAL.x, DIAL.y, C.coral, 520, 0.35, { width: 26 });
          FX.burst(DIAL.x, DIAL.y, { n: 40, colors: [C.spark, C.coral, '#ffffff'], speed: [300, 1100], life: [0.25, 0.5] });
          FX.addTrauma(0.6);
          FX.kick(0.06);
        },
      ], // 吸い込まれて「ガチッ」
    ],
    draw(ctx, u, o) {
      const S = scroll(u);
      const t = sec(u);
      ctx.save();
      ctx.translate(0, DROP - S); // 機械室（下から上がってくる）
      MR.gears(ctx, i => Ease.outBack(seg(u, 0.3 + i * 0.06, 0.55 + i * 0.06)), u * 6);
      MR.circuits(ctx, i => Ease.inOutCubic(seg(u, 0.45 + i * 0.04, 0.72 + i * 0.04)));
      const g = Timeline[4].gateObj;
      if (!o.omitGateObject && g) g.draw(ctx); // 大ダイヤル（凍結中はゲートが描く）
      ctx.restore();

      ctx.save();
      ctx.translate(0, -S); // 縄の部屋（上へ流れ去る）
      RR.pulley(ctx, u * 20);
      const c = cut();
      const [nx, ny] = RR.NORMAL;
      const drop = Ease.outCubic(seg(u, 0, 0.25));
      const e1 = [lerp(c.x, RR.LOW[0], 0.55) + nx * 60, lerp(c.y, RR.LOW[1], 0.55) + ny * 60 + 220 * drop];
      lineW(ctx, RR.LOW[0], RR.LOW[1], e1[0], e1[1], 16, C.magenta); // 垂れ下がる左の切れ端
      const pull = Ease.inCubic(seg(u, 0, 0.1));
      if (pull < 1) {
        // 右の切れ端は滑車へ引き込まれる
        const e2 = [
          lerp(lerp(c.x, RR.TOP[0], 0.55) - nx * 60, RR.TOP[0], pull),
          lerp(lerp(c.y, RR.TOP[1], 0.55) - ny * 60, RR.TOP[1], pull),
        ];
        lineW(ctx, RR.TOP[0], RR.TOP[1], e2[0], e2[1], 16, C.magenta);
      }
      const wy = weightY(u);
      lineW(
        ctx,
        u < HIT ? RR.TOP[0] + 40 : RR.WEIGHT.x,
        u < HIT ? RR.TOP[1] : wy - 300,
        RR.WEIGHT.x,
        wy - RR.WEIGHT.h / 2 - 36,
        12,
        shade(C.magenta, -0.2),
      );
      RR.weight(ctx, wy, u < HIT ? 0 : 0.3 * seg(u, HIT, 0.4));
      RR.bollard(ctx);
      if (u < HIT) RR.floor(ctx);
      else {
        for (const s of shards) {
          // 砕けた床
          const x = s.cx + s.vx * t;
          const y = RR.FLOOR + 35 + s.vy * t + 1200 * t * t;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(s.spin * t);
          ctx.fillStyle = s.color;
          ctx.fillRect(-s.w / 2, -35, s.w, 70);
          ctx.restore();
        }
      }
      ctx.restore();
      const [bx, by, br] = ballPos(u);
      if (br > 0.5) {
        drawSpark(ctx, bx, by, br * 0.9);
        disc(ctx, bx, by, br, C.spark);
        disc(ctx, bx - br * 0.3, by - br * 0.3, br * 0.28, 'rgba(255,255,255,0.6)');
      }
    },
    three,
    gate: { x: DIAL.x, y: DIAL.y, r: 190, color: CONFIG.colors.coral },
  });
})();
