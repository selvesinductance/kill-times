// 五門の兵：演出：火花・土ぼこり・煙、画面の光、ブラックホール、バグ（警告ウィンドウ）、演出の後かたづけ
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 効果（火花と土ぼこり） ----------
const FX = [];
const sparkGeo = new THREE.OctahedronGeometry(0.5, 0), puffGeo = new THREE.SphereGeometry(1, 10, 8), poofGeo = new THREE.BoxGeometry(1, 1, 1);
function spawnFx(kind, x, y, z) {
  let f = FX.find((q) => q.life <= 0 && q.kind === kind);
  if (!f) {
    if (FX.length >= 110) return;
    const spark = kind === 'spark';
    const m = new THREE.Mesh(spark ? sparkGeo : kind === 'poof' ? poofGeo : puffGeo, new THREE.MeshBasicMaterial({ color: spark ? 0xfff0b0 : 0xe6d8b8, transparent: true, depthWrite: false, blending: spark ? THREE.AdditiveBlending : THREE.NormalBlending }));
    scene.add(m);
    f = { m, kind, life: 0 };
    FX.push(f);
  }
  const spark = kind === 'spark';
  if (kind === 'poof') {
    f.life = f.max = 0.7 + Math.random() * 0.5;
    f.m.position.set(x, y, z);
    f.m.material.color.setScalar(0.78 + Math.random() * 0.22); // 白〜明るい灰色
    f.vx = (Math.random() - 0.5) * 2.4; f.vy = 1.5 + Math.random() * 2; f.vz = (Math.random() - 0.5) * 2.4;
    f.s0 = 0.7 + Math.random() * 0.8;
    f.m.rotation.set(0, Math.random() * 6, 0);
    f.m.visible = true;
    return;
  }
  f.life = f.max = spark ? 0.35 : 1.2;
  f.m.position.set(x, y, z);
  f.vx = (Math.random() - 0.5) * (spark ? 7 : 3); f.vy = spark ? 2 + Math.random() * 4 : 0.5 + Math.random(); f.vz = (Math.random() - 0.5) * (spark ? 7 : 3);
  f.s0 = spark ? 0.5 + Math.random() * 0.6 : 1.6 + Math.random() * 1.8;
  f.m.visible = true;
}
function updateFx(dt) {
  for (const f of FX) {
    if (f.life <= 0) continue;
    f.life -= dt;
    if (f.life <= 0) { f.m.visible = false; continue; }
    const k = 1 - f.life / f.max;
    f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
    if (f.kind === 'spark') { f.vy -= 14 * dt; f.m.scale.setScalar(f.s0 * (1 - k)); f.m.material.opacity = 1 - k; f.m.rotation.y += dt * 8; }
    else if (f.kind === 'poof') { f.vx *= 1 - dt * 2; f.vz *= 1 - dt * 2; f.m.scale.setScalar(f.s0 * (1 - 0.6 * k)); f.m.material.opacity = 0.95 * (1 - k * k); }
    else { f.m.scale.set(f.s0 * (0.6 + k * 1.8), f.s0 * (0.4 + k), f.s0 * (0.6 + k * 1.8)); f.m.material.opacity = 0.75 * (1 - k); }
  }
}
function clearFx() { FX.forEach((f) => { f.life = 0; f.m.visible = false; }); }

// 画面全体にかぶせる光と影（3D の上、上のバナーの下）
function screenFx(kind) {
  const fl = document.createElement('div');
  fl.className = 'fx-flash ' + kind;
  app.insertBefore(fl, $('hud'));
  setTimeout(() => fl.remove(), 700);
  if (kind === 'bh') { const v = document.createElement('div'); v.className = 'bh-vig'; app.insertBefore(v, $('hud')); }
}

// ---------- ブラックホール：巨大な黒い球へ、たくさんの粒が渦を巻いて吸い込まれていく ----------
const BH_R = 10, BH_Y = 10.5, BH_N = 3200, BH_OUT = 38;
// ブラックホールが出ている間は、空も地面も暗い紫に沈める（粒の光が映える）
const DIM_SKY = new THREE.Color(0x2a1648), DIM_FOG = new THREE.Color(0x1a0d30), BASE_FOG = new THREE.Color(HORIZON);
let worldDim = 0;
function applyDim(d) {
  worldDim = d;
  hemi.intensity = 0.7 * (1 - 0.72 * d);
  sun.intensity = 0.85 * (1 - 0.8 * d);
  fill.intensity = 0.25 * (1 - 0.4 * d);
  sky.material.color.setRGB(1, 1, 1).lerp(DIM_SKY, d);
  scene.fog.color.copy(BASE_FOG).lerp(DIM_FOG, d);
  renderer.setClearColor(scene.fog.color, 1);
}
let dotTex = null, glowTex = null;
const radialTex = (stops) => new THREE.CanvasTexture(canvasOf(64, 64, (x) => {
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
}));
// 粒は4本の腕の根もと（外側の決まった角度）から次々と流れ込むので、流れた跡がそのまま渦の腕になる
function spawnBH(h, i) {
  const far = i % 7 === 0; // 一部は腕に乗らず、遠くの地面や空から飛んでくる
  h.r[i] = far ? BH_OUT * (1 + Math.random() * 0.5) : BH_OUT * (0.9 + Math.random() * 0.1);
  h.a[i] = (i % 4) * (Math.PI / 2) + (Math.random() - 0.5) * (far ? 6.3 : 0.45);
  h.y[i] = (Math.random() - 0.5) * (far ? 22 : 1.4);
  h.v[i] = far ? 0.7 + Math.random() * 0.6 : 0.88 + Math.random() * 0.24;
}
function stepBH(h, i, dt, cr, speed) {
  let r = h.r[i];
  const w = Math.min(12, 3.6 * Math.pow(BH_R / Math.max(r, 2.5), 1.5)) * h.v[i]; // 中心ほど速く回る
  h.a[i] -= w * dt;
  r -= dt * (3 + 80 / Math.max(r, 1)) * h.v[i] * speed; // 中心ほど速く落ちる
  h.y[i] *= Math.exp(-dt * 2.4);
  if (r < cr * 1.02) { spawnBH(h, i); return; }
  h.r[i] = r;
}
function makeHole(g) {
  if (!dotTex) {
    dotTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
    glowTex = radialTex([[0, 'rgba(150,80,255,0.6)'], [0.45, 'rgba(120,60,255,0.35)'], [1, 'rgba(40,10,90,0)']]);
  }
  const grp = new THREE.Group();
  grp.position.set(g.x, BH_Y, g.z);
  grp.rotation.y = Math.atan2(-sold.hx, -sold.hz);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const disk = new THREE.Group();
  disk.rotation.x = 0.8; // 渦の面を後ろ（カメラ）側へ傾けて、巻き込むようすを見せる
  const pos = new Float32Array(BH_N * 3), cols = new Float32Array(BH_N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.25, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.frustumCulled = false;
  disk.add(pts);
  grp.add(glow, disk, core);
  scene.add(grp);
  const h = { grp, core, glow, disk, geo, pos, cols, t: 0, r: new Float32Array(BH_N), a: new Float32Array(BH_N), y: new Float32Array(BH_N), v: new Float32Array(BH_N) };
  // 最初から腕ができているように、それぞれの粒をばらばらの時間だけ先に流しておく
  for (let i = 0; i < BH_N; i++) { spawnBH(h, i); for (let n = Math.floor(Math.random() * 80); n > 0; n--) stepBH(h, i, 0.05, BH_R * 0.5, 1); }
  // 近くのゲートも吸い込む
  h.gates = course.gates.map((gt) => ({ gt, d: Math.hypot(gt.x - g.x, gt.z - g.z), x0: gt.group.position.x, z0: gt.group.position.z })).filter((q) => q.d < 34);
  return h;
}
function updateHole(dt) {
  const h = hole;
  h.t += dt;
  const grow = 1 - Math.pow(1 - Math.min(1, h.t / BH_GROW), 3); // はじめ速く、だんだんゆっくりふくらむ
  const cr = Math.max(0.05, BH_R * grow);
  h.core.scale.setScalar(cr);
  h.glow.scale.setScalar(cr * 3.6 + 0.4);
  const pos = h.pos, cols = h.cols, out = BH_OUT;
  const appear = Math.min(1, h.t / 0.45); // 粒はふっと現れる
  for (let i = 0; i < BH_N; i++) {
    stepBH(h, i, dt, cr, 0.45 + 0.55 * grow);
    const r = h.r[i], j = i * 3;
    pos[j] = r * Math.cos(h.a[i]); pos[j + 1] = h.y[i]; pos[j + 2] = r * Math.sin(h.a[i]);
    // 色：中心のそばは白く熱く、オレンジ・桃色を経て、外ほど紫
    const q = Math.min(1, Math.max(0, (r - cr) / (out - cr)));
    let R, Gc, B;
    if (q < 0.18) { const k = q / 0.18; R = 1; Gc = 0.95 - 0.4 * k; B = 0.8 - 0.65 * k; } // 白 → オレンジ
    else if (q < 0.5) { const k = (q - 0.18) / 0.32; R = 1; Gc = 0.55 - 0.4 * k; B = 0.15 + 0.55 * k; } // → 桃色
    else { const k = Math.min(1, (q - 0.5) / 0.5); R = 1 - 0.55 * k; Gc = 0.15 + 0.05 * k; B = 0.7 + 0.3 * k; } // → 紫
    const br = (1.35 - 0.55 * q) * appear;
    cols[j] = R * br; cols[j + 1] = Gc * br; cols[j + 2] = B * br;
  }
  h.geo.attributes.position.needsUpdate = true;
  h.geo.attributes.color.needsUpdate = true;
  // ゲートは近いものから順に、回りながら縮んで中心へ
  for (const q of h.gates) {
    const k = Math.min(1, Math.max(0, (h.t - 0.5 - q.d * 0.05) / 2.2)), e = k * k;
    if (k <= 0) continue;
    q.gt.sucked = true;
    const gp = q.gt.group;
    gp.position.set(q.x0 + (h.grp.position.x - q.x0) * e, BH_Y * e, q.z0 + (h.grp.position.z - q.z0) * e);
    gp.scale.setScalar(Math.max(0.001, 1 - e));
    gp.rotation.z += dt * 5 * k; gp.rotation.x += dt * 3 * k;
  }
  if (h.t < BH_GROW + 1) shake = Math.max(shake, 0.32 * (1 - h.t / (BH_GROW + 1)) + 0.08); // ふくらむ間、ゆれ続ける
  applyDim(Math.min(1, h.t / 2.1));
}
// ---------- バグ：警告ウィンドウが次々と、どんどん速く出てくる ----------
let errBox = null, errN = 0, errCas = null, errBeep = 0;
const ERR_MSGS = [
  ['警告', '兵士の数が NaN になりました'], ['エラー', '√ の中がマイナスです。実数で計算できません'], ['警告', 'NaN は NaN と等しくありません'],
  ['TypeError', '兵士 is not a number'], ['エラー 0x4E614E', '数ではない数が見つかりました'], ['警告', '虚数の兵士は行進できません'],
  ['エラー', '続行できません'], ['NaN', 'NaN'], ['警告', 'isNaN(兵士) → true'], ['警告', 'ボスの HP − NaN = NaN'],
  ['エラー', 'NaN 人で戦うことはできません'], ['致命的なエラー', '兵士を数えられません'],
];
const WARN_SVG = '<svg class="ic" viewBox="0 0 32 28" aria-hidden="true"><path d="M16 1.6 30.6 26.4H1.4z" fill="#ffd23a" stroke="#141210" stroke-width="1.6" stroke-linejoin="round"/><rect x="14.6" y="9" width="2.8" height="10" rx="1.2" fill="#141210"/><circle cx="16" cy="22.4" r="1.7" fill="#141210"/></svg>';
function updateErrWins(t) {
  if (!errBox) return;
  const want = Math.min(90, Math.floor(2 + 88 * Math.pow(Math.min(1, t / 2.7), 1.9)));
  while (errN < want) spawnErrWin();
}
function spawnErrWin() {
  const aw = app.clientWidth || 800, ah = app.clientHeight || 600, ww = Math.min(300, aw * 0.74), wh = 130, top = reserve.top || 60;
  // ずらしながら重なっていく（ときどき別の場所から始め直す）
  if (!errCas || errCas.x + ww > aw - 4 || errCas.y + wh > ah - 4 || Math.random() < 0.1) {
    errCas = { x: Math.random() * Math.max(8, aw - ww - 80), y: top + Math.random() * Math.max(8, (ah - top) * 0.55 - wh) };
  } else { errCas.x += 24; errCas.y += 24; }
  const [ti, msg] = ERR_MSGS[Math.floor(Math.random() * ERR_MSGS.length)];
  const el = document.createElement('div');
  el.className = 'errwin';
  el.style.left = errCas.x.toFixed(0) + 'px'; el.style.top = errCas.y.toFixed(0) + 'px'; el.style.width = ww.toFixed(0) + 'px';
  el.innerHTML = '<div class="tb"><span>' + esc(ti) + '</span><i>×</i></div><div class="bd">' + WARN_SVG + '<p>' + esc(msg) + '</p></div><div class="ft"><span>OK</span></div>';
  errBox.appendChild(el);
  errN++;
  if (clock - errBeep > 0.06) { errBeep = clock; sfx('beep'); }
}
function cleanupEffects() {
  if (hole) { scene.remove(hole.grp); hole.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); hole = null; }
  app.classList.remove('glitch');
  const sc = $('scan'); if (sc) sc.remove();
  if (errBox) { errBox.remove(); errBox = null; }
  stopBhSound();
  errN = 0; errCas = null;
  if (worldDim) applyDim(0);
  app.querySelectorAll('.fx-flash, .bh-vig, .slash-fx').forEach((e) => e.remove());
  pops.splice(0).forEach((p) => p.a.remove());
  clearFx();
  shake = 0;
}
