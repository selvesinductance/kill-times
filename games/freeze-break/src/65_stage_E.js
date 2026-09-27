// 区間E 充填（13.5–17.0秒）→ G5 連打
// ダイヤルが唸りを上げて高速回転 → 回路を光が走って中心へ → 渦を巻いて光が集まり、光点が膨らむ
// → 六角形の殻が組み上がってコアになる → 殻にひびが1本入る
(() => {
  const MR = MachineRoom;
  const C = MR.C;
  const CORE = MR.DIAL;
  const extra = u => 90 * Ease.inCubic(seg(u, 0, 0.7)) + 30 * seg(u, 0.7, 1); // ダイヤルの追加回転

  // ---- 3D: 区間Dの機械室をそのまま使う。歯車が加速し、回路を光が走り、3Dの渦を巻いて光が集まる
  //      → 六角柱の殻が6枚の板から組み上がってコアになる（正面の絵はゲートの2Dの絵。凍結中はゲートが描く）
  const TEXN = 512;
  const SPAN = 460;
  const KK = TEXN / SPAN;
  const APO = 130 * Math.cos(Math.PI / 6);
  const mat = (color, e = 0.3) => World3D.mat(color, e, 0.5, 0.2);
  const V3 = (dx, dy) => [0, -dy, -dx]; // 平面の2Dの向き → 3D の向き
  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      T.spark = World3D.sparkles(260, grp); // 歯車を回した直後の光（回路を走る光と、渦を巻いて集まる光）: ぼんやりした光の玉ではなく、くっきりしたきらめく粒で
      T.core = World3D.glow(C.spark, 200);
      T.panels = Array.from({ length: 6 }, () => new THREE.Mesh(new THREE.BoxGeometry(130, 16, 132), mat('#2d2250', 0.35)));
      const cv = document.createElement('canvas');
      cv.width = cv.height = TEXN;
      T.cctx = cv.getContext('2d');
      T.ctex = new THREE.CanvasTexture(cv);
      T.face = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), new THREE.MeshBasicMaterial({ map: T.ctex, transparent: true }));
      [T.core, ...T.panels, T.face].forEach(o => grp.add(o));
      scene.add(grp);
      this.group = grp;
      this.T = T;
    },
    update(u, o) {
      const T = this.T;
      const DT = StageDefs.D.three;
      const c3 = MR.PM(CORE.x, CORE.y);
      const spinUp = Ease.inCubic(seg(u, 0, 0.7));
      if (DT.group) {
        // 区間Dの機械室: 歯車が加速し、ダイヤルは縮みながら消える
        const K = DT.T;
        DT.update(1, { omitGateObject: true }); // 区間Dの終わりの状態に揃える（途中から始めても歯車・回路がそろう）
        DT.group.visible = true;
        MR.GEARS.forEach(([, , , , dir], i) => {
          K.gears[i].rotation.z = -dir * (6 + u * 4 + 50 * spinUp);
        });
        const fade = 1 - seg(u, 0.55, 0.72);
        const g4 = Timeline[4].gateObj;
        K.dial.visible = fade > 0;
        K.dialBack.visible = fade > 0;
        if (fade > 0 && g4) {
          const s0 = g4.spin;
          const x = K.dctx;
          const DK = 512 / 620;
          g4.spin = s0 + extra(u);
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.clearRect(0, 0, 512, 512);
          x.setTransform(DK, 0, 0, DK, (310 - CORE.x) * DK, (310 - CORE.y) * DK);
          g4.draw(x);
          K.dtex.needsUpdate = true;
          g4.spin = s0;
          const sc = 0.3 + 0.7 * fade;
          K.dial.scale.setScalar(sc);
          K.dial.material.opacity = fade;
          K.dialBack.scale.set(sc, 1, sc);
        }
      }
      T.spark.begin();
      MR.CIRCUITS.forEach((pts, i) =>
        [0, 0.18].forEach(off => {
          // 回路を走る光: くっきりした粒の頭と、短い尾（1本に 8 粒）
          const k = seg(u, 0.08 + i * 0.05 + off, 0.4 + i * 0.05 + off);
          if (k <= 0 || k >= 1) return;
          for (let j = 0; j < 8; j++) {
            const kk = Ease.inCubic(k) - j * 0.01;
            if (kk < 0) break;
            const [x, y] = MR.pointAt(pts, kk);
            const p = MR.PM(x, y);
            T.spark.add([-80, p[1], p[2]], j ? 44 - j * 4 : 72, j % 3 === 1 ? '#ffffff' : C.spark, 1 - j * 0.1, 0.35);
          }
        }),
      );
      const NV = 96; // 3Dの渦を巻いて集まる光（奥行きにも揺れる。前の 28 個から 96 粒に）
      for (let j = 0; j < NV; j++) {
        const k = seg(u, 0.25 + (j % 12) * 0.016, 0.7 + (j % 12) * 0.016);
        if (k <= 0 || k >= 1) continue;
        const a = (j / NV) * TAU + 2.5 * k * TAU;
        const r = (500 + 120 * (((j * 37) % 11) / 10)) * (1 - Ease.inCubic(k));
        const p = MR.PM(CORE.x + Math.cos(a) * r, CORE.y + Math.sin(a) * r);
        T.spark.add(
          [260 * (1 - k) * Math.sin(a * 1.5 + j), p[1], p[2]],
          44 + 20 * k,
          [C.violet, C.cyan, '#ffffff'][j % 3],
          Math.min(1, k * 5),
          0.5,
        );
      }
      T.spark.end();
      const grow = Ease.inOutCubic(seg(u, 0.3, 0.8)); // 光点が膨らむ
      T.core.position.set(20, c3[1], c3[2]);
      T.core.scale.setScalar((26 + 60 * grow) * 5 * (1 + 0.1 * Beat.pulse));
      const k = seg(u, 0.6, 0.8);
      const ok = Math.max(0.01, Ease.outBack(k));
      const spin = (1 - k) * 1.5;
      const show = k > 0 && !o.omitGateObject;
      T.panels.forEach((m, i) => {
        // 六角柱の殻: 6枚の板が外から回りながら組み上がる
        m.visible = k > 0;
        const th = i * (Math.PI / 3) + Math.PI / 6 + spin;
        const rad = V3(Math.cos(th), Math.sin(th));
        const d = APO * (1 + 2.5 * (1 - Ease.outCubic(k)));
        m.position.set(c3[0] + rad[0] * d - 10, c3[1] + rad[1] * d, c3[2] + rad[2] * d);
        m.rotation.set(Math.atan2(rad[2], rad[1]), 0, 0);
      });
      T.face.visible = show; // 正面の絵（ゲートの2Dの絵。ひびは 0.86 で入る）
      if (show) {
        const g5 = Timeline[5].gateObj;
        const x = T.cctx;
        if (g5) {
          const h0 = g5.hits;
          g5.hits = u < 6 / 7 ? -1 : 0;
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.clearRect(0, 0, TEXN, TEXN);
          x.setTransform(KK, 0, 0, KK, (SPAN / 2 - CORE.x) * KK, (SPAN / 2 - CORE.y) * KK);
          g5.draw(x);
          T.ctex.needsUpdate = true;
          g5.hits = h0;
        }
        T.face.position.set(c3[0] + 70, c3[1], c3[2]);
        T.face.rotation.set(-spin, Math.PI / 2, 0, 'XYZ');
        T.face.scale.setScalar(ok);
        T.face.material.opacity = Math.min(1, k * 1.5);
      }
    },
    camera(u) {
      const d0 = World3D.fitDist(50);
      const e = Ease.inOutCubic(seg(u, 0.4, 0.9));
      const zoom = 1.04 + 0.08 * e;
      // 充填の間は回り込み、最後は正面
      const f = MR.PM(0, 60 * e);
      const R = d0 / zoom;
      const yaw = Math.PI / 2 + 0.3 * Math.sin(Math.PI * seg(u, 0.02, 0.85));
      return {
        pos: [f[0] + R * Math.sin(yaw), f[1], f[2] + R * Math.cos(yaw)],
        look: f,
        up: [0, 1, 0],
        fov: 50,
        roll: 0.03 * Math.sin(Math.PI * seg(u, 0, 0.8)),
      };
    },
    plane: { o: MR.PM(0, 0), r: [0, 0, -1], d: [0, -1, 0] },
  };

  defineStage('E', {
    origin: StageB.ORIGIN_NEXT,
    camera: u => {
      const e = Ease.inOutCubic(seg(u, 0.4, 0.9));
      return Camera.make(0, 60 * e, 1.04 + 0.08 * e, 0.03 * Math.sin(Math.PI * seg(u, 0, 0.8))); // 区間Dの終わり (0,0,1.04,0) から
    },
    events: [
      [1 / 14, () => FX.addTrauma(0.2)],
      [
        5 / 7,
        () => {
          FX.shock(CORE.x, CORE.y, C.violet, 380, 0.3, { width: 18 });
          FX.addTrauma(0.25);
        },
      ],
      [
        6 / 7,
        () => {
          FX.burst(CORE.x, CORE.y, {
            n: 16,
            colors: [C.violet, '#ffffff'],
            kinds: ['streak', 'dot'],
            speed: [200, 600],
            life: [0.2, 0.4],
            size: [4, 9],
          });
          FX.addTrauma(0.3);
        },
      ],
    ],
    draw(ctx, u, o) {
      const spinUp = Ease.inCubic(seg(u, 0, 0.7));
      MR.gears(ctx, () => 1, 6 + u * 4 + 50 * spinUp); // 背景の歯車も速くなる
      MR.circuits(ctx, () => 1);
      MR.CIRCUITS.forEach((pts, i) => {
        // 回路を走る光
        for (const off of [0, 0.18]) {
          const k = seg(u, 0.08 + i * 0.05 + off, 0.4 + i * 0.05 + off);
          if (k <= 0 || k >= 1) continue;
          const [x, y] = MR.pointAt(pts, Ease.inCubic(k));
          drawSpark(ctx, x, y, 16, C.spark);
        }
      });
      const fade = 1 - seg(u, 0.55, 0.72); // ダイヤルは縮みながら消える
      const g4 = Timeline[4].gateObj;
      if (g4 && fade > 0) {
        const s0 = g4.spin;
        const sc = 0.3 + 0.7 * fade;
        g4.spin = s0 + extra(u);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(CORE.x, CORE.y);
        ctx.scale(sc, sc);
        ctx.translate(-CORE.x, -CORE.y);
        g4.draw(ctx);
        ctx.restore();
        g4.spin = s0;
      }
      for (let j = 0; j < 28; j++) {
        // 渦を巻いて集まる光
        const k = seg(u, 0.25 + (j % 7) * 0.03, 0.7 + (j % 7) * 0.03);
        if (k <= 0 || k >= 1) continue;
        const a = (j / 28) * TAU + 2.5 * k * TAU;
        const r = 560 * (1 - Ease.inCubic(k));
        drawSpark(ctx, CORE.x + Math.cos(a) * r, CORE.y + Math.sin(a) * r, 10 + 6 * k, j % 2 ? C.violet : C.cyan);
      }
      const grow = Ease.inOutCubic(seg(u, 0.3, 0.8)); // 光点が膨らむ
      drawSpark(ctx, CORE.x, CORE.y, 26 + 60 * grow, C.spark);
      // 殻が組み上がる（凍結中はゲートが描く）
      const g5 = Timeline[5].gateObj;
      const k = seg(u, 0.6, 0.8);
      if (!o.omitGateObject && g5 && k > 0) {
        const h0 = g5.hits;
        const sc = Math.max(0.01, Ease.outBack(k));
        g5.hits = u < 6 / 7 ? -1 : 0; // ひびは 3.0秒で入る
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.translate(CORE.x, CORE.y);
        ctx.scale(sc, sc);
        ctx.rotate((1 - k) * 1.5);
        ctx.translate(-CORE.x, -CORE.y);
        g5.draw(ctx);
        ctx.restore();
        g5.hits = h0;
      }
    },
    three,
    gate: { x: CORE.x, y: CORE.y, r: 130, color: CONFIG.colors.violet },
  });
})();
