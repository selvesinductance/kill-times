// 五門の兵：ゲート：板に書く数式、カテゴリの素材とレアリティの縁取り、上の印、ゲートを組み立てる
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- ゲートの板に書く大きな数式 ----------
// UDデジタル教科書体が入っていればそれ（Windows）、なければ BIZ UDPGothic
const MATH_FONT = '"UD Digi Kyokasho N-B", "UD デジタル 教科書体 N-B", "UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "BIZ UDPGothic", "STIX Two Text", sans-serif';
const fontStr = (size, it) => (it ? 'italic ' : '') + '700 ' + size.toFixed(1) + 'px ' + MATH_FONT;
function measureTokens(ctx, tokens, S) {
  const items = [];
  let x = 0;
  const text = (s, size, dy, it) => { ctx.font = fontStr(size, it); items.push({ s, x, size, dy, it }); x += ctx.measureText(s).width || 0; };
  for (const t of tokens) {
    if (typeof t === 'string') { text(t, S, 0, false); continue; }
    if (t.sup != null) { x += S * 0.03; text(String(t.sup), S * 0.6, -S * 0.44, !!t.it); x += S * 0.02; continue; }
    if (t.sub != null) { text(String(t.sub), S * 0.6, S * 0.2, !!t.it); continue; }
    if (t.frac) {
      const fs = S * 0.58;
      ctx.font = fontStr(fs);
      const wn = ctx.measureText(t.frac[0]).width || 0, wd = ctx.measureText(t.frac[1]).width || 0;
      const w = Math.max(wn, wd) + S * 0.16, x0 = x + S * 0.05;
      items.push({ s: t.frac[0], x: x0 + (w - wn) / 2, size: fs, dy: -S * 0.42 });
      items.push({ s: t.frac[1], x: x0 + (w - wd) / 2, size: fs, dy: S * 0.22 });
      items.push({ bar: true, x: x0, w, dy: -S * 0.3 });
      x = x0 + w + S * 0.05;
      continue;
    }
    if (t.stack) {
      const fs = S * 0.45;
      ctx.font = fontStr(fs);
      const w = Math.max(ctx.measureText(t.stack[0]).width || 0, ctx.measureText(t.stack[1]).width || 0), x0 = x + S * 0.04;
      items.push({ s: t.stack[0], x: x0, size: fs, dy: -S * 0.52 });
      items.push({ s: t.stack[1], x: x0, size: fs, dy: S * 0.24 });
      x = x0 + w + S * 0.06;
      continue;
    }
    if (t.it) text(t.it, S, 0, true);
  }
  return { items, w: x };
}
// 板は素材の色の半透明、文字はその上で読める色（縁取りつき）
const PANEL_INK = {
  add: { bg: 'rgba(192, 133, 80, 0.62)', edge: 'rgba(90, 55, 25, 0.55)', ink: '#fff6e6', line: 'rgba(60, 34, 14, 0.85)' },
  muldiv: { bg: 'rgba(212, 148, 90, 0.62)', edge: 'rgba(110, 60, 25, 0.55)', ink: '#fff3e2', line: 'rgba(80, 40, 12, 0.85)' },
  sign: { bg: 'rgba(242, 245, 248, 0.66)', edge: 'rgba(120, 130, 145, 0.55)', ink: '#23262d', line: 'rgba(255, 255, 255, 0.9)' },
  pow: { bg: 'rgba(189, 162, 238, 0.6)', edge: 'rgba(90, 60, 160, 0.55)', ink: '#faf6ff', line: 'rgba(52, 30, 105, 0.9)' },
  mod: { bg: 'rgba(106, 109, 117, 0.66)', edge: 'rgba(30, 32, 38, 0.6)', ink: '#eef0f4', line: 'rgba(20, 22, 26, 0.9)' },
  rand: { bg: 'rgba(245, 238, 221, 0.7)', edge: 'rgba(150, 125, 75, 0.55)', ink: '#4a3a1c', line: 'rgba(255, 252, 242, 0.9)' },
  const: { bg: 'rgba(248, 246, 240, 0.72)', edge: 'rgba(180, 150, 80, 0.6)', ink: '#6b4e12', line: 'rgba(255, 255, 250, 0.9)' },
};
function drawFormula(canvas, tokens, cat) {
  let ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  const st = PANEL_INK[cat] || PANEL_INK.add;
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, cw, ch);
  if (cat === 'mod') { ctx.fillStyle = 'rgba(30, 32, 38, 0.35)'; for (let i = 1; i < 8; i++) ctx.fillRect((cw * i) / 8 - 3, 0, 6, ch); }
  ctx.strokeStyle = st.edge;
  ctx.lineWidth = 6;
  ctx.strokeRect(13, 13, cw - 26, ch - 26);
  let S = Math.min(ch * 0.58, 172);
  let m = measureTokens(ctx, tokens, S);
  const maxW = cw - 56;
  if (m.w > maxW) { S *= maxW / m.w; m = measureTokens(ctx, tokens, S); }
  const x0 = (cw - m.w) / 2, base = ch / 2 + S * 0.36;
  // 数式は別の紙に描いてから、50% の透明度で板に重ねる（縁取りと文字が重なって濃くならないように）
  const ink = document.createElement('canvas');
  ink.width = cw; ink.height = ch;
  const main = ctx;
  ctx = ink.getContext('2d') || main;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const pass of ['line', 'ink']) {
    ctx.fillStyle = st.ink;
    ctx.strokeStyle = st.line;
    for (const it of m.items) {
      if (it.bar) {
        const h = it.h || S * 0.056, bx = x0 + it.x, by = base + it.dy - h / 2;
        if (pass === 'line') { ctx.lineWidth = S * 0.07; ctx.strokeRect(bx, by, it.w, h); } else ctx.fillRect(bx, by, it.w, h);
        continue;
      }
      ctx.font = fontStr(it.size, it.it);
      if (pass === 'line') { ctx.lineWidth = it.size * 0.12; ctx.strokeText(it.s, x0 + it.x, base + it.dy); } else ctx.fillText(it.s, x0 + it.x, base + it.dy);
    }
  }
  if (ctx !== main) { main.globalAlpha = 0.5; main.drawImage(ink, 0, 0); main.globalAlpha = 1; }
}

// ゲートの枠と板は、カテゴリの素材の色（木・青銅・鏡・水晶・黒鉄・象牙・大理石）
const CAT_STYLE = {
  add: { frame: 0x8a5a33, panel: 0xc08550, metal: 0, rough: 0.9 },
  muldiv: { frame: 0xa8652f, panel: 0xd4945a, metal: 0.65, rough: 0.35 },
  sign: { frame: 0xd8dfe7, panel: 0xf2f5f8, metal: 0.85, rough: 0.12 },
  pow: { frame: 0x8a68c8, panel: 0xbda2ee, metal: 0.1, rough: 0.15 },
  mod: { frame: 0x40424a, panel: 0x6a6d75, metal: 0.7, rough: 0.45 },
  rand: { frame: 0xe6dbbd, panel: 0xf5eedd, metal: 0, rough: 0.55 },
  const: { frame: 0xeeebe4, panel: 0xf8f6f0, metal: 0.05, rough: 0.4 },
};
const CATM = {};
for (const [k, c] of Object.entries(CAT_STYLE)) {
  CATM[k] = {
    frame: new THREE.MeshStandardMaterial({ color: c.frame, metalness: c.metal, roughness: c.rough, transparent: k === 'pow', opacity: k === 'pow' ? 0.85 : 1 }),
    back: new THREE.MeshBasicMaterial({ color: c.panel, transparent: true, opacity: 0.6 }),
  };
}
const EMB = {
  wood: new THREE.MeshStandardMaterial({ color: 0xbb834b, roughness: 0.85 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0xc8843e, metalness: 0.75, roughness: 0.3, emissive: 0x3a1e08, emissiveIntensity: 0.35 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xeef3f8, metalness: 0.55, roughness: 0.08, emissive: 0x3a4048, emissiveIntensity: 0.5 }),
  mirrorDisc: new THREE.MeshStandardMaterial({ color: 0xc9d6e2, metalness: 0.7, roughness: 0.05, emissive: 0x24303c, emissiveIntensity: 0.6 }),
  crystal: new THREE.MeshStandardMaterial({ color: 0xb79cff, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.85, emissive: 0x4a2fa0, emissiveIntensity: 0.5 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x6b6f77, metalness: 0.7, roughness: 0.45 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xf7f0de, roughness: 0.45 }),
  pip: new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6 }),
  pipRed: new THREE.MeshStandardMaterial({ color: 0xc8352b, roughness: 0.5 }),
  marble: new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.35 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe0b445, metalness: 0.85, roughness: 0.28, emissive: 0x6b4c10, emissiveIntensity: 0.4 }),
};
// レアリティの縁取り：白 → 緑 → 青 → 紫 → 金 → 虹（ゲームでおなじみの並び）
function rainbowTexture() {
  const c = canvasOf(128, 128, (x) => {
    const img = x.createImageData(128, 128), hc = new THREE.Color();
    for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
      hc.setHSL(((i + j) / 128) % 1, 0.95, 0.6); // 縦横どちらにも1周期でつながる（繰り返しても継ぎ目が出ない）
      const o = (j * 128 + i) * 4;
      img.data[o] = hc.r * 255; img.data[o + 1] = hc.g * 255; img.data[o + 2] = hc.b * 255; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.5, 0.5); // 使う面には絵の半分だけを貼る → 色の周回が半分（対角線で1周）
  return t;
}
const RAINBOW = rainbowTexture();
const TRIM = [
  new THREE.MeshStandardMaterial({ color: 0xf6f6f4, metalness: 0.2, roughness: 0.4, emissive: 0x606060, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0x3fbf5a, metalness: 0.3, roughness: 0.35, emissive: 0x0f4a1a, emissiveIntensity: 0.35 }),
  new THREE.MeshStandardMaterial({ color: 0x3b82f0, metalness: 0.3, roughness: 0.35, emissive: 0x10306a, emissiveIntensity: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0xa45cf2, metalness: 0.3, roughness: 0.3, emissive: 0x5a20a0, emissiveIntensity: 0.6 }),
  new THREE.MeshStandardMaterial({ color: 0xf0c869, metalness: 0.7, roughness: 0.25, emissive: 0xf0b030, emissiveIntensity: 0.8 }),
  new THREE.MeshBasicMaterial({ map: RAINBOW }),
];

const gateGeoCache = {};
function gateGeo(w) {
  if (!gateGeoCache[w]) {
    gateGeoCache[w] = {
      post: new THREE.BoxGeometry(0.8, GH + 0.6, 0.8),
      foot: new THREE.BoxGeometry(1.25, 0.4, 1.25),
      beam: new THREE.BoxGeometry(w + 0.2, 0.8, 0.95),
      plinth: new THREE.BoxGeometry(3.4, 0.35, 0.9),
      panel: new THREE.PlaneGeometry(w - 1.0, GH - 0.3),
      trimV: new THREE.BoxGeometry(0.24, GH - 0.3, 0.2),
      trimH: new THREE.BoxGeometry(w - 1.0, 0.24, 0.2),
    };
  }
  return gateGeoCache[w];
}

// ---------- ゲートの上の印（カテゴリごとの立体の飾り） ----------
function stroke(group, pts, r, mat) {
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const s = new THREE.Mesh(GEO.usph, mat);
    s.scale.setScalar(r);
    s.position.set(x, y, 0);
    group.add(s);
    if (i) {
      const [px, py] = pts[i - 1];
      const c = new THREE.Mesh(GEO.ucyl, mat);
      c.scale.set(r, Math.hypot(x - px, y - py), r);
      c.position.set((x + px) / 2, (y + py) / 2, 0);
      c.rotation.z = Math.atan2(y - py, x - px) - Math.PI / 2;
      group.add(c);
    }
  }
}
function dot(group, x, y, r, mat) { const s = new THREE.Mesh(GEO.usph, mat); s.scale.setScalar(r); s.position.set(x, y, 0); group.add(s); }
// ゲートの枠（柱・足・はり・台）と、板のふち（4本）を、それぞれ1つの形にまとめる（幅ごとに1回だけ作る）
const gateFrameCache = {};
function gateFrame(w) {
  if (gateFrameCache[w]) return gateFrameCache[w];
  const gg = gateGeo(w), hw = w / 2 - 0.45, ex = (w - 1.0) / 2 - 0.12, T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  return (gateFrameCache[w] = {
    frame: bakeGeos([[gg.post, T(-hw, (GH + 0.6) / 2, 0)], [gg.post, T(hw, (GH + 0.6) / 2, 0)], [gg.foot, T(-hw, 0.2, 0)], [gg.foot, T(hw, 0.2, 0)], [gg.beam, T(0, GH + 0.3, 0)], [gg.plinth, T(0, GH + 0.875, 0)]]),
    trim: bakeGeos([[gg.trimV, T(-ex, GH / 2, 0.1)], [gg.trimV, T(ex, GH / 2, 0.1)], [gg.trimH, T(0, GH - 0.27, 0.1)], [gg.trimH, T(0, 0.27, 0.1)]]),
  });
}
// ゲートの上の印：同じ素材の部品を1つの形にまとめる（カテゴリごとに1回だけ作る）。回る部品（サイコロ・水晶）は、回る単位ごとにまとめる
const emblemCache = {};
function emblemFor(cat) {
  if (!emblemCache[cat]) {
    const t = buildEmblem(cat), animSet = new Set(t.anim);
    t.g.updateMatrixWorld(true);
    const rel = (o, root) => new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld);
    const bucket = (map, mat, item) => { if (!map.has(mat)) map.set(mat, []); map.get(mat).push(item); };
    const stat = new Map(), anims = t.anim.map((a) => ({ a, parts: new Map() }));
    t.g.traverse((o) => {
      if (!o.isMesh) return;
      let an = null;
      for (let q = o; q && q !== t.g; q = q.parent) if (animSet.has(q)) { an = q; break; }
      if (an) bucket(anims.find((r) => r.a === an).parts, o.material, [o.geometry, rel(o, an)]);
      else bucket(stat, o.material, [o.geometry, rel(o, t.g)]);
    });
    const bake = (map) => [...map].map(([mat, items]) => ({ mat, geo: bakeGeos(items) }));
    emblemCache[cat] = { stat: bake(stat), anims: anims.map((r) => ({ pos: r.a.position.clone(), rot: r.a.rotation.clone(), scale: r.a.scale.clone(), parts: bake(r.parts) })) };
  }
  const c = emblemCache[cat], g = new THREE.Group(), anim = [];
  for (const p of c.stat) g.add(new THREE.Mesh(p.geo, p.mat));
  for (const a of c.anims) {
    const ag = new THREE.Group();
    ag.position.copy(a.pos); ag.rotation.copy(a.rot); ag.scale.copy(a.scale);
    for (const p of a.parts) ag.add(new THREE.Mesh(p.geo, p.mat));
    g.add(ag); anim.push(ag);
  }
  return { g, anim };
}
function buildEmblem(cat) {
  const g = new THREE.Group();
  const anim = [];
  if (cat === 'add') {
    stroke(g, [[-1.5, 0], [-0.3, 0]], 0.21, EMB.wood); stroke(g, [[-0.9, -0.6], [-0.9, 0.6]], 0.21, EMB.wood);
    stroke(g, [[0.35, 0], [1.5, 0]], 0.21, EMB.wood);
  } else if (cat === 'muldiv') {
    stroke(g, [[-1.45, -0.55], [-0.35, 0.55]], 0.17, EMB.bronze); stroke(g, [[-1.45, 0.55], [-0.35, -0.55]], 0.17, EMB.bronze);
    stroke(g, [[0.35, 0], [1.5, 0]], 0.17, EMB.bronze); dot(g, 0.92, 0.5, 0.21, EMB.bronze); dot(g, 0.92, -0.5, 0.21, EMB.bronze);
  } else if (cat === 'sign') {
    const d = new THREE.Mesh(GEO.disc, EMB.mirrorDisc); d.rotation.x = Math.PI / 2; d.position.z = -0.3; g.add(d);
    stroke(g, [[-0.62, 0.22], [0.62, 0.22]], 0.16, EMB.mirror); stroke(g, [[0, -0.36], [0, 0.8]], 0.16, EMB.mirror);
    stroke(g, [[-0.62, -0.66], [0.62, -0.66]], 0.16, EMB.mirror);
  } else if (cat === 'pow') {
    stroke(g, [[-1.1, -0.05], [-0.8, 0.12], [-0.45, -0.78], [0.0, 0.8], [1.1, 0.8]], 0.16, EMB.crystal);
    for (const sx of [-1.75, 1.75]) { const o = new THREE.Mesh(GEO.oct, EMB.crystal); o.position.set(sx, 0.1, 0); g.add(o); anim.push(o); }
  } else if (cat === 'mod') {
    stroke(g, [[0.65, 0.8], [-0.65, 0.3], [0.65, -0.2]], 0.16, EMB.iron);
    stroke(g, [[-0.65, -0.5], [0.65, -0.5]], 0.16, EMB.iron); stroke(g, [[-0.65, -0.86], [0.65, -0.86]], 0.16, EMB.iron);
  } else if (cat === 'rand') {
    const die = new THREE.Group();
    const cube = new THREE.Mesh(GEO.ubox, EMB.ivory); cube.scale.setScalar(1.5); die.add(cube);
    const pip = (x, y, z, sx, sy, sz, m) => { const p = new THREE.Mesh(GEO.usph, m || EMB.pip); p.scale.set(sx, sy, sz); p.position.set(x, y, z); die.add(p); };
    for (const [x, y] of [[-0.38, -0.38], [0.38, -0.38], [0, 0], [-0.38, 0.38], [0.38, 0.38]]) pip(x, y, 0.75, 0.13, 0.13, 0.05);
    pip(0, 0.75, 0, 0.22, 0.05, 0.22, EMB.pipRed);
    for (const [y, z] of [[0.38, -0.38], [0, 0], [-0.38, 0.38]]) pip(0.75, y, z, 0.05, 0.13, 0.13);
    die.rotation.set(0.45, -0.6, 0);
    die.position.y = 0.35;
    g.add(die);
    anim.push(die);
  } else {
    const slab = new THREE.Mesh(GEO.ubox, EMB.marble); slab.scale.set(3.1, 2.0, 0.4); g.add(slab);
    const sig = new THREE.Group();
    stroke(sig, [[0.6, 0.62], [-0.6, 0.62], [0.1, 0], [-0.6, -0.62], [0.6, -0.62]], 0.12, EMB.gold);
    sig.position.z = 0.26;
    g.add(sig);
  }
  return { g, anim };
}

function buildGate(gate, pos) {
  const type = G.TYPES[gate.type];
  const w = pos.w || RIVER.BW, gg = gateGeo(w), fm = CATM[type.cat].frame;
  const g = new THREE.Group();
  g.position.set(pos.x, 0, pos.z);
  g.rotation.y = pos.rot || 0;
  const gf = gateFrame(w);
  g.add(new THREE.Mesh(gf.frame, fm)); // 柱・足・はり・台は、まとめて1つ
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * (GH - 0.3)) / (w - 1.0));
  const tokens = type.label(gate.p);
  drawFormula(canvas, tokens, type.cat);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const panelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const panel = new THREE.Mesh(gg.panel, panelMat); panel.position.set(0, GH / 2, 0); g.add(panel);
  const back = new THREE.Mesh(gg.panel, CATM[type.cat].back); back.rotation.y = Math.PI; back.position.set(0, GH / 2, -0.02); g.add(back);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fl = new THREE.Mesh(gg.panel, flashMat); fl.position.set(0, GH / 2, 0.05); g.add(fl);
  const em = emblemFor(type.cat);
  em.g.position.set(0, GH + 2.05, 0);
  em.g.rotation.x = -0.32;
  g.add(em.g);
  g.add(new THREE.Mesh(gf.trim, TRIM[type.rarity])); // 板のふちの4本も、まとめて1つ
  const anchor = document.createElement('div');
  anchor.className = 'anchor';
  const lab = document.createElement('div');
  lab.className = 'gl c-' + type.cat + ' r' + type.rarity;
  lab.innerHTML = gateHTML(gate.type, gate.p);
  anchor.appendChild(lab);
  labelsEl.appendChild(anchor);
  return { group: g, panelMat, flashMat, tex, canvas, tokens, x: pos.x, z: pos.z, type, anchor, lab, extras: em.anim, flash: 0, lw: 0, lh: 0 };
}
function redrawPanels() {
  if (!course) return;
  course.gates.forEach((g) => { drawFormula(g.canvas, g.tokens, g.type.cat); g.tex.needsUpdate = true; g.lw = 0; });
}
if (document.fonts && document.fonts.load) {
  Promise.all(['700 64px "BIZ UDPGothic"', '600 64px "STIX Two Text"'].map((f) => document.fonts.load(f))).then(redrawPanels, () => {});
}
