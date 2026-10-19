// 五門の兵：ゲームの進み：状態、ステージの始まり、レーン選び、ゲートを通る、地雷、ボス戦、アイテム、結果
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 状態 ----------
const game = { screen: 'title', mode: 'endless', diff: 'early', timer: store.get('timer', true), stageNo: 1, stage: null, phase: 'idle', phaseT: 0, go: false, laneA: 0, laneB: 0, run: null, wentNeg: false, zeroSeen: false, outcome: null, mine: null, routeIndex: -1, items: 0 };
let hole = null;

function showOnly(id) { ['title', 'result', 'dexScreen'].forEach((s) => { $(s).hidden = s !== id; }); }
function setHudVisible(v) { $('hud').hidden = !v; reserve.at = -1; }
function setControls(v, goText) {
  $('controls').hidden = !v;
  $('goBtn').hidden = !goText;
  if (goText) $('goBtn').textContent = goText;
}
function updateCount() {
  const n = sold.n;
  $('countNum').textContent = fmtBig(n);
  // 下の小さな行は「1億1000万」のような読みだけ（兵種の内訳は書かない）
  $('countRead').textContent = (n < 0n ? -n : n) >= 10000n && digits(n) <= 12 ? G.fmtJa(n) : '';
  $('count').classList.toggle('neg', n < 0n);
}
const inPlaza = () => game.phase === 'run' && game.run && game.run.plaza;
const nearestIdx = (xs, x) => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = i; }); return b; };
function freeRange() {
  if (!course || game.screen !== 'game') return null;
  if (game.phase === 'intro' || game.phase === 'choose') return course.geo.freeA;
  if (inPlaza()) return course.geo.plaza.free;
  return null;
}
const keys = { l: false, r: false };
function freeMove(dt, range) {
  const kd = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (kd) sold.tx += kd * KEY_SPEED * dt;
  sold.tx = Math.max(range.x0, Math.min(range.x1, sold.tx));
  const px = sold.x;
  sold.x += (sold.tx - sold.x) * Math.min(1, dt * 12);
  const vx = (sold.x - px) / Math.max(dt, 1e-3);
  const target = Math.max(-0.8, Math.min(0.8, -vx / 14));
  sold.lean += (target - sold.lean) * Math.min(1, dt * 10);
}
function stepLane(d) {
  if (!freeRange()) return;
  const xs = inPlaza() ? course.geo.plaza.xsB : course.geo.startXs;
  let t = null;
  if (d > 0) { for (const x of xs) if (x > sold.tx + 0.5) { t = x; break; } }
  else { for (let i = xs.length - 1; i >= 0; i--) if (xs[i] < sold.tx - 0.5) { t = xs[i]; break; } }
  if (t === null) return;
  sold.tx = t;
  sfx('lane');
  markTouched();
}
// 画面上のドラッグ量を、地面の左右（x）の移動量に直す
function lateral(dx, dy) {
  const e = course.geo.ext, over = camMode === 'over';
  const rz = over ? Math.max(e.z0, Math.min(e.z1, sold.z)) : sold.z - 3;
  const rx = over ? sold.tx : sold.x;
  const a = project(rx, 0, rz), b = project(rx + 1, 0, rz);
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
  if (L2 < 1e-3 || a.z > 1 || b.z > 1) return dx / 30;
  return ((dx * vx + dy * vy) / L2) * (over ? 1 : 1.3);
}

// ステージ開始の「（ヘルメット）×5」：ゲームの中の3Dのヘルメット（頭にかぶった姿）をそのまま撮った絵を使う
let helmetIconURL = null;
function makeHelmetIcon() {
  try {
    const Wp = 384, Hp = 288; // 大きく撮ってから縮め、ふちをなめらかにする
    const rt = new THREE.WebGLRenderTarget(Wp, Hp);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xeaf5ff, 0x6d8f4c, 0.75));
    const key = new THREE.DirectionalLight(0xfff2da, 1.0); key.position.set(-2, 4, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0xcfe3ff, 0.35); rim.position.set(3, 1, -2); sc.add(rim);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xf3d2a8, roughness: 0.7 }));
    const helm = new THREE.Mesh(helmetGeo, new THREE.MeshStandardMaterial({ color: 0x1f4fa8, roughness: 0.4, metalness: 0.2 }));
    sc.add(head, helm);
    const cam = new THREE.PerspectiveCamera(19.5, Wp / Hp, 0.1, 20);
    cam.position.set(0.5, 1.36, 1.36); cam.lookAt(0, 1.0, 0);
    const prevRT = renderer.getRenderTarget(), prevClear = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClear);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    const px = new Uint8Array(Wp * Hp * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, Wp, Hp, px);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevAlpha);
    rt.dispose(); head.material.dispose(); helm.material.dispose();
    let seen = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) { seen++; if (seen > 200) break; }
    if (seen <= 200) return null; // 何も写っていない（描けない環境）
    const big = document.createElement('canvas'); big.width = Wp; big.height = Hp;
    const bx = big.getContext('2d'), img = bx.createImageData(Wp, Hp);
    for (let y = 0; y < Hp; y++) img.data.set(px.subarray((Hp - 1 - y) * Wp * 4, (Hp - y) * Wp * 4), y * Wp * 4); // 上下を戻す
    bx.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(big, 0, 0, 128, 96);
    return c.toDataURL('image/png');
  } catch (e) { return null; }
}
function helmetIcon() {
  if (helmetIconURL === null) helmetIconURL = makeHelmetIcon() || '';
  return helmetIconURL ? '<img class="helm" src="' + helmetIconURL + '" alt="">' : HELMET;
}
// 3Dで撮れないときの代わりの絵
const HELMET = '<svg viewBox="2 13 44 24" preserveAspectRatio="none" aria-hidden="true"><path d="M7.5 32a16.5 17 0 0 1 33 0z" fill="#2a5cc0"/><path d="M24 15a16.5 17 0 0 1 16.5 17h-6a12 14 0 0 0-10.5-16.5z" fill="#1f4fa8"/><ellipse cx="16.5" cy="22" rx="4.6" ry="2.6" transform="rotate(-38 16.5 22)" fill="#ffffff" opacity="0.5"/><rect x="3" y="30.5" width="42" height="5" rx="2.5" fill="#183f88"/></svg>';
const DIFF_NAMES = { early: 'イージー', final: 'ノーマル', nocommon: 'ハード' };

function startGame(mode, diff, stageNo) {
  ensureAudio();
  game.mode = mode;
  game.diff = diff || 'early';
  game.stageNo = stageNo || 1;
  game.screen = 'game';
  showOnly(null);
  startStage();
}
function startStage() {
  cleanupEffects();
  if (game.mode === 'endless' && game.stageNo === 1) game.items = 0; // エンドレスの開始時はアイテム0個
  const once = game.mode === 'once';
  if (!once && game.stageNo > reach) { reach = game.stageNo; store.set('reach', reach); }
  const t = once ? (game.diff === 'early' ? 0 : 1) : G.progressOf(game.stageNo);
  const stage = G.generateStage({ t, difficulty: once && game.diff === 'nocommon' ? 'nocommon' : undefined, allowReverse: !(once && game.diff === 'early') });
  game.stage = stage;
  Object.assign(game, { run: null, wentNeg: false, zeroSeen: false, outcome: null, mine: null, routeIndex: -1, go: game.timer, touched: false, lastOp: 0 });
  stopFF();
  buildCourse(stage);
  brookSound(true);
  const geo = course.geo;
  sold.x = sold.tx = geo.startXs[geo.startXs.length === 3 ? 1 : 0];
  // 制限時間ありでは、兵士は30秒ぶん手前から一定の速さで走ってくる
  sold.z = game.timer ? lockZ() + RUN_SPEED * (TIMER_SEC + INTRO_SEC) : waitZ() + 20;
  sold.y = 0; sold.hx = 0; sold.hz = -1; sold.lean = 0; sold.suck = 0;
  keys.l = keys.r = false;
  setArmy(stage.n0);
  const mech = stage.layout.kind !== 'straight' ? G.MECH_NAMES[stage.layout.kind] : '';
  $('modeName').textContent = (once ? '1ステージ' : 'エンドレス') + (mech ? '・' + mech : '');
  $('stageName').textContent = once ? DIFF_NAMES[game.diff] : 'ステージ ' + game.stageNo;
  $('bossKicker').textContent = stage.reverse ? '反転ボスの HP' : 'ボスの HP';
  $('bossPlate').classList.toggle('reverse', stage.reverse);
  setBossTag(stage.hp);
  $('timer').hidden = true;
  setHudVisible(true);
  setControls(false);
  $('camBtn').disabled = true;
  camMode = 'follow';
  $('camBtn').setAttribute('aria-pressed', 'false');
  updateCamera(0, true);
  const intro = $('intro');
  intro.innerHTML = '<div class="big">' + esc(once ? DIFF_NAMES[game.diff] : 'ステージ' + game.stageNo) + '</div>' +
    '<div class="army">' + helmetIcon() + '<span>×' + esc(G.fmtComma(stage.n0)) + '</span></div>' +
    (mech ? '<div class="mech">仕掛け：' + esc(mech) + '</div>' : '') +
    (stage.reverse ? '<div class="warn">反転ボスを倒せ（マイナスの兵士で、HP 以下にする）</div>' : '') +
    (game.timer ? '' : '<div class="hint">入るレーンを決めたら出発</div>');
  intro.hidden = false;
  game.phase = 'intro';
  game.phaseT = 0;
}
let lastTick = TIMER_SEC;
function enterChoose() {
  $('intro').hidden = true;
  game.phase = 'choose';
  game.phaseT = 0;
  camMode = 'over';
  $('camBtn').disabled = false;
  $('camBtn').setAttribute('aria-pressed', 'true');
  setControls(true, game.timer ? null : 'このレーンで出発');
  $('timer').hidden = !game.timer;
  $('timer').textContent = String(TIMER_SEC);
  $('timer').classList.remove('hurry');
  lastTick = TIMER_SEC;
}
// 先頭が入口を越えた：いちばん近いレーンに入り、ここからは壁で左右に移れない
function lockIn() {
  const lay = game.stage.layout, geo = course.geo;
  const lane = nearestIdx(geo.startXs, sold.x);
  game.laneA = lane;
  const run = { n: game.stage.n0, steps: [], segs: [], seg: 0, s: 0, plaza: false, go: false };
  if (lay.kind === 'plaza') {
    run.seq = lay.routes.find((r) => r.lanes[0] === lane).seq.slice(0, lay.k);
    run.segs.push(geo.plaza.pathA(lane, sold.x, sold.z), { plaza: true });
    game.routeIndex = lay.routes.findIndex((r) => r.lanes[0] === lane);
    run.partial = true;
  } else {
    const ri = lay.routes.findIndex((r) => r.lanes[0] === lane);
    game.routeIndex = ri;
    run.seq = lay.routes[ri].seq;
    run.segs.push(geo.routePath(ri, sold.x, sold.z));
  }
  game.run = run;
  game.phase = 'run';
  game.phaseT = 0;
  setControls(false);
  $('timer').hidden = true;
  stopFF();
  sfx('lock');
}
function enterPlaza() {
  game.run.plaza = true;
  setControls(true, game.timer ? null : '後半へ出発');
}
function leavePlaza() {
  const run = game.run, lay = game.stage.layout, pz = course.geo.plaza;
  run.plaza = false;
  game.laneB = nearestIdx(pz.xsB, sold.x);
  const ri = lay.routes.findIndex((r) => r.lanes[0] === game.laneA && r.lanes[1] === game.laneB);
  game.routeIndex = ri;
  run.seq = lay.routes[ri].seq;
  run.partial = false;
  run.segs.push(pz.pathB(game.laneB, sold.x, sold.z));
  run.seg++;
  run.s = 0;
  setControls(false);
  sfx('lock');
}
function trackAch(v) {
  if (v < 0n) { game.wentNeg = true; unlock('hanten'); }
  if (v <= -1000n) unlock('shinen');
  if (v === 0n) game.zeroSeen = true;
  else if (game.zeroSeen) unlock('mu');
  if (v > 10000n) unlock('manjin');
}
function applyStep(step) {
  const run = game.run;
  const sid = run.seq[step];
  const gate = game.stage.gates[sid];
  const g = course.gates[sid];
  const before = run.n;
  const after = G.applyGate(before, gate, Math.random);
  run.steps[step] = { sid, type: gate.type, before, after };
  g.flash = 1;
  g.panelMat.opacity = 0.55;
  g.lab.classList.add('passed');
  registerDex(gate.type);
  if (G.isMine(after)) { run.final = after; enterMine(after, g); return false; }
  run.n = after;
  setArmy(after);
  const cls = after < 0n ? 'neg' : after < before ? 'down' : '';
  popup(fmtShort(before) + ' → ' + fmtShort(after), cls, g.x, g.z);
  if (after < 0n && before >= 0n) sfx('neg'); else sfx(after >= before ? 'up' : 'down');
  trackAch(after);
  return true;
}
const MINE_SEC = 5.0; // 地雷の演出の長さ（このあと結果を出す）
const BH_GROW = 3.3; // ブラックホールがふくらみきるまで
function enterMine(kind, g) {
  game.phase = 'mine';
  game.phaseT = 0;
  game.mine = kind;
  sold.moving = false;
  // どちらの演出も、後ろから追う視点に切り替えて見せる
  camMode = 'follow';
  camCut = true; // ゆっくり動かさず、一瞬で切り替える
  $('camBtn').setAttribute('aria-pressed', 'false');
  $('camBtn').disabled = true;
  setControls(false);
  if (kind === G.MINE_BH) {
    hole = makeHole(g);
    sold.holeX = g.x; sold.holeZ = g.z; sold.holeY = BH_Y;
    screenFx('bh');
    bhSound(BH_GROW, MINE_SEC);
    unlock('horizon');
    $('countNum').textContent = '∞';
  } else {
    app.classList.add('glitch');
    const sc = document.createElement('div'); sc.className = 'scan'; sc.id = 'scan'; app.appendChild(sc);
    screenFx('bug');
    errBox = document.createElement('div');
    errBox.id = 'errwins';
    errBox.setAttribute('aria-hidden', 'true');
    app.insertBefore(errBox, $('pauseScreen'));
    $('countNum').textContent = 'NaN';
    $('countRead').textContent = '√ に マイナス が入った';
    sfx('bug');
    unlock('nan');
  }
}

// ---------- ボス戦：兵士と HP が同じだけ減っていき、勝てばボスが倒れる ----------
const CL_APPROACH = 0.55, CL_FIGHT = 2.2;
function enterClash() {
  game.phase = 'clash';
  game.phaseT = 0;
  const st = game.stage, n = game.run.n;
  const a = n < 0n ? -n : n, sgn = n < 0n ? -1n : 1n;
  const fights = st.reverse ? n < 0n : n > 0n;
  const heal = st.reverse ? n > 0n : n < 0n;
  const win = fights && a >= st.hp;
  const K = fights ? (a < st.hp ? a : st.hp) : heal ? a : 0n;
  const b = course.geo.boss;
  game.outcome = {
    win, heal, fights, final: n, a, sgn, K, shownK: -1n, upd: -1, hitT: 0,
    from: { x: sold.x, z: sold.z }, to: { x: b.x + b.f.x * 4.4, z: b.z + b.f.z * 4.4 },
    tEnd: CL_APPROACH + (K > 0n ? CL_FIGHT : 0.3),
  };
  game.run.final = n;
  course.bossCombo = fights && K > 0n;
  if (game.wentNeg && n > 0n) unlock('futabi');
  $('camBtn').disabled = true;
  setControls(false);
}
function updateClash(dt) {
  const o = game.outcome, t = game.phaseT, st = game.stage, b = course.geo.boss, ud = course.boss.userData;
  const u = Math.min(1, t / CL_APPROACH), e = 1 - (1 - u) * (1 - u);
  sold.x = o.from.x + (o.to.x - o.from.x) * e;
  sold.z = o.from.z + (o.to.z - o.from.z) * e;
  sold.hx += (-b.f.x - sold.hx) * Math.min(1, dt * 8); sold.hz += (-b.f.z - sold.hz) * Math.min(1, dt * 8);
  sold.lean = 0;
  sold.moving = t < o.tEnd;
  if (o.K > 0n && t >= CL_APPROACH && !o.used) {
    const f = Math.min(1, (t - CL_APPROACH) / CL_FIGHT);
    const fe = 1 - Math.pow(1 - f, 1.4);
    const k = f >= 1 ? o.K : (o.K * BigInt(Math.floor(fe * 1e9))) / 1000000000n;
    if (k !== o.shownK && (f >= 1 || clock - o.upd > 0.05)) {
      o.shownK = k;
      o.upd = clock;
      let rem = o.a - k;
      if (o.win && rem === 0n) rem = 1n; // ぴったりのときも、最後の1人は生き残る
      setArmy(o.sgn * rem);
      setBossTag(o.fights ? st.hp - k : st.hp + k);
    }
    if (f < 1) {
      const cx = b.x + b.f.x * 3.4, cz = b.z + b.f.z * 3.4;
      if (o.fights) spawnFx('spark', cx + b.f.z * (Math.random() - 0.5) * 8, 0.6 + Math.random() * 3, cz);
      ud.holder.position.x = Math.sin(t * 47) * 0.12;
      if (o.heal) { ud.holder.scale.setScalar(1 + 0.14 * fe); ud.eye.emissiveIntensity = 1.3 + fe * 1.5; }
      o.hitT -= dt;
      if (o.hitT <= 0) { sfx(o.fights ? 'hit' : 'heal'); o.hitT = o.fights ? 0.11 : 0.45; if (o.fights) o.flash = 1; }
    } else ud.holder.position.x = 0;
  }
  bossDamage(o, dt, o.fights && o.K > 0n && t >= CL_APPROACH && t < o.tEnd, o.win && t >= o.tEnd);
  if (o.used && t >= o.tEnd && !o.hpZero) { o.hpZero = true; setBossTag(0n); } // 一太刀のあと、HP が一気に 0 になる
  if (t < o.tEnd) return;
  const after = t - o.tEnd;
  if (o.win) {
    if (!o.redGone) {
      o.redGone = true; course.bossCombo = false; bossRed(0, true); // 倒れ始めると、赤い部分が 0 まで縮んで消える（倒しきれなかったときと同じ）
      // HP が 0 になった瞬間に知らせる（結果画面の勝利の音とは重ならない）
      if (game.mode === 'endless') {
        if (game.stageNo >= 8) unlock('hachimon');
        if (Math.random() < ITEM_DROP) { // ボスを倒すたびに 25% の確率でアイテムが手に入る
          const n = ++game.items;
          toast('アイテム獲得', '切り捨て御免（所持 ' + n + '）');
          noticeSound('item');
        }
      }
    }
    course.bossHidden = after > 0.65; // 縮み終わるのを見せてから、バーを消す
    const ft = after; // HP が 0 になった瞬間から倒れ始める
    // マイクラ風：赤いまま、はじめ速く真横へ 90° 倒れ、少し寝たあと白い煙になって消える
    const sx = b.f.z, sz = -b.f.x, at = (lat, y, dep) => [b.x - sx * lat + b.f.x * dep, y, b.z - sz * lat + b.f.z * dep];
    if (ft > 0 && !o.gone) {
      const q = Math.min(1, Math.sqrt(ft / 0.6));
      ud.pivot.rotation.z = (Math.PI / 2) * q;
      if (q >= 1 && !o.impact) {
        o.impact = true;
        sfx('thud');
        shake = 0.55;
        for (let i = 0; i < 10; i++) spawnFx('puff', ...at(6 + Math.random() * 18, 0.6, (Math.random() - 0.5) * 8));
      }
      if (ft >= 1.05) {
        o.gone = true;
        course.boss.visible = false;
        sfx('poof');
        for (let i = 0; i < 34; i++) spawnFx('poof', ...at(6.5 + Math.random() * 17, 2 + Math.random() * 9, (Math.random() - 0.5) * 5));
      }
    }
    sold.y = after > 0.3 ? Math.abs(Math.sin((after - 0.3) * 7)) * 0.9 : 0;
    if (after > 2.3) finish();
  } else {
    if (!o.roared) { o.roared = true; sfx('roar'); if (course.bossCombo) { course.bossCombo = false; bossRed(course.bossR, true); } }
    ud.holder.position.y = after < 0.8 ? Math.abs(Math.sin(after * 12)) * 0.5 * (1 - after / 0.8) : 0;
    if (after > 1.5) finish();
  }
}
// 攻撃を受けている間、ボスの体を赤く光らせ、当たるたびに強く点滅してのけぞる
const DMG_COLOR = new THREE.Color(0xd8322a), DMG_EMIT = new THREE.Color(0xff2a14);
function bossDamage(o, dt, fighting, dying) {
  const ud = course.boss.userData, m = ud.body, bs = ud.base;
  o.flash = Math.max(0, (o.flash || 0) - dt * 7);
  const goal = dying ? 0.65 : fighting ? 0.45 : 0; // 倒れていく間は赤いまま
  o.heat = (o.heat || 0) + (goal - (o.heat || 0)) * Math.min(1, dt * (goal ? 10 : 3));
  const d = Math.min(1, o.heat + 0.55 * o.flash);
  m.color.copy(bs.color).lerp(DMG_COLOR, d * 0.75);
  m.emissive.copy(bs.emissive).lerp(DMG_EMIT, d);
  m.emissiveIntensity = bs.ei + d * 0.5; // 強すぎると陰影が消えて平らに見える
  ud.holder.rotation.x = -0.07 * o.flash; // 当たった瞬間に少し後ろへのけぞる
  const tag = course.bossTagInner, hot = d > 0.08;
  tag.classList.toggle('hit', hot);
  $('bossHp').classList.toggle('hit', hot);
  tag.style.transform = hot ? 'translate(-50%, -100%) translateX(' + (Math.sin(clock * 61) * 3 * Math.max(o.flash, 0.3) * (fighting ? 1 : 0)).toFixed(1) + 'px)' : '';
}
// ---------- アイテム「切り捨て御免」：エンドレスのボス戦のあいだだけ使え、ボスを必ず倒す ----------
const ITEM_DROP = 0.25;
const itemBtn = $('itemBtn'), itemHint = $('itemHint');
let itemUsedEver = store.get('itemUsed', false);
function itemUsable() {
  const o = game.outcome;
  // 兵士（マイナスの兵士も）が1人以上残っているときだけ。0人になったらもう使えない
  return game.screen === 'game' && game.mode === 'endless' && game.phase === 'clash' && !!o && !o.used && game.phaseT < o.tEnd && game.items > 0 && sold.n !== 0n;
}
function updateItemUI() {
  const show = game.screen === 'game' && game.mode === 'endless' && game.phase === 'clash';
  if (itemBtn.hidden === show) itemBtn.hidden = !show;
  if (!show) { if (!itemHint.hidden) itemHint.hidden = true; return; }
  const ok = itemUsable();
  if (itemBtn.disabled === ok) itemBtn.disabled = !ok;
  itemBtn.classList.toggle('ready', ok);
  const n = String(game.items);
  if ($('itemN').textContent !== n) $('itemN').textContent = n;
  const hint = ok && !itemUsedEver && !paused; // 使えるのに、まだ一度も使ったことがないときだけ
  if (itemHint.hidden === hint) itemHint.hidden = !hint;
}
function useItem() {
  if (!itemUsable()) return;
  const o = game.outcome, t = game.phaseT;
  game.items--;
  itemUsedEver = true;
  store.set('itemUsed', true);
  // いまの兵士はそのまま残り、ボスは一太刀で倒れる
  Object.assign(o, { used: true, win: true, fights: true, heal: false, tEnd: t + 0.5, flash: 1 });
  course.bossCombo = true; // 赤い部分を残しておき、HP が 0 になってから縮める
  course.boss.userData.holder.position.x = 0;
  shake = Math.max(shake, 0.9);
  const el = document.createElement('div');
  el.className = 'slash-fx';
  el.innerHTML = '<div class="flash"></div><div class="blade"></div><div class="name">切り捨て御免</div>';
  app.insertBefore(el, $('pauseScreen'));
  setTimeout(() => el.remove(), 1500);
  sfx('slash');
  updateItemUI();
}
itemBtn.onclick = useItem;
function finish() {
  $('bossHp').classList.remove('hit');
  game.phase = 'result';
  sold.moving = false;
  sold.y = 0;
  const o = game.outcome || { win: false, final: game.mine };
  if (o.win) sfx('win'); else sfx('lose');
  let next = null;
  if (game.mode === 'endless' && o.win) {
    if (game.stageNo > best) { best = game.stageNo; store.set('best', best); }
    next = game.stageNo + 1;
  }
  renderResult(o, game.stage, next);
  showOnly('result');
}

function routeValueText(sm) {
  if (sm.allMine) return sm.mines.map((m) => G.fmtJa(m)).join('・');
  const v = sm.min === sm.max ? fmtBig(sm.min) : fmtBig(sm.min) + ' 〜 ' + fmtBig(sm.max);
  return sm.mines.length ? v + '（または ' + sm.mines.map((m) => G.fmtJa(m)).join('・') + '）' : v;
}
function pathHTML(stage, seq, steps) {
  const parts = ['<span>' + esc(G.fmtComma(stage.n0)) + '</span>'];
  seq.forEach((sid, i) => {
    const g = stage.gates[sid];
    parts.push('<span class="math">' + tokensHTML(G.TYPES[g.type].label(g.p)) + '</span>');
    if (steps && steps[i]) parts.push('<span>→ ' + esc(fmtShort(steps[i].after)) + '</span>');
  });
  return parts.join('');
}
function renderResult(o, st, next) {
  const lines = [];
  const run = game.run, lay = st.layout;
  // 突破／敗北のすぐ下は、そのまま答え合わせ（説明の文は出さない）
  lines.push(!game.mine && o.win ? '<p class="verdict win">突破</p>' : '<p class="verdict lose">敗北</p>');
  lines.push('<div class="kicker">答え合わせ</div><div class="answers">');
  lay.routes.forEach((r, i) => {
    const sm = st.summaries[i];
    const you = i === game.routeIndex;
    let val = routeValueText(sm);
    if (you && run && !run.partial) val = fmtBig(run.final);
    const chips = (i === st.correct ? '<span class="chip ok">正解</span>' : '') + (you ? '<span class="chip you">' + (run && run.partial ? 'あなた（前半）' : 'あなた') + '</span>' : '');
    lines.push('<div class="answer' + (i === st.correct ? ' correct' : '') + '"><span class="lane">' + esc(routeName(lay, r)) + '</span><span class="v">' + esc(val) + '</span><span class="chips">' + chips + '</span></div>');
  });
  lines.push('</div>');
  if (run) lines.push('<div class="kicker">あなたのルート</div><div class="path">' + pathHTML(st, run.seq, run.steps) + '</div>');
  if (game.routeIndex !== st.correct) {
    const seq = lay.routes[st.correct].seq;
    const random = seq.some((sid) => G.TYPES[st.gates[sid].type].random);
    const cr = random ? null : G.runRoute(st, st.correct, G.mulberry32(1));
    lines.push('<div class="kicker">正解のルート（' + esc(routeName(lay, lay.routes[st.correct])) + '）</div><div class="path">' + pathHTML(st, seq, cr && cr.steps) + '</div>');
  }
  const btns = [];
  if (game.mode === 'endless') {
    if (next) btns.push('<button class="btn primary" type="button" id="nextBtn">ステージ ' + next + ' へ</button>');
    else {
      lines.push('<p class="meta-line">到達：ステージ ' + game.stageNo + '　エンドレスBEST：ステージ' + reach + '</p>');
      btns.push('<button class="btn primary" type="button" id="retryBtn">ステージ1からもう一度</button>');
    }
  } else btns.push('<button class="btn primary" type="button" id="retryBtn">もう一度（' + esc(DIFF_NAMES[game.diff]) + '）</button>');
  btns.push('<button class="btn" type="button" id="toTitleBtn">タイトルへ</button>');
  lines.push('<div class="result-btns">' + btns.join('') + '</div>');
  $('resultInner').innerHTML = lines.join('');
  const nb = $('nextBtn'); if (nb) nb.onclick = () => { game.stageNo = next; showOnly(null); startStage(); };
  const rb = $('retryBtn'); if (rb) rb.onclick = () => { showOnly(null); if (game.mode === 'endless') game.stageNo = 1; startStage(); };
  $('toTitleBtn').onclick = () => toTitle();
  setTimeout(() => { const f = nb || rb; if (f) f.focus({ preventScroll: true }); }, 50);
}
