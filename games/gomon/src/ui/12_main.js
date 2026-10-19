// 五門の兵：毎フレームの更新と、起動
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 毎フレーム ----------
function resize() {
  const w = Math.max(1, app.clientWidth), h = Math.max(1, app.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (course) course.gates.forEach((g) => { g.lw = 0; });
}
window.addEventListener('resize', resize);
resize();

let glyphs = '';
function updateGlyphs() {
  const vert = camMode === 'over' && rtl();
  const s = vert ? 'v' : 'h';
  if (s === glyphs) return;
  glyphs = s;
  $('leftBtn').textContent = vert ? '▼' : '◀';
  $('rightBtn').textContent = vert ? '▲' : '▶';
  $('leftBtn').setAttribute('aria-label', vert ? 'となりのレーンへ（下）' : 'となりのレーンへ（左）');
  $('rightBtn').setAttribute('aria-label', vert ? 'となりのレーンへ（上）' : 'となりのレーンへ（右）');
}
function updateEntryHints() {
  const showA = game.screen === 'game' && (game.phase === 'intro' || game.phase === 'choose');
  const showB = inPlaza();
  course.highlight.visible = course.marker.visible = showA || showB;
  if (!showA && !showB) return;
  const geo = course.geo;
  const xs = showA ? geo.startXs : geo.plaza.xsB;
  const i = nearestIdx(xs, sold.tx);
  setHighlight(xs[i], showA ? geo.hl : geo.plaza.hlB, geo.colW);
  const zm = (showA ? lockZ() : geo.plaza.zLock) + 5;
  course.marker.position.set(sold.tx, 0.14, zm);
  course.marker.children.forEach((c, k) => { c.position.z = -((k * 1.9 + clock * 3) % 5.7); });
}

const hint = document.createElement('div');
hint.className = 'swipe-hint';
hint.innerHTML = '<svg class="arr" aria-hidden="true"><path/></svg><span class="tx">スワイプして<br>行き先変更</span>';
labelsEl.appendChild(hint);
let hintLen = 0;
function updateHint() {
  const show = course && game.screen === 'game' && game.phase === 'choose' && !game.touched && !(game.go && !game.timer) && !paused;
  if (!show) { hint.style.visibility = 'hidden'; return; }
  const fr = course.geo.freeA, zH = lockZ() + 9;
  const a = project(fr.x0 - 1, 0, zH), b = project(fr.x1 + 1, 0, zH);
  if (a.z > 1 || b.z > 1) { hint.style.visibility = 'hidden'; return; }
  const L = Math.max(60, Math.hypot(b.x - a.x, b.y - a.y)), ang = Math.atan2(b.y - a.y, b.x - a.x);
  const svg = hint.firstChild;
  if (Math.abs(L - hintLen) > 2) {
    hintLen = L;
    const H = 34, hl = 26, t = 12, m = H / 2;
    svg.setAttribute('width', L.toFixed(0));
    svg.setAttribute('height', String(H));
    svg.firstChild.setAttribute('d', 'M0 ' + m + 'L' + hl + ' 0V' + (m - t / 2) + 'H' + (L - hl) + 'V0L' + L + ' ' + m + 'L' + (L - hl) + ' ' + H + 'V' + (m + t / 2) + 'H' + hl + 'V' + H + 'Z');
  }
  hint.style.visibility = 'visible';
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  hint.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px,0)';
  svg.style.transform = 'translate(-50%,-50%) rotate(' + ang.toFixed(3) + 'rad)';
  // 札は矢印の下に少し離して置く。下に入らなければ矢印の横（右、だめなら左）、最後は上
  const tx = hint.lastChild, tw = tx.offsetWidth || 110, th = tx.offsetHeight || 40;
  const vertical = Math.abs(Math.cos(ang)) < 0.5;
  const low = a.y > b.y ? a : b, right = a.x > b.x ? a : b, left = a.x > b.x ? b : a;
  const Wd = app.clientWidth, rs = screenReserve();
  const minY = rs.top + 6, maxY = rs.ctlTop - 8, gap = 22;
  const cands = vertical
    ? [[low.x, low.y + gap + th / 2], [mx + 17 + gap + tw / 2, my], [mx - 17 - gap - tw / 2, my]]
    : [[mx, my + 17 + gap + th / 2], [right.x + gap + tw / 2, right.y], [left.x - gap - tw / 2, left.y], [mx, my - 17 - gap - th / 2]];
  const fits = ([x, y]) => x - tw / 2 >= 8 && x + tw / 2 <= Wd - 8 && y - th / 2 >= minY && y + th / 2 <= maxY;
  if (camMode === 'over') {
    // 真上から見ているときは、道の外の芝生（−x の側：横長なら道の下、縦長なら道の左）に置く
    const rd = course.geo.road, e0 = project(rd.x0 - 2, 0, zH), e1 = project(rd.x0 - 6, 0, zH);
    let dx = e1.x - e0.x, dy = e1.y - e0.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const half = Math.abs(dx) * tw / 2 + Math.abs(dy) * th / 2;
    // 芝生の幅が足りないときは、矢印に重ならない範囲で画面の内側へ寄せる（スマホなら矢印の左側になる）
    const gx = Math.max(tw / 2 + 8, Math.min(Wd - tw / 2 - 8, e0.x + dx * (12 + half)));
    const gy = Math.max(minY + th / 2, Math.min(maxY - th / 2, e0.y + dy * (12 + half)));
    const mX = vertical ? 21 : 4, mY = vertical ? 4 : 21; // 矢印の太さの方向だけ余白をとる
    const ax0 = Math.min(a.x, b.x) - mX, ax1 = Math.max(a.x, b.x) + mX, ay0 = Math.min(a.y, b.y) - mY, ay1 = Math.max(a.y, b.y) + mY;
    const clear = gx + tw / 2 < ax0 || gx - tw / 2 > ax1 || gy + th / 2 < ay0 || gy - th / 2 > ay1;
    if (clear) cands.unshift([gx, gy]);
  }
  let [lx, ly] = cands.find(fits) || cands[0];
  lx = Math.max(tw / 2 + 8, Math.min(Wd - tw / 2 - 8, lx));
  ly = Math.max(minY + th / 2, Math.min(maxY - th / 2, ly));
  tx.style.transform = 'translate(-50%,-50%) translate(' + (lx - mx).toFixed(1) + 'px,' + (ly - my).toFixed(1) + 'px)';
}

// 一度操作したあと10秒なにもしなければ、残り時間の下に「長押しで早送り」を出す
const ffHint = document.createElement('div');
ffHint.className = 'ff-hint';
ffHint.innerHTML = '長押しで<br>早送り';
ffHint.hidden = true;
app.appendChild(ffHint);
function updateFFHint() {
  const show = game.screen === 'game' && game.phase === 'choose' && game.timer && game.touched && !game.ff && !paused && clock - (game.lastOp || 0) >= 10 && !$('timer').hidden;
  if (!show) { if (!ffHint.hidden) ffHint.hidden = true; return; }
  ffHint.hidden = false;
  const ar = app.getBoundingClientRect(), tr = $('timer').getBoundingClientRect(), hr = $('hud').getBoundingClientRect();
  const w = ffHint.offsetWidth, tc = (tr.left + tr.right) / 2 - ar.left;
  const left = Math.max(8, Math.min(ar.width - w - 8, tc - w / 2));
  const top = Math.max(tr.bottom, hr.bottom) - ar.top + 12;
  ffHint.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
  ffHint.style.setProperty('--ax', (tc - left).toFixed(1) + 'px');
}

let last = performance.now(), clock = 0;
function tick(now) {
  const raw = Math.min(0.05, (now - last) / 1000) * (window.__gomonTimeScale || 1);
  last = now;
  const dt = paused ? 0 : raw;
  clock += dt;
  if (game.screen === 'game' && !paused) update(game.ff && game.phase === 'choose' ? dt * 6 : dt);
  TRIM[4].emissiveIntensity = 0.55 + 0.45 * Math.sin(clock * 4);
  RAINBOW.offset.set((clock * 0.15) % 1, (clock * 0.15) % 1);
  WATER_TEX.offset.x = (clock * 0.05) % 1; // 川は横へゆっくり流れる
  if (course) updateFish(course.fish, dt);
  if (game.screen === 'game') { brookNear(riverNearness()); brookDrops(dt); }
  updateBump(dt);
  if (course) {
    for (const g of course.gates) {
      if (g.flash > 0) { g.flash = Math.max(0, g.flash - dt * 1.6); g.flashMat.opacity = g.flash * 0.8; }
      for (const e of g.extras) e.rotation.y += dt * (g.type.cat === 'rand' ? 0.6 : 1.4);
    }
    updateEntryHints();
    const hl = course.highlight, ht = course.hlTarget;
    hl.position.x += (ht.x - hl.position.x) * 0.25;
    hl.position.z = (ht.z0 + ht.z1) / 2;
    hl.position.y = 0.08;
    hl.scale.set(ht.w - 0.8, ht.z0 - ht.z1, 1);
    MAT.highlight.opacity = 0.22 + 0.1 * Math.sin(clock * 4);
  }
  if (hole) updateHole(dt);
  updateFx(dt);
  updateGlyphs();
  updateCamera(raw);
  drawArmy(clock);
  renderer.render(scene, camera);
  updateLabels(dt);
  updateHint();
  updateFFHint();
  updateItemUI();
  requestAnimationFrame(tick);
}
function update(dt) {
  game.phaseT += dt;
  const geo = course.geo;
  if (game.phase === 'intro' || game.phase === 'choose') {
    freeMove(dt, geo.freeA);
    sold.hx = 0; sold.hz = -1;
    if (game.go) { sold.z -= RUN_SPEED * dt; sold.moving = true; }
    else { const dz = (waitZ() - sold.z) * Math.min(1, dt * 1.6); sold.z += dz; sold.moving = Math.abs(dz) > RUN_SPEED * dt * 0.15; }
    if (game.phase === 'intro') {
      if (game.phaseT > INTRO_SEC) enterChoose();
      return;
    }
    if (game.timer) {
      const left = Math.max(0, (sold.z - lockZ()) / RUN_SPEED);
      const sec = Math.ceil(left - 1e-6);
      $('timer').textContent = String(sec);
      $('timer').classList.toggle('hurry', left <= 5);
      if (sec < lastTick && sec <= 5 && sec > 0) sfx('tick');
      lastTick = sec;
    }
    if (sold.z <= lockZ()) lockIn();
  } else if (game.phase === 'run') {
    const run = game.run;
    const seg = run.segs[run.seg];
    if (seg.plaza) {
      const pz = geo.plaza;
      if (!run.plaza) enterPlaza();
      sold.hx += (0 - sold.hx) * Math.min(1, dt * 6); sold.hz += (-1 - sold.hz) * Math.min(1, dt * 6);
      sold.y = 0;
      freeMove(dt, pz.free);
      if (game.timer || run.go) { sold.z -= RUN_SPEED * dt; sold.moving = true; }
      else { const dz = (pz.zMid - sold.z) * Math.min(1, dt * 2.5); sold.z += dz; sold.moving = Math.abs(dz) > RUN_SPEED * dt * 0.15; }
      if (sold.z <= pz.zLock) leavePlaza();
      return;
    }
    sold.moving = true;
    sold.lean += (0 - sold.lean) * Math.min(1, dt * 6);
    run.s += RUN_SPEED * dt;
    while (seg.gi < seg.events.length && seg.events[seg.gi].s <= run.s) {
      const ok = applyStep(seg.events[seg.gi++].step);
      if (!ok) return;
    }
    const p = seg.at(run.s);
    sold.x = sold.tx = p.x; sold.z = p.z; sold.y = p.y;
    sold.hx += (p.hx - sold.hx) * Math.min(1, dt * 8); sold.hz += (p.hz - sold.hz) * Math.min(1, dt * 8);
    const hl = Math.hypot(sold.hx, sold.hz) || 1; sold.hx /= hl; sold.hz /= hl;
    // 橋の上では、橋の種類ごとの足音
    const br = course.onBridge(sold.x, sold.z);
    if (br) { run.stepT = (run.stepT || 0) - dt; if (run.stepT <= 0) { run.stepT = 0.25 + Math.random() * 0.03; run.stepAlt = !run.stepAlt; stepSound(br.type, run.stepAlt); } }
    else run.stepT = 0;
    if (keys.l !== keys.r) tryBump(keys.r ? 1 : -1);
    if (run.s >= seg.len) {
      if (run.seg < run.segs.length - 1) { run.seg++; run.s = 0; }
      else enterClash();
    }
  } else if (game.phase === 'clash') {
    updateClash(dt);
  } else if (game.phase === 'mine') {
    if (hole) sold.suck = Math.min(1, game.phaseT / BH_GROW);
    if (game.mine === G.MINE_BUG) {
      updateErrWins(game.phaseT);
      if (Math.random() < dt * 5) shake = Math.max(shake, 0.6); // ときどきガクッとゆれる
    }
    if (game.phaseT > MINE_SEC) finish();
  }
}

// テストと撮影のための入口（遊ぶ人には関係しない）
window.__gomon = { game, sold, bump, riverNearness: () => riverNearness(), camInfo: () => { const rv = course.geo.river, q = camera.position; let h = 0; if (!rv.inRiver(q.x, q.z, 0)) { const nz = rv.nearZ(q.x), fz = rv.farZ(q.x); h = q.z > nz ? q.z - nz : q.z < fz ? fz - q.z : 0; } return { y: Math.round(q.y), d: Math.round(Math.hypot(h, q.y - RIVER.WATER_Y)) }; }, get camMode() { return camMode; }, get course() { return course; }, drawFormula, gateHTML, EXAMPLE, setArmy, peek(v) { peek = v; } };

// ---------- 起動（更新されても、遊んでいたモードとステージから再開） ----------
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  try { window.claude.hot.snapshot(() => ({ screen: game.screen, mode: game.mode, diff: game.diff, timer: game.timer, stageNo: game.stageNo, items: game.items })); } catch (e) { /* なくても動く */ }
}
function boot(data) {
  data = data || {};
  refreshTitleLines();
  toTitle();
  if (data.screen === 'game' && data.mode) {
    if (typeof data.timer === 'boolean') game.timer = data.timer;
    startGame(data.mode, data.diff, data.stageNo || 1);
    if (data.mode === 'endless' && game.stageNo > 1) game.items = Math.max(0, data.items | 0);
  }
  requestAnimationFrame((t) => { last = t; tick(t); });
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
