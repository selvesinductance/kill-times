// 区間B 飛翔（3.0–6.5秒）→ G2 滑らせる
// パチンコから放たれた玉を、カメラは追い続ける（場面の切り替えなし）
// 玉は空気抵抗で減速しながら輪をくぐって進む。3D では輪をくぐり始める頃から、行く先に扉のはまった門が組み上がる（扉は開いている）
// → 玉が迫るとセンサーが検知して扉が左右から閉まり、ぶつかる寸前で凍結（扉と枠のすき間から光が漏れ、錠が赤く脈打つ）
// → 解錠すると扉が左右の壁の中へ開き、玉は当たらずにそのまま抜ける（区間C）。2D の代替表示では扉が遠くから飛んでくる
// 3D: 操作は正面から見て下に引く。放した後、カメラが横へ回り込む間に、ゴムは「後ろへ引いた姿勢」へ移り、
//     玉は前（−z、少し上向き）へ飛ぶ。縦に立てた輪をカメラも一緒にくぐり、最後は扉を正面から見て G2
const StageB = (() => {
  // A_END は区間Aのカメラの終わり（操作の直前にパチンコへ寄る）と同じ
  const C = CONFIG.colors;
  const GA = { x: 0, y: 60 };
  const A_ZOOM = 1.75;
  const A_Y = 175;
  const A_END = [0, A_Y, A_ZOOM];
  const DOOR = { x: 0, y: -2380, w: 760, h: 560 };
  const BOTTOM = DOOR.y + DOOR.h / 2;
  // 2D: 発射の速さ・ゴムが縮む時間・玉の半径
  const V = 2600;
  const SNAP = 0.06;
  const BALL = 34;
  const HOOPS = [-300, -520, -740, -960, -1180, -1400, -1620, -1840]; // 輪は8つ（密に）
  const launch = () => {
    const g = Timeline[1].gateObj;
    return g && g.release != null ? g.release : -Math.PI / 2;
  };
  const relOff = () => {
    const g = Timeline[1].gateObj;
    return g && g.relOff ? g.relOff : { x: 0, y: 150 };
  };
  // 2D: 発射の勢いはすぐ落ち、上昇気流（VW）に乗って扉へ
  const VW = 350;
  const K2 = 2.8;
  //     （凍結の瞬間、扉の下面まで約 120 の隙間になる値）

  // 発射からの秒数 t での玉（2Dの座標）
  function ballT(t) {
    const a = launch();
    const off = relOff();
    // ゴムが縮む
    if (t < SNAP) {
      const k = t / SNAP;
      return { x: GA.x + off.x * (1 - k * k), y: GA.y + off.y * (1 - k * k) };
    }
    const ft = t - SNAP;
    const side = Math.cos(a) * V * 0.4; // 放した向きの横ずれは、輪に導かれて中央へ戻る
    const x = (side / 3) * (1 - Math.exp(-3 * ft)) * Math.exp(-0.8 * ft);
    return { x, y: GA.y - ((V - VW) / K2) * (1 - Math.exp(-K2 * ft)) - VW * ft };
  }
  const ball = u => ballT(u * 3.5);
  // 扉は光の奥の遠くから飛んできて、玉の目の前に叩きつけられる（3.25秒）
  const U_DOOR0 = 0.74;
  const U_SLAM = 13 / 14;
  const doorK = u => seg(u, U_DOOR0, U_SLAM); // 0: 遠く → 1: 定位置
  const END_CAM = [0, DOOR.y + 200, 1.0];
  function camera(u) {
    const b = ball(Math.max(0, u - 0.02)); // 玉を少し遅れて追う
    const look = lerp(-260, DOOR.y + 200 - b.y, Ease.inOutCubic(seg(u, 0.45, 0.8)));
    const e = Ease.inOutCubic(seg(u, 0, 0.12));
    const zoom = lerp(A_END[2], lerp(0.9, 1.0, Ease.inOutCubic(seg(u, 0.5, 0.85))), e);
    return Camera.make(lerp(A_END[0], b.x * 0.5, e), lerp(A_END[1], b.y + look, e), zoom, 0.04 * Math.sin(Math.PI * seg(u, 0.05, 0.6)));
  }

  // 扉の絵（2Dの描画と、3Dの扉の前面のテクスチャで共用）
  function doorArt(ctx, u, g, omit) {
    const { x, y, w, h } = DOOR;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rrect(ctx, x - w / 2 + 16, y - h / 2 + 22, w, h, 28);
    ctx.fill();
    ctx.fillStyle = '#1d2140';
    rrect(ctx, x - w / 2, y - h / 2, w, h, 28);
    ctx.fill();
    ctx.strokeStyle = GREY_D;
    ctx.lineWidth = 10;
    rrect(ctx, x - w / 2, y - h / 2, w, h, 28);
    ctx.stroke();
    const leak = 0.55 + 0.1 * Math.sin(u * 40) + 0.2 * Beat.pulse; // 合わせ目と縁から漏れる光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    lineW(ctx, x, y - h / 2 + 10, x, y + h / 2 - 10, 10, hexA(C.spark, 0.5 * leak));
    lineW(ctx, x, y - h / 2 + 10, x, y + h / 2 - 10, 3, hexA('#ffffff', 0.9 * leak));
    for (const sx of [-1, 1])
      lineW(ctx, x + sx * (w / 2 + 4), y - h / 2 + 30, x + sx * (w / 2 + 4), y + h / 2 - 30, 8, hexA(C.spark, 0.35 * leak));
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2 + 30, y - h / 2 + 50, w - 60, 34);
    ctx.rect(x - w / 2 + 30, y + h / 2 - 84, w - 60, 34);
    ctx.clip();
    ctx.fillStyle = hexA(C.cyan, 0.55);
    for (let sx = x - w / 2; sx < x + w / 2 + 40; sx += 44) {
      ctx.beginPath();
      ctx.moveTo(sx, y - h / 2);
      ctx.lineTo(sx + 22, y - h / 2);
      ctx.lineTo(sx - 18, y + h / 2);
      ctx.lineTo(sx - 40, y + h / 2);
      ctx.fill();
    }
    ctx.restore();
    for (const [px, py] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      disc(ctx, x + px * (w / 2 - 34), y + py * (h / 2 - 30), 11, GREY_D);
    if (!omit && g) g.draw(ctx); // 溝とつまみと錠（凍結中はゲートが描く）
  }
  function door(ctx, u, g, omit) {
    // 2D版: 遠くから近づく＝小さい扉が大きくなる
    const k = doorK(u);
    if (k <= 0) return;
    const s =
      lerp(0.05, 1, Ease.inQuad(k)) *
      (1 + 0.04 * Math.exp(-(u - U_SLAM) * 3.5 * 14) * Math.sin((u - U_SLAM) * 3.5 * 40) * (u > U_SLAM ? 1 : 0));
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.translate(DOOR.x, DOOR.y);
    ctx.scale(s, s);
    ctx.translate(-DOOR.x, -DOOR.y);
    doorArt(ctx, u, g, omit);
    ctx.restore();
  }

  // ---- 3D ----
  // 横への回り込み（イーズイン）→ 少し間を置いて 2拍目（1.0秒）に発射                                       // 放した後、カメラが横へ回り込む間は玉を止めておく
  const SWING = 0.2;
  const HOLD = 2 / 7;
  const T0 = HOLD * 3.5;
  // 前（−z）へ 8° 上向き
  const START = [0, -60, 0];
  const TH = 0.14;
  const DIR = [0, Math.sin(TH), -Math.cos(TH)];
  // 3D の発射の速さ・空気抵抗、凍結の瞬間の扉までの隙間
  const V3 = 2600;
  const K3 = 0.25;
  const GAP = 120;
  const s3 = t => (t < SNAP ? 0 : (V3 / K3) * (1 - Math.exp(-K3 * (t - SNAP)))); // 発射からの秒数 t で進んだ距離
  // 放した向きの横ずれ（中央へ戻る）
  const lat = t => {
    const ft = Math.max(0, t - SNAP);
    const side = Math.cos(launch()) * V * 0.4;
    return (side / 3) * (1 - Math.exp(-3 * ft)) * Math.exp(-0.8 * ft);
  };
  const S_FACE = s3(3.5 - T0) + GAP; // 凍結の瞬間、玉は扉の手前 GAP で「ぶつかりそう」
  const at = s => START.map((v, i) => v + DIR[i] * s);
  // 扉の中心（玉は中心より 160 上へ向かう）
  const FACE_Z = at(S_FACE)[2];
  const DC = [0, at(S_FACE)[1] - 160, FACE_Z - 30];
  // 3D の扉: 最初は左右の壁の中に開いている → 玉が迫るとセンサーが検知（扉枠が赤く点滅して「ピピッ」）→ 左右から勢いよく閉まり、U_SLAM で鍵が掛かって少し跳ね返る
  const U_DETECT = 0.85;
  const U_CLOSE0 = 0.895;
  const OPEN_X = 420;
  const shut3 = u => {
    if (u < U_CLOSE0) return 0;
    if (u < U_SLAM) return Ease.inQuad(seg(u, U_CLOSE0, U_SLAM));
    const a = (u - U_SLAM) * 3.5;
    return 1 - 0.04 * Math.exp(-a * 14) * Math.abs(Math.sin(a * 40));
  };
  // 扉のはまった壁（門）の寸法: 開口は扉より 10 大きい。厚み 140 の中に扉が収まる。広さは凍結の構図の外まで（区間Cでカメラが回り込む道はふさがない）
  const OW = DOOR.w / 2 + 10;
  const OH = DOOR.h / 2 + 10;
  const WX = 820;
  const WTOP = 1500;
  const WBOT = 1250;
  const WF = FACE_Z + 50;
  const WBK = FACE_Z - 90;
  const JW = 40;
  // 16分音符（区間Bの u で 1/28）。門は輪をくぐり始める頃（u = 10/28）から組み上がる
  const Q16 = 1 / 28;
  const U_WALL = 10 * Q16;
  const RINGS_S = [500, 950, 1400, 1850, 2300, 2750, 3200, 3650]; // 3D の輪8つ（間隔 450。最後の輪も扉が現れる前にくぐり終える）
  function ball3(u) {
    const t = u * 3.5 - T0;
    const off = relOff();
    const d = Math.hypot(off.x, off.y) || 150;
    const back = [off.x * 0.3, -d * 0.25, d]; // 後ろ（+z）へ引いた姿勢
    if (t < 0) {
      // 回り込む間に、下へ引いた姿勢から後ろへ引いた姿勢へ
      const k = Ease.inCubic(seg(u, 0, SWING));
      const down = [off.x, -off.y, 0];
      const s = 1.5 * Math.sin(u * 300);
      return [0, 1, 2].map(i => START[i] + lerp(down[i], back[i], k) + (i === 0 ? s : 0));
    }
    // ゴムが縮む
    if (t < SNAP) {
      const k = t / SNAP;
      return [0, 1, 2].map(i => START[i] + back[i] * (1 - k * k));
    }
    const p = at(s3(t));
    p[0] += lat(t);
    return p;
  }
  const mixCam = (A, B, k) => ({
    pos: A.pos.map((v, i) => lerp(v, B.pos[i], k)),
    look: A.look.map((v, i) => lerp(v, B.look[i], k)),
    up: A.up.map((v, i) => lerp(v, B.up[i], k)),
  });
  const mat = (color, e = 0.35) => World3D.mat(color, e);
  const TEX = { w: 1024, h: 755 };
  const TK = TEX.w / DOOR.w;

  const three = {
    build(scene) {
      const grp = new THREE.Group();
      const T = {};
      T.ball = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 18), mat(C.spark, 0.8));
      T.glow = World3D.glow(C.spark, 260);
      T.rings = HOOPS.map((hy, i) => {
        // 縦に立てた輪（進路に沿って並ぶ。玉とカメラがくぐる）
        const m = new THREE.Mesh(new THREE.TorusGeometry(190, 16, 12, 64), mat([C.cyan, C.violet, C.magenta][i % 3], 0.4));
        m.material.transparent = true;
        m.position.set(...at(RINGS_S[i]));
        m.rotation.x = -TH;
        return m;
      });
      T.windPos = new Float32Array(70 * 2 * 3); // 追い風（前へ流れる線。扉が閉まると前面で止まる）
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(T.windPos, 3));
      T.wind = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      T.wind.frustumCulled = false;
      T.light = World3D.glow('#ffffff', 1700);
      T.light.position.set(DC[0], DC[1], DC[2] - 700); // 光の出口（扉の奥）
      T.lightCore = new THREE.Mesh(new THREE.CircleGeometry(280, 48), new THREE.MeshBasicMaterial({ color: C.spark }));
      T.lightCore.position.set(DC[0], DC[1], DC[2] - 800);
      T.door = new THREE.Group(); // 行く手をふさぐ扉: 箱 + 前面に扉の絵 + 裏に光の板
      const cv = document.createElement('canvas');
      cv.width = TEX.w;
      cv.height = TEX.h;
      T.texCtx = cv.getContext('2d');
      T.tex = new THREE.CanvasTexture(cv);
      T.halves = [-1, 1].map(side => {
        // 左右2枚（区間Cで中央から割れて開く）
        const h = new THREE.Group();
        const cx = DC[0] + (side * DOOR.w) / 4;
        const box = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w / 2, DOOR.h, 60), mat('#1d2140', 0.15));
        box.position.set(cx, DC[1], DC[2]);
        const fg = new THREE.PlaneGeometry(DOOR.w / 2, DOOR.h);
        const uv = fg.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (side < 0 ? 0 : 0.5) + uv.getX(i) * 0.5);
        const face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: T.tex, transparent: true }));
        face.position.set(cx, DC[1], FACE_Z + 0.5);
        h.add(box, face);
        return h;
      });
      T.rim = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR.w + 20, DOOR.h + 20),
        new THREE.MeshBasicMaterial({
          color: C.spark,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      T.rim.position.set(DC[0], DC[1], FACE_Z - 3); // 扉と枠のすき間から光が漏れて見える
      T.door.add(...T.halves, T.rim);
      // 扉のはまった壁（門）: 輪をくぐり始める頃（u = 10/28）に扉枠と外周の線が引かれ、16分音符ごとに開口のまわりから外へブロックが組み上がる（u 11/28〜19/28）
      // 扉は完成した門の奥から飛んできて開口にはまる。区間Cでは扉が左右の壁の中へ引き込まれる。奥の縦穴は開口からしか見えない
      T.wall = new THREE.Group();
      T.grow = [];
      const slab = (x0, x1, y0, y1, z0, z1, m, axis) => {
        const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
        g.position.set((x0 + x1) / 2, DC[1] + (y0 + y1) / 2, (z0 + z1) / 2);
        T.wall.add(g);
        if (axis) T.grow.push([g, axis]);
        return g;
      };
      const jm = mat('#30355e', 0.3);
      slab(-OW - JW, -OW, -OH - JW, OH + JW, WBK, WF + 24, jm, 'y');
      slab(OW, OW + JW, -OH - JW, OH + JW, WBK, WF + 24, jm, 'y'); // 扉枠（少し手前に出る）
      slab(-OW, OW, OH, OH + JW, WBK, WF + 24, jm, 'x');
      slab(-OW, OW, -OH - JW, -OH, WBK, WF + 24, jm, 'x');
      const neon = (col, op) => World3D.addMat(col, { opacity: op });
      T.neon = neon(C.cyan, 0.7);
      T.edge = neon(C.violet, 0.5);
      // 扉枠の細い光（拍で明滅）
      const NX = OW + JW / 2;
      const NY = OH + JW / 2;
      const NT = 3.5;
      const NZ0 = WF + 24;
      const NZ1 = WF + 25;
      slab(-NX - NT, -NX + NT, -NY - NT, NY + NT, NZ0, NZ1, T.neon, 'y');
      slab(NX - NT, NX + NT, -NY - NT, NY + NT, NZ0, NZ1, T.neon, 'y');
      slab(-NX, NX, NY - NT, NY + NT, NZ0, NZ1, T.neon, 'x');
      slab(-NX, NX, -NY - NT, -NY + NT, NZ0, NZ1, T.neon, 'x');
      // 外周の細い光（これから壁ができる場所を先に示す。何もない空間に立つ門として形が読める）
      const ET = 5;
      const EZ0 = WF + 10;
      const EZ1 = WF + 11;
      slab(-WX, -WX + 2 * ET, -WBOT, WTOP, EZ0, EZ1, T.edge, 'y');
      slab(WX - 2 * ET, WX, -WBOT, WTOP, EZ0, EZ1, T.edge, 'y');
      slab(-WX, WX, WTOP - 2 * ET, WTOP, EZ0, EZ1, T.edge, 'x');
      slab(-WX, WX, -WBOT, -WBOT + 2 * ET, EZ0, EZ1, T.edge, 'x');
      // ブロック（84個を1回の描画で）
      const cols = [-WX, -625, -OW - JW, -215, 0, 215, OW + JW, 625, WX];
      const blocks = [];
      const rows = (ys, cs) => {
        for (let r = 0; r < ys.length - 1; r++) for (const c of cs) blocks.push({ x0: cols[c], x1: cols[c + 1], y0: ys[r], y1: ys[r + 1] });
      };
      rows([OH + JW, 564, 798, 1032, 1266, WTOP], [0, 1, 2, 3, 4, 5, 6, 7]);
      rows([-WBOT, -1020, -790, -560, -OH - JW], [0, 1, 2, 3, 4, 5, 6, 7]);
      rows([-OH - JW, -110, 110, OH + JW], [0, 1, 6, 7]);
      const rnd = rng(7);
      blocks.forEach(b => {
        b.cx = (b.x0 + b.x1) / 2;
        b.cy = (b.y0 + b.y1) / 2;
        b.d = Math.hypot(b.cx, b.cy * 0.8) + rnd() * 150;
        b.dz = rnd() < 0.35 ? 10 : 0;
        b.base = new THREE.Color('#121430').multiplyScalar(0.8 + 0.4 * rnd());
      });
      blocks
        .sort((p, q) => p.d - q.d)
        // 開口に近い順に 9 回（16分音符ごと）
        .forEach((b, i) => {
          b.u0 = (11 + Math.floor((i * 9) / blocks.length)) * Q16;
        });
      T.blocks = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#121430', emissiveIntensity: 0.3, roughness: 0.8, metalness: 0.1 }),
        blocks.length,
      );
      T.blockData = blocks;
      T.flashC = new THREE.Color(C.cyan);
      T.wall.add(T.blocks);
      T.near = World3D.glow(C.spark, 500); // 迫る玉の光が扉の前面に映る（近いほど小さく明るい）
      [T.ball, T.glow, ...T.rings, T.wind, T.light, T.lightCore, T.door, T.near, T.wall].forEach(o => grp.add(o));
      // 飛ぶ道の下を、音の粒の川が玉より速く先へ流れる
      World3D.addSpectrum({
        parent: grp,
        pos: [0, -820, -300],
        x: [1, 0, 0],
        y: [0, Math.cos(TH), Math.sin(TH)],
        z: [0, -Math.sin(TH), Math.cos(TH)],
        size: [2200, 650, 6800],
      });
      scene.add(grp);
      this.group = grp;
      this.T = T;
      this.buildWall(1, 1, false); // 完成した姿（区間Cへ直接飛んだときも壁がある）
    },
    buildWall(u, pu, live) {
      // 門の組み上がり（u で決まる。やり直しても同じ）
      const T = this.T;
      const M = this.tm || (this.tm = new THREE.Matrix4());
      const c = this.tc || (this.tc = new THREE.Color());
      const kL = Ease.outCubic(seg(u, U_WALL, U_WALL + 2 * Q16)); // 扉枠と外周の線が中央から伸びる
      T.grow.forEach(([m, ax]) => {
        m.visible = kL > 0.001;
        m.scale[ax] = Math.max(0.001, kL);
      });
      T.blocks.visible = u >= U_WALL;
      T.blockData.forEach((b, i) => {
        // 手前から押し込まれるように現れ、シアンに光って落ち着く
        const k = clamp((u - b.u0) / (0.9 * Q16));
        const s = k <= 0 ? 0.0001 : lerp(0.3, 1, Ease.outCubic(k));
        const f = k > 0 ? Math.exp(-(u - b.u0) / (0.8 * Q16)) : 0;
        const d = WF + b.dz - WBK + 70 * (1 - Ease.outCubic(k));
        M.makeScale((b.x1 - b.x0) * s, (b.y1 - b.y0) * s, d);
        M.setPosition(b.cx, DC[1] + b.cy, WBK + d / 2);
        T.blocks.setMatrixAt(i, M);
        T.blocks.setColorAt(i, c.copy(b.base).lerp(T.flashC, 0.8 * f));
        if (live && pu < b.u0 && u >= b.u0)
          for (let j = 0; j < 2; j++)
            World3D.spawn({
              p: [b.cx + (Math.random() - 0.5) * (b.x1 - b.x0), DC[1] + b.cy + (Math.random() - 0.5) * (b.y1 - b.y0), WF + 40],
              v: [(Math.random() - 0.5) * 360, (Math.random() - 0.5) * 360, 150 + Math.random() * 350],
              g: [0, 0, 0],
              life: 0.45 + 0.3 * Math.random(),
              size: 70,
              color: [C.cyan, C.violet, '#ffffff'][(i + j) % 3],
              drag: 1.4,
            });
      });
      T.blocks.instanceMatrix.needsUpdate = true;
      if (T.blocks.instanceColor) T.blocks.instanceColor.needsUpdate = true;
    },
    update(u, o) {
      const T = this.T;
      const b = ball3(u);
      const A = StageDefs.A.three;
      const pu = this.lastU == null ? u : this.lastU;
      if (A.group) {
        // パチンコ（区間Aの群れ）は後ろに残る
        A.group.visible = u < 0.6;
        const AT = A.T;
        AT.left.visible = AT.right.visible = AT.handle.visible = AT.bandL.visible = AT.bandR.visible = true;
        [AT.ball, AT.glow, ...AT.rings, ...AT.deco, ...AT.bumps].forEach(m => {
          m.visible = false;
        });
        const tipL = [-80, -48, 0];
        const tipR = [80, -48, 0];
        // 玉がゴムの線を越えるまでは掛かったまま
        if (b[2] > -4) {
          World3D.stretch(AT.bandL, tipL, b);
          World3D.stretch(AT.bandR, tipR, b);
        } else {
          World3D.stretch(AT.bandL, tipL, [0, -48, 0]);
          World3D.stretch(AT.bandR, [0, -48, 0], tipR);
        }
      }
      T.ball.position.set(...b);
      T.glow.position.set(...b);
      T.glow.scale.setScalar(260 * (1 + 0.15 * Beat.pulse));
      const ringFade = 1 - Ease.inOutCubic(seg(u, 0.8, 0.92)); // くぐり終えた輪は消して扉を見せる
      T.rings.forEach(m => {
        m.material.emissiveIntensity = 0.4 + 1.6 * Math.exp(-m.position.distanceTo(T.ball.position) / 140);
        m.material.opacity = ringFade;
        m.visible = ringFade > 0.01;
      });
      // 閉まるまでは追い風が開口を抜けていく
      const sk = shut3(u);
      const closed = u >= U_SLAM;
      const stop = closed ? FACE_Z + 2 : FACE_Z - 900;
      const span = 300 - stop;
      const fast = seg(u, HOLD, HOLD + 0.05) * (1 - seg(u, 0.75, 0.85)); // 輪をくぐる間は速く長い線（速さの印象）
      for (let i = 0; i < 70; i++) {
        // 追い風の線
        const x = ((i * 137) % 700) - 350;
        const y = ((i * 211) % 560) - 280;
        const z0 = 300 - ((u * 3.5 * lerp(1500, 4200, fast) + i * 173) % span);
        const z1 = Math.max(z0 - lerp(110, 420, fast), stop);
        const yb = START[1] + (DIR[1] / -DIR[2]) * (START[2] - z0);
        T.windPos.set([x, yb + y, z0, x, yb + y + (DIR[1] / -DIR[2]) * (z0 - z1), z1], i * 6);
      }
      T.wind.geometry.attributes.position.needsUpdate = true;
      T.wind.material.opacity = 0.35 + 0.3 * fast;
      const nPass = RINGS_S.filter(v => v <= s3(Math.max(0, u * 3.5 - T0))).length; // 輪をくぐるたびに揺れと風切り音
      if (u < this.lastU) this.nPass = nPass;
      const RX = [1, 0, 0];
      const RY2 = [0, Math.cos(TH), Math.sin(TH)];
      // くぐった輪から虹色の粒がはじける
      if (this.nPass != null && nPass > this.nPass && !o.frozen && is3D() && ringFade > 0.5) {
        Sound.sfx('airpass');
        World3D.sparkRing(at(RINGS_S[nPass - 1]), RX, RY2, 200, 60, 700, 0.9, 34);
      }
      if (!o.frozen && u < 0.8)
        // 輪のまわりのきらめき
        T.rings.forEach((m, i) => {
          if (Math.random() < 0.5) World3D.sparkRing(at(RINGS_S[i]), RX, RY2, 196, 1, 60, 0.9, 22);
        });
      this.nPass = nPass;
      this.lastU = u;
      const CT = StageDefs.C.three; // 扉の奥の縦穴（区間C）は、扉の壁がその手前まで来たら出しておく（開いた後に現れて見えないように。壁より先に出すと飛んでくる壁が縦穴を突き抜けて見える）
      // 縦穴は扉が閉まってから（開いている間は開口の向こうは空）
      if (CT && CT.group && CT.T) {
        CT.group.visible = closed;
        CT.T.ball.visible = CT.T.glow.visible = CT.T.wind.visible = false;
      }
      const alarm = u >= U_DETECT; // 検知したら扉枠の光は赤（閉まるまでは速く点滅、閉まった後は拍で脈打つ。解錠すると区間Cがシアンに戻す）
      T.neon.color.set(alarm ? '#ff2d55' : C.cyan);
      T.neon.opacity = alarm && !closed ? (Math.sin(u * 3.5 * TAU * 9) > 0 ? 1 : 0.15) : 0.5 + 0.4 * Beat.pulse;
      this.buildWall(u, u < pu ? u : pu, !o.frozen && is3D());
      T.light.visible = T.lightCore.visible = false; // 輪くぐりの行き先の「太陽のような光」は出さない（扉の縁から漏れる光だけ残す。区間Cで扉が開く瞬間の光には使う）
      T.rim.visible = closed; // 扉と枠のすき間から漏れる光（閉まってから）
      T.rim.material.opacity = 0.55 + 0.2 * Beat.pulse + 0.15 * Math.sin(u * 40);
      T.door.visible = u >= U_CLOSE0 - 0.01; // それまでは壁の中に引き込まれている（見えない）
      T.door.position.set(0, 0, 0);
      T.halves[0].position.x = -OPEN_X * (1 - sk);
      T.halves[1].position.x = OPEN_X * (1 - sk);
      const gap = Math.max(0, b[2] - FACE_Z - 34);
      const nearK = seg(sk, 0.3, 1);
      T.near.visible = nearK > 0;
      T.near.position.set(b[0], b[1], FACE_Z + 3);
      T.near.scale.setScalar(160 + gap * 0.7);
      T.near.material.opacity = clamp(1 - gap / 700, 0, 1) * nearK;
      if (T.door.visible) this.paintDoor(u, o.omitGateObject); // 扉の前面に扉の絵を描く（凍結中は溝とつまみを除く）
    },
    paintDoor(u, omit) {
      const T = this.T;
      const c = T.texCtx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, TEX.w, TEX.h);
      c.setTransform(TK, 0, 0, TK, (DOOR.w / 2) * TK, -(DOOR.y - DOOR.h / 2) * TK);
      doorArt(c, u, Timeline[2].gateObj, omit);
      T.tex.needsUpdate = true;
    },
    camera(u) {
      // 区間Aの終わり（パチンコに寄った構図）から
      const d0 = World3D.fitDist(50);
      const kSide = Ease.inCubic(seg(u, 0, SWING));
      const R = lerp(d0 / A_ZOOM, 1100, kSide);
      const yaw = 1.2 * kSide;
      // パチンコを横から（縦長でもパチンコと玉が画面に入る）
      const side = {
        pos: [R * Math.sin(yaw), lerp(-A_Y, 50, kSide), R * Math.cos(yaw) - 250 * kSide],
        look: [0, lerp(-A_Y, -40, kSide), lerp(0, -20, kSide)],
        up: [0, 1, 0],
      };
      const b = ball3(Math.max(0, u - 0.015));
      // 輪をくぐった瞬間に画角が跳ねて揺れる（速さの印象）
      const tt = u * 3.5 - T0;
      const sNow = s3(Math.max(0, tt));
      const passed = RINGS_S.filter(v => v <= sNow);
      const tPass = passed.length ? SNAP - Math.log(1 - (passed[passed.length - 1] * K3) / V3) / K3 : -9;
      const kick = Math.exp(-Math.max(0, tt - tPass) * 7);
      // 玉のすぐ後ろから追う
      const chase = {
        pos: [b[0] + 50, b[1] + 90 - DIR[1] * 320, b[2] - DIR[2] * 320],
        look: [b[0], b[1] + DIR[1] * 600, b[2] + DIR[2] * 600],
        up: [0, 1, 0],
      };
      const front = { pos: [0, DC[1] + 60, FACE_Z + d0], look: [0, DC[1] + 60, FACE_Z], up: [0, 1, 0] }; // 引いて扉と迫る玉を正面から
      const kChase = Ease.inOutCubic(seg(u, HOLD + 0.02, HOLD + 0.2));
      const kFront = Ease.inOutCubic(seg(u, 0.74, 0.95));
      const c = mixCam(mixCam(side, chase, kChase), front, kFront);
      // 輪をくぐる間の画面の揺れは無し（画角の跳ねだけ）
      return {
        pos: c.pos,
        look: c.look,
        up: c.up,
        fov: lerp(50, 78 + 4 * kick, kChase * (1 - kFront)),
        roll: 0.06 * Math.sin(Math.PI * seg(u, HOLD, 0.6)),
      };
    },
    plane: { o: [0, DC[1] + DOOR.y, FACE_Z + 1], r: [1, 0, 0], d: [0, -1, 0] }, // 扉の前面（平面の (0, DOOR.y) が扉の中心 DC）
  };

  defineStage('B', {
    camera,
    events: [
      [
        0.02,
        () => {
          if (!is3D()) {
            Sound.sfx('whoosh');
            Music.stinger();
          }
        },
      ], // 2D: 発射（派手な和音）
      [
        13 / 14,
        () => {
          // 2D: 玉の目の前に扉が叩きつけられ、鍵が掛かる
          if (is3D()) return;
          FX.addTrauma(0.8);
          FX.kick(0.07);
          Sound.sfx('lock'); // 「ドン」は鳴らさない。鍵の「カ・チッ」だけ
          FX.shock(DOOR.x, DOOR.y, '#ffffff', 900, 0.3, { width: 22 });
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ])
            FX.burst(DOOR.x + (sx * DOOR.w) / 2, DOOR.y + (sy * DOOR.h) / 2, {
              n: 12,
              colors: [C.cyan, '#ffffff'],
              speed: [300, 900],
              life: [0.25, 0.5],
            });
        },
      ],
      [
        HOLD,
        () => {
          if (is3D()) {
            FX.addTrauma(0.45);
            FX.kick(0.05);
            Sound.sfx('whoosh');
            Music.stinger();
          }
        },
      ], // 3D: 発射（派手な和音）
      [
        U_DOOR0,
        () => {
          if (!is3D()) Sound.sfx('whoosh');
        },
      ], // 2D: 扉が遠くから飛んでくる
      [
        U_DETECT,
        () => {
          if (is3D()) Sound.sfx('detect');
        },
      ], // 3D: 扉のセンサーが玉を検知
      [
        13 / 14,
        () => {
          // 3D: 玉の目の前に扉が叩きつけられ、鍵が掛かる
          if (!is3D()) return;
          FX.addTrauma(0.8);
          FX.kick(0.07);
          Sound.sfx('lock'); // 「ドン」は鳴らさない。鍵の「カ・チッ」だけ
          FX.shock(DOOR.x, DOOR.y, '#ffffff', 900, 0.3, { width: 22 });
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ])
            FX.burst(DOOR.x + (sx * DOOR.w) / 2, DOOR.y + (sy * DOOR.h) / 2, {
              n: 12,
              colors: [C.cyan, '#ffffff'],
              speed: [300, 900],
              life: [0.25, 0.5],
            });
        },
      ],
    ],
    draw(ctx, u, o) {
      // 2D（WebGL が使えないときの予備）
      const g = Timeline[2].gateObj;
      const b = ball(u);
      const cam = camera(u);
      drawFlowGrid(ctx, 3 + u * 3.5, C.cyan);
      for (const sx of [-430, 430]) lineW(ctx, sx, 400, sx, DOOR.y + DOOR.h / 2, 8, '#1a2338');
      const span = 400 - BOTTOM; // 上昇気流: 上へ流れる線（扉が閉まると下面で止まる）
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      for (let i = 0; i < 28; i++) {
        const y = 400 - ((u * 3.5 * 1500 + i * 293) % span);
        const x = ((i * 137) % 760) - 380;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + 110, 400));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      HOOPS.forEach((hy, i) => {
        if (hy < BOTTOM + 200) return; // 扉のすぐ下の輪は描かない（凍結中の玉に重なる）
        const glow = Math.exp(-Math.abs(b.y - hy) / 90);
        ctx.save();
        ctx.translate(0, hy);
        ctx.scale(1, 0.26);
        ctx.strokeStyle = glow > 0.05 ? hexA('#ffffff', 0.4 + 0.6 * glow) : hexA([C.cyan, C.violet, C.magenta][i % 3], 0.8);
        ctx.lineWidth = 16 + 20 * glow;
        ctx.beginPath();
        ctx.arc(0, 0, 170 + 30 * glow, 0, TAU);
        ctx.stroke();
        ctx.restore();
      });
      const ga = Timeline[1].gateObj;
      if (ga && cam.y > -1200) GateKinds.pull.paint(ctx, ga, b.x, b.y, { ball: false, slack: b.y < ga.y - 4 });
      door(ctx, u, g, o.omitGateObject);
      for (let i = 12; i >= 1; i--) {
        const p = ball(Math.max(0, u - i * 0.006));
        ctx.globalAlpha = 0.45 * (1 - i / 12);
        disc(ctx, p.x, p.y, 26 * (1 - i / 12) + 4, C.spark);
      }
      ctx.globalAlpha = 1;
      drawSpark(ctx, b.x, b.y, 30);
      disc(ctx, b.x, b.y, BALL, C.spark);
      disc(ctx, b.x - 10, b.y - 10, 10, 'rgba(255,255,255,0.6)');
    },
    three,
    gate: { x: DOOR.x - 40, y: DOOR.y + 20, len: 460, angle: 0, color: C.cyan },
  });
  const END3 = {
    // 区間C（3D）へ渡す終わりの状態
    yz: at(s3(3.5 - T0)),
    vel: DIR.map(v => v * V3 * Math.exp(-K3 * (3.5 - T0 - SNAP))),
    ball: () => ball3(1),
    DC,
    FACE_Z,
  };
  return { END_BALL: () => ball(1), END_CAM, ORIGIN_NEXT: [0, -2400], END3, three }; // 区間C以降の原点（扉の中心が区間Cの (0,20) になる）
})();
