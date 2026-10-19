// 五門の兵：コースを組み立てる・片づける、ボス、入口のハイライト、ボスの HP バー
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- コースを組み立てる ----------
let course = null;
const labelsEl = $('labels');

function clearCourse() {
  if (!course) return;
  scene.remove(course.root);
  course.gates.forEach((g) => { g.panelMat.dispose(); g.flashMat.dispose(); g.tex.dispose(); g.anchor.remove(); });
  course.bossTag.remove();
  course.root.traverse((o) => { if (o.userData.own) o.geometry.dispose(); if (o.userData.inst && o.dispose) o.dispose(); });
  (course.boss.userData.mats || []).forEach((m) => m.dispose());
  course = null;
}

function buildBoss(reverse) {
  const outer = new THREE.Group(), pivot = new THREE.Group(), holder = new THREE.Group(), inner = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: reverse ? 0x4a3c82 : 0x6a6178, roughness: 0.8, emissive: reverse ? 0x2a1d60 : 0x000000, emissiveIntensity: 0.4 });
  const eye = new THREE.MeshStandardMaterial({ color: reverse ? 0xeee8ff : 0xffcb62, emissive: reverse ? 0xb9a8ff : 0xffa928, emissiveIntensity: 1.3 });
  const add = (geo, m, x, y, z) => { const o = ownMesh(geo, m); o.position.set(x, y, z); inner.add(o); return o; };
  add(new THREE.BoxGeometry(3.6, 3.4, 2.3), mat, 0, 3.4, 0);
  add(new THREE.BoxGeometry(2.3, 1.8, 1.9), mat, 0, 6.0, 0);
  add(new THREE.BoxGeometry(0.46, 0.24, 0.1), eye, -0.52, 6.1, 0.97);
  add(new THREE.BoxGeometry(0.46, 0.24, 0.1), eye, 0.52, 6.1, 0.97);
  add(new THREE.BoxGeometry(1.0, 3.1, 1.1), mat, -2.45, 3.4, 0);
  add(new THREE.BoxGeometry(1.0, 3.1, 1.1), mat, 2.45, 3.4, 0);
  add(new THREE.BoxGeometry(1.15, 1.7, 1.25), mat, -0.9, 0.85, 0);
  add(new THREE.BoxGeometry(1.15, 1.7, 1.25), mat, 0.9, 0.85, 0);
  for (const sx of [-0.8, 0, 0.8]) add(new THREE.ConeGeometry(0.28, 0.8, 6), eye, sx, 7.3, 0);
  inner.scale.setScalar(2.2);
  if (reverse) { inner.rotation.z = Math.PI; inner.position.y = 7.8 * 2.2; }
  // 片側の腕の外側・地面の高さを軸にして、真横へ倒れる（マイクラ風）
  const SIDE = 2.95 * 2.2, offs = new THREE.Group();
  pivot.position.x = -SIDE;
  offs.position.x = SIDE;
  outer.add(pivot); pivot.add(offs); offs.add(holder); holder.add(inner);
  outer.userData = { mats: [mat, eye], pivot, holder, eye, body: mat, base: { color: mat.color.clone(), emissive: mat.emissive.clone(), ei: mat.emissiveIntensity } };
  return outer;
}

function buildCourse(stage, seed) {
  clearCourse();
  seed = seed || (Math.random() * 1e9) >>> 0;
  const geo = buildGeo(stage, G.mulberry32((seed ^ 0x9e3779b9) >>> 0));
  const root = new THREE.Group();
  if (geo.river) {
    buildRiver(root, geo.river, geo.beachX[0], geo.beachX[1], geo.farFlip);
    geo.bridges.forEach((b, i) => buildBridge(root, b.type, b.x, b.z0, b.z1, G.mulberry32((seed + i * 7919) >>> 0), b.o));
    (geo.curves || []).forEach((cv, i) => buildCurveBridge(root, cv.type, cv.pts, G.mulberry32((seed + 31 + i * 104729) >>> 0), cv.avoid, geo.river));
    (geo.bulges || []).forEach((bg, i) => buildBulge(root, bg.type, bg, G.mulberry32((seed + 57 + i * 7919) >>> 0)));
    (geo.landRoads || []).forEach((pts, i) => root.add(ribbonMesh(pts, RIVER.BW, WASTE[geo.farFlip ? 1 : 0].path, 0.015 + i * 0.003))); // 向こう岸の陸の道
  }
  const fish = decorateRiver(root, geo, seed);
  setGround(geo.river || null, geo.farFlip);
  placeHills(geo.river, geo.farFlip);
  for (const p of geo.pads) {
    const m = ownMesh(new THREE.BoxGeometry(p.w, 0.06, p.z0 - p.z1), p.matObj);
    m.position.set(p.x, p.y || 0, (p.z0 + p.z1) / 2); root.add(m);
  }
  const arena = ownMesh(new THREE.CylinderGeometry(geo.arena.r, geo.arena.r, 0.1, 64), geo.arenaMat || MAT.arena);
  arena.position.set(geo.arena.x, 0.02, geo.arena.z); root.add(arena);
  const hl = ownMesh(new THREE.PlaneGeometry(1, 1), MAT.highlight);
  hl.rotation.x = -Math.PI / 2; root.add(hl);
  const marker = new THREE.Group();
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(GEO.chevron, MAT.marker); c.scale.setScalar(1.7); marker.add(c); }
  root.add(marker);

  const gates = stage.layout.slots.map((slot) => {
    const g = buildGate(stage.gates[slot.id], geo.slotPos[slot.id]);
    root.add(g.group);
    return g;
  });
  const boss = buildBoss(stage.reverse);
  boss.position.set(geo.boss.x, 0, geo.boss.z);
  boss.rotation.y = geo.boss.rot;
  root.add(boss);
  const bossTag = document.createElement('div');
  bossTag.className = 'anchor';
  const bt = document.createElement('div');
  bt.className = 'boss-bar' + (stage.reverse ? ' reverse' : '');
  bt.innerHTML = '<i class="dmg"></i><i class="fill"></i>';
  bossTag.appendChild(bt);
  labelsEl.appendChild(bossTag);
  scene.add(root);
  course = { root, geo, gates, boss, bossTag, bossTagInner: bt, bossHidden: false, highlight: hl, marker, hlTarget: { x: 0, z0: geo.hl.z0, z1: geo.hl.z1, w: geo.colW }, fish, onBridge: makeOnBridge(geo) };
  plantTrees(geo, seed);
  setHighlight(geo.startXs[0], geo.hl, geo.colW);
  setBossTag(stage.hp);
  $('bossHp').classList.remove('hit');
}
function setHighlight(x, range, w) {
  if (!course) return;
  course.hlTarget = { x, z0: range.z0, z1: range.z1, w: w || RIVER.BW };
}
function setBossTag(hp) {
  if (!course) return;
  // 頭上のバーは、はじめの HP に対する割合。回復で増えた分は枠を超えて伸びる（画面の外まで伸びてよい。60倍で打ち止め）
  const hp0 = game.stage ? game.stage.hp : hp;
  const r = hp <= 0n ? 0 : hp >= hp0 * 60n ? 60 : Math.max(0.004, Number((hp * 100000n) / hp0) / 100000);
  course.bossTagInner.lastElementChild.style.width = (r * 100).toFixed(2) + '%';
  course.bossR = r;
  if (!course.bossCombo) bossRed(r, false);
  // 反転ボスの HP はマイナスで書く
  $('bossHp').textContent = fmtBig(game.stage && game.stage.reverse && hp > 0n ? -hp : hp);
}
// 赤い部分（受けたダメージ）の右端。攻撃中はそのまま残して赤を増やし、終わったら一気に消すか、追いかけて縮める
function bossRed(r, drain) {
  const red = course.bossTagInner.firstElementChild;
  red.style.transition = drain ? 'width 0.5s ease-in' : 'none';
  red.style.width = (r * 100).toFixed(2) + '%';
}
