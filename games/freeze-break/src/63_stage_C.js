// 区間C 落下（6.5–10.0秒）→ G3 切る
// 扉が中央から左右に割れて光があふれる → 玉が光に吸い込まれて縦穴を落ちる（壁のタイルがドミノのように裏返る）
// → 床に着地。斜めに張った縄が滑車ごしに巨大な重りを吊っている
// カメラは原点に置いたまま、世界を上へ流して落下を表す（区間Bの終わりのカメラとつながる）

// 縄の部屋の部品（区間Dでも使う）
const RopeRoom = (() => {
  const C = CONFIG.colors;
  const ROPE = { x: -60, y: 30, len: 820, angle: -0.5 };
  const ca = Math.cos(ROPE.angle);
  const sa = Math.sin(ROPE.angle);
  const h = ROPE.len / 2;
  const LOW = [ROPE.x - ca * h, ROPE.y - sa * h];
  const TOP = [ROPE.x + ca * h, ROPE.y + sa * h];
  const FLOOR = 300;
  const WEIGHT = { x: TOP[0] + 40, y: 90, w: 180, h: 160 };
  const R = {
    C,
    ROPE,
    LOW,
    TOP,
    FLOOR,
    WEIGHT,
    NORMAL: [-sa, ca],
    floor(ctx) {
      ctx.fillStyle = '#261d3a';
      ctx.fillRect(-700, FLOOR, 1400, 70);
      lineW(ctx, -700, FLOOR, 700, FLOOR, 6, hexA(C.magenta, 0.7));
      for (let x = -660; x < 700; x += 80) lineW(ctx, x, FLOOR + 14, x + 40, FLOOR + 56, 4, '#3a2e55');
    },
    bollard(ctx) {
      ctx.fillStyle = GREY_D;
      rrect(ctx, LOW[0] - 28, LOW[1] - 6, 56, FLOOR - LOW[1] + 6, 10);
      ctx.fill();
      disc(ctx, LOW[0], LOW[1], 20, GREY);
    },
    pulley(ctx, spin = 0) {
      ctx.fillStyle = GREY_D;
      ctx.fillRect(TOP[0] - 8, TOP[1] - 400, 16, 400);
      gear(ctx, TOP[0], TOP[1], 44, 12, spin, GREY_D, 6);
      disc(ctx, TOP[0], TOP[1], 16, GREY);
    },
    weight(ctx, y, rot = 0) {
      const { x, w, h } = WEIGHT;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = GREY;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, -h / 2 - 14, 22, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.34, -h / 2);
      ctx.lineTo(w * 0.34, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fillStyle = '#2d2f45';
      ctx.fill();
      ctx.strokeStyle = GREY;
      ctx.lineWidth = 6;
      ctx.stroke();
      drawText(ctx, '10t', 0, 16, 54, GREY, { weight: 900 });
      ctx.restore();
    },
  };
  return R;
})();

(() => {
  const RR = RopeRoom;
  const C = RR.C;
  const DOOR = { w: 760, h: 560, y: 20 };
  const FALL = 2300;
  const O = StageB.ORIGIN_NEXT;
  const scroll = u => FALL * Ease.inOutCubic(seg(u, 0.16, 0.74));
  const split = u => 620 * Ease.outExpo(seg(u, 0, 0.12)); // 弾けるように開く（飛んでくる玉より先に開き切る）
  // 区間Bの終わりの玉（この区間の座標で）
  const bEnd = () => {
    const b = StageB.END_BALL();
    return [b.x - O[0], b.y - O[1]];
  };

  function ball(u) {
    const [x0, y0] = bEnd();
    if (u < 0.2) {
      // 区間Bの終わりの速さ（上へ 350/秒）のまま開いた扉を抜け、光に吸われて頂点へ
      const s = u / 0.2;
      const h00 = 2 * s ** 3 - 3 * s * s + 1;
      const h10 = s ** 3 - 2 * s * s + s;
      const h01 = -2 * s ** 3 + 3 * s * s;
      return [lerp(x0, 0, h01), h00 * y0 + h10 * 0.2 * (-350 * 3.5) + h01 * -40];
    }
    // カメラが玉を追い越して先に縄の部屋へ
    if (u < 0.74) {
      const k = Ease.inOutCubic(seg(u, 0.4, 0.74));
      return [lerp(30 * Math.sin(seg(u, 0.2, 0.74) * 9), 60, k), lerp(lerp(-40, 120, Ease.inOutCubic(seg(u, 0.2, 0.3))), -1300, k)];
    }
    return [60, lerp(-1300, -400, Ease.inQuad(seg(u, 0.74, 1)))]; // 上から落ちてくる玉（床にぶつかる前に G3）
  }

  function doorHalf(ctx, side, dx, dy) {
    // side: -1 左半分 / 1 右半分
    const { w, h, y } = DOOR;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.beginPath();
    ctx.rect(side < 0 ? -w / 2 - 20 : 0, y - h / 2 - 20, w / 2 + 20, h + 40);
    ctx.clip();
    ctx.fillStyle = '#1d2140';
    rrect(ctx, -w / 2, y - h / 2, w, h, 28);
    ctx.fill();
    ctx.strokeStyle = GREY_D;
    ctx.lineWidth = 10;
    rrect(ctx, -w / 2, y - h / 2, w, h, 28);
    ctx.stroke();
    lineW(ctx, 0, y - h / 2, 0, y + h / 2, 8, GREY_D);
    for (const yy of [y - h / 2 + 50, y + h / 2 - 84]) {
      ctx.fillStyle = hexA(C.cyan, 0.55);
      for (let x = -w / 2 + 30; x < w / 2 - 30; x += 44) ctx.fillRect(x, yy, 22, 34);
    }
    const g2 = Timeline[2].gateObj;
    // 解錠済みの溝とつまみ（区間Bの座標で描かれている）
    if (g2) {
      ctx.save();
      ctx.translate(-O[0], -O[1]);
      g2.draw(ctx);
      ctx.restore();
    }
    ctx.restore();
  }

  function tiles(ctx, u, S, by) {
    for (const side of [-1, 1]) {
      for (let ty = 420, i = 0; ty < 2000; ty += 170, i++) {
        const y = ty - S;
        if (y < -1400 || y > 1400) continue;
        const k = seg(by + S - ty, -60, 140);
        const sx = Math.cos(Math.PI * k);
        ctx.save();
        ctx.translate(side * 390, y);
        ctx.scale(sx, 1);
        ctx.fillStyle = k < 0.5 ? hexA(C.magenta, 0.85) : hexA(C.cyan, 0.85);
        ctx.fillRect(-55, -55, 110, 110);
        ctx.restore();
      }
    }
  }

  // ---- 3D: 扉が左右の壁の中へ開いて光があふれる → 玉は当たらずに前へ飛び込み、カメラは玉を追って開口を斜めにくぐってから横へ回り込む
  //      → 光を抜けた先で重力に引かれて縦穴を落ちる（奥の壁のタイルがドミノ状に裏返る）→ 縄の部屋に着地して G3
  // 縄の部屋は x=0 の縦の平面に置き、+x 側から見る。区間Cの2D座標 (x, y) → 3D (0, RY − y, RZ − x)
  // 着地は 2.75秒（8分の格子）
  const G3D = 800;
  const DRAG_T = 0.9; // 前へ進む勢いが空気抵抗で落ちる時定数（秒）。全体の TAU（2π）と名前が重ならないように
  const T_LAND = 2.75;
  const E = StageB.END3;
  const V0 = E.vel;
  const Y0 = E.yz[1];
  const Z0 = E.yz[2];
  const zAt = t => Z0 + V0[2] * DRAG_T * (1 - Math.exp(-t / DRAG_T)); // 前へ進む距離（空気抵抗で進み切る）
  const Z_F = zAt(T_LAND);
  const Y_FRZ = Y0 + V0[1] * 3.5 - 0.5 * G3D * 3.5 * 3.5;
  // 凍結の瞬間、玉はまだ落ちている途中（この区間の座標で (60, −400)、床にぶつかる前に縄を切る）
  const RY = Y_FRZ - 400;
  const RZ = zAt(3.5) + 60;
  const P = (x, y) => [0, RY - y, RZ - x];
  Object.assign(RR, { P3: P, RY, RZ }); // 区間D（3D）も同じ平面の座標を使う
  const loc = p3 => [RZ - p3[2], RY - p3[1]]; // x=0 の点 → この区間の2D座標（FX 用）
  function ball3(u) {
    const t = u * 3.5;
    const x0 = E.ball()[0];
    const x = x0 * Math.exp(-t / 0.4);
    const z = zAt(t);
    return [x, Y0 + V0[1] * t - 0.5 * G3D * t * t, z]; // 床には着かない（落ちている途中で G3）
  }
  const mat = (color, e = 0.3) => World3D.mat(color, e, 0.6);
  // 縦穴は扉より十分奥（手前の端が扉の前面から 400 以上奥）
  const TILE_Z = [-390, -130, 130, 390];
  const TILE_Y = [];
  for (let y = Y0 - 420; y > RY + 1150; y -= 210) TILE_Y.push(y); // 縦穴は玉の通り道より下から
  function burst3(p, n, colors, sp, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - c * c);
      const v = lerp(sp[0], sp[1], Math.random());
      World3D.spawn({
        p: p.slice(),
        v: [s * Math.cos(a) * v, c * v, s * Math.sin(a) * v],
        g: [0, -300, 0],
        life: lerp(life[0], life[1], Math.random()),
        size: 26,
        color: colors[i % colors.length],
        drag: 1.6,
      });
    }
  }

  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      T.ball = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 18), mat(C.spark, 0.8));
      T.glow = World3D.glow(C.spark, 260);
      T.tiles = []; // 縦穴の奥の壁（x = −420、+x を向く）
      TILE_Y.forEach(y =>
        TILE_Z.forEach(dz => {
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(180, 180),
            new THREE.MeshStandardMaterial({
              color: C.magenta,
              emissive: C.magenta,
              emissiveIntensity: 0.35,
              roughness: 0.7,
              side: THREE.DoubleSide,
            }),
          );
          m.position.set(-420, y, Z_F + dz);
          m.rotation.y = Math.PI / 2;
          m.userData = { y, dz };
          T.tiles.push(m);
        }),
      );
      const WT = Y0 - 300;
      const WB = RY - 1200;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(1200, WT - WB), mat('#191530', 0.2));
      wall.position.set(-560, (WT + WB) / 2, Z_F);
      wall.rotation.y = Math.PI / 2; // タイル（x=−420）から十分離す（近いと深度が競ってタイルが欠ける）
      Object.assign(wall.material, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
      const pillars = [-1, 1].map(sd => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(40, WT - WB, 40), mat('#2a2450', 0.25));
        m.position.set(-540, (WT + WB) / 2, Z_F + sd * 600);
        return m;
      });
      // 縄の部屋
      const floor = new THREE.Mesh(new THREE.BoxGeometry(700, 70, 1400), mat('#261d3a', 0.2));
      floor.position.set(-50, RY - 335, RZ);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 1400), new THREE.MeshBasicMaterial({ color: C.magenta }));
      edge.position.set(300, RY - 300, RZ);
      const [lx, ly] = RR.LOW;
      const [tx, ty] = RR.TOP;
      const W = RR.WEIGHT;
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, RR.FLOOR - ly + 6, 16), mat(GREY_D, 0.15));
      bollard.position.set(...P(lx, (ly + RR.FLOOR) / 2));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 10), mat(GREY, 0.2));
      cap.position.set(...P(lx, ly));
      const post = new THREE.Mesh(new THREE.BoxGeometry(16, 400, 16), mat(GREY_D, 0.15));
      post.position.set(...P(tx, ty - 200));
      T.wheel = new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 26, 24), mat(GREY_D, 0.2));
      T.wheel.position.set(...P(tx, ty));
      T.wheel.rotation.z = Math.PI / 2;
      T.weight = new THREE.Mesh(new THREE.CylinderGeometry(W.w * 0.34 * Math.SQRT2, (W.w / 2) * Math.SQRT2, W.h, 4), mat('#2d2f45', 0.25));
      T.weight.position.set(...P(W.x, W.y));
      T.weight.rotation.y = Math.PI / 4;
      const lc = document.createElement('canvas');
      lc.width = 256;
      lc.height = 128;
      const lx2 = lc.getContext('2d');
      lx2.fillStyle = GREY;
      lx2.font = `900 96px ${CONFIG.displayFont || 'sans-serif'}`;
      lx2.textAlign = 'center';
      lx2.textBaseline = 'middle';
      lx2.fillText('10t', 128, 70);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 60),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }),
      );
      label.position.set(W.w * 0.5 + 4, RY - W.y - 16, RZ - W.x);
      label.rotation.y = Math.PI / 2;
      const hang = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 8), mat(shade(C.magenta, -0.2), 0.3));
      World3D.stretch(hang, P(tx + 40, ty), P(W.x, W.y - W.h / 2));
      T.rope = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 10), mat(C.magenta, 0.45));
      World3D.stretch(T.rope, P(lx, ly), P(tx, ty));
      T.windPos = new Float32Array(30 * 6); // 落下中の風切り線（止まった空気の中を落ちるので、画面では上へ流れる）
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(T.windPos, 3));
      T.wind = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      T.wind.frustumCulled = false;
      grp.add(T.wind);
      T.wall = wall;
      T.pillars = pillars;
      Object.assign(T, { floor, edge, label, hang });
      World3D.addSpectrum({ parent: grp, pos: [-540, RY + 850, RZ], x: [0, 0, 1], y: [1, 0, 0], z: [0, 1, 0], size: [720, 150, 1250] }); // 縄の部屋の奥の壁: 音の粒が上から下へ流れ落ちる
      T.shaft = new THREE.Group(); // 縦穴（扉が開いた閃光の中で現れる）
      [...T.tiles, wall, ...pillars].forEach(m => T.shaft.add(m));
      grp.add(T.shaft);
      [T.ball, T.glow, floor, edge, bollard, cap, post, T.wheel, T.weight, label, hang, T.rope].forEach(o => grp.add(o));
      scene.add(grp);
      this.group = grp;
      this.T = T;
    },
    update(u, o) {
      const T = this.T;
      const b = ball3(u);
      const B3 = StageB.three;
      if (B3.group) {
        // 区間Bの扉と光: 扉は左右に割れ、光があふれて消える
        const BT = B3.T;
        B3.group.visible = u < 0.5;
        [BT.ball, BT.glow, BT.near, BT.wind, ...BT.rings].forEach(m => {
          m.visible = false;
        });
        // やり直した回でも描き直す
        if (!BT.painted || u < (this.prevU || 0)) {
          B3.paintDoor(1, false);
          BT.painted = true;
        }
        this.prevU = u;
        BT.door.visible = true;
        BT.door.position.set(0, 0, 0);
        BT.neon.color.set(C.cyan);
        BT.neon.opacity = 0.5 + 0.4 * Beat.pulse; // 解錠したので扉枠の光はシアンに戻る
        const k = 420 * Ease.outExpo(seg(u, 0, 0.12)); // 扉は左右の壁の中へ引き込まれる（壁からはみ出さない幅）
        BT.halves[0].position.x = -k;
        BT.halves[1].position.x = k;
        BT.rim.visible = false;
        BT.lightCore.visible = u < 0.015; // 裏の光の板と円は開いた瞬間（閃光の中）に消す
        BT.light.visible = true; // 扉が開いた瞬間にあふれる光（区間Bでは隠している）
        BT.light.scale.setScalar(1700 + 1300 * Ease.outCubic(seg(u, 0, 0.06)) - 2600 * Ease.inOutCubic(seg(u, 0.06, 0.16))); // 一瞬あふれて引き、玉が飛び込む小さな光として残る（カメラが開口をくぐるので、大きいままだと画面が白くなる）
        BT.light.material.opacity =
          (1 - 0.45 * seg(u, 0.03, 0.12)) * (1 - 0.3 * seg(u, 0.12, 0.2)) * (1 - Ease.inOutCubic(seg(u, 0.16, 0.26))); // カメラが開口をくぐった後は消す
      }
      T.ball.position.set(...b);
      T.glow.position.set(...b);
      T.ball.visible = T.glow.visible = true; // 区間Bの終わりに隠されているので必ず表示し直す
      const cd = World3D.camera ? World3D.camera.position.distanceTo(T.ball.position) : 2000; // 開口をくぐる間はカメラが玉に近いので、光の輪を小さくする（画面が黄色くにじまないように）
      T.glow.scale.setScalar(260 * (1 + 0.15 * Beat.pulse) * clamp(cd / 1300, 0.5, 1));
      T.shaft.visible = true; // 縦穴は区間Bの終わりから出ている
      T.tiles.forEach(m => {
        // 玉が通り過ぎた段から、玉に近い列→外側へドミノ状に裏返る
        const { y } = m.userData;
        const k = seg(y - b[1] - Math.abs(m.position.z - b[2]) * 0.35, 0, 160);
        m.rotation.y = Math.PI / 2 + Math.PI * k;
        const c = k < 0.5 ? C.magenta : C.cyan;
        m.material.color.set(c);
        m.material.emissive.set(c);
      });
      const t = u * 3.5;
      const vy = Math.max(0, G3D * t - V0[1]);
      const fk = clamp(vy / 1400) * (1 - seg(u, 0.85, 1));
      for (let i = 0; i < 30; i++) {
        // 風切り線: 空気に固定した位置を、玉の周りで折り返して使う
        const x = ((i * 137) % 600) - 300;
        const z = b[2] + ((i * 263) % 1000) - 500;
        const y = b[1] - 900 + ((((i * 311 - b[1]) % 1800) + 1800) % 1800);
        const len = 60 + vy * 0.16;
        T.windPos.set([x, y, z, x, y + len, z], i * 6);
      }
      T.wind.geometry.attributes.position.needsUpdate = true;
      T.wind.material.opacity = 0.4 * fk;
      T.wind.visible = fk > 0.02;
      T.rope.visible = !o.omitGateObject;
    },
    camera(u) {
      // 玉を追って扉の開口をくぐり（扉のまわりは壁なので、外を回り込むと玉が壁に隠れる）→ くぐった後で横へ回り込む → 玉より先に縄の部屋へ回り、落ちてくる玉を待つ
      const d0 = World3D.fitDist(50);
      const b = ball3(Math.max(0, u - 0.02));
      // 回り込みながら寄り、開口を斜めにくぐる
      const kF = Ease.inOutCubic(seg(u, 0, 0.12));
      const kIn = Ease.inOutCubic(seg(u, 0.02, 0.16));
      const kSw = Ease.inOutCubic(seg(u, 0.03, 0.3));
      const kR = Ease.inOutCubic(seg(u, 0.17, 0.3));
      const k2 = Ease.inOutCubic(seg(u, 0.5, 0.8));
      // 注視点: 扉 → 玉 →（回り込みながら）玉の少し下の先
      const f0 = [0, E.DC[1] + 60, E.FACE_Z];
      const fp = [0, b[1] - 40, b[2]];
      const fb = [0, b[1] - 100, b[2] - 120];
      const fe = [0, RY, RZ];
      const f = [0, 1, 2].map(i => lerp(lerp(lerp(f0[i], fp[i], kF), fb[i], kSw), fe[i], k2));
      // 開口をくぐる時は玉の 440 後ろ（右の枠から 50 以上離れる）
      const R = lerp(lerp(lerp(d0, 440, kIn), 1500, kR), d0 / 1.05, k2);
      const yaw = (Math.PI / 2) * kSw;
      const el = 0.14 * kSw * (1 - k2);
      const pos = [f[0] + R * Math.sin(yaw) * Math.cos(el), f[1] + R * Math.sin(el), f[2] + R * Math.cos(yaw) * Math.cos(el)];
      return {
        pos,
        look: f,
        up: [0, 1, 0],
        fov: lerp(50, 58, kSw * (1 - k2)) + 10 * Math.sin(Math.PI * seg(u, 0.06, 0.28)),
        roll: 0.04 * Math.sin(Math.PI * seg(u, 0.1, 0.7)),
      };
    },
    plane: { o: [0, RY, RZ], r: [0, 0, -1], d: [0, -1, 0] }, // 縄の部屋（区間Cの2D座標そのまま）
  };

  defineStage('C', {
    origin: O,
    camera: u => {
      // 区間Bの終わりのカメラから、光に吸い込まれる玉を追って中央へ
      const cy = StageB.END_CAM[1] - O[1];
      const e = Ease.inOutCubic(seg(u, 0, 0.2));
      return Camera.make(0, cy * (1 - e), 1 + 0.05 * Ease.inOutCubic(seg(u, 0.74, 1)), 0.05 * Math.sin(Math.PI * seg(u, 0.2, 0.74)));
    },
    three,
    events: [
      [
        0.01,
        () => {
          if (is3D()) return;
          FX.burst(0, 20, { n: 40, colors: ['#ffffff', C.spark], speed: [200, 900], life: [0.3, 0.7], size: [6, 14] });
          FX.addTrauma(0.3);
        },
      ],
      [
        0.2,
        () => {
          if (is3D()) return;
          FX.shock(0, -40, '#ffffff', 420, 0.35, { width: 16 });
          FX.burst(0, -40, { n: 24, colors: ['#ffffff', C.spark], speed: [200, 700], life: [0.3, 0.6] });
        },
      ], // 頂点で光に触れる
      [
        0.74,
        () => {
          if (!is3D()) FX.addTrauma(0.2);
        },
      ],
      [
        0.004,
        () => {
          if (!is3D()) return;
          FX.addTrauma(0.45);
          FX.flash(0.6);
          burst3([0, E.DC[1], E.FACE_Z + 20], 46, ['#ffffff', C.spark, C.cyan], [300, 1300], [0.3, 0.8]);
        },
      ], // 3D: 扉が弾けるように開く
      [
        3 / 14,
        () => {
          if (!is3D()) return;
          const b = ball3(3 / 14);
          const [x, y] = loc(b);
          FX.shock(x, y, '#ffffff', 380, 0.35, { width: 14 });
          burst3(b, 24, ['#ffffff', C.spark], [200, 700], [0.3, 0.6]);
        },
      ], // 3D: 光を抜けて頂点
    ],
    draw(ctx, u, o) {
      const S = scroll(u);
      const sp = Math.sin(Math.PI * seg(u, 0.16, 0.74));
      const [bx, by] = ball(u);
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round'; // 縦穴の風切り線
      for (let i = 0; i < 26; i++) {
        const x = ((i * 173) % 1000) - 500;
        const y = ((((i * 311 - S * 1.6) % 2600) + 2600) % 2600) - 1300;
        ctx.globalAlpha = 0.35 * sp;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 60 + 200 * sp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      lineW(ctx, -470, -S - 2000, -470, FALL - S - 300, 10, '#241f3a'); // 縦穴の壁
      lineW(ctx, 470, -S - 2000, 470, FALL - S - 300, 10, '#241f3a');
      tiles(ctx, u, S, by);
      const k = split(u); // 割れる扉と、あふれる光
      if (k < 700 && S < 1400) {
        const lw = k * 2;
        if (lw > 1) {
          const gr = ctx.createLinearGradient(-lw / 2, 0, lw / 2, 0);
          gr.addColorStop(0, hexA(C.spark, 0));
          gr.addColorStop(0.5, 'rgba(255,255,255,0.95)');
          gr.addColorStop(1, hexA(C.spark, 0));
          ctx.globalAlpha = 1 - seg(u, 0.12, 0.32);
          ctx.fillStyle = gr;
          ctx.fillRect(-lw / 2, -1400 - S, lw, 2800);
          ctx.globalAlpha = 1;
        }
        doorHalf(ctx, -1, -k, -S);
        doorHalf(ctx, 1, k, -S);
      }
      ctx.save();
      ctx.translate(0, FALL - S); // 縄の部屋（落下の終わりに下から上がってくる）
      RR.floor(ctx);
      RR.pulley(ctx);
      lineW(ctx, RR.TOP[0] + 40, RR.TOP[1], RR.WEIGHT.x, RR.WEIGHT.y - RR.WEIGHT.h / 2 - 36, 12, shade(C.magenta, -0.2));
      RR.weight(ctx, RR.WEIGHT.y);
      RR.bollard(ctx);
      const g = Timeline[3].gateObj;
      if (!o.omitGateObject && g) g.draw(ctx); // 斜めの縄（凍結中はゲートが描く）
      ctx.restore();
      drawSpark(ctx, bx, by, 24);
      disc(ctx, bx, by, 26, C.spark);
      disc(ctx, bx - 8, by - 8, 7, 'rgba(255,255,255,0.6)');
    },
    gate: Object.assign({ color: CONFIG.colors.magenta }, RopeRoom.ROPE),
  });
})();
