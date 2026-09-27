// 区間F 解放（17.0–20.0秒）→ リザルト
// 殻が爆散、光の束が回る → これまでの物体（ボタン・パチンコ・つまみ・縄・ダイヤル・コア）のシルエットが順に閃く
// → 文字が渦を巻いて集まり、ロゴ「FREEZE BREAK」になる → 「CLEAR」の判が押される
(() => {
  const C = CONFIG.colors;
  const CORE = { x: 0, y: 100 };
  const LOGO_Y = -40;
  const CLEAR_Y = 90;
  const LOGO = 'FREEZE BREAK';

  function icon(ctx, i, x, y, s) {
    // 白いシルエット
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 70, s / 70);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (i === 0) {
      ctx.arc(0, 0, 50, 0, TAU);
      ctx.fill();
    } else if (i === 1) {
      ctx.moveTo(-40, -40);
      ctx.quadraticCurveTo(-40, 10, 0, 10);
      ctx.quadraticCurveTo(40, 10, 40, -40);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 60);
      ctx.stroke();
    } else if (i === 2) {
      ctx.moveTo(-60, 0);
      ctx.lineTo(60, 0);
      ctx.stroke();
      rrect(ctx, -54, -30, 34, 60, 8);
      ctx.fill();
    } else if (i === 3) {
      ctx.moveTo(-60, 35);
      ctx.lineTo(-8, 5);
      ctx.moveTo(8, -5);
      ctx.lineTo(60, -35);
      ctx.stroke();
    } else if (i === 4) {
      gear(ctx, 0, 0, 55, 12, 0, '#ffffff', 10);
    } else {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        ctx.lineTo(Math.cos(a) * 55, Math.sin(a) * 55);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 3D: 殻が3Dに爆散し、歯車と奥の壁も吹き飛ぶ → 最高に鮮やかな虹色の空に花火が上がる → 光の束と輪が平面に広がる → 文字とシルエットは平面に沿った2Dで上書き
  const MR = MachineRoom;
  const PM = (x, y) => MR.PM(x, y);
  const addMat = col => World3D.addMat(col, { side: THREE.DoubleSide });
  // 花火: 核が弾けた瞬間から打ち上がり、8分音符ごとに奥の空で開く（区間Fの秒 tb に開く。打ち上げは 0.6秒前から。位置は核からの相対）
  const FW = (() => {
    const R = rng(2027);
    const PAL = ['#ff2d55', '#ffd23f', '#3dff8b', '#3fd0ff', '#a066ff', '#ff5ce1', '#ffffff', '#ff8a2b'];
    return [0.5, 0.75, 1.0, 1.0, 1.25, 1.5, 1.75, 2.0, 2.0, 2.25, 2.5, 2.75, 3.0].map((tb, i) => ({
      tb,
      t0: Math.max(0, tb - 0.6),
      x: -2600 - R() * 1800,
      y: -500 + R() * 2500,
      z: (R() - 0.5) * 2600,
      y0: -3300 - R() * 500,
      dz: (R() - 0.5) * 400,
      c1: PAL[i % PAL.length],
      c2: PAL[(i * 3 + 2) % PAL.length],
      n: 85 + Math.floor(R() * 25),
      sp: 1050 + R() * 350,
    }));
  })();
  function burst(f, c3) {
    // 花火が開く: 閃光と、2色の粒の球（3つに1つは尾を引く）
    const P = [f.x, c3[1] + f.y, c3[2] + f.z];
    World3D.spawn({ p: P, v: [0, 0, 0], life: 0.22, size: 520, color: '#ffffff', drag: 0, live: true, mix: 0 });
    for (let i = 0; i < f.n; i++) {
      const zz = 2 * Math.random() - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - zz * zz);
      const v = f.sp * (0.9 + 0.12 * Math.random());
      World3D.spawn({
        p: P,
        v: [rr * Math.cos(th) * v, zz * v, rr * Math.sin(th) * v],
        g: [0, -260, 0],
        life: 1.1 + 0.5 * Math.random(),
        size: 78 + 18 * Math.random(),
        color: i % 2 ? f.c1 : f.c2,
        drag: 1.25,
        live: true,
        mix: 0.12,
        trail: i % 3 === 0 ? { dt: 0.06, life: 0.3, size: 0.5 } : null,
      });
    }
  }
  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      T.pg = new THREE.Group(); // 平面の2D座標（y下向き、z は奥）で置ける入れ物
      T.pg.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0)),
      );
      T.pg.position.set(...PM(CORE.x, CORE.y));
      const wedge = new THREE.BufferGeometry();
      wedge.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, Math.cos(-0.07), Math.sin(-0.07), 0, Math.cos(0.07), Math.sin(0.07), 0]), 3),
      );
      T.beams = [];
      [C.spark, C.magenta, C.cyan].forEach((col, j) => {
        for (let i = j; i < 12; i += 3) {
          const m = new THREE.Mesh(wedge, addMat(col));
          m.scale.setScalar(1800);
          m.userData.i = i;
          T.beams.push(m);
        }
      });
      T.rings = [C.spark, C.cyan, C.magenta, C.violet, C.coral, '#ffffff'].map(
        col => new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), addMat(col)),
      );
      [...T.beams, ...T.rings].forEach(m => T.pg.add(m));
      // 核が弾けた後の空: 最高に鮮やかな虹色（中心のまわりを渦を巻いて回る虹と、放射する光の筋。拍で明るさが脈打つ）
      T.sky = new THREE.Mesh(
        new THREE.SphereGeometry(11000, 64, 32),
        new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 }, k: { value: 0 }, pulse: { value: 0 } },
          vertexShader:
            'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: [
            'uniform float time; uniform float k; uniform float pulse; varying vec3 vDir;',
            'vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }',
            'void main() {',
            '  vec3 d = normalize(vDir);',
            '  float a = atan(d.y, -d.z), r = acos(clamp(-d.x, -1.0, 1.0));', // 画面の中心（−x の向き）のまわりの角度と、中心からの離れ
            '  vec3 col = hue(a / 6.2831853 + r * 1.4 - time * 0.35);', // 渦を巻いて回る虹（彩度は最大）
            '  float ray = 0.5 + 0.5 * sin(a * 16.0 + time * 1.8);', // 放射する光の筋
            '  col *= mix(0.62, 1.0, smoothstep(0.2, 0.8, ray)) * (0.9 + 0.1 * pulse);',
            '  gl_FragColor = vec4(col * k, 1.0);',
            '}',
          ].join('\n'),
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      T.sky.position.set(...PM(CORE.x, CORE.y));
      T.sky.renderOrder = -10;
      grp.add(T.sky);
      T.flash = World3D.glow('#ffffff', 600);
      T.flash.position.set(...PM(CORE.x, CORE.y));
      grp.add(T.pg, T.flash);
      scene.add(grp);
      this.group = grp;
      this.T = T;
    },
    update(u, o) {
      const T = this.T;
      const ET = StageDefs.E.three;
      const DT = StageDefs.D.three;
      const t = u * 3.5;
      if (ET.group && DT.group) {
        ET.update(1, { omitGateObject: true }); // 区間Eの終わりの状態から（区間Dの機械室も揃う）
        ET.group.visible = true;
        const E = ET.T;
        const D = DT.T;
        const c3 = PM(CORE.x, CORE.y);
        E.face.visible = false;
        E.core.visible = false;
        E.panels.forEach((m, i) => {
          // 殻の板が回りながら飛び散る
          const th = i * (Math.PI / 3) + Math.PI / 6;
          const dy = -Math.sin(th);
          const dz = -Math.cos(th);
          const d = 113 + 1400 * t;
          m.visible = t < 1.2;
          m.position.set(c3[0] + 500 * t, c3[1] + dy * d - 300 * t * t, c3[2] + dz * d);
          m.rotation.set(Math.atan2(dz, dy) + 6 * t, 4 * t * (i % 2 ? 1 : -1), 3 * t);
        });
        MR.GEARS.forEach(([x, y], i) => {
          // 歯車も衝撃で吹き飛ぶ
          const L = Math.hypot(x - CORE.x, y - CORE.y);
          const vx = (x - CORE.x) / L;
          const vy = (y - CORE.y) / L;
          const p = PM(x + vx * 1600 * t, y + vy * 1600 * t);
          D.gears[i].position.set(-40 + 700 * t, p[1] - 200 * t * t, p[2]);
          D.hubs[i].visible = false;
          D.gears[i].rotation.set(2 * t, Math.PI / 2 + t, -(i % 2 ? 1 : -1) * (62 + 20 * t), 'XYZ');
          D.gears[i].visible = t < 1.4;
        });
        const gone = u > 0.03; // 回路とダイヤルは衝撃の光で消える
        D.circ.forEach(c => {
          c.segs.forEach(m => {
            m.visible = m.visible && !gone;
          });
          c.a.visible = c.a.visible && !gone;
          c.b.visible = c.b.visible && !gone;
        });
        D.dialBack.visible = false;
        D.dial.visible = false;
        // 奥の壁は衝撃で吹き飛び、虹色の空が現れる
        if (D.back) {
          D.back.visible = t < 0.22;
          D.back.position.x = -120 - 4000 * t - 16000 * t * t;
          D.back.rotation.set(2 * t, Math.PI / 2 + 1.2 * t, 0.7 * t);
          D.back.scale.setScalar(Math.max(0.01, 1 - 3 * t));
        }
        if (D.spec) D.spec.visible = t < 0.05;
      }
      const skyK = Ease.outCubic(seg(u, 0, 0.06)); // 核が弾けた閃光の中で虹色の空に変わる
      T.sky.material.uniforms.k.value = skyK;
      T.sky.material.uniforms.time.value = FX.time;
      T.sky.material.uniforms.pulse.value = Beat.pulse;
      // 花火（区間Fの秒）
      const c3 = PM(CORE.x, CORE.y);
      const ft = u * 3;
      const pt = this.fwT == null || ft < this.fwT ? ft : this.fwT;
      this.fwT = ft;
      if (ft > pt && !o.frozen)
        FW.forEach(f => {
          for (let s = Math.max(pt, f.t0); s < Math.min(ft, f.tb); s += 1 / 90) {
            // 打ち上げの尾（コマ落ちしても途切れない）
            const k = Ease.outCubic(seg(s, f.t0, f.tb));
            World3D.spawn({
              p: [f.x, c3[1] + lerp(f.y0, f.y, k), c3[2] + f.z + f.dz * (1 - k)],
              v: [0, -40, 0],
              g: [0, -120, 0],
              life: 0.3 + 0.15 * Math.random(),
              size: 42,
              color: '#ffe7b0',
              drag: 2,
              live: true,
              mix: 0.1,
            });
          }
          if (pt < f.tb && ft >= f.tb) burst(f, c3);
        });
      const beams = (1 - seg(u, 0.5, 1)) * seg(u, 0, 0.05); // 回る光の束
      // 虹色の空の上では控えめに
      T.beams.forEach(m => {
        m.visible = beams > 0;
        m.rotation.z = (m.userData.i / 12) * TAU + u * 1.2;
        m.material.opacity = 0.35 * beams * (1 - 0.55 * skyK);
      });
      T.rings.forEach((m, i) => {
        // 広がる輪
        const k = seg(u, i * 0.06, 0.45 + i * 0.06);
        m.visible = k > 0 && k < 1;
        m.scale.setScalar(Math.max(1, Ease.outExpo(k) * 1000));
        m.material.opacity = 1 - k;
      });
      const fl = 1 - seg(u, 0, 0.3);
      T.flash.visible = fl > 0;
      T.flash.scale.setScalar(900 * fl + 1);
    },
    overlay(ctx, u) {
      texts(ctx, u);
    },
    camera(u) {
      const d0 = World3D.fitDist(50);
      const e1 = Ease.outExpo(seg(u, 0, 0.25));
      const e2 = Ease.inOutCubic(seg(u, 0.3, 0.75));
      // 爆発で引き、最後は正面・zoom 1（2Dと同じ）
      const zoom = 1.12 - 0.3 * e1 + 0.18 * e2;
      const f = PM(0, lerp(60, 0, e2));
      const R = d0 / zoom;
      const sw = Math.sin(Math.PI * seg(u, 0, 0.7));
      const yaw = Math.PI / 2 - 0.45 * sw;
      const el = 0.15 * sw;
      const pos = [f[0] + R * Math.sin(yaw) * Math.cos(el), f[1] + R * Math.sin(el), f[2] + R * Math.cos(yaw) * Math.cos(el)];
      return { pos, look: f, up: [0, 1, 0], fov: 50, roll: 0.06 * Math.sin(Math.PI * seg(u, 0, 0.5)) };
    },
    plane: { o: MR.PM(0, 0), r: [0, 0, -1], d: [0, -1, 0] },
  };

  defineStage('F', {
    origin: StageB.ORIGIN_NEXT,
    camera: u => {
      const e1 = Ease.outExpo(seg(u, 0, 0.25));
      const e2 = Ease.inOutCubic(seg(u, 0.3, 0.75));
      return Camera.make(0, lerp(60, 0, e2), 1.12 - 0.22 * e1 + 0.1 * e2, 0.06 * Math.sin(Math.PI * seg(u, 0, 0.5))); // 区間Eの終わりから
    },
    events: [
      [
        0.001,
        () => {
          FX.addTrauma(0.5);
          FX.shock(CORE.x, CORE.y, '#ffffff', 1400, 0.5, { width: 50 });
        },
      ],
      [
        6 / 7,
        () => {
          // 「CLEAR」の判は 3.0秒（拍）に押される
          FX.addTrauma(0.35);
          FX.kick(0.05);
          FX.burst(0, CLEAR_Y, {
            n: 40,
            colors: [C.coral, C.spark, '#ffffff'],
            kinds: ['streak', 'dot'],
            speed: [300, 1000],
            life: [0.3, 0.6],
          });
        },
      ],
    ],
    draw(ctx, u) {
      const beams = (1 - seg(u, 0.5, 1)) * seg(u, 0, 0.05); // 回る光の束
      if (beams > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        [C.spark, C.magenta, C.cyan].forEach((col, j) => {
          ctx.fillStyle = hexA(col, 0.22 * beams);
          ctx.beginPath();
          for (let i = j; i < 12; i += 3) {
            const a = (i / 12) * TAU + u * 1.2;
            ctx.moveTo(CORE.x, CORE.y);
            ctx.arc(CORE.x, CORE.y, 1800, a - 0.07, a + 0.07);
            ctx.closePath();
          }
          ctx.fill();
        });
        ctx.restore();
      }
      [C.spark, C.cyan, C.magenta, C.violet, C.coral, '#ffffff'].forEach((col, i) => {
        // 広がる輪
        const k = seg(u, i * 0.06, 0.45 + i * 0.06);
        if (k <= 0 || k >= 1) return;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = col;
        ctx.lineWidth = 30 * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(CORE.x, CORE.y, Ease.outExpo(k) * 1000, 0, TAU);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      drawSpark(ctx, CORE.x, CORE.y, 150 * (1 - seg(u, 0, 0.3)) + 0.01, '#ffffff');
      texts(ctx, u);
    },
    three,
  });

  function texts(ctx, u) {
    // シルエット・粒・ロゴ・判（2Dと3Dの上書きで共用）
    for (let i = 0; i < 6; i++) {
      // これまでの物体が順に閃く
      const k = seg(u, 0.16 + i * 0.06, 0.3 + i * 0.06);
      if (k <= 0 || k >= 1) continue;
      const a = -Math.PI / 2 + (i / 6) * TAU + u * 0.8;
      ctx.globalAlpha = Math.sin(Math.PI * k);
      ctx.shadowColor = 'rgba(14,10,34,0.85)';
      ctx.shadowBlur = 14; // 明るい虹色の上でも形が読めるように
      icon(ctx, i, CORE.x + Math.cos(a) * 340, CORE.y + Math.sin(a) * 340, 60 + 30 * k);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    for (let j = 0; j < 40; j++) {
      // ロゴへ吸い込まれる粒
      const k = seg(u, 0.42 + (j % 8) * 0.02, 0.7 + (j % 8) * 0.02);
      if (k <= 0 || k >= 1) continue;
      const a = (j / 40) * TAU + 3 * k;
      const r = 700 * (1 - Ease.inCubic(k));
      drawSpark(ctx, Math.cos(a) * r, LOGO_Y + Math.sin(a) * r * 0.6, 8, j % 2 ? C.spark : C.cyan);
    }
    ctx.save(); // 渦を巻いて集まる文字
    ctx.font = `400 88px ${CONFIG.displayFont}`;
    const widths = [...LOGO].map(ch => ctx.measureText(ch).width + 4); // 書体が読み込まれたら幅も変わるので毎回測る
    const W = widths.reduce((s, w) => s + w, 0);
    let x = -W / 2;
    [...LOGO].forEach((ch, i) => {
      const w = widths[i];
      const cx = x + w / 2;
      x += w;
      if (ch === ' ') return;
      const k = seg(u, 0.5 + i * 0.02, 0.72 + i * 0.02);
      if (k <= 0) return;
      const e = Ease.outCubic(k);
      const a0 = i * 0.9 + 2;
      const a = a0 + (1 - e) * 2.2;
      const r = 900 * (1 - e);
      const px = lerp(Math.cos(a) * 900, cx, e) + Math.cos(a) * r * 0.1;
      const py = lerp(Math.sin(a) * 900, LOGO_Y, e);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i % 2 ? 1 : -1) * 2.5 * (1 - e));
      ctx.scale(0.3 + 0.7 * Ease.outBack(k), 0.3 + 0.7 * Ease.outBack(k));
      ctx.globalAlpha = Math.min(1, k * 3);
      drawText(ctx, ch, 0, 0, 88, i > 6 ? C.spark : C.ink, { display: true, stroke: 14 }); // 縁取り（虹色の空の上でも読める）
      ctx.restore();
    });
    ctx.restore();
    const s = seg(u, 6 / 7 - 0.05, 6 / 7); // 「CLEAR」の判
    if (s > 0) {
      const sc = lerp(2.2, 1, Ease.outBack(s));
      ctx.save();
      ctx.translate(0, CLEAR_Y);
      ctx.rotate(-0.08);
      ctx.scale(sc, sc);
      ctx.globalAlpha = Math.min(1, s * 2);
      ctx.fillStyle = 'rgba(14,10,34,0.88)';
      rrect(ctx, -150, -44, 300, 88, 12);
      ctx.fill(); // 判の地（虹色の空の上でも読める）
      ctx.strokeStyle = C.coral;
      ctx.lineWidth = 8;
      rrect(ctx, -150, -44, 300, 88, 12);
      ctx.stroke();
      drawText(ctx, 'CLEAR', 0, 4, 60, C.coral, { display: true, letter: 8 });
      ctx.restore();
    }
  }
})();
