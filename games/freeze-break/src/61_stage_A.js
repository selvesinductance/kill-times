// 区間A 点火（0.0–3.0秒）→ G1 引いて放す
// ボタンが光点に弾ける → 同心円 → 図形が飛来してY字のパチンコを組み上げる → 光点が図形に跳ね返りながらゴムに収まる
// 3D: タイトルの輪のトンネルが奥へ去り、カメラが回り込みながら組み立てを見せ、最後にパチンコの正面に収まる
(() => {
  // G = ゴムに収まった玉の位置（G1 の位置、ゲート平面の座標）
  const C = CONFIG.colors;
  const G = { x: 0, y: 60 };
  // 跳ね返る2点
  const P1 = [-260, -240];
  const P2 = [240, -320];
  const BUMP1 = [P1[0] - 55, P1[1] - 45];
  const BUMP2 = [P2[0] + 55, P2[1] - 45];
  const gate = () => Timeline[1].gateObj;
  // 拍（0.5秒）と8分（0.25秒）の格子に合わせた出来事の時刻（区間の長さ 3秒 で割った u）
  // 押した後 0.75秒 溜めて勢いよく発射、部品が収まる 1.0・1.25・1.75秒、光点が跳ね返る 1.5・2.0秒、ゴムに触れるのは凍結の瞬間（3.0秒）
  const U_LAUNCH = 0.75 / 3;
  const U_B1 = 1.5 / 3;
  const U_B2 = 2.0 / 3;
  const U_LAND = 1;
  const U_SL = 1.0 / 3;
  const U_SR = 1.25 / 3;
  const U_SH = 1.75 / 3;

  // 横切る飾りの図形（シード固定）
  const deco = (() => {
    const R = rng(11);
    const cols = [C.cyan, C.magenta, C.violet, C.spark];
    const out = [];
    for (let i = 0; i < 10; i++) {
      const a = R() * TAU;
      const s0 = 900;
      const s1 = 900;
      out.push({
        type: i % 3,
        color: cols[i % 4],
        size: 26 + R() * 44,
        spin: (R() - 0.5) * 8,
        z0: (R() - 0.5) * 900,
        z1: (R() - 0.5) * 900,
        from: [Math.cos(a) * s0, Math.sin(a) * s0],
        to: [-Math.cos(a + (R() - 0.5)) * s1, -Math.sin(a + (R() - 0.5)) * s1],
        t0: 0.04 + R() * 0.4,
        len: 0.3 + R() * 0.15,
      });
    }
    return out;
  })();

  function sparkPos(u) {
    if (u < U_LAUNCH) return [G.x, G.y];
    // 2D版も高く上げる
    if (u < U_B1) {
      const k = Ease.outCubic(seg(u, U_LAUNCH, U_B1));
      return [lerp(G.x, P1[0], k), lerp(G.y, P1[1], k) - Math.sin(Math.PI * k) * 260];
    }
    if (u < U_B2) {
      const k = Ease.inOutCubic(seg(u, U_B1, U_B2));
      return [lerp(P1[0], P2[0], k), lerp(P1[1], P2[1], k) - Math.sin(Math.PI * k) * 120];
    }
    if (u < U_LAND) {
      const k0 = seg(u, U_B2, U_LAND);
      const k = -0.6 * k0 * k0 * k0 + 0.2 * k0 * k0 + 1.4 * k0;
      const a = (1 - k) * (1 - k);
      const b = 2 * (1 - k) * k;
      const c = k * k;
      return [a * P2[0] + b * 120 + c * G.x, a * P2[1] + b * -560 + c * G.y];
    }
    return [G.x, G.y]; // ゴムに触れた瞬間に止まる
  }
  const pieces = u => {
    const pc = (a, b, dx, dy, rot) => {
      const k = Ease.outBack(seg(u, a, b));
      return [dx * (1 - k), dy * (1 - k), rot * (1 - k)];
    };
    return {
      left: pc(U_SL - 0.22, U_SL, -800, -250, -2.6),
      right: pc(U_SR - 0.22, U_SR, 800, -180, 2.6),
      handle: pc(U_SH - 0.22, U_SH, 0, 800, 1.3),
    };
  };
  function shape(ctx, type, x, y, s, rot, color, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    if (type === 0) {
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.closePath();
    } else if (type === 1) ctx.rect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5);
    else ctx.arc(0, 0, s * 0.8, 0, TAU);
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.restore();
  }
  const snap = (x, y) => () => {
    FX.burst(x, y, { n: 14, colors: [C.coral, '#ffffff'], kinds: ['streak', 'dot'], speed: [200, 600], life: [0.2, 0.4], size: [4, 9] });
    FX.addTrauma(0.12);
  };
  const bounce = p => () => {
    FX.burst(p[0], p[1], {
      n: 18,
      colors: [C.spark, '#ffffff'],
      kinds: ['streak', 'dot'],
      speed: [250, 800],
      life: [0.2, 0.45],
      size: [4, 10],
    });
    FX.shock(p[0], p[1], C.spark, 170, 0.25, { width: 10 });
    FX.addTrauma(0.15);
  };

  // ---- 3D ----
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, -y, z); // ゲート平面の座標（y下向き）→ 3D
  const G3 = [G.x, -G.y, 0];
  const Q1 = [P1[0], -P1[1], 0];
  const Q2 = [P2[0], -P2[1], 0];
  // 重力のある放物線: S から E へ T 秒で着く（途中で手前か奥へふくらむ）
  const G_LAUNCH = 4200; // ボタンからの最初の弧は重力を強くして高く上げる（着く時刻は同じ）
  function arc(S, E, T, t, bulge, g = 1800) {
    const tt = clamp(t / T) * T;
    const v = [(E[0] - S[0]) / T, (E[1] - S[1]) / T + 0.5 * g * T, (E[2] - S[2]) / T];
    return [S[0] + v[0] * tt, S[1] + v[1] * tt - 0.5 * g * tt * tt, S[2] + v[2] * tt + bulge * Math.sin((Math.PI * tt) / T)];
  }
  function spark3(u) {
    const t = u * 3;
    if (u < U_LAUNCH) return G3.slice();
    if (u < U_B1) return arc(G3, Q1, (U_B1 - U_LAUNCH) * 3, t - U_LAUNCH * 3, 160, G_LAUNCH);
    if (u < U_B2) return arc(Q1, Q2, (U_B2 - U_B1) * 3, t - U_B1 * 3, -140);
    // 立方体からは自然な速さで跳ね、だんだん減速してゴムに触れた瞬間に止まる
    if (u < U_LAND) {
      const T3 = (U_LAND - U_B2) * 3;
      const k = seg(u, U_B2, U_LAND);
      return arc(Q2, G3, T3, T3 * (-0.6 * k * k * k + 0.2 * k * k + 1.4 * k), 180);
    }
    return G3.slice();
  }
  const mat = (color, e = 0.35) => World3D.mat(color, e);
  // 発射の向き d（最初の弧の出だしの速さの向き）と、ボタンを真横から見るカメラ（up = d、視線は d に垂直）
  (() => {
    const T1 = (U_B1 - U_LAUNCH) * 3;
    const v = [(Q1[0] - G3[0]) / T1, (Q1[1] - G3[1]) / T1 + 0.5 * G_LAUNCH * T1, (160 * Math.PI) / T1];
    const n = Math.hypot(...v);
    const d = v.map(x => x / n);
    // −z を d に垂直な面へ射影
    const wz = [d[2] * d[0], d[2] * d[1], d[2] * d[2] - 1];
    const wn = Math.hypot(...wz);
    const w = wz.map(x => x / wn);
    const r = [w[1] * d[2] - w[2] * d[1], w[2] * d[0] - w[0] * d[2], w[0] * d[1] - w[1] * d[0]]; // 画面の右 = w × d
    const L = G3.map((x, i) => x + d[i] * 60); // 見る点（ボタンの光点が画面中央より 60 下）
    Object.assign(LaunchView, {
      d,
      w,
      r,
      L,
      G3: G3.slice(),
      cam: dist => ({ pos: L.map((x, i) => x - w[i] * dist), look: L.slice(), up: d.slice(), fov: 50, roll: 0 }),
      plane: { o: L.slice(), r, d: d.map(x => -x) },
    });
  })();
  const pivotOf = (mesh, c) => {
    const p = new THREE.Group();
    mesh.geometry.translate(-c.x, -c.y, -c.z);
    p.add(mesh);
    p.position.copy(c);
    p.userData.home = c.clone();
    return p;
  };
  function stretch(mesh, a, b) {
    // 円柱を a から b へ渡す
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const L = Math.max(0.01, d.length());
    mesh.position.copy(va).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh.scale.set(1, L, 1);
  }

  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      const tl = V3(G.x - 80, G.y - 12);
      const tr = V3(G.x + 80, G.y - 12);
      const fork = V3(G.x, G.y + 110);
      const armL = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(tl, V3(G.x - 80, G.y + 110), fork), 24, 13, 10),
        mat(C.coral),
      );
      const armR = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(fork, V3(G.x + 80, G.y + 110), tr), 24, 13, 10),
        mat(C.coral),
      );
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 190, 14), mat(C.coral));
      handle.position.copy(V3(G.x, G.y + 205));
      T.left = pivotOf(armL, tl.clone().add(fork).multiplyScalar(0.5));
      T.right = pivotOf(armR, tr.clone().add(fork).multiplyScalar(0.5));
      T.handle = new THREE.Group();
      T.handle.add(handle);
      handle.position.set(0, 0, 0);
      T.handle.position.copy(V3(G.x, G.y + 205));
      T.handle.userData.home = T.handle.position.clone();
      const bandGeo = new THREE.CylinderGeometry(4.5, 4.5, 1, 6);
      bandGeo.translate(0, 0, 0);
      T.bandL = new THREE.Mesh(bandGeo, mat(shade(C.spark, -0.3), 0.2));
      T.bandR = new THREE.Mesh(bandGeo, mat(C.spark, 0.4));
      T.ball = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 18), mat(C.spark, 0.8));
      T.glow = World3D.glow(C.spark, 260);
      T.bumps = [
        new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 60, 3), mat(C.cyan, 0.45)),
        new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), mat(C.magenta, 0.45)),
      ];
      T.bumps[0].rotation.x = Math.PI / 2;
      T.rings = [C.spark, C.coral, C.cyan].map(
        col => new THREE.Mesh(new THREE.TorusGeometry(250, 9, 8, 80), new THREE.MeshBasicMaterial({ color: col, transparent: true })),
      );
      T.rings.forEach(m => m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...LaunchView.w).negate())); // 点火の同心円は最初のカメラに正対
      T.deco = deco.map(d => {
        const geo =
          d.type === 0
            ? new THREE.TetrahedronGeometry(d.size)
            : d.type === 1
              ? new THREE.BoxGeometry(d.size * 1.3, d.size * 1.3, d.size * 1.3)
              : new THREE.TorusGeometry(d.size * 0.8, d.size * 0.14, 8, 32);
        return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: d.color, wireframe: d.type !== 2, transparent: true }));
      });
      [T.left, T.right, T.handle, T.bandL, T.bandR, T.ball, T.glow, ...T.bumps, ...T.rings, ...T.deco].forEach(o => grp.add(o));
      World3D.addSpectrum({ parent: grp, pos: [0, -720, -700], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], size: [2400, 620, 6000] }); // 地面に広がる音の粒（奥へ流れる）
      scene.add(grp);
      this.group = grp;
      this.T = T;
    },
    update(u, o) {
      const T = this.T;
      const omit = o.omitGateObject;
      const tg = StageDefs.T.three.group;
      if (tg) {
        // タイトルの輪のトンネルが視線の奥へ去る
        const k = 2600 * Ease.inCubic(seg(u, 0, 0.35));
        const LV = LaunchView;
        tg.visible = u < 0.35;
        StageDefs.T.three.tunnel.position.set(...LV.L.map((x, i) => x + LV.w[i] * k));
      }
      const TT = StageDefs.T.three; // スタートボタン: 沈んだキャップが発射の瞬間に跳ね上がり、その後しぼんで消える
      if (TT.bgroup) {
        // 発射したらすぐ引っ込む（パチンコの部品が来る前に）
        const charge = seg(u, 0, U_LAUNCH);
        const press = (16 + 10 * charge) * (1 - Ease.outBack(seg(u, U_LAUNCH - 0.015, U_LAUNCH + 0.02)));
        const gone = Ease.inCubic(seg(u, U_LAUNCH + 0.005, U_LAUNCH + 0.04));
        TT.bgroup.visible = u < U_LAUNCH + 0.04;
        TT.ball.visible = TT.glow.visible = false;
        TT.cap.position.y = -56 - press + (u < U_LAUNCH ? 3 * charge * Math.sin(u * 900) : 0); // 溜めている間は震える
        TT.cap.material.emissiveIntensity = 0.45 + 1.4 * charge * (u < U_LAUNCH ? 1 : 0);
        TT.button.scale.setScalar(Math.max(0.001, 1 - gone));
        TT.button.position.set(...LaunchView.G3.map((v, i) => v - LaunchView.d[i] * 160 * gone)); // 沈みながら縮む
      }
      T.rings.forEach((m, i) => {
        // 点火の同心円
        const k = seg(u, i * 0.03, 0.25 + i * 0.05);
        m.visible = k > 0 && k < 1;
        m.position.set(G3[0], G3[1], 0);
        m.scale.setScalar(Math.max(0.001, (Ease.outExpo(k) * (500 + i * 250)) / 250));
        m.material.opacity = 1 - k;
        // 点火の輪のまわりのきらめき
        if (m.visible && Math.random() < 0.8) {
          const q = new THREE.Vector3(1, 0, 0).applyQuaternion(m.quaternion);
          const w = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion);
          const r = 250 * m.scale.x;
          World3D.sparkRing([G3[0], G3[1], 0], q.toArray(), w.toArray(), r, 2, 120, 0.6, 26);
        }
      });
      T.deco.forEach((m, i) => {
        // 横切る飾り
        const d = deco[i];
        const k = seg(u, d.t0, d.t0 + d.len);
        const e = Ease.inOutCubic(k);
        m.visible = k > 0 && k < 1;
        m.position.set(lerp(d.from[0], d.to[0], e), -lerp(d.from[1], d.to[1], e), lerp(d.z0, d.z1, e));
        m.rotation.set(d.spin * k, d.spin * k * 0.7, d.spin * k * 0.4);
        m.material.opacity = Math.sin(Math.PI * k);
      });
      [
        [BUMP1, 0.25, U_B1],
        [BUMP2, 0.3, U_B2],
      ].forEach(([p, a, hit], i) => {
        // 跳ね返り台
        let s = Ease.outBack(seg(u, a, a + 0.1)) * (1 - Ease.inCubic(seg(u, 0.72, 0.86)));
        if (u >= hit) s *= 1 + 0.35 * (1 - seg(u, hit, hit + 0.08));
        const m = T.bumps[i];
        m.visible = s > 0.01;
        m.position.set(p[0], -p[1], 0);
        m.scale.setScalar(Math.max(0.001, s));
        m.rotation.y = u * 4 + i;
      });
      // 部品が奥・横から回転しながら飛来
      const pc = pieces(u);
      const show = u >= U_SL - 0.22 && !omit;
      const set = (grp, pp, from3, rot3) => {
        const k = 1 - (pp[2] === 0 ? 0 : pp[0] / (from3[0] || 1));
        grp.visible = show;
        const f = Math.abs(from3[0]) > 0 ? pp[0] / from3[0] : Math.abs(from3[1]) > 0 ? -pp[1] / from3[1] : 0;
        grp.position.set(grp.userData.home.x + from3[0] * f, grp.userData.home.y + from3[1] * f, grp.userData.home.z + from3[2] * f);
        grp.rotation.set(rot3[0] * f, rot3[1] * f, rot3[2] * f);
        return k;
      };
      set(T.left, pc.left, [-800, 250, 600], [2.0, 0, -2.6]);
      set(T.right, pc.right, [800, 180, -500], [0, 2.0, 2.6]);
      set(T.handle, pc.handle, [0, -800, 400], [-1.5, 0, 1.3]);
      // 光点は重力のある放物線で飛ぶ
      const s3 = spark3(u);
      const landed = u >= U_LAND;
      // 発射まではキャップと一緒に沈んで溜める
      if (u < U_LAUNCH) {
        const ch = seg(u, 0, U_LAUNCH);
        const pr = (16 + 10 * ch) * (1 - Ease.outBack(seg(u, U_LAUNCH - 0.015, U_LAUNCH + 0.02)));
        for (let i = 0; i < 3; i++) s3[i] -= LaunchView.d[i] * pr;
      }
      T.ball.visible = T.glow.visible = !omit;
      T.ball.position.set(...s3);
      T.glow.position.set(...s3);
      T.ball.scale.setScalar(landed ? 1 : 0.7);
      T.glow.scale.setScalar(
        260 * (1 + 0.15 * Beat.pulse) * (u < U_LAUNCH ? 1 + 1.2 * seg(u, 0, U_LAUNCH) : 1 + 1.5 * Math.exp(-(u - U_LAUNCH) * 30)),
      ); // 溜めるほど光が膨らみ、発射で弾ける
      const tip = x => [G3[0] + x, G3[1] + 12, 0];
      T.bandL.visible = T.bandR.visible = show && u >= U_SR;
      if (landed) {
        stretch(T.bandL, tip(-80), s3);
        stretch(T.bandR, tip(80), s3);
      } else {
        stretch(T.bandL, tip(-80), tip(0));
        stretch(T.bandR, tip(0), tip(80));
      }
    },
    camera(u) {
      // 回り込み、最後にパチンコの正面へ
      const d0 = World3D.fitDist(50);
      const e = Ease.inOutCubic(u);
      const yaw = 0.62 * Math.sin(Math.PI * Ease.inOutCubic(seg(u, 0.04, 0.92)));
      const pitch = 0.22 * Math.sin(Math.PI * seg(u, 0.08, 0.88));
      const dist = lerp(d0, d0 / 1.06, e) * (1 + 0.28 * Math.sin(Math.PI * seg(u, 0.05, 0.9)));
      const sp = spark3(u);
      const f = 0.35 * Math.sin(Math.PI * seg(u, U_LAUNCH, U_LAND));
      const zm = Ease.inOutCubic(seg(u, 0.84, 1)); // 操作の直前にパチンコへ寄る（引く余白ぶん下を中心に）
      const look = [sp[0] * f, lerp(lerp(0, -40, e) + (sp[1] - lerp(0, -40, e)) * f, -175, zm), 0];
      const dz = dist * lerp(1, 1.06 / 1.75, zm);
      const orbit = {
        pos: [look[0] + dz * Math.sin(yaw) * Math.cos(pitch), look[1] + dz * Math.sin(pitch), dz * Math.cos(yaw) * Math.cos(pitch)],
        look,
      };
      // 発射の瞬間まではボタンを真横から（玉は画面の真上へ）、跳ね返り台までに回り込みへ
      const side = LaunchView.cam(d0);
      const k = Ease.inOutCubic(seg(u, U_LAUNCH + 0.03, U_B1 + 0.05));
      const up = side.up.map((x, i) => lerp(x, i === 1 ? 1 : 0, k));
      const un = Math.hypot(...up);
      return {
        pos: side.pos.map((x, i) => lerp(x, orbit.pos[i], k)),
        look: side.look.map((x, i) => lerp(x, orbit.look[i], k)),
        up: up.map(x => x / un),
        fov: 50,
        roll: k * 0.05 * Math.sin(Math.PI * seg(u, 0, 0.9)),
      };
    },
    plane: { o: [0, 0, 0], r: [1, 0, 0], d: [0, -1, 0] },
  };

  defineStage('A', {
    // 操作の直前にパチンコへ寄る
    camera(u) {
      const e = Ease.inOutCubic(u);
      const z = Ease.inOutCubic(seg(u, 0.84, 1));
      return Camera.make(0, lerp(40 * e, 175, z), lerp(1 + 0.06 * e, 1.75, z), 0.04 * Math.sin(u * Math.PI));
    },
    events: [
      [
        U_LAUNCH,
        () => {
          FX.addTrauma(0.5);
          FX.kick(0.06);
          FX.shock(G.x, G.y, '#ffffff', 420, 0.3, { width: 18 });
          FX.burst(G.x, G.y, {
            n: 30,
            dir: -Math.PI / 2,
            spread: 0.9,
            colors: [C.spark, '#ffffff', C.coral],
            kinds: ['streak', 'dot'],
            speed: [600, 1600],
            life: [0.25, 0.5],
          });
        },
      ], // 溜めた力で勢いよく発射
      [U_SL, snap(-40, 150)],
      [U_SR, snap(40, 150)],
      [U_SH, snap(0, 250)],
      [U_B1, bounce(P1)],
      [U_B2, bounce(P2)],
      [
        U_LAND,
        () => {
          FX.burst(G.x, G.y, { n: 20, colors: [C.spark, '#ffffff'], speed: [150, 500], life: [0.2, 0.5], size: [4, 10] });
          FX.addTrauma(0.2);
        },
      ],
    ],
    draw(ctx, u, o) {
      // 2D（WebGL が使えないときの予備）
      const t = u * 3;
      drawFlowGrid(ctx, t, C.spark);
      [C.spark, C.coral, C.cyan].forEach((col, i) => {
        const k = seg(u, i * 0.03, 0.25 + i * 0.05);
        if (k <= 0 || k >= 1) return;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = col;
        ctx.lineWidth = 18 * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(G.x, G.y, Ease.outExpo(k) * (500 + i * 250), 0, TAU);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      for (const d of deco) {
        const k = seg(u, d.t0, d.t0 + d.len);
        if (k <= 0 || k >= 1) continue;
        const e = Ease.inOutCubic(k);
        ctx.globalAlpha = Math.sin(Math.PI * k);
        shape(ctx, d.type, lerp(d.from[0], d.to[0], e), lerp(d.from[1], d.to[1], e), d.size, d.spin * k, d.color, false);
      }
      ctx.globalAlpha = 1;
      [
        [BUMP1, 0, 0.25, U_B1, C.cyan],
        [BUMP2, 1, 0.3, U_B2, C.magenta],
      ].forEach(([p, type, a, hit, col]) => {
        let s = Ease.outBack(seg(u, a, a + 0.1)) * (1 - Ease.inCubic(seg(u, 0.72, 0.86)));
        if (u >= hit) s *= 1 + 0.35 * (1 - seg(u, hit, hit + 0.08));
        if (s > 0.01) shape(ctx, type, p[0], p[1], 70 * s, type === 0 ? 0.6 : 0.3, col, true);
      });
      const g = gate();
      const [sx, sy] = sparkPos(u);
      if (!o.omitGateObject && g && u >= U_SL - 0.22)
        GateKinds.pull.paint(ctx, g, sx, sy, { pieces: pieces(u), band: u >= U_SR, slack: u < U_LAND, ball: u >= U_LAND });
      if (u < 0.95) {
        const fade = 1 - seg(u, U_LAND, U_LAND + 0.1);
        drawSpark(ctx, sx, sy, (18 + (u < U_LAUNCH ? 10 * Math.sin(u * 120) : 0)) * fade + 0.01);
      }
    },
    three,
    gate: { x: G.x, y: G.y, dir: -Math.PI / 2, color: C.spark, frame: C.coral }, // Y字の開いた向き（真上）へ発射、下へ引く
  });
})();
