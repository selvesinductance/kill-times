// 五門の兵：カメラ（追う視点・真上・ボス戦・ブラックホール・タイトル）と、画面上の札
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- カメラ ----------
let camMode = 'follow';
const camPos = new THREE.Vector3(0, 10, RIVER.WAIT + 30);
const camLook = new THREE.Vector3(0, 1, RIVER.WAIT);
const camUp = new THREE.Vector3(0, 1, 0);
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpU = new THREE.Vector3();
let shake = 0;
let reserve = { top: 74, bottom: 90, ctlTop: 9999, at: -1 };
function screenReserve() {
  const now = performance.now();
  if (now - reserve.at < 300) return reserve;
  const ar = app.getBoundingClientRect(), hud = $('hud');
  const hb = hud.hidden ? 0 : hud.getBoundingClientRect().bottom - ar.top;
  const ctl = $('controls');
  const ct = ctl.hidden ? 0 : ctl.getBoundingClientRect().top - ar.top;
  reserve = { top: Math.max(24, (hb || 56) + 8), bottom: game.screen === 'game' ? 90 : 24, ctlTop: ct > 0 ? ct : Math.max(1, app.clientHeight) - 20, at: now };
  if (hb) app.style.setProperty('--hud-h', Math.round(hb) + 'px');
  return reserve;
}
function overView() {
  const e = course ? course.geo.ext : { x0: -14, x1: 14, z0: -48, z1: 19 };
  const H = Math.max(1, app.clientHeight);
  const t = Math.tan(THREE.MathUtils.degToRad(FOV_OVER / 2));
  fovTarget = FOV_OVER;
  const { top, bottom } = screenReserve();
  const usable = Math.max(0.45, 1 - (top + bottom) / H);
  // 画面の横・縦に u だけ収めるのに要る高さ
  const fitAcross = (u) => u / (t * camera.aspect * 0.94), fitAlong = (u) => u / (t * usable);
  const fit = (z0, z1) => {
    const hl = (z1 - z0) / 2 + 3, hw = (e.x1 - e.x0) / 2 + 1.5;
    return rtl() ? Math.max(fitAcross(hl), fitAlong(hw)) : Math.max(fitAlong(hl), fitAcross(hw));
  };
  let z0 = e.z0;
  const bf = course && course.geo.bossFar;
  if (bf !== undefined && bf < z0 && fit(bf, e.z1) <= fit(e.z0, e.z1) * 1.15) z0 = bf;
  const zMid = (z0 + e.z1) / 2, xMid = (e.x0 + e.x1) / 2;
  const halfLen = (e.z1 - z0) / 2 + 3, halfWid = (e.x1 - e.x0) / 2 + 1.5;
  if (rtl()) {
    // 兵士は画面の右から左へ（前方 −z が画面の左、+x が画面の上）
    const d = Math.max(fitAcross(halfLen), fitAlong(halfWid));
    const shift = (((bottom - top) / 2) / H) * 2 * d * t;
    tmpL.set(xMid - shift, 0, zMid);
    tmpP.set(xMid - shift, d, zMid + d * 0.08);
    tmpU.set(1, 0, 0);
  } else {
    const d = Math.max(fitAlong(halfLen), fitAcross(halfWid));
    const shift = (((bottom - top) / 2) / H) * 2 * d * t;
    tmpL.set(xMid, 0, zMid + shift);
    tmpP.set(xMid, d, zMid + shift + d * 0.06);
    tmpU.set(0, 0, -1);
  }
}
function followView() {
  tmpP.set(sold.x - sold.hx * 17, 10 + sold.y, sold.z - sold.hz * 17);
  tmpL.set(sold.x + sold.hx * 16, 1.5 + sold.y * 0.5, sold.z + sold.hz * 16);
  tmpU.set(0, 1, 0);
}
// ボス戦は斜め前から：ボスの顔が見え、反対側の真横へ倒れる姿が奥へ向かって見える
function clashView() {
  const b = course.geo.boss, f = b.f, sx = f.z, sz = -f.x; // s はボスの +x 側（倒れるのは −x 側）
  // 縦長の画面ほど、正面寄り → 斜め45°寄りにして高く引く（倒れた体が画面の奥行き方向にも伸び、横幅に収まる）
  const k = Math.min(1, Math.max(0, (1.1 / camera.aspect - 1) / 1.2));
  const A = 28 - k * 6, B = 12 + k * 22, H = 19 + k * 11;
  // 倒れていくのに合わせて、倒れる側へ少しカメラを振る
  const o = game.outcome, fall = o && o.win ? Math.min(1, Math.max(0, (game.phaseT - o.tEnd) / 0.8)) : 0;
  const pan = 4 + (k ? 3 : 5) * fall * (2 - fall);
  tmpP.set(b.x + f.x * A + sx * (B - pan), H, b.z + f.z * A + sz * (B - pan));
  tmpL.set(b.x + f.x * 2 - sx * pan, 9 - k * 3, b.z + f.z * 2 - sz * pan);
  tmpU.set(0, 1, 0);
}
// ブラックホールは後ろから：ふくらむのに合わせて引き、画角も広げて巨大さを見せる
function holeView() {
  const g = Math.min(1, hole.t / BH_GROW), e = 1 - (1 - g) * (1 - g), c = hole.grp.position;
  const k = Math.min(1.6, Math.max(1, 1.1 / camera.aspect)); // 縦長の画面ではもっと引く
  const D = (18 + 20 * e) * k, H = 10 + 6 * e;
  tmpP.set(c.x - sold.hx * D, H, c.z - sold.hz * D);
  tmpL.set(c.x, BH_Y - 1 - e, c.z);
  tmpU.set(0, 1, 0);
  fovTarget = 50 + 10 * e;
}
let titleAngle = 0;
function titleView(dt) {
  titleAngle += dt * 0.07;
  const e = course ? course.geo.ext : { z0: -48, z1: 11 };
  const cz = (e.z0 + e.z1) / 2;
  tmpP.set(Math.sin(titleAngle) * 74, 46, cz + Math.cos(titleAngle) * 74);
  tmpL.set(0, 0, cz);
  tmpU.set(0, 1, 0);
}
let fovTarget = FOV_FOLLOW;
let peek = null; // 撮影用：決めた位置からカメラを向ける（遊ぶ人には関係しない）
let camCut = false;
// ボス戦の視点：戦い始める前、橋を渡りきったところ（道のしるし）から切り替える
function bossCamOn() {
  if (game.phase === 'clash') return true;
  const run = game.run;
  if (game.phase !== 'run' || !run || run.plaza || run.seg !== run.segs.length - 1) return false;
  const seg = run.segs[run.seg];
  return !!seg && seg.markS !== undefined && run.s >= seg.markS;
}
function updateCamera(dt, snap) {
  fovTarget = FOV_FOLLOW;
  if (camCut) { snap = true; camCut = false; }
  if (peek) { tmpP.set(peek[0], peek[1], peek[2]); tmpL.set(peek[3], peek[4], peek[5]); tmpU.set(0, 1, 0); snap = true; }
  else if (game.screen === 'title') titleView(dt);
  else if (course && bossCamOn()) clashView();
  else if (game.phase === 'mine' && hole) holeView();
  else if (camMode === 'over') overView();
  else followView();
  const k = snap ? 1 : 1 - Math.exp(-dt * (reduceMotion ? 12 : 3.4));
  camPos.lerp(tmpP, k);
  camLook.lerp(tmpL, k);
  camUp.lerp(tmpU, k).normalize();
  const nearT = Math.min(40, Math.max(0.3, camPos.y * 0.2));
  let proj = false;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { camera.fov += (fovTarget - camera.fov) * k; proj = true; }
  if (Math.abs(camera.near - nearT) > nearT * 0.1) { camera.near = nearT; proj = true; }
  if (proj) camera.updateProjectionMatrix();
  camera.position.copy(camPos);
  // 高いところから見下ろしても地面がかすまないよう、霧はカメラの高さのぶん遠ざける
  const lift = Math.max(0, camPos.y - 20);
  scene.fog.near = 160 + lift; scene.fog.far = 700 + lift;
  if (shake > 0 && !reduceMotion) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.2);
  }
  camera.up.copy(camUp);
  camera.lookAt(camLook);
  sky.position.copy(camera.position);
}

// ---------- 画面上の札 ----------
const v3 = new THREE.Vector3();
function project(x, y, z) {
  v3.set(x, y, z).project(camera);
  return { x: (v3.x * 0.5 + 0.5) * app.clientWidth, y: (-v3.y * 0.5 + 0.5) * app.clientHeight, z: v3.z };
}
function placeAnchor(el, x, y, z, scale) {
  const p = project(x, y, z);
  if (p.z > 1 || p.z < -1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible';
  el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
  if (scale !== undefined && el.firstChild) el.firstChild.style.transform = 'translate(-50%,-100%) scale(' + scale.toFixed(3) + ')';
}
const pops = [];
function popup(text, cls, x, z) {
  const a = document.createElement('div');
  a.className = 'anchor';
  const p = document.createElement('div');
  p.className = 'pop ' + (cls || '');
  p.textContent = text;
  a.appendChild(p);
  labelsEl.appendChild(a);
  pops.push({ a, x, z, t: 0 });
}
const placed = [];
function updateLabels(dt) {
  if (!course) return;
  const over = game.screen === 'game' && camMode === 'over' && !bossCamOn();
  const hideGates = game.screen === 'game' && (game.phase === 'clash' || game.phase === 'result' || !!hole); // ブラックホールの前に札が浮かないように
  placed.length = 0;
  // 真上から見るとき：縦長の画面では、同じ高さに並ぶゲートの札を列にそろえる（左はしのレーンは橋の左、右はしのレーンは橋の右、
  // 間のレーンは橋の上）。入らない札は小さくする。横長の画面では、札をゲートの位置に置く。どちらも、隣と重なるなら上下にずらす
  const VW = app.clientWidth || 0;
  const items = [];
  for (const g of course.gates) {
    if (hideGates || g.sucked) { g.anchor.style.visibility = 'hidden'; continue; }
    if (!g.lw) { g.lw = g.lab.offsetWidth || 64; g.lh = g.lab.offsetHeight || 24; }
    if (over) {
      const p = project(g.x, 0.6, g.z);
      if (p.z > 1 || p.z < -1) { g.anchor.style.visibility = 'hidden'; continue; }
      const e = project(g.x + RIVER.BW / 2, 0.6, g.z);
      items.push({ g, p, hw: Math.abs(e.x - p.x), cx: p.x, s: 1 });
    } else {
      g.lab.style.transformOrigin = '';
      const d = camera.position.distanceTo(v3.set(g.x, GH + 3.6, g.z));
      if (game.screen === 'game' && d > 75) { g.anchor.style.visibility = 'hidden'; continue; }
      placeAnchor(g.anchor, g.x, GH + 3.6, g.z, Math.max(0.42, Math.min(1.1, 22 / d)));
    }
  }
  if (over && !rtl()) {
    const rows = new Map();
    for (const it of items) { const k = Math.round(it.g.z / 2); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(it); }
    for (const row of rows.values()) {
      row.sort((a, b) => a.p.x - b.p.x);
      const n = row.length;
      row.forEach((it, i) => {
        const w = it.g.lw + 6, near = (j) => Math.abs(row[j].p.x - it.p.x);
        const mid = n === 1 ? VW - 8 : 2 * Math.min(i > 0 ? near(i - 1) : Infinity, i < n - 1 ? near(i + 1) : Infinity) - 12;
        const mode = n === 1 ? 'c' : i === 0 ? 'l' : i === n - 1 ? 'r' : 'c';
        if (mode === 'c') { it.s = Math.max(0.6, Math.min(1, mid / w)); return; }
        // 橋の外側：入らなければ、少し小さくして、自分の橋の外側の半分までかぶせる
        const out = mode === 'l' ? it.p.x - it.hw - 10 : VW - (it.p.x + it.hw) - 10; // 橋の外の幅
        let sc = Math.min(1, Math.max(0.75, out / w)), inset = Math.max(0, w * sc - out);
        if (inset > it.hw) { sc = Math.max(0.6, (out + it.hw) / w); inset = Math.max(0, w * sc - out); }
        if (inset > it.hw + 1) { it.s = Math.max(0.6, Math.min(1, mid / w)); return; } // それでも入らなければ、橋の上に
        it.s = sc;
        const sw = w * sc, edge = it.hw + 6 - inset; // 札の内側のふちと、レーンの真ん中との間
        it.cx = mode === 'l' ? it.p.x - edge - sw / 2 : it.p.x + edge + sw / 2;
      });
    }
  }
  for (const it of items) {
    const { g, p, s } = it, w = (g.lw + 6) * s, h = (g.lh + 4) * s;
    // 画面の端で切れないようにする
    let cx = it.cx;
    if (VW > w + 8) cx = Math.max(w / 2 + 4, Math.min(VW - w / 2 - 4, cx));
    let bestDy = 0, bestO = Infinity;
    for (const dy of [0, -(h / 2 + 1), h / 2 + 1, -h, h]) {
      let o = 0;
      for (const q of placed) {
        const ox = Math.min(cx + w / 2, q.x1) - Math.max(cx - w / 2, q.x0);
        const oy = Math.min(p.y + dy + h / 2, q.y1) - Math.max(p.y + dy - h / 2, q.y0);
        if (ox > 0 && oy > 0) o += ox * oy;
      }
      if (o < bestO) { bestO = o; bestDy = dy; }
      if (o === 0) break;
    }
    placed.push({ x0: cx - w / 2, x1: cx + w / 2, y0: p.y + bestDy - h / 2, y1: p.y + bestDy + h / 2 });
    g.anchor.style.visibility = 'visible';
    g.anchor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
    g.lab.style.transformOrigin = '50% 50%';
    g.lab.style.transform = 'translate(-50%,-50%) translateY(' + bestDy.toFixed(1) + 'px)' + (s < 1 ? ' scale(' + s.toFixed(3) + ')' : '');
  }
  course.bossTagInner.classList.toggle('gone', course.bossHidden || !!hole); // 倒れ始めたら（ブラックホールの間も）ふっと消える
  if (!course.bossHidden && !hole) placeAnchor(course.bossTag, course.geo.boss.x, 18.5, course.geo.boss.z);
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += dt;
    placeAnchor(p.a, p.x, GH + 2.6, p.z);
    if (p.t > 1.5) { p.a.remove(); pops.splice(i, 1); }
  }
}
