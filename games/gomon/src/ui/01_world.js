// 五門の兵：3D の土台：描く道具、空・地面・荒地・遠くの丘と雲・木と草・岩、共通の素材と形
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 描く道具 ----------
const dummy = new THREE.Object3D(); // 置き方（行列）の計算に使い回す
const col = new THREE.Color();      // 色の計算に使い回す
const WHITE = new THREE.Color(0xffffff);
// 絵を描いた紙（canvas）。描けない環境でも止まらない
function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  try { const x = c.getContext && c.getContext('2d'); if (x) draw(x); } catch (e) { /* 描けなくても動く */ }
  return c;
}
// くり返して貼る模様
const texOf = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
// 多角形（{x,z} の並び、穴つき）を上向きの平らな面にする
function polyGeo(outline, holes, y, uvScale) {
  const V2 = (p) => new THREE.Vector2(p.x, p.z);
  const c = outline.map(V2), hs = (holes || []).map((h) => h.map(V2));
  const tris = THREE.ShapeUtils.triangulateShape(c, hs);
  const all = c.concat(...hs), pos = [], uv = [], nrm = [];
  for (const t of tris) {
    const a = all[t[0]];
    let b = all[t[1]], d = all[t[2]];
    if ((b.y - a.y) * (d.x - a.x) - (b.x - a.x) * (d.y - a.y) < 0) { const q = b; b = d; d = q; }
    for (const q of [a, b, d]) { pos.push(q.x, y, q.y); uv.push(q.x * uvScale, q.y * uvScale); nrm.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// コースの部品：片づけるとき（clearCourse）に形も捨てる印 own をつける
function ownMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.userData.own = true; return m; }

// 多角形までの距離（中は負）
function polySD(poly) {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z), bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
  return (x, z) => {
    if (x < bx0 - 30 || x > bx1 + 30 || z < bz0 - 30 || z > bz1 + 30) return 30;
    let inside = false, d2 = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
      const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2));
      const dx = a.x + ex * t - x, dz = a.z + ez * t - z; d2 = Math.min(d2, dx * dx + dz * dz);
    }
    return inside ? -Math.sqrt(d2) : Math.sqrt(d2);
  };
}

// 部品を置いた形のまま1つの形にまとめる（描く回数を減らす）。items：[[形, 置き方の行列], ...]
function bakeGeos(items) { return mergeGeos(items.map(([g, m]) => (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m))); }
function mergeGeos(list) {
  const arr = { position: [], normal: [], uv: [] };
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; for (const k of Object.keys(arr)) arr[k].push(...g.attributes[k].array); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(arr.position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2));
  return out;
}

// ---------- 3D の土台：青空と平原 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(HORIZON, 1);
$('field').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON, 160, 700);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2600);
const hemi = new THREE.HemisphereLight(0xeaf5ff, 0x6d8f4c, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2da, 0.85);
sun.position.set(-40, 80, 30);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe3ff, 0.25);
fill.position.set(40, 30, -50);
scene.add(fill);

const sky = (() => {
  const R = 1200, g = new THREE.SphereGeometry(R, 32, 16);
  const pos = g.attributes.position, cols = [];
  const cH = new THREE.Color(HORIZON), cM = new THREE.Color(0x8fc4ef), cZ = new THREE.Color(0x3a83d4), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / R);
    if (t < 0.12) c.copy(cH).lerp(cM, t / 0.12); else c.copy(cM).lerp(cZ, Math.min(1, (t - 0.12) / 0.5));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  scene.add(m);
  return m;
})();

// 地面の模様（256×256）：base の色で塗ってから、draw(ctx, rng) でまだらを描く
const noiseCanvas = (base, seed, draw) => canvasOf(256, 256, (x) => { x.fillStyle = base; x.fillRect(0, 0, 256, 256); draw(x, G.mulberry32(seed)); });
// 草原：明るい緑に、細かい草のまだら
const grassTex = texOf(noiseCanvas('#86bd5b', 7, (x, rng) => {
  for (let i = 0; i < 2600; i++) {
    const r = 96 + Math.floor(rng() * 44), g = 150 + Math.floor(rng() * 60), b = 56 + Math.floor(rng() * 34);
    x.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.25 + rng() * 0.35).toFixed(2) + ')';
    const s = 1 + rng() * 3;
    x.fillRect(rng() * 256, rng() * 256, s, s * (1 + rng() * 2));
  }
}));
// 地面：コースごとに作り直す（川があるときは、川の形の穴をあける）。模様は 20 ごとにくり返す
const GROUND_RECT = [{ x: -1400, z: -1300 }, { x: 1400, z: -1300 }, { x: 1400, z: 1500 }, { x: -1400, z: 1500 }];
const ground = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff, map: grassTex }));
ground.position.y = -0.02;
scene.add(ground);
// 川の向こう岸は荒地（反転ボスのときは色を反転）
// 反転ボスの向こう岸：色を反転し、そのままだと川の青と見分けにくいので、色相を紫の側へ回す
const FLIP_HUE = 0.21;
const flipColor = (c) => c.setRGB(1 - c.r, 1 - c.g, 1 - c.b).offsetHSL(FLIP_HUE, 0, 0);
const invertCanvas = (src) => canvasOf(src.width, src.height, (x) => { // 色を反転した写し
  x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, src.width, src.height), q = new THREE.Color();
  for (let i = 0; i < d.data.length; i += 4) { flipColor(q.setRGB(d.data[i] / 255, d.data[i + 1] / 255, d.data[i + 2] / 255)); d.data[i] = q.r * 255; d.data[i + 1] = q.g * 255; d.data[i + 2] = q.b * 255; }
  x.putImageData(d, 0, 0);
});
const wasteCanvas = noiseCanvas('#a5653f', 17, (x, rng) => {
  for (let i = 0; i < 2200; i++) { // 乾いた土のまだら
    const v = rng(), r = v < 0.5 ? 120 + rng() * 30 : 170 + rng() * 30, g = r * (0.58 + rng() * 0.06), b = r * (0.36 + rng() * 0.06);
    x.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (0.25 + rng() * 0.35).toFixed(2) + ')';
    const sz = 1 + rng() * 4; x.fillRect(rng() * 256, rng() * 256, sz, sz);
  }
  x.strokeStyle = 'rgba(70,36,20,0.55)'; x.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) { // ひび割れ
    let px = rng() * 256, py = rng() * 256;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 50; py += (rng() - 0.5) * 50; x.lineTo(px, py); }
    x.stroke();
  }
});
const inv = (hex) => flipColor(new THREE.Color(hex)).getHex();
const wasteSet = (flip) => {
  const k = (hex) => (flip ? inv(hex) : hex);
  return {
    ground: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texOf(flip ? invertCanvas(wasteCanvas) : wasteCanvas) }),
    path: new THREE.MeshStandardMaterial({ color: k(0xb98457), roughness: 1 }),
    arena: new THREE.MeshStandardMaterial({ color: k(0x7c4a30), roughness: 1 }),
    bank: new THREE.MeshStandardMaterial({ color: k(0x7a4a30), roughness: 1, side: THREE.DoubleSide }),
    rock: new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), // 色は1つずつ（反転は1つずつの色で行う）
    dead: new THREE.MeshLambertMaterial({ color: k(0x4a3427) }),
    mesa: [0xa8603c, 0x95522f, 0xb4704a].map((c) => k(c)),
    flip,
  };
};
const WASTE = [wasteSet(false), wasteSet(true)];
const farGround = new THREE.Mesh(new THREE.BufferGeometry(), WASTE[0].ground);
farGround.position.y = -0.02;
farGround.visible = false;
scene.add(farGround);
function setGround(river, flip) {
  ground.geometry.dispose();
  farGround.geometry.dispose();
  if (!river) { ground.geometry = polyGeo(GROUND_RECT, [], 0, 1 / 20); farGround.geometry = new THREE.BufferGeometry(); farGround.visible = false; return; }
  // 手前の岸から手前（草原）と、向こう岸から先（荒地）の2枚に分ける。その間が川
  const R0 = GROUND_RECT;
  ground.geometry = polyGeo(river.near.concat([{ x: R0[2].x, z: R0[2].z }, { x: R0[3].x, z: R0[3].z }]), [], 0, 1 / 20);
  farGround.geometry = polyGeo(river.far.concat([{ x: R0[1].x, z: R0[1].z }, { x: R0[0].x, z: R0[0].z }]), [], 0, 1 / 26);
  farGround.material = WASTE[flip ? 1 : 0].ground;
  farGround.visible = true;
}
setGround(null);

// 遠くの丘と雲（一度だけ作る）。川をまたぐ丘は、川の外へずらす
const hills = [];
function placeHills(river, flip) {
  hills.forEach((h, i) => {
    let z = h.z;
    if (river && z + h.R > river.zMin - 6 && z - h.R < river.zMax + 6) z = (z > (river.zMin + river.zMax) / 2) ? river.zMax + 6 + h.R : river.zMin - 6 - h.R;
    h.m.position.z = z;
    // 向こう岸の丘は、荒地の赤茶けた岩山にする
    const far = river && z < river.zMin;
    h.m.material.color.setHex(far ? WASTE[flip ? 1 : 0].mesa[i % 3] : h.c);
    h.m.scale.y = h.R * (far ? 0.55 : 0.38);
  });
  mesas.visible = !!river;
  if (river) mesas.children.forEach((m, i) => { m.material = WASTE[flip ? 1 : 0].mesaMats[i % 3]; });
}
(function scenery() {
  const hillGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const hillCols = [0x79a957, 0x6f9e50, 0x83b25e, 0x6a9a4e];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3, r = 500 + (i % 3) * 50, R = 90 + ((i * 37) % 60);
    const m = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: hillCols[i % 4] }));
    m.scale.set(R * 1.6, R * 0.38, R);
    m.position.set(Math.cos(a) * r, -1, 100 + Math.sin(a) * r);
    scene.add(m);
    hills.push({ m, z: m.position.z, R, c: hillCols[i % 4] });
  }
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, fog: false });
  const puff = new THREE.SphereGeometry(1, 10, 7); // 遠くの雲なので、粗くてよい
  const rng = G.mulberry32(99), parts = [];
  // 雲は動かないので、70個のふくらみを1つの形にまとめて、1回で描く
  for (let i = 0; i < 14; i++) {
    const grp = new THREE.Object3D();
    const a = rng() * Math.PI * 2, r = 380 + rng() * 420;
    grp.position.set(Math.cos(a) * r, 150 + rng() * 110, 100 + Math.sin(a) * r);
    const ks = [];
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Object3D();
      const s = 14 + rng() * 16;
      p.scale.set(s * 1.4, s * 0.62, s);
      p.position.set((k - 2) * 17 + rng() * 8, rng() * 8, rng() * 12);
      grp.add(p); ks.push(p);
    }
    grp.rotation.y = rng() * 6;
    grp.updateMatrixWorld(true);
    for (const p of ks) parts.push([puff, p.matrixWorld.clone()]);
  }
  const clouds = new THREE.Mesh(bakeGeos(parts), cloudMat);
  clouds.frustumCulled = false;
  scene.add(clouds);
})();

// 木（コースごとに植え直す）
const MAXT = 500;
const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6); trunkGeo.translate(0, 1.5, 0);
const crownGeo = new THREE.IcosahedronGeometry(2.4, 0); crownGeo.translate(0, 4.6, 0);
const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x7a5636 }), MAXT);
const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), MAXT);
crowns.setColorAt(0, WHITE);
[trunks, crowns].forEach((m) => { m.count = 0; m.frustumCulled = false; scene.add(m); });
// 平原の低い草：細い葉を6枚まとめたひとかたまり（コースごとに植え直す）
const MAXG = 2500;
const grassGeo = (() => {
  const pos = [], nrm = [], r = G.mulberry32(7);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), bx = ca * 0.1, bz = sa * 0.1, h = 0.45 + r() * 0.45, lean = 0.12 + r() * 0.2, w = 0.07;
    const p0 = [bx - sa * w, 0, bz + ca * w], p1 = [bx + sa * w, 0, bz - ca * w], p2 = [bx + ca * lean, h, bz + sa * lean];
    pos.push(...p0, ...p1, ...p2, ...p1, ...p0, ...p2); // 表と裏の2枚（両面表示だと裏側が暗くなるため）
    for (let i = 0; i < 6; i++) nrm.push(0, 1, 0); // 光は上から当たったことにして、どの向きの葉も地面と同じ明るさに
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
})();
const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXG);
grass.setColorAt(0, WHITE);
grass.count = 0; grass.frustumCulled = false; scene.add(grass);
// 荒地の枯れ木と岩
const MAXD = 80, MAXR = 160; // 向こう岸の枯れ木と岩（はじめの版の約3割）
const deadGeo = mergeGeos([
  new THREE.CylinderGeometry(0.2, 0.42, 3.4, 6).translate(0, 1.7, 0),
  new THREE.CylinderGeometry(0.08, 0.17, 1.9, 5).rotateZ(-0.75).translate(0.62, 2.7, 0),
  new THREE.CylinderGeometry(0.07, 0.15, 1.6, 5).rotateZ(0.85).translate(-0.55, 2.35, 0.1),
  new THREE.CylinderGeometry(0.05, 0.11, 1.1, 5).rotateX(0.7).translate(0, 3.35, 0.35),
]);
const deadTrees = new THREE.InstancedMesh(deadGeo, WASTE[0].dead, MAXD);
const ROCK_GEO = new THREE.DodecahedronGeometry(1, 0); // 岩（荒地と水ぎわで同じ形）
const rocks = new THREE.InstancedMesh(ROCK_GEO, WASTE[0].rock, MAXR);
rocks.setColorAt(0, WHITE);
[deadTrees, rocks].forEach((m) => { m.count = 0; m.frustumCulled = false; scene.add(m); });
WASTE.forEach((w) => { w.mesaMats = w.mesa.map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true })); });
// 遠くの台地（荒地の地平線）
const mesas = new THREE.Group();
(function () {
  const rng = G.mulberry32(23), g = new THREE.CylinderGeometry(1, 1.25, 1, 7);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(g, WASTE[0].mesaMats[i % 3]);
    const R = 40 + rng() * 60, H = 25 + rng() * 45;
    m.scale.set(R, H, R * (0.6 + rng() * 0.5));
    m.position.set((i - 4) * 150 + (rng() - 0.5) * 80, H / 2 - 2, -330 - rng() * 260);
    m.rotation.y = rng() * 6;
    mesas.add(m);
  }
})();
mesas.visible = false;
scene.add(mesas);
function plantTrees(geo, seed) {
  const rng = G.mulberry32(seed);
  const e = geo.ext, rd = geo.road, ar = geo.arena;
  // ボスのまわり：ボス戦のカメラはボスの前（橋の側）にあるので、空けるのは前だけ。後ろと横は足場のすぐ外から置いてよい（倒れる体と重なってもよい）
  const bf = geo.boss.f;
  const nearBoss = (x, z, r, tall) => {
    const dx = x - ar.x, dz = z - ar.z, d = Math.hypot(dx, dz);
    if (d < ar.r + 0.5 + r) return true; // 足場の上には置かない
    return tall && dx * bf.x + dz * bf.z > -r && d < ar.r + 40 + r; // 背の高いものは、カメラとボスの間に入れない
  };
  // ボスへ向かう道の上には置かない
  const onPad = (x, z, m) => geo.pads.some((p) => Math.abs(x - p.x) < p.w / 2 + m && z < Math.max(p.z0, p.z1) + m && z > Math.min(p.z0, p.z1) - m);
  const blocked = (x, z, r, low) =>
    (x > e.x0 - 7 - r && x < e.x1 + 7 + r && z > e.z0 - 8 - r && z < e.z1 + 4 + r) ||
    (x > rd.x0 - 5 - r && x < rd.x1 + 5 + r && z > RIVER.BANK - 6 && z < ROAD_END + 30) ||
    nearBoss(x, z, r, !low) || onPad(x, z, r + 0.5) ||
    (geo.river && geo.river.inRiver(x, z, r + 1.5));
  let n = 0, nd = 0, nr = 0;
  const flip = !!geo.farFlip;
  const farSide = (x, z) => geo.river && geo.river.farLand(x, z, 1);
  const rock = (x, z, s) => {
    if (nr >= MAXR || (geo.river && geo.river.inRiver(x, z, s + 0.8)) || nearBoss(x, z, s, false) || onPad(x, z, s + 0.3)) return;
    dummy.position.set(x, s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 6.28, rng() * 3);
    dummy.scale.set(s * (0.8 + rng() * 0.6), s * (0.5 + rng() * 0.4), s * (0.8 + rng() * 0.6));
    dummy.updateMatrix();
    rocks.setMatrixAt(nr, dummy.matrix);
    const t = 0.62 + rng() * 0.3, warm = rng() < 0.6;
    col.setRGB(t * (warm ? 0.78 : 0.7), t * (warm ? 0.55 : 0.64), t * (warm ? 0.42 : 0.6));
    if (flip) flipColor(col);
    rocks.setColorAt(nr, col);
    nr++;
  };
  // 緑の木を1本（大きさ s）
  const tree = (x, z, s) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * 6.28, 0);
    dummy.scale.set(s, s * (0.85 + rng() * 0.4), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(n, dummy.matrix);
    crowns.setMatrixAt(n, dummy.matrix);
    col.setHSL(0.24 + rng() * 0.08, 0.42 + rng() * 0.2, 0.3 + rng() * 0.12);
    crowns.setColorAt(n, col);
    n++;
  };
  const put = (x, z, s) => {
    if (farSide(x, z)) { // 向こう岸は荒地：枯れ木と岩（多すぎないよう、候補の3割だけ置く）
      if (rng() < 0.7) return;
      const dead = rng() < 0.45 && nd < MAXD;
      if (blocked(x, z, 1.5 * s, !dead)) return;
      if (dead) {
        dummy.position.set(x, 0, z); dummy.rotation.set((rng() - 0.5) * 0.12, rng() * 6.28, (rng() - 0.5) * 0.12);
        dummy.scale.set(s, s * (0.8 + rng() * 0.5), s); dummy.updateMatrix();
        deadTrees.setMatrixAt(nd++, dummy.matrix);
      } else rock(x, z, 0.8 + rng() * 2.2 * s);
      return;
    }
    if (n < MAXT && !blocked(x, z, 2.4 * s)) tree(x, z, s);
  };
  if (geo.river && geo.river.island) { // 中州の、砂地とボスの足場のまわり以外には木を植える（木の数には限りがあるので、先に植える）
    const I = geo.river.island, inO = polySD(I.outline), inS = I.sand ? polySD(I.sand) : () => 99;
    const xs = I.outline.map((p) => p.x), zs = I.outline.map((p) => p.z), bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
    for (let i = 0, k = 0; i < 400 && k < 70 && n < MAXT; i++) {
      const x = bx0 + rng() * (bx1 - bx0), z = bz0 + rng() * (bz1 - bz0);
      if (inO(x, z) > -2.5 || inS(x, z) < 3 || Math.hypot(x - ar.x, z - ar.z) < ar.r + 3) continue;
      tree(x, z, 0.6 + rng() * 0.5);
      k++;
    }
  }
  for (let z = 26; z < ROAD_END; z += 10 + rng() * 6) {
    put(rd.x0 - 7 - rng() * 10, z, 0.9 + rng() * 0.7);
    put(rd.x1 + 7 + rng() * 10, z, 0.9 + rng() * 0.7);
  }
  // 平原の木：コースのまわりから遠くまで植える（近いほど多く、遠いほど大きく。数の上限は MAXT）
  const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
  for (let i = 0; i < 6000 && n < MAXT; i++) {
    const th = rng() * Math.PI * 2, r = 25 + 500 * Math.pow(rng(), 1.8), x = cx + Math.sin(th) * r, z = cz + Math.cos(th) * r;
    put(x, z, farSide(x, z) ? 0.8 + rng() * 0.8 : (0.8 + rng()) * (1 + Math.max(0, r - 140) / 200));
  }
  if (geo.river) for (let i = 0; i < 900; i++) put((rng() * 2 - 1) * 260, geo.river.zMin - 5 - rng() * 230, 0.7 + rng() * 0.8);
  if (geo.river) { // 向こうの道とボスの足場のまわりにも、小さな岩を散らす
    for (let i = 0; i < 80; i++) { const x = (rng() * 2 - 1) * (e.x1 + 30), z = geo.river.farZ(x) - 1 - rng() * 90; rock(x, z, 0.3 + rng() * 0.9); }
  }
  // 平原の低い草：草地の上だけ（砂地・道・川・荒地・ボスの足場には生やさない）。コースの近くほど多く
  const rv = geo.river, beach = geo.beachX || [0, 0];
  const isl = rv && rv.island ? polySD(rv.island.outline) : null, islSand = rv && rv.island && rv.island.sand ? polySD(rv.island.sand) : null;
  const onGreen = (x, z) => {
    if (Math.hypot(x - ar.x, z - ar.z) < ar.r + 0.6) return false;
    if (isl && isl(x, z) < -0.8) return !(islSand && islSand(x, z) < 0.6); // 中州の草地
    if (!rv) return true;
    if (rv.inRiver(x, z, 1.2) || farSide(x, z)) return false;
    if (x > beach[0] - 0.6 && x < beach[1] + 0.6 && z > rv.nearZ(x) - 1) return false; // 手前の岸の砂地と道
    return !(x > rd.x0 - 0.6 && x < rd.x1 + 0.6 && z > RIVER.BANK);
  };
  let ng = 0;
  for (let i = 0; i < 9000 && ng < MAXG; i++) {
    const th = rng() * Math.PI * 2, r = 6 + 330 * Math.pow(rng(), 1.6), x = cx + Math.sin(th) * r, z = cz + Math.cos(th) * r;
    if (!onGreen(x, z)) continue;
    const sc = 0.7 + rng() * 0.8;
    dummy.position.set(x, 0, z); dummy.rotation.set(0, rng() * 6.28, 0); dummy.scale.set(sc, sc * (0.8 + rng() * 0.5), sc); dummy.updateMatrix();
    grass.setMatrixAt(ng, dummy.matrix);
    col.setHSL(0.24 + rng() * 0.05, 0.45 + rng() * 0.1, 0.35 + rng() * 0.08); grass.setColorAt(ng, col); // 地面（#86bd5b ≒ H0.26 S0.43 L0.55）より少しだけ濃い緑
    ng++;
  }
  grass.count = ng; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  trunks.count = crowns.count = n;
  deadTrees.count = nd; rocks.count = nr;
  deadTrees.material = WASTE[flip ? 1 : 0].dead; rocks.material = WASTE[flip ? 1 : 0].rock;
  [trunks, crowns, deadTrees, rocks].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
}

// ---------- コースで共通の素材と形 ----------
const MAT = {
  approach: new THREE.MeshStandardMaterial({ color: 0xbfa577, roughness: 1 }), // 手前の岸と中州の砂地
  arena: new THREE.MeshStandardMaterial({ color: 0xae9061, roughness: 1 }),
  highlight: new THREE.MeshBasicMaterial({ color: 0xffd65a, transparent: true, opacity: 0.3, depthWrite: false }),
  chevron: new THREE.MeshBasicMaterial({ color: 0xd39a2c, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
  // アンコールの張り出しの上の、うすい矢印（明るい床には濃い色、暗い床には明るい色）
  chevronFaint: new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
  chevronFaintDark: new THREE.MeshBasicMaterial({ color: 0x4a4038, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
  marker: new THREE.MeshBasicMaterial({ color: 0xffbf1a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  blob: new THREE.MeshBasicMaterial({ color: 0x1d2a10, transparent: true, opacity: 0.2, depthWrite: false }),
};

const GEO = {
  ucyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  usph: new THREE.SphereGeometry(1, 12, 8),
  ubox: new THREE.BoxGeometry(1, 1, 1),
  oct: new THREE.OctahedronGeometry(0.32),
  disc: new THREE.CylinderGeometry(1.15, 1.15, 0.12, 32),
  // 矢じり（先が進行方向 −z を向く）
  chevron: (() => { const s = new THREE.Shape(); s.moveTo(-0.9, 0.5); s.lineTo(0, -0.5); s.lineTo(0.9, 0.5); s.lineTo(0.9, 0.95); s.lineTo(0, -0.05); s.lineTo(-0.9, 0.95); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI); return g; })(),
};
