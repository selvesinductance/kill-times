// タイトル（t=0 で凍結、G0 押す）。ロゴの文字は UI が凍結の上に描く
// スタートボタンは「押しボタンを真横から見た姿」。ボタンの軸は光点が最初に飛び出す向き（LaunchView.d）に傾けて置き、
// カメラはその軸を画面の真上にして真横から見る → 押すと光点が画面の真上へ飛び出す（玉の軌道は区間Aのまま）
// 3D: ボタンの奥へ輪のトンネルが続き、ゆっくり回る（2D が使えないときは下の draw と art）
const LaunchView = {}; // 区間Aのファイルが中身を入れる（発射の向き・カメラ・平面）
function sideButton(ctx, x, y, press, C) {
  // 押しボタンを真横から見た絵（2D版）。y は光点の中心
  const top = y + 26 + press;
  ctx.fillStyle = '#2a2d45';
  ctx.beginPath();
  ctx.moveTo(x - 100, top + 60);
  ctx.lineTo(x + 100, top + 60);
  ctx.lineTo(x + 130, top + 130);
  ctx.lineTo(x - 130, top + 130);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = GREY_D;
  rrect(ctx, x - 92, top + 44 - press, 184, 16, 6);
  ctx.fill();
  ctx.fillStyle = C.coral;
  rrect(ctx, x - 70, top, 140, 44 - press, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rrect(ctx, x - 58, top + 6, 116, 8, 4);
  ctx.fill();
  drawSpark(ctx, x, top - 26, 30);
  disc(ctx, x, top - 26, 26, C.spark);
  disc(ctx, x - 8, top - 34, 7, 'rgba(255,255,255,0.6)');
}
defineStage('T', {
  camera: () => Camera.make(0, 0, 1, 0),
  draw(ctx) {
    ctx.strokeStyle = hexA(CONFIG.colors.violet, 0.3);
    ctx.lineWidth = 2;
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.arc(0, 60, 120 + i * 70, 0, TAU);
      ctx.stroke();
    }
  },
  three: {
    build(scene) {
      const C = CONFIG.colors;
      const g = new THREE.Group();
      const cols = [C.violet, C.cyan, C.magenta];
      const V = a => new THREE.Vector3(...a);
      for (let i = 0; i < 12; i++) {
        // 輪のトンネル（軸は視線の向き）
        const m = new THREE.Mesh(new THREE.TorusGeometry(250, 11, 8, 72), new THREE.MeshBasicMaterial({ color: cols[i % 3] }));
        m.position.set(0, 0, -120 - i * 300);
        g.add(m);
      }
      const light = World3D.glow(C.coral, 700); // トンネルの奥の光
      light.position.set(0, 0, -3800);
      g.add(light);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), V(LaunchView.w));
      g.position.set(...LaunchView.L);
      const mat = (col, e) => World3D.mat(col, e, 0.45, 0.2);
      // 押しボタン（軸 = 発射の向き）
      const b = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 44, 40), mat(C.coral, 0.45));
      const shine = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 4, 40), mat('#ffffff', 0.5));
      shine.position.y = 23;
      cap.add(shine);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(92, 92, 16, 40), mat(GREY_D, 0.2));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(100, 130, 70, 40), mat('#2a2d45', 0.2));
      cap.position.y = -56;
      collar.position.y = -86;
      base.position.y = -129;
      b.add(cap, collar, base);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(LaunchView.d));
      b.position.set(...LaunchView.G3);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 18), mat(C.spark, 0.8));
      const glow = World3D.glow(C.spark, 260);
      ball.position.set(...LaunchView.G3);
      glow.position.set(...LaunchView.G3);
      const bg = new THREE.Group();
      bg.add(b, ball, glow);
      const root = new THREE.Group();
      root.add(g, bg);
      scene.add(root); // 区間を離れたら丸ごと隠れる
      Object.assign(this, { group: root, tunnel: g, button: b, cap, bgroup: bg, ball, glow });
    },
    update() {
      const onT = Game.stage.id === 'T';
      const g0 = Timeline[0].gateObj;
      this.group.visible = onT;
      this.bgroup.visible = true;
      this.tunnel.children.forEach((m, i) => {
        m.rotation.z = FX.time * (0.1 + i * 0.02);
      });
      this.cap.position.y = -56 - (g0 && g0.done ? 16 : 0); // 押すとキャップが沈む
      this.ball.position.set(...LaunchView.G3.map((v, i) => v - LaunchView.d[i] * (g0 && g0.done ? 16 : 0)));
      this.glow.position.copy(this.ball.position);
      this.glow.scale.setScalar(260 * (1 + 0.12 * Math.sin(FX.time * 3)));
    },
    camera: () => LaunchView.cam(World3D.fitDist(50)), // ボタンを真横から（画面の真上 = 発射の向き）
    plane: () => LaunchView.plane,
  },
  gate: {
    x: 0,
    y: 100,
    r: 120,
    color: CONFIG.colors.coral,
    art(ctx, g) {
      // ボタンから波紋が広がる（押せる場所のしるし）。ボタン本体は 3D（2D版は横からの絵）
      if (!g.done) {
        for (let i = 0; i < 2; i++) {
          const k = (FX.time * 0.6 + i * 0.5) % 1;
          ctx.globalAlpha = 0.5 * (1 - k);
          ctx.strokeStyle = CONFIG.colors.coral;
          ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath();
          ctx.ellipse(g.x, g.y + 30, 150 * (1 + k * 0.8), 60 * (1 + k * 0.8), 0, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (!World3D.ok) sideButton(ctx, 0, 60, g.done ? 16 : 0, CONFIG.colors);
    },
  },
});
