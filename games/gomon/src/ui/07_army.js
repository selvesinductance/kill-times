// 五門の兵：兵士：並び方と旗、毎フレームの動き、欄干に当たったときのゆれ
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 兵士 ----------
const MAXU = 1200;
const bodyGeo = new THREE.CylinderGeometry(0.2, 0.27, 0.78, 8); bodyGeo.translate(0, 0.39, 0);
const headGeo = new THREE.SphereGeometry(0.2, 10, 8); headGeo.translate(0, 0.98, 0);
const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 4); poleGeo.translate(-0.24, 1.2, 0);
const flagGeo = new THREE.PlaneGeometry(0.55, 0.36); flagGeo.translate(0.04, 1.62, 0);

// ヘルメット（頭の上半分をおおう丸い帽子と、つば）
const helmetGeo = mergeGeos([
  new THREE.SphereGeometry(0.228, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.0, 0),
  new THREE.CylinderGeometry(0.262, 0.262, 0.035, 16).translate(0, 1.0, 0),
]);
// 文字入りの旗は、表と裏の2枚を背中合わせにして、どちらから見ても文字が正しく読めるようにする
const flag2Geo = mergeGeos([new THREE.PlaneGeometry(0.55, 0.36).translate(0.04, 1.62, 0), new THREE.PlaneGeometry(0.55, 0.36).rotateY(Math.PI).translate(0.04, 1.62, 0)]);
const softMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
const bodies = new THREE.InstancedMesh(bodyGeo, softMat(), MAXU);
const heads = new THREE.InstancedMesh(headGeo, softMat(), MAXU);
const helmets = new THREE.InstancedMesh(helmetGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2 }), MAXU);
const poles = new THREE.InstancedMesh(poleGeo, softMat(), MAXU);
const flagMat = softMat(); flagMat.side = THREE.DoubleSide;
const flags = new THREE.InstancedMesh(flagGeo, flagMat, MAXU);
// 百万人隊（10⁶）の旗だけは虹色：流れる虹の模様を貼った別の旗
const flagsRB = new THREE.InstancedMesh(flagGeo, new THREE.MeshBasicMaterial({ map: RAINBOW, side: THREE.DoubleSide }), MAXU);
[bodies, heads, helmets, poles, flags, flagsRB].forEach((m) => {
  m.setColorAt(0, WHITE); // 色つきの描き方で最初から組み立てておく
  m.count = 0; m.frustumCulled = false; scene.add(m);
});
const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 28), MAT.blob);
blob.rotation.order = 'YXZ';
blob.rotation.x = -Math.PI / 2;
scene.add(blob);
const sold = { x: 0, y: 0, z: RIVER.WAIT, tx: 0, hx: 0, hz: -1, lean: 0, moving: false, n: 5n, units: [], bw: 0, bd: 0, suck: 0, holeX: 0, holeY: 0, holeZ: 0 };
const C_POS = new THREE.Color(0x2f6bd8), C_POS2 = new THREE.Color(0x6aa2f5), C_NEG = new THREE.Color(0xa24ad8), C_NEG2 = new THREE.Color(0xd8a4f7);
function layoutUnits() {
  const groups = unitsFor(sold.n);
  const rows = [];
  let row = [], rowW = 0, rowD = 0, total = 0;
  const maxW = (course ? course.geo.colW : RIVER.BW) - 2;
  for (const gp of groups) {
    const s = 1.6 * Math.pow(1.2, Math.min(gp.tier, 8)); // 1桁上がるごとに 1.2 倍、k = 8 で頭打ち
    const sp = 0.62 * s;
    for (let k = 0; k < gp.count && total < MAXU; k++, total++) {
      if (rowW + sp > maxW && row.length) { rows.push({ row, rowW, rowD }); row = []; rowW = 0; rowD = 0; }
      row.push({ tier: gp.tier, s, ox: rowW + sp / 2 });
      rowW += sp; rowD = Math.max(rowD, sp * 1.05);
    }
  }
  if (row.length) rows.push({ row, rowW, rowD });
  const units = [];
  let z = 0, bw = 0;
  for (const r of rows) {
    for (const u of r.row) units.push({ tier: u.tier, s: u.s, ox: u.ox - r.rowW / 2, oz: z + r.rowD / 2, ph: Math.random() * 6.28 });
    z += r.rowD;
    bw = Math.max(bw, r.rowW);
  }
  sold.units = units;
  sold.bw = bw; sold.bd = z;
  const neg = sold.n < 0n;
  let f = 0, pl = 0, rb = 0;
  for (const L of LFLAGS.values()) L.mesh.count = 0;
  units.forEach((u, i) => {
    const k = Math.min(u.tier, 8) / 8;
    col.copy(neg ? C_NEG : C_POS).lerp(neg ? C_NEG2 : C_POS2, k * 0.8);
    bodies.setColorAt(i, col);
    col.setHex(neg ? 0xeedcff : 0xf3d2a8);
    heads.setColorAt(i, col);
    col.setHex(neg ? 0x6a2a9a : 0x1f4fa8);
    helmets.setColorAt(i, col);
    if (u.tier > 0) {
      col.setHex(0x5a4a2a); poles.setColorAt(pl, col);
      u.pi = pl++;
      if (u.tier === 6) { flagsRB.setColorAt(rb, WHITE); u.ri = rb++; }
      else if (u.tier >= 7) { const L = labeledFlag(u.tier); u.lk = L; u.li = L.mesh.count++; }
      else { flagColor(u.tier); flags.setColorAt(f, col); u.fi = f++; }
    }
  });
  bodies.count = heads.count = helmets.count = units.length;
  pruneLabeledFlags();
  poles.count = pl;
  flags.count = f;
  flagsRB.count = rb;
  [bodies, heads, helmets, poles, flags, flagsRB].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
}
// k ≧ 7 の黒い旗：地は rgb(k,k,k)、そこに「10ᵏ」を白い文字・赤い縁取りで書く（k ごとに1枚の旗の絵を作って使い回す）
const LFLAGS = new Map();
function labeledFlag(k) {
  let L = LFLAGS.get(k);
  if (L) return L;
  const c = canvasOf(128, 84, (x) => {
    const v = Math.min(255, k);
    x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    x.fillRect(0, 0, 128, 84);
    const font = (px) => '700 ' + px.toFixed(1) + 'px "BIZ UDPGothic", "Noto Sans JP", sans-serif';
    const ks = String(k);
    let big = 44, small = 28;
    x.font = font(big); let w1 = x.measureText('10').width || 50;
    x.font = font(small); let w2 = x.measureText(ks).width || 20;
    const sc = Math.min(1, 112 / (w1 + w2 + 2));
    big *= sc; small *= sc; w1 *= sc; w2 *= sc;
    const x0 = (128 - (w1 + w2 + 2)) / 2, base = 42 + big * 0.36;
    x.lineJoin = 'round';
    for (const pass of ['line', 'ink']) {
      x.fillStyle = '#ffffff'; x.strokeStyle = '#e0262b';
      x.font = font(big); x.lineWidth = Math.max(3, big * 0.16);
      if (pass === 'line') x.strokeText('10', x0, base); else x.fillText('10', x0, base);
      x.font = font(small); x.lineWidth = Math.max(2.5, small * 0.16);
      if (pass === 'line') x.strokeText(ks, x0 + w1 + 2, base - big * 0.42); else x.fillText(ks, x0 + w1 + 2, base - big * 0.42);
    }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(flag2Geo, mat, 9); // 1つの桁の旗は多くても9本
  mesh.count = 0; mesh.frustumCulled = false;
  scene.add(mesh);
  L = { k, mesh, mat, tex };
  LFLAGS.set(k, L);
  return L;
}
function pruneLabeledFlags() {
  if (LFLAGS.size <= 120) return;
  for (const [k, L] of LFLAGS) if (!L.mesh.count) { scene.remove(L.mesh); L.mat.dispose(); L.tex.dispose(); LFLAGS.delete(k); }
}
// 10ᵏ人隊の旗の色：白 → 緑 → 青 → 紫 → 金 →（虹）→ rgb(k,k,k)（k ≧ 7、だんだん明るく）→ 255 からはずっと白
const FLAG_COL = [0xffffff, 0xffffff, 0x3fbf5a, 0x3b82f0, 0xa45cf2, 0xf0c869];
function flagColor(k) {
  if (k <= 5) return col.setHex(FLAG_COL[k]);
  const v = Math.min(255, k) / 255;
  return col.setRGB(v, v, v);
}
function setArmy(n) { sold.n = n; layoutUnits(); updateCount(); }
function drawArmy(time) {
  const running = sold.moving;
  const hx = sold.hx, hz = sold.hz, rx = -hz, rz = hx;
  const yaw = Math.atan2(hx, hz) - Math.PI, bo = bumpOffset();
  sold.units.forEach((u, i) => {
    const ox = u.ox + bo * (0.6 + 0.4 * Math.abs(u.ox) / (sold.bw / 2 + 0.5)); // 欄干に当たったときは、外側の兵士ほど大きくゆれる
    let x = sold.x + rx * ox - hx * u.oz, z = sold.z + rz * ox - hz * u.oz;
    const bob = running ? Math.abs(Math.sin(time * 11 + u.ph)) * 0.12 : Math.sin(time * 2 + u.ph) * 0.02;
    let y = sold.y + bob, s = u.s;
    if (sold.suck > 0) {
      const k = sold.suck, ang = k * 9 + u.ph, r = (1 - k) * Math.hypot(u.ox, u.oz + 1);
      x += (sold.holeX + Math.cos(ang) * r - x) * k;
      z += (sold.holeZ + Math.sin(ang) * r - z) * k;
      y += (sold.holeY - 1) * k;
      s *= 1 - k;
    }
    if (game.phase === 'mine' && game.mine === G.MINE_BUG && Math.sin(time * 37 + i * 12.99) > 0.55) {
      // バグ：ときどき兵士がガタッとずれたり、消えたりする
      x += (Math.random() - 0.5) * 1.8; z += (Math.random() - 0.5) * 1.8;
      if (Math.random() < 0.25) s *= 0.02;
    }
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw + sold.lean + (running ? Math.sin(time * 11 + u.ph) * 0.15 : 0), 0);
    dummy.scale.setScalar(Math.max(0.0001, s));
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    helmets.setMatrixAt(i, dummy.matrix);
    if (u.lk) u.lk.mesh.setMatrixAt(u.li, dummy.matrix);
    if (u.pi !== undefined) poles.setMatrixAt(u.pi, dummy.matrix);
    if (u.fi !== undefined) flags.setMatrixAt(u.fi, dummy.matrix);
    if (u.ri !== undefined) flagsRB.setMatrixAt(u.ri, dummy.matrix);
  });
  [bodies, heads, helmets, poles, flags, flagsRB].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  for (const L of LFLAGS.values()) if (L.mesh.count) L.mesh.instanceMatrix.needsUpdate = true;
  blob.visible = sold.units.length > 0 && sold.suck === 0;
  if (blob.visible) {
    blob.position.set(sold.x - hx * (sold.bd / 2), 0.06, sold.z - hz * (sold.bd / 2));
    blob.scale.set(sold.bw / 2 + 0.7, sold.bd / 2 + 0.7, 1);
    blob.rotation.y = yaw;
  }
}

// ---------- 橋に入ったあと横へ動かそうとしたとき：欄干にコツンと当たる（音・兵士の小さなゆれ・欄干が一瞬光る） ----------
const bump = { t: 9, side: 0, cool: 0 };
const bumpFlash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0, depthWrite: false }));
bumpFlash.visible = false;
scene.add(bumpFlash);
function tryBump(wx) {
  if (game.screen !== 'game' || game.phase !== 'run' || !game.run || game.run.plaza || !course || paused) return;
  if (bump.cool > 0 || !wx) return;
  const br = course.onBridge(sold.x, sold.z);
  if (!br || br.wide) return; // 張り出しの上は広いので当たらない
  const rx = -sold.hz, rz = sold.hx; // 兵士の右の向き
  if (Math.abs(rx) < 0.35) return; // 横向きに進んでいるときは、左右の操作は前後になる
  const side = Math.sign(wx * rx);
  bump.t = 0; bump.side = side; bump.cool = 0.45;
  bumpSound(br.type);
  sold.lean = -side * 0.3;
  if (!br.noRail) {
    const d = RIVER.BW / 2 - 0.2;
    bumpFlash.position.set(sold.x + rx * side * d, 0.95 + (sold.y || 0), sold.z + rz * side * d);
    bumpFlash.rotation.set(0, Math.atan2(sold.hx, sold.hz), 0);
    bumpFlash.scale.set(1, 1, 6.5);
    bumpFlash.visible = true;
  }
}
function updateBump(dt) {
  bump.t += dt; bump.cool -= dt;
  const o = Math.max(0, 1 - bump.t * 2.6);
  bumpFlash.material.opacity = o;
  if (o <= 0) bumpFlash.visible = false;
}
const bumpOffset = () => { const t = bump.t; if (t > 0.6) return 0; return bump.side * 0.45 * (t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) * 9) * Math.cos((t - 0.06) * 26)); };
