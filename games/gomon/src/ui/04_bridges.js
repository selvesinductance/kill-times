// 五門の兵：橋：3種類の橋（丸太・石・現代的な赤い鋼）、曲がる橋、アンコールの張り出し、道の帯と矢印
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 橋（太い1本の川に、3種類の橋をかける） ----------
const BRIDGE_TYPES = ['log', 'stone', 'modern'];
const stripeTexture = (w, h, draw) => texOf(canvasOf(w, h, draw));
const STONE_TEX = stripeTexture(128, 128, (x) => {
  x.fillStyle = '#857e72'; x.fillRect(0, 0, 128, 128);
  const rng = G.mulberry32(5);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { // 石だたみ（1段ずつずらして並べる）
    const x0 = ((c * 48 + (r % 2) * 24) % 128) - 24, y0 = r * 32;
    const v = 128 + Math.floor(rng() * 26);
    x.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 16) + ')';
    x.fillRect(x0 + 2, y0 + 2, 44, 28); x.fillRect(x0 + 2 + 128, y0 + 2, 44, 28);
  }
});
const PLATE_TEX = stripeTexture(64, 128, (x) => { // 赤い鋼板の継ぎ目
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 128);
  x.fillStyle = 'rgba(60,20,20,0.35)'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 64, 64, 2); x.fillRect(31, 0, 2, 128);
});
const WATER_TEX = stripeTexture(128, 128, (x) => {
  x.fillStyle = '#c9e2f3'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 2;
  const rng = G.mulberry32(11);
  for (let i = 0; i < 9; i++) { // さざなみ（流れる向き＝横に長い波）
    const y = 6 + rng() * 116, L = 24 + rng() * 30, x0 = rng() * (128 - L);
    x.beginPath(); for (let k = 0; k <= 12; k++) { const t = k / 12; x.lineTo(x0 + t * L, y + Math.sin(t * Math.PI * 2) * 2); } x.stroke();
  }
});
const BMAT = {
  bark: new THREE.MeshStandardMaterial({ color: 0x8a5d36, roughness: 0.95 }),
  logEnd: new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7d5230, roughness: 0.85 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.95 }),
  stoneDeck: new THREE.MeshStandardMaterial({ map: STONE_TEX, roughness: 0.95 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xa39c8f, roughness: 0.95 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x857e73, roughness: 1 }),
  redSteel: new THREE.MeshPhongMaterial({ color: 0x8a1f18, specular: 0xc49a90, shininess: 90 }),
  redDeck: new THREE.MeshPhongMaterial({ color: 0x7a1d17, map: PLATE_TEX, specular: 0x9a7068, shininess: 70 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
  water: new THREE.MeshStandardMaterial({ color: 0x3f8cc6, map: WATER_TEX, roughness: 0.3, metalness: 0.05 }),
  bank: new THREE.MeshStandardMaterial({ color: 0xab8e60, roughness: 1, side: THREE.DoubleSide }),
};
// 同じ形をたくさん置く。ms：置き方の行列の並び。cols：1つずつの色（数なら色の濃さ、THREE.Color ならその色）
function instM(root, geo, mat, ms, cols) {
  if (!ms.length) return;
  const m = new THREE.InstancedMesh(geo, mat, ms.length);
  ms.forEach((mx, i) => { m.setMatrixAt(i, mx); if (cols) m.setColorAt(i, typeof cols[i] === 'number' ? col.setScalar(cols[i]) : cols[i]); });
  m.userData.inst = true;
  root.add(m);
}
// [x, y, z, 大きさx, y, z, 回転x, y, z] の並びで置く
const itemMatrix = (it) => { dummy.position.set(it[0], it[1], it[2]); dummy.rotation.set(it[6] || 0, it[7] || 0, it[8] || 0); dummy.scale.set(it[3], it[4], it[5]); dummy.updateMatrix(); return dummy.matrix.clone(); };
const inst = (root, geo, mat, items, tones) => instM(root, geo, mat, items.map(itemMatrix), tones);
const along = (z0, z1, step, pad) => { const out = [], len = z0 - z1 - 2 * pad, n = Math.max(1, Math.round(len / step)); for (let i = 0; i <= n; i++) out.push(z0 - pad - (len * i) / n); return out; };
// 床の箱。上の面の模様を、長さに合わせてくり返す
function deckMesh(w, h, len, mat, ru, rv) {
  const g = new THREE.BoxGeometry(w, h, len), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  return ownMesh(g, mat);
}
// 石橋の下：水から立ち上がるアーチ（眼鏡橋）を、横から見た形で押し出す
function archGeo(len, w) {
  const top = -0.86, bot = RIVER.BED_Y, pier = 1.6, n = Math.max(2, Math.round(len / 11)), span = (len - pier * (n + 1)) / n, ry = 1.35, spring = -2.75;
  const s = new THREE.Shape();
  s.moveTo(0, top); s.lineTo(len, top); s.lineTo(len, bot);
  let xr = len - pier;
  s.lineTo(xr, bot);
  for (let k = 0; k < n; k++) {
    s.lineTo(xr, spring);
    s.absellipse(xr - span / 2, spring, span / 2, ry, 0, Math.PI, false);
    s.lineTo(xr - span, bot);
    xr -= span + pier;
    s.lineTo(Math.max(0, xr), bot);
  }
  s.lineTo(0, bot);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 10 });
  g.rotateY(Math.PI / 2);
  return g;
}
// 橋を1本つくる。床の上の面は y = 0.03（岸の地面とそろえる）
// o：{ joinNear / joinFar（曲がる橋とつながる端：のばさず、親柱も立てない）, noRail（欄干なし：橋どうしが交わるところ）}
function buildBridge(root, type, x, zNear, zFar, rng, o) {
  o = o || {};
  const z0 = zNear + (o.joinNear ? 0 : 0.8), z1 = zFar - (o.joinFar ? 0 : 0.8), len = z0 - z1, zc = (z0 + z1) / 2, hw = RIVER.BW / 2;
  const ends = (a, b) => [o.joinNear ? null : z0 - a, o.joinFar ? null : z1 + b].filter((v) => v !== null);
  const rail = !o.noRail;
  // 欄干をあけるところ（アンコールの輪がつながるところ）：gaps = [{ side, z0, z1 }]（z0 > z1）
  const gaps = o.gaps || [];
  const inGap = (sd, z) => gaps.some((g) => g.side === sd && z < g.z0 && z > g.z1);
  const pieces = (sd, a, b) => { // a→b（a > b）を、あけるところで切り分ける
    let out = [[a, b]];
    for (const g of gaps) if (g.side === sd) out = out.flatMap(([p, q]) => (g.z0 <= q || g.z1 >= p ? [[p, q]] : [[p, Math.max(q, g.z0)], [Math.min(p, g.z1), q]].filter(([u, v]) => u - v > 0.3)));
    return out;
  };
  const add = (m, px, py, pz) => { m.position.set(px, py, pz); root.add(m); return m; };
  const sides = [-1, 1];
  if (type === 'log') {
    // 手づくりの太い丸太の橋：太さも長さも少しずつちがう丸太を横に並べ、太い杭と丸太の手すりを縄でしばる
    const r = rng || Math.random, tone = () => 0.72 + r() * 0.4;
    const deck = [], dc = [];
    for (let z = z0 - 0.36; z > z1 + 0.3; z -= 0.66 + (r() - 0.5) * 0.08) {
      const rad = 0.3 + r() * 0.08, ext = (r() - 0.5) * 0.7;
      deck.push([x + ext * 0.4, 0.05 - rad + r() * 0.025, z, rad, RIVER.BW + 0.35 + ext, rad, (r() - 0.5) * 0.4, 0, Math.PI / 2 + (r() - 0.5) * 0.035]);
      dc.push(tone());
    }
    inst(root, GEO.ucyl, [BMAT.bark, BMAT.logEnd, BMAT.logEnd], deck, dc);
    const big = [], bc = [], ropes = [];
    for (const sd of sides) { big.push([x + sd * (hw - 1.3), -0.72, zc, 0.42, len, 0.42, Math.PI / 2]); bc.push(0.8); } // 床の下の太い桁
    const pz = rail ? along(z0, z1, 2.7, 0.5) : [];
    for (const sd of rail ? sides : []) {
      pz.forEach((z, i) => {
        if (inGap(sd, z) || (i < pz.length - 1 && inGap(sd, pz[i + 1]))) { if (!inGap(sd, z)) { const px = x + sd * (hw - 0.12); big.push([px, 0.62, z, 0.2, 1.4, 0.2]); bc.push(tone()); } return; }
        const px = x + sd * (hw - 0.12), lean = (r() - 0.5) * 0.07;
        big.push([px, 0.62, z, 0.19 + r() * 0.03, 1.4, 0.19 + r() * 0.03, lean, 0, (r() - 0.5) * 0.07]); bc.push(tone());
        ropes.push([px, 1.12, z, 0.22, 0.16, 0.22]); // 縄のしばり目
        if (i < pz.length - 1) { // 手すりの丸太（1本ずつ少し傾く）
          const zn = pz[i + 1], dy = (r() - 0.5) * 0.1;
          big.push([px, 1.16 + dy / 2, (z + zn) / 2, 0.12, z - zn + 0.35, 0.12, Math.PI / 2 + dy / (z - zn), 0, 0]); bc.push(tone());
        }
      });
      for (const [a, b] of pieces(sd, z0 - 0.5, z1 + 0.5)) ropes.push([x + sd * (hw - 0.12), 0.6, (a + b) / 2, 0.05, a - b, 0.05, Math.PI / 2]); // 下の段は縄
    }
    for (const z of along(z0, z1, 5.5, 1.8)) for (const sd of sides) { big.push([x + sd * (hw - 0.9), -1.85, z, 0.27 + r() * 0.06, 2.8, 0.27 + r() * 0.06, (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08]); bc.push(tone() * 0.85); }
    for (const z of along(z0, z1, 11, 4)) { // 杭どうしをつなぐ筋交い（×の形）
      const w = 2 * (hw - 0.9), hgt = 1.3, l2 = Math.hypot(w, hgt), th = Math.atan2(w, hgt);
      for (const sg of [-1, 1]) { big.push([x, -1.45, z, 0.13, l2, 0.13, 0, 0, sg * th]); bc.push(tone() * 0.85); }
    }
    for (const z of ends(0.35, 0.35)) for (const sd of sides) { // 親柱：いちばん太い丸太
      big.push([x + sd * (hw - 0.15), 1.0, z, 0.38, 2.1, 0.38]); bc.push(tone());
      ropes.push([x + sd * (hw - 0.15), 1.55, z, 0.42, 0.2, 0.42], [x + sd * (hw - 0.15), 1.25, z, 0.42, 0.14, 0.42]);
    }
    inst(root, GEO.ucyl, [BMAT.bark, BMAT.logEnd, BMAT.logEnd], big, bc);
    inst(root, GEO.ucyl, BMAT.rope, ropes);
  } else if (type === 'stone') {
    add(deckMesh(RIVER.BW, 0.9, len, BMAT.stoneDeck, 2, len / 5), x, -0.42, zc);
    const ag = archGeo(len, RIVER.BW - 0.4);
    add(ownMesh(ag, BMAT.stoneDark), x - (RIVER.BW - 0.4) / 2, 0, z0);
    if (rail) inst(root, GEO.ubox, BMAT.stone, sides.flatMap((sd) => pieces(sd, z0, z1).map(([a, b]) => [x + sd * (hw - 0.24), 0.45, (a + b) / 2, 0.48, 0.86, a - b])));
    const posts = [], caps = [];
    for (const z of rail ? along(z0, z1, 6, 0.6) : []) for (const sd of sides) if (!inGap(sd, z)) { posts.push([x + sd * (hw - 0.24), 0.56, z, 0.66, 1.1, 0.66]); caps.push([x + sd * (hw - 0.24), 1.17, z, 0.8, 0.14, 0.8]); }
    for (const z of ends(0.5, 0.5)) for (const sd of sides) { posts.push([x + sd * (hw - 0.3), 0.8, z, 0.95, 1.6, 0.95]); caps.push([x + sd * (hw - 0.3), 1.67, z, 1.1, 0.16, 1.1]); } // 親柱
    inst(root, GEO.ubox, BMAT.stone, posts);
    inst(root, GEO.ubox, BMAT.stoneDark, caps);
  } else {
    // 現代的な橋：つやのある赤い鋼の橋。細い手すりがびっしり並び、ところどころに明かりがともる
    add(deckMesh(RIVER.BW, 0.38, len, BMAT.redDeck, 1, len / 6), x, -0.16, zc);
    const steel = [];
    for (const sd of sides) steel.push([x + sd * (hw - 0.16), -0.42, zc, 0.32, 0.82, len]); // 床の両側の桁
    for (const z of rail ? along(z0, z1, 0.9, 0.3) : []) for (const sd of sides) if (!inGap(sd, z)) steel.push([x + sd * (hw - 0.16), 0.6, z, 0.05, 1.08, 0.05]);
    for (const y of rail ? [1.14, 0.12] : []) for (const sd of sides) for (const [a, b] of pieces(sd, z0 - 0.1, z1 + 0.1)) steel.push([x + sd * (hw - 0.16), y, (a + b) / 2, 0.1, 0.08, a - b]);
    const lamps = [];
    for (const z of rail ? along(z0, z1, 9, 2) : []) for (const sd of sides) if (!inGap(sd, z)) { steel.push([x + sd * (hw - 0.16), 1.8, z, 0.07, 1.35, 0.07]); lamps.push([x + sd * (hw - 0.16), 2.55, z, 0.17, 0.17, 0.17]); }
    for (const z of ends(0.4, 0.4)) for (const sd of sides) { steel.push([x + sd * (hw - 0.3), 0.85, z, 0.6, 1.7, 0.6]); lamps.push([x + sd * (hw - 0.3), 1.9, z, 0.24, 0.24, 0.24]); } // 親柱
    const cols = [];
    for (const z of along(z0, z1, 15, 4)) { for (const sd of sides) cols.push([x + sd * (hw - 2.3), -1.8, z, 0.36, 2.9, 0.36]); steel.push([x, -0.7, z, RIVER.BW - 1.6, 0.42, 0.7]); }
    inst(root, GEO.ubox, BMAT.redSteel, steel);
    inst(root, GEO.ucyl, BMAT.redSteel, cols);
    inst(root, GEO.usph, BMAT.lamp, lamps);
  }
}
// 曲がる橋（立体交差・アンコールの輪）：道の線（高さつき）に沿って、同じ種類の橋をつくる
// avoid(x, z, kind)：ほかの橋の床の上なら true（そこには欄干（kind = 'rail'）・杭（'pier'）を立てない）
const MAT2 = {};
const dbl = (key, m) => MAT2[key] || (MAT2[key] = Object.assign(m.clone(), { side: THREE.DoubleSide }));
function stripMesh(rows, mat, period) { // rows：[[左の点, 右の点], ...] を帯にする
  const pos = [], uv = [], idx = [];
  let acc = 0;
  rows.forEach(([a, b], i) => {
    if (i) acc += Math.hypot(a.x - rows[i - 1][0].x, a.y - rows[i - 1][0].y, a.z - rows[i - 1][0].z);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, acc / period, 1, acc / period);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return ownMesh(g, mat);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mSeg(A, B, r, h) { // A→B の向きの棒（箱：幅 r・高さ h、円柱：太さ r）
  dummy.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
  dummy.lookAt(B.x, B.y, B.z);
  const L = A.distanceTo(B);
  if (h === undefined) { dummy.rotateX(Math.PI / 2); dummy.scale.set(r, L, r); } else dummy.scale.set(r, h, L);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}
function mAt(x, y, z, sx, sy, sz, ry) { dummy.position.set(x, y, z); dummy.rotation.set(0, ry || 0, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); return dummy.matrix.clone(); }
const raise = (p, dy) => p.clone().add(V(0, dy, 0)); // p を dy だけ上げた点
// 曲がる橋とアンコールの張り出しに共通の、欄干と床の下の杭（部品は parts にためて、最後に flushParts でまとめて置く）
//   post(p, i)：欄干の柱（i 本目。石の橋は6本に1本を太い柱に、現代的な橋は10本に1本に明かりをつける）
//   seg(a, b)：柱と柱の間の手すり、pier(p)：床の下の杭・柱（p は床の高さ）
const newParts = () => ({ logs: [], lt: [], big: [], bt: [], ropes: [], box: [], dark: [], steel: [], lamps: [], cols: [] });
function railKit(type, parts, tone) {
  if (type === 'log') {
    return {
      post: (p) => { parts.big.push(mAt(p.x, p.y + 0.6, p.z, 0.2, 1.4, 0.2)); parts.bt.push(tone()); parts.ropes.push(mAt(p.x, p.y + 1.1, p.z, 0.22, 0.16, 0.22)); },
      seg: (a, b) => { parts.big.push(mSeg(raise(a, 1.14), raise(b, 1.14), 0.12)); parts.bt.push(tone()); parts.ropes.push(mSeg(raise(a, 0.58), raise(b, 0.58), 0.05)); },
      pier: (p) => { const h = p.y - RIVER.BED_Y - 0.4; parts.big.push(mAt(p.x, p.y - 0.4 - h / 2, p.z, 0.29, h, 0.29)); parts.bt.push(tone() * 0.85); },
    };
  }
  if (type === 'stone') {
    return {
      post: (p, i) => { if (i % 6 === 0) { parts.box.push(mAt(p.x, p.y + 0.55, p.z, 0.66, 1.1, 0.66)); parts.dark.push(mAt(p.x, p.y + 1.16, p.z, 0.8, 0.14, 0.8)); } },
      seg: (a, b) => { parts.box.push(mSeg(raise(a, 0.44), raise(b, 0.44), 0.48, 0.86)); },
    };
  }
  return {
    post: (p, i) => {
      parts.steel.push(mAt(p.x, p.y + 0.57, p.z, 0.05, 1.08, 0.05));
      if (i % 10 === 5) { parts.steel.push(mAt(p.x, p.y + 1.8, p.z, 0.07, 1.35, 0.07)); parts.lamps.push(mAt(p.x, p.y + 2.55, p.z, 0.17, 0.17, 0.17)); }
    },
    seg: (a, b) => { for (const y of [1.14, 0.12]) parts.steel.push(mSeg(raise(a, y), raise(b, y), 0.1, 0.08)); },
    pier: (p) => { const top = p.y - 0.8, h = top - RIVER.BED_Y; parts.cols.push(mAt(p.x, top - h / 2, p.z, 0.36, h, 0.36)); },
  };
}
function flushParts(root, type, parts) {
  if (type === 'log') {
    instM(root, GEO.ucyl, [BMAT.bark, BMAT.logEnd, BMAT.logEnd], parts.logs, parts.lt);
    instM(root, GEO.ucyl, [BMAT.bark, BMAT.logEnd, BMAT.logEnd], parts.big, parts.bt);
    instM(root, GEO.ucyl, BMAT.rope, parts.ropes);
  } else if (type === 'stone') {
    instM(root, GEO.ubox, BMAT.stone, parts.box);
    instM(root, GEO.ubox, BMAT.stoneDark, parts.dark);
  } else {
    instM(root, GEO.ubox, BMAT.redSteel, parts.steel);
    instM(root, GEO.ucyl, BMAT.redSteel, parts.cols);
    instM(root, GEO.usph, BMAT.lamp, parts.lamps);
  }
}
function buildCurveBridge(root, type, pts, rng, avoid, river) {
  const P = pathThrough(pts);
  const r = rng || Math.random, tone = () => 0.72 + r() * 0.4, hw = RIVER.BW / 2;
  avoid = avoid || (() => false);
  // s の位置の、中心・左右の向き（水平）
  const fr = (s) => { const a = P.at(s); return { c: V(a.x, (a.y || 0) + 0.045, a.z), n: V(-a.hz, 0, a.hx), t: V(a.hx, 0, a.hz) }; }; // まっすぐの橋（0.03）と重なってもちらつかないよう、少しだけ高く
  const off = (f, d, dy) => f.c.clone().addScaledVector(f.n, d).add(V(0, dy || 0, 0));
  const ss = (step, pad) => { const out = [], n = Math.max(1, Math.round((P.len - 2 * pad) / step)); for (let i = 0; i <= n; i++) out.push(pad + ((P.len - 2 * pad) * i) / n); return out; };
  const overWater = (p) => !river || river.inRiver(p.x, p.z, -1);
  const sides = [-1, 1];
  const deckStrips = (th, topMat, sideMat, period) => {
    const rows = ss(0.8, 0).map(fr);
    root.add(stripMesh(rows.map((f) => [off(f, hw), off(f, -hw)]), topMat, period));
    for (const sd of sides) root.add(stripMesh(rows.map((f) => [off(f, sd * hw), off(f, sd * hw, -th)]), sideMat, 1));
    root.add(stripMesh(rows.map((f) => [off(f, hw, -th), off(f, -hw, -th)]), sideMat, 1));
  };
  const parts = newParts(), kit = railKit(type, parts, tone);
  // 欄干：s の点を順に結ぶ（ほかの橋の上は飛ばす）
  const railLine = (sd, d, step, pad) => {
    let prev = null, k = 0;
    for (const s of ss(step, pad)) {
      const p = off(fr(s), sd * d);
      const ok = !avoid(p.x, p.z, 'rail');
      if (ok) { kit.post(p, k++); if (prev) kit.seg(prev, p); }
      prev = ok ? p : null;
    }
  };
  // 床の下の杭・柱：水の上で、ほかの橋の床の上でないところだけ
  const pier = (p) => { if (overWater(p) && !avoid(p.x, p.z, 'pier')) kit.pier(p); };
  if (type === 'log') {
    for (let s = 0.35; s < P.len - 0.3; s += 0.66 + (r() - 0.5) * 0.08) {
      const f = fr(s), rad = 0.3 + r() * 0.08, ext = RIVER.BW / 2 + 0.17 + (r() - 0.5) * 0.35;
      parts.logs.push(mSeg(off(f, ext, 0.02 - rad), off(f, -ext, 0.02 - rad), rad)); parts.lt.push(tone());
    }
    for (const sd of sides) { const pp = ss(1.5, 0).map((s) => off(fr(s), sd * (hw - 1.3), -0.72)); for (let i = 1; i < pp.length; i++) { parts.big.push(mSeg(pp[i - 1], pp[i], 0.42)); parts.bt.push(0.8); } }
    for (const sd of sides) railLine(sd, hw - 0.12, 2.7, 0.5);
    for (const s of ss(5.5, 1.8)) for (const sd of sides) pier(off(fr(s), sd * (hw - 0.9)));
  } else if (type === 'stone') {
    deckStrips(0.9, dbl('sd', BMAT.stoneDeck), dbl('st', BMAT.stone), 5);
    for (const sd of sides) railLine(sd, hw - 0.24, 1.0, 0.3);
    for (const s of ss(9, 3)) { // 石橋の下は、道の向きにそろえた太い橋脚
      const f = fr(s);
      if (overWater(f.c) && !avoid(f.c.x, f.c.z, 'pier')) { const top = f.c.y - 0.86, h = top - RIVER.BED_Y; parts.dark.push(mAt(f.c.x, top - h / 2, f.c.z, RIVER.BW - 1.2, h, 1.8, Math.atan2(f.t.x, f.t.z))); }
    }
  } else {
    deckStrips(0.8, dbl('rd', BMAT.redDeck), dbl('rs', BMAT.redSteel), 6);
    for (const sd of sides) railLine(sd, hw - 0.16, 0.9, 0.3);
    for (const s of ss(12, 4)) { const f = fr(s); for (const sd of sides) pier(off(f, sd * (hw - 2.3))); }
  }
  flushParts(root, type, parts);
}

// アンコールの張り出し：橋の床が外へ丸くふくらんだ形（穴はない）。欄干はふちに沿って曲げる
//   b：{ outline（ふちの点。手前のつけ根 → 外 → 先のつけ根。z は減っていく）, edge（本体の橋のふちの x）, dir（外の向き）, loop（兵士が回る道。床にうすい矢印を描く）}
function buildBulge(root, type, b, rng) {
  const r = rng || Math.random, tone = () => 0.72 + r() * 0.4, { outline, edge, dir } = b, Y = 0.045;
  const zN = outline[0].z, zF = outline[outline.length - 1].z;
  const poly = outline.concat([{ x: edge - dir * 0.3, z: zF }, { x: edge - dir * 0.3, z: zN }]);
  const inside = polySD(poly);
  const P = pathThrough(outline);
  // ふちから内側へ d だけ入った点を、step ごとに
  const rim = (d, step, pad, dy) => {
    const out = [], n = Math.max(1, Math.round((P.len - 2 * pad) / step));
    for (let i = 0; i <= n; i++) {
      const a = P.at(pad + ((P.len - 2 * pad) * i) / n), nx = -a.hz, nz = a.hx, sg = inside(a.x + nx * 0.6, a.z + nz * 0.6) < 0 ? 1 : -1;
      out.push(V(a.x + nx * sg * d, Y + (dy || 0), a.z + nz * sg * d));
    }
    return out;
  };
  const xOut = (z) => { for (let i = 1; i < outline.length; i++) if (outline[i].z <= z) { const p = outline[i - 1], q = outline[i], t = (z - p.z) / ((q.z - p.z) || 1); return p.x + (q.x - p.x) * t; } return outline[outline.length - 1].x; };
  // 床の下の杭・柱（水の上だけ）を、張り出しの中に並べる
  const grid = (step, inset) => { const out = []; for (let z = zN - step / 2; z > zF; z -= step) for (let o = step / 2; o < 30; o += step) { const x = edge + dir * o; if (inside(x, z) < -inset) out.push(V(x, Y, z)); } return out; };
  const skirt = (top, bot, mat) => root.add(stripMesh(outline.map((p) => [V(p.x, Y + top, p.z), V(p.x, Y + bot, p.z)]), mat, 1));
  const parts = newParts(), kit = railKit(type, parts, tone);
  const rail = (pts) => pts.forEach((p, i) => { kit.post(p, i); if (i) kit.seg(pts[i - 1], p); }); // ふちに沿った欄干
  if (type === 'log') {
    for (let z = zN - 0.4; z > zF + 0.3; z -= 0.66 + (r() - 0.5) * 0.08) { // 本体の床と同じ向きの丸太。ふちに合わせて長さを変える
      const rad = 0.3 + r() * 0.08, xa = edge - dir * 0.2, xb = xOut(z) + dir * (r() * 0.35 - 0.05);
      if ((xb - xa) * dir < 0.6) continue;
      parts.logs.push(mSeg(V(xa, Y + 0.02 - rad, z), V(xb, Y + 0.02 - rad, z), rad)); parts.lt.push(tone());
    }
    const beam = rim(1.1, 1.5, 0, -0.75); for (let i = 1; i < beam.length; i++) { parts.big.push(mSeg(beam[i - 1], beam[i], 0.42)); parts.bt.push(0.8); }
    rail(rim(0.12, 2.7, 0.4));
    for (const p of grid(4.6, 1.2)) kit.pier(p);
  } else if (type === 'stone') {
    root.add(ownMesh(polyGeo(poly, [], Y, 1 / 5), BMAT.stoneDeck));
    skirt(0, -0.9, dbl('st', BMAT.stone));
    skirt(-0.9, RIVER.BED_Y - Y, dbl('sk', BMAT.stoneDark)); // 水の中から立ち上がる、丸い石垣
    rail(rim(0.24, 1.0, 0.3));
  } else {
    root.add(ownMesh(polyGeo(poly, [], Y, 1 / 8), BMAT.redDeck));
    skirt(0, -0.8, dbl('rs', BMAT.redSteel));
    rail(rim(0.16, 0.9, 0.3));
    for (const p of grid(6, 2)) kit.pier(p);
  }
  flushParts(root, type, parts);
  // 回る道すじを、床にうすい矢印で
  chevronsAlong(root, b.loop, Y + 0.09, { x: edge, dir }, type === 'stone' ? MAT.chevronFaintDark : MAT.chevronFaint);
}

// ---------- 陸の道の帯と、道すじに沿った矢印 ----------
function ribbonMesh(pts, width, mat, yOff) {
  const pos = [], idx = [], nrm = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx, p = pts[i], y = (p.y || 0) + (yOff || 0);
    pos.push(p.x + (nx * width) / 2, y, p.z + (nz * width) / 2, p.x - (nx * width) / 2, y, p.z - (nz * width) / 2);
    const dl = Math.hypot(b.x - a.x, b.z - a.z) || 1, slope = ((b.y || 0) - (a.y || 0)) / dl;
    const ny = 1 / Math.sqrt(1 + slope * slope), nt = -slope * ny;
    for (let k = 0; k < 2; k++) nrm.push(tx * nt, ny, tz * nt);
  }
  // 三角形は上向き（上から見て反時計回り）にそろえる。道を表側だけ描くので、折れ返った三角形があっても黒く出ない
  const xz = (v) => [pos[v * 3], pos[v * 3 + 2]];
  let sgn = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = xz(2 * i), [bx, bz] = xz(2 * i + 1), [cx, cz] = xz(2 * i + 2);
    sgn += (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const k = i * 2;
    if (sgn >= 0) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return ownMesh(g, mat);
}
function chevronsAlong(root, pts, yOff, clip, mat) {
  const P = pathThrough(pts);
  for (let s = 2.5; s < P.len - 1; s += 4.2) {
    const a = P.at(s);
    if (clip && (a.x - clip.x) * clip.dir < 1.2) continue; // レーンの上には矢じりを置かない
    const m = new THREE.Mesh(GEO.chevron, mat || MAT.chevron);
    m.position.set(a.x, a.y + (yOff || 0.06), a.z);
    m.rotation.y = Math.atan2(-a.hx, -a.hz);
    root.add(m);
  }
}
