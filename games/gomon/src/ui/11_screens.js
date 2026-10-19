// 五門の兵：タイトル・図鑑・実績・一時停止・音の設定と、操作（キー・タップ・ドラッグ・早送り）
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- タイトル・図鑑・実績 ----------
const EXAMPLE = {
  add: { a: 20 }, sub: { a: 66 }, mul: { u: '9', d: '10' }, div: { u: '8', d: '10' }, neg: {}, abs: {}, append: { a: 7 }, dice: { s: 1, N: 100 },
  pctPos: { p: 150 }, frac: { u: '3', d: '4' }, pow2: { op: '+', N: 5 }, negAbs: {}, sq: {}, mod: { m: '90' }, min: { a: '150' }, max: { a: '50' },
  gcd: { a: 60 }, nd2: {}, sqrtConst: { s: 1, a: 144 }, pow3: { op: '×', N: 2 }, fact: { s: 1, N: 4 }, pctNeg: { p: 50 }, pi: {}, pi2: {},
  nC2: {}, sigmaN: {}, sqrtN: {}, lcm: { a: 12 }, halfnd3: {}, comb: { s: -1, p: 12, q: 2 }, perm: { s: -1, p: 5, q: 2 }, sigmaConst: { s: 1, N: 10 },
  sqrtMul: { op: '×', a: 2 }, e: {}, e2: {}, log: { p: '2', q: 8 }, piE: {}, ePi: {}, eIPi: {}, zeta: {},
};
function refreshTitleLines(animate) {
  $('achLine').textContent = achieved.size + ' / ' + ACH.length;
  renderAchMini();
  $('bestLine').textContent = '（エンドレスBEST：ステージ' + (reach > 0 ? reach : ' - ') + '）';
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === sel)));
  $('timerOn').setAttribute('aria-pressed', String(game.timer));
  $('timerOff').setAttribute('aria-pressed', String(!game.timer));
  $('soundBtn').setAttribute('aria-pressed', String(!muted));
  $('soundBtn').textContent = muted ? '音：オフ' : '音：オン';
  placeSegs(!!animate);
}
function renderDex() {
  $('dexCount').textContent = '登録 ' + dex.size + ' / ' + G.TYPE_LIST.length + '　通ったゲートが登録されます。全種類を登録すると「ゲートマスター」。';
  $('dexBody').innerHTML = G.BY_RARITY.map((list, r) => {
    const cards = list.map((t) => {
      if (!dex.has(t.id)) return '<div class="dex-card unknown"><span class="gl r' + r + '" style="background:#2a2738;color:#6c6884">？？？</span><span class="nm">未登録</span><span class="ds">' + esc(G.RARITY_NAMES[r]) + '</span></div>';
      const c = G.CATS[t.cat];
      return '<div class="dex-card"><span class="gl c-' + t.cat + ' r' + r + '">' + gateHTML(t.id, EXAMPLE[t.id]) + '</span><span class="nm">' + esc(t.name) + '</span><span class="ds">' + esc(c.name + '・' + c.material) + '<br>' + esc(t.note) + '</span></div>';
    }).join('');
    return '<div class="dex-group"><h3>' + esc(G.RARITY_NAMES[r]) + '（' + list.length + '種）</h3><div class="dex-grid">' + cards + '</div></div>';
  }).join('');
}
// タイトルに実績を並べる。ゲートマスターの行に、ゲート図鑑への入口を置く
function renderAchMini() {
  $('achMini').innerHTML = ACH.map((a) => {
    const got = achieved.has(a.id);
    const dexBtn = a.id === 'master' ? '<button class="btn" type="button" id="dexBtn">ゲート図鑑<small>' + dex.size + ' / ' + G.TYPE_LIST.length + '</small></button>' : '';
    return '<li' + (got ? ' class="got"' : '') + '><span class="mk" aria-hidden="true">' + (got ? '★' : '☆') + '</span><span class="sr">' + (got ? '獲得済み' : '未獲得') + '</span><span class="nm">' + esc(a.name) + '</span><span class="cd">' + esc(a.cond) + '</span>' + dexBtn + '</li>';
  }).join('');
  $('dexBtn').onclick = () => { renderDex(); showOnly('dexScreen'); };
}
function toTitle() {
  cleanupEffects();
  brookSound(false);
  game.screen = 'title';
  game.phase = 'idle';
  game.run = null;
  setHudVisible(false);
  setControls(false);
  $('intro').hidden = true;
  showOnly('title');
  refreshTitleLines();
  const demo = G.generateStage({ t: 0.6, mechanic: 'cross', allowReverse: false, rng: G.mulberry32(20261018) });
  game.stage = demo;
  buildCourse(demo, 20261018);
  sold.x = sold.tx = course.geo.startXs[0];
  sold.z = waitZ() + 2; sold.y = 0; sold.hx = 0; sold.hz = -1; sold.lean = 0; sold.suck = 0; sold.moving = false;
  setArmy(demo.n0);
  updateCamera(0, true);
}

// ---------- 入力 ----------
// 選んでいるボタンの下に金色の板を置き、選び直すとすべって動く
const segs = [...document.querySelectorAll('.menu .seg')].map((seg) => {
  const ind = document.createElement('span');
  ind.className = 'seg-ind instant';
  ind.setAttribute('aria-hidden', 'true');
  seg.prepend(ind);
  seg.classList.add('slide');
  return { seg, ind, placed: false };
});
function placeSegs(animate) {
  for (const g of segs) {
    const b = g.seg.querySelector('button[aria-pressed="true"]');
    if (!b || !b.offsetWidth) continue;
    const instant = !animate || !g.placed;
    g.ind.classList.toggle('instant', instant);
    g.ind.style.width = Math.max(0, b.offsetWidth - 6) + 'px';
    g.ind.style.transform = 'translateX(' + (b.offsetLeft + 3) + 'px)';
    g.placed = true;
    if (instant) requestAnimationFrame(() => g.ind.classList.remove('instant'));
  }
}
window.addEventListener('resize', () => placeSegs(false));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeSegs(false), () => {});

// タイトル：ステージと制限時間を選んで、スタートで始める
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { sel = b.dataset.mode; store.set('sel', sel); refreshTitleLines(true); }; });
$('startBtn').onclick = () => { if (sel === 'endless') startGame('endless', null, 1); else startGame('once', sel); };
$('timerOn').onclick = () => { game.timer = true; store.set('timer', true); refreshTitleLines(true); };
$('timerOff').onclick = () => { game.timer = false; store.set('timer', false); refreshTitleLines(true); };

document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { showOnly('title'); refreshTitleLines(); }; });
$('leftBtn').onclick = () => stepLane(-1);
$('rightBtn').onclick = () => stepLane(1);
$('goBtn').onclick = () => {
  if (game.phase === 'choose' && !game.go) { game.go = true; setControls(true, null); }
  else if (inPlaza() && !game.run.go) { game.run.go = true; setControls(true, null); }
};
$('camBtn').onclick = () => {
  if ($('camBtn').disabled) return;
  camMode = camMode === 'over' ? 'follow' : 'over';
  $('camBtn').setAttribute('aria-pressed', String(camMode === 'over'));
};
// 一時停止：音のオン・オフとタイトルへ戻るは、ここにまとめる
let paused = false;
function setPaused(v) {
  if (v && game.screen !== 'game') return;
  paused = v;
  if (!v) $('soundScreen').hidden = true;
  $('pauseScreen').hidden = !v;
  AU.setPaused(v);
  keys.l = keys.r = false;
  drag = null;
  stopFF();
  if (v) setTimeout(() => $('resumeBtn').focus({ preventScroll: true }), 30);
}
$('pauseBtn').onclick = () => setPaused(true);
$('resumeBtn').onclick = () => setPaused(false);
$('soundBtn').onclick = () => { muted = !muted; store.set('muted', muted); AU.setMuted(muted); ensureAudio(); if (!muted && game.screen === 'game') brookSound(true); refreshTitleLines(); };
// 音の設定：システム音・環境音・BGM（BGM は大きさの設定だけ）
function refreshVolumes() {
  document.querySelectorAll('[data-vol]').forEach((el) => { const v = AU.volume(el.dataset.vol); el.value = String(v); el.nextElementSibling.textContent = String(v); });
}
function openSound(v) {
  $('soundScreen').hidden = !v;
  if (v) { ensureAudio(); refreshVolumes(); refreshTitleLines(); setTimeout(() => $('soundClose').focus({ preventScroll: true }), 30); }
}
document.querySelectorAll('[data-vol]').forEach((el) => {
  const k = el.dataset.vol;
  el.addEventListener('input', () => {
    AU.setVolume(k, +el.value);
    el.nextElementSibling.textContent = String(AU.volume(k));
    const all = store.get('vol2', {}); all[k] = AU.volume(k); store.set('vol2', all);
    if (k === 'env' && game.screen === 'game' && !muted) brookSound(true);
  });
  el.addEventListener('change', () => { if (k === 'se') AU.preview('up'); else if (k === 'env') AU.preview('plop'); }); // 離したときに、試しに鳴らす
});
$('soundOpenP').onclick = () => openSound(true);
$('soundOpenT').onclick = () => openSound(true);
$('soundClose').onclick = () => { openSound(false); if (paused) $('soundOpenP').focus({ preventScroll: true }); };
$('quitBtn').onclick = () => { setPaused(false); toTitle(); };
// 残り時間を長押しすると早送り
let ffTimer = null;
function stopFF() { if (game.ff) { game.lastOp = clock; sfx('ffOff'); } clearTimeout(ffTimer); ffTimer = null; game.ff = false; $('timer').classList.remove('ff'); }
function startFF() { if (game.phase === 'choose' && game.timer && !paused && !game.ff) { game.ff = true; game.lastOp = clock; $('timer').classList.add('ff'); sfx('ffOn'); } }
const timerEl = $('timer');
timerEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  clearTimeout(ffTimer);
  ffTimer = setTimeout(startFF, 180);
  try { timerEl.setPointerCapture(e.pointerId); } catch (err) { /* なくても動く */ }
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => timerEl.addEventListener(ev, stopFF));
timerEl.addEventListener('contextmenu', (e) => e.preventDefault());
const markTouched = () => { game.touched = true; game.lastOp = clock; };
const LEFT_KEYS = ['ArrowLeft', 'a', 'A'], RIGHT_KEYS = ['ArrowRight', 'd', 'D'], DOWN_KEYS = ['ArrowDown', 's', 'S'], UP_KEYS = ['ArrowUp', 'w', 'W'];
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('soundScreen').hidden) { $('soundClose').click(); e.preventDefault(); return; }
  if (game.screen !== 'game') return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { setPaused(!paused); e.preventDefault(); return; }
  if (paused || !$('result').hidden) return;
  const k = e.key;
  if (k === 'f' || k === 'F') { if (!e.repeat) startFF(); e.preventDefault(); return; }
  // どの視点でも ←↓ と →↑ の全部で動ける
  if (LEFT_KEYS.includes(k) || DOWN_KEYS.includes(k)) { keys.l = true; markTouched(); e.preventDefault(); }
  else if (RIGHT_KEYS.includes(k) || UP_KEYS.includes(k)) { keys.r = true; markTouched(); e.preventDefault(); }
  else if ((k === 'Enter' || k === ' ') && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { if (!$('goBtn').hidden && !$('controls').hidden) $('goBtn').click(); e.preventDefault(); }
  else if (k === 'v' || k === 'V') $('camBtn').click();
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'f' || k === 'F') stopFF();
  if (LEFT_KEYS.includes(k) || DOWN_KEYS.includes(k)) keys.l = false;
  if (RIGHT_KEYS.includes(k) || UP_KEYS.includes(k)) keys.r = false;
});
window.addEventListener('blur', () => { keys.l = keys.r = false; stopFF(); });
let drag = null;
app.addEventListener('pointerdown', (e) => {
  if (paused || e.target.closest('button, .screen, .hud')) { drag = null; return; }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId, moved: false };
  try { app.setPointerCapture(e.pointerId); } catch (err) { /* なくても動く */ }
});
app.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
  const r = freeRange();
  if (!drag.moved) return;
  if (!r) { // 橋の上：横へ動かそうとしたら欄干に当たる
    if (game.phase === 'run' && course) { drag.acc = (drag.acc || 0) + lateral(dx, dy); if (Math.abs(drag.acc) > 1.5) { tryBump(Math.sign(drag.acc)); drag.acc = 0; } }
    return;
  }
  sold.tx = Math.max(r.x0, Math.min(r.x1, sold.tx + lateral(dx, dy)));
  markTouched();
});
// 指を動かさずに離したら（タップ・クリック）、兵士はクリックしたところと同じ高さ（画面の縦の位置）へ寄っていく
function groundAt(cx, cy) {
  const r = app.getBoundingClientRect();
  v3.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0.5).unproject(camera);
  const dx = v3.x - camera.position.x, dy = v3.y - camera.position.y, dz = v3.z - camera.position.z;
  if (dy > -1e-6) return null;
  const t = -camera.position.y / dy;
  return { x: camera.position.x + dx * t, z: camera.position.z + dz * t };
}
function tapTarget(cx, cy) {
  const r = freeRange();
  if (!r) {
    if (game.phase === 'run' && course) { const pt = groundAt(cx, cy); if (pt && Math.abs(pt.x - sold.x) > 3) tryBump(Math.sign(pt.x - sold.x)); }
    return;
  }
  const pt = groundAt(cx, cy);
  if (!pt) return;
  sold.tx = Math.max(r.x0, Math.min(r.x1, pt.x));
  sfx('lane');
  markTouched();
}
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.type === 'pointerup' && !drag.moved) tapTarget(e.clientX, e.clientY);
  drag = null;
};
app.addEventListener('pointerup', endDrag);
app.addEventListener('pointercancel', endDrag);
