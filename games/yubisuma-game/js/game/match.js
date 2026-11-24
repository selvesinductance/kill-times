// 対戦の進行: 掛け声 → 全員が同時に親指を出す → 判定 → 手を下ろす → 抜け・順位、を人数ぶん繰り返す
// プレイヤーの入力（操作パネル・画面の手のクリック）、一時停止、早送り、結果画面もここで扱う
import { NPC_COLORS } from '../config.js';
import { settings, saveSettings, callWord } from '../settings.js';
import { $, el, setText } from '../dom.js';
import { say, stopVoice, canSpeak, unlockAudio } from '../voice.js';
import { hCount, uCount, isIn, upTotal, newHands, aliveOrder, nextCaller, aliveIndices, tableHands, lockedSum } from './rules.js';
import { entryFor, npcDecide, raiseHands, npcLowerHand, autoRound, tablesReady } from './strategy.js';
import { canvas, tween, reduceMotion } from '../scene/stage.js';
import { seatObjs, buildSeats, syncHandsInstant, moveGlow, dropHand, shakeHand, handUnderPointer, setHover } from '../scene/seats.js';
import { setCount, showCounter } from '../scene/counter.js';
import { show } from '../ui/screens.js';
import { renderModes, showTitleScene, leaveTitleScene } from '../ui/title.js';

let G = null;          // 対戦中のゲーム（なければ null）
let lastMode = null;   // 最後に遊んだ { n: 人数, m: 番手 }（やりなおす・もう一度に使う）
export const currentGame = () => G;

const sleepRaw = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- 一時停止 ----------
   止めているあいだは、ゲームの進行（待ち時間の後）が pauseGate で止まる */
let pauseWaiters = [];
function pauseGate(){ return G && G.paused ? new Promise(r => pauseWaiters.push(r)) : Promise.resolve(); }
function releasePause(){ const w = pauseWaiters; pauseWaiters = []; w.forEach(r => r()); }
async function sleep(ms){
  const f = G && G.ff ? 0.22 : 1;
  await sleepRaw(reduceMotion ? Math.min(ms, 250) * f : ms * f);
  await pauseGate();
}
function openPause(){
  if (!G || G.over || !$('modal-pause').hidden) return;
  G.paused = true;
  stopVoice();
  setVoiceBtn();
  $('modal-pause').hidden = false;
  $('btn-resume').focus();
}
function closePause(){
  $('modal-pause').hidden = true;
  if (G){ G.paused = false; releasePause(); }
}
function setVoiceBtn(){ const b = $('btn-voice'); b.textContent = settings.voice ? 'オン' : 'オフ'; b.setAttribute('aria-pressed', String(settings.voice)); }
// 古いゲームの続きが動いていたら、ここで止める
function guard(token){ if (!G || G.token !== token) throw new Error('aborted'); }

/* ---------- 開始と終了 ---------- */
function dropGame(){
  $('modal-pause').hidden = true;
  if (!G) return;
  if (G.cancelChoice) G.cancelChoice();
  G.token = {}; G = null;
  releasePause();   // 止まっていた進行を流して、古いゲームを終わらせる
  $('modal-lower').hidden = true;
}
// n 人戦を、プレイヤーが m 番手に宣言する並びで始める
export function startGame(n, m){
  dropGame();
  lastMode = { n, m };
  const players = [];
  for (let i = 0; i < n; i++){
    players.push({ name: i === 0 ? 'あなた' : `NPC${i}`, isPlayer: i === 0, color: i === 0 ? settings.color : NPC_COLORS[i - 1],
      hands:newHands(), rank:0 });
  }
  const token = {};
  G = { token, n, m, players, caller:(n - m + 1) % n, exits:0, round:0, ff:false, over:false };
  leaveTitleScene();
  buildSeats(players);
  syncHandsInstant(players);
  showCounter(true); setCount(0, false);
  show('game');
  $('banner').innerHTML = '';
  $('ctl-play').hidden = true; $('ctl-watch').hidden = true;
  $('game-screen').classList.remove('watching');
  $('btn-skip').disabled = false; $('btn-ff').disabled = false;
  $('btn-ff').setAttribute('aria-pressed', 'false'); $('btn-ff').textContent = '早送り';
  setVoiceBtn();
  runGame(token).catch(e => { if (e.message !== 'aborted') console.error(e); });
}
export function toTitle(){
  dropGame();
  stopVoice();
  $('modal-lower').hidden = true;
  show('title');
  renderModes(tablesReady());
  showTitleScene();
}
function restart(){ if (lastMode) startGame(lastMode.n, lastMode.m); }

async function runGame(token){
  await sleep(500); guard(token);
  while (!G.over){
    if (G.skip){ skipToEnd(); return; }
    await playRound(token);
    guard(token);
  }
}

/* ---------- 表示の更新 ---------- */
function setInfo(){
  const p = G.players[G.caller];
  $('info').innerHTML = '';
  $('info').append(el('span', null, `ラウンド ${G.round} ・ 宣言者 `), el('b', { text:p.name }));
}
// 名札の札（宣言者・手と固定の数・順位）
function updateLabels(){
  if (!G) return;
  G.players.forEach((p, i) => {
    const s = seatObjs[i]; if (!s) return;
    s.label.classList.toggle('caller', !G.over && i === G.caller && isIn(p));
    const chips = s.label.querySelector('.chips'); chips.innerHTML = '';
    if (p.rank) chips.append(el('span', { class:'chip rank', text: p.rank === G.players.length ? `${p.rank}位（最下位）` : `${p.rank}位で抜け` }));
    else {
      if (!G.over && i === G.caller) chips.append(el('span', { class:'chip call', text:'宣言者' }));
      chips.append(el('span', { class:'chip', text:`手 ${hCount(p)} ・ 固定 ${uCount(p)}` }));
    }
  });
}

/* ---------- 1 ラウンド ---------- */
async function playRound(token){
  G.round++;
  const players = G.players, c = G.caller;
  const ord = aliveOrder(players, c);
  const e = entryFor(players, ord);
  setInfo(); updateLabels();
  moveGlow(c);
  $('banner').innerHTML = '';

  // 出し方を決める
  const dec = {};
  for (const i of ord) if (!players[i].isPlayer) dec[i] = npcDecide(players, ord, i, e, Math.random);
  const me = players[0];
  let myRaise = [];
  if (isIn(me)){
    const choice = await playerChoice(token, c === 0);
    guard(token);
    myRaise = choice.raise;
    dec[0] = { k: uCount(me) + myRaise.length, call: choice.call };
  } else {
    showWatch();
  }

  // 掛け声 →「数」を言う瞬間に、全員が同時に親指を出す（読み終わるのを待たない）
  const call = dec[c].call, word = callWord();
  const banner = $('banner');
  banner.innerHTML = '';
  const numEl = el('span', { class:'num-say', text:`${call}！` });
  numEl.style.visibility = 'hidden';   // 場所だけ取っておき、数を言う瞬間に出す
  banner.append(el('div', { class:'who', text:`${players[c].name} の宣言` }), el('div', { class:'call pop' }, `${word}、`, numEl));
  if (G.ff) await sleep(200);
  else if (canSpeak()) await Promise.all([say(word, 1.15, 600 + word.length * 260).ended, sleep(350)]);
  else await sleep(650);               // 読み上げなし: 掛け声のぶんの一拍
  guard(token);
  if (!G.ff) await Promise.race([say(String(call), 1.15, 2000).started, sleep(450)]);
  guard(token);
  await pauseGate(); guard(token);
  numEl.style.visibility = ''; numEl.classList.add('pop');

  // 全員が同時に出す
  const raises = {};
  for (const i of ord) raises[i] = players[i].isPlayer ? myRaise : raiseHands(players[i], dec[i].k, Math.random);
  const anims = [];
  for (const i of ord){
    for (const hi of raises[i]){ players[i].hands[hi].up = true; anims.push(tween(seatObjs[i].hands[hi].th, 't', 1, G.ff ? 120 : 380)); }
  }
  await Promise.all(anims); guard(token);
  for (const i of ord) players[i].hands.forEach((h, j) => { seatObjs[i].hands[j].ring.visible = h.alive && h.up; });
  setCount(upTotal(players), true);
  updateLabels();

  // 判定
  const total = ord.reduce((a, i) => a + uCount(players[i]), 0);
  const hit = call === total;
  const res = el('div', { class:'res pop' }, el('span', { class: hit ? 'hit' : 'miss', text: hit ? '当たり！' : dec[c].miss ? 'はずれ（戦略のうち）' : 'はずれ' }));
  banner.append(res);
  await sleep(hit ? 700 : 900); guard(token);

  // 当てた宣言者は片手を下ろす。両手を下ろしたら抜ける
  if (hit){
    const p = players[c];
    let hi;
    if (p.isPlayer){
      hi = await chooseLowerHand();
      guard(token);
    } else {
      hi = npcLowerHand(p, e, dec[c].k, ord.slice(1).map(i => dec[i].k));
    }
    p.hands[hi].alive = false;
    await dropHand(c, hi, G.ff); guard(token);
    setCount(upTotal(players), true);
    if (hCount(p) === 0){
      p.rank = ++G.exits;
      res.append(el('div', { text: p.isPlayer ? (p.rank === 1 ? 'あなたが1抜け！' : `あなたは${p.rank}位で抜けました`) : `${p.name} が${p.rank}位で抜けた` }));
    }
    updateLabels();
  }

  // 残りが 1 人なら終わり。そうでなければ宣言は隣の人へ
  const alive = aliveIndices(players);
  if (alive.length <= 1){
    if (alive.length === 1) players[alive[0]].rank = ++G.exits;
    G.over = true; updateLabels(); moveGlow(-1);
    await sleep(900); guard(token);
    finishGame();
    return;
  }
  G.caller = nextCaller(players, c);
  await sleep(G.ff ? 150 : 650);
}

/* ---------- プレイヤーの入力 ---------- */
// 親指を立てるかどうか（宣言者なら宣言する数も）を選んで「決定」を押すまで待つ
function playerChoice(token, isCaller){
  return new Promise(resolve => {
    const me = G.players[0];
    const raise = new Set();
    let call = null;
    const panel = $('ctl-play');
    $('ctl-watch').hidden = true;
    panel.hidden = false;
    $('ctl-title').innerHTML = '';
    $('ctl-title').append(isCaller ? 'あなたが宣言者です' : '親指を出してください',
      el('span', { class:'sub', text: isCaller ? '親指の本数と宣言する数を選んで「決定」' : `${G.players[G.caller].name} が宣言します` }));
    const thumbs = $('thumbs');
    const names = ['左手', '右手'];
    const preview = () => {
      me.hands.forEach((h, j) => {
        const o = seatObjs[0].hands[j];
        if (h.alive && !h.up) o.th.t = raise.has(j) ? 0.55 : 0;   // 選んだ手は親指を半分だけ起こして見せる
      });
    };
    const toggle = (j) => { raise.has(j) ? raise.delete(j) : raise.add(j); render(); preview(); };
    const render = () => {
      thumbs.innerHTML = '';
      me.hands.forEach((h, j) => {
        if (!h.alive){ thumbs.append(el('div', { class:'btn thumb-btn', 'aria-disabled':'true', style:'opacity:.35' }, el('span', { class:'h', text:names[j] }), el('span', { class:'v', text:'下ろした手' }))); return; }
        if (h.up){ thumbs.append(el('div', { class:'btn thumb-btn locked' }, el('span', { class:'h', text:`${names[j]}の親指・固定` }), el('span', { class:'v', text:'立てたまま' }))); return; }
        const on = raise.has(j);
        const b = el('button', { class:'btn thumb-btn', type:'button', 'aria-pressed':String(on) }, el('span', { class:'h', text:`${names[j]}の親指` }), el('span', { class:'v', text: on ? '立てる' : '立てない' }));
        b.addEventListener('click', () => toggle(j));
        thumbs.append(b);
      });
      const k = uCount(me) + raise.size;
      $('thumb-hint').hidden = !me.hands.some(h => h.alive && !h.up);
      $('callrow').hidden = !isCaller;
      const qnums = $('qnums'); qnums.innerHTML = '';
      if (isCaller){
        const nums = $('nums'); nums.innerHTML = '';
        const th = tableHands(G.players);
        const others = lockedSum(G.players, 0);
        // 今の親指の出し方で起こり得る合計: 自分の本数 ＋ 他の人の固定済み 〜 自分の本数 ＋ 他の人の残っている手
        const lo = k + others, hi = k + (th - hCount(me));
        const mkNum = (v) => {
          const can = v >= lo && v <= hi;
          const b = el('button', { class: can ? 'btn num' : 'btn num impossible', type:'button', 'aria-pressed':String(call === v), 'aria-label': can ? `${v} と宣言する` : `${v} と宣言する（今の出し方では起こり得ない）`, text:String(v) });
          b.addEventListener('click', () => { call = v; render(); });
          return b;
        };
        // 右の操作パネルと、手の下のボタン列（PC の横長画面だけ表示）の両方に並べる
        for (let v = 0; v <= th; v++){ nums.append(mkNum(v)); qnums.append(mkNum(v)); }
        const free = th - hCount(me) - others;
        setText($('call-hint'), `場の手は合計 ${th} 本。あなた以外は、固定された親指が ${others} 本、まだ動かせる親指が ${free} 本。`);
      }
      const sum = $('summary'); sum.innerHTML = '';
      sum.append('親指 ', el('b', { text:`${k} 本` }));
      if (isCaller) sum.append(' ・ 宣言 ', el('b', { text: call === null ? '未選択' : `「${callWord()}、${call}！」` }));
      $('btn-decide').disabled = $('q-decide').disabled = isCaller && call === null;
    };
    render(); preview();
    // 画面の自分の手をクリック（タップ）しても切り替えられる。固定された親指は手を小さく揺らして知らせる
    G.toggleThumb = (j) => {
      const h = me.hands[j];
      if (!h || !h.alive) return;
      if (h.up){ shakeHand(seatObjs[0].hands[j]); return; }
      toggle(j);
    };
    const decide = $('btn-decide'), qdecide = $('q-decide');
    const detach = () => { decide.removeEventListener('click', onDecide); qdecide.removeEventListener('click', onDecide); G.cancelChoice = null; G.toggleThumb = null; setHover(-1); };
    const onDecide = () => {
      if (isCaller && call === null) return;
      detach();
      panel.hidden = true;
      unlockAudio();
      // 選んだ手は一度倒し、公開のときに立てる
      me.hands.forEach((h, j) => { if (h.alive && !h.up) seatObjs[0].hands[j].th.t = 0; });
      resolve({ raise:[...raise], call });
    };
    decide.addEventListener('click', onDecide); qdecide.addEventListener('click', onDecide);
    G.cancelChoice = detach;
  });
}
// 当てたときに下ろす手を選ぶ（片方しか残っていない・両方同じ状態なら選ばない）
function chooseLowerHand(){
  const me = G.players[0];
  const upI = me.hands.findIndex(h => h.alive && h.up), downI = me.hands.findIndex(h => h.alive && !h.up);
  if (upI < 0) return Promise.resolve(downI);
  if (downI < 0) return Promise.resolve(upI);
  return new Promise(resolve => {
    const names = ['左手', '右手'];
    const box = $('lower-choices'); box.innerHTML = '';
    const mk = (i, label, primary) => {
      const b = el('button', { class:`btn ${primary ? 'primary' : ''}`, type:'button', text:`${names[i]}を下ろす（${label}）` });
      b.addEventListener('click', () => { $('modal-lower').hidden = true; resolve(i); });
      return b;
    };
    box.append(mk(upI, '親指が上がっている手', true), mk(downI, '親指が下がっている手', false));
    $('modal-lower').hidden = false;
    box.querySelector('button').focus();
  });
}
// 自分が抜けた後は観戦（早送り・結果まで飛ばす）
function showWatch(){
  $('ctl-play').hidden = true;
  const w = $('ctl-watch'); w.hidden = false;
  $('game-screen').classList.add('watching');
  const me = G.players[0];
  setText($('watch-title'), me.rank ? `あなたは${me.rank}位で抜けました` : '観戦中');
}

/* ---------- 結果 ---------- */
function finishGame(){
  $('ctl-play').hidden = true; $('ctl-watch').hidden = true;
  const me = G.players[0];
  if (me.rank === 1){ settings.stars[`${G.n}-${G.m}`] = true; saveSettings(); }
  setText($('res-title'), me.rank === 1 ? '1抜け！' : `${me.rank}位`);
  setText($('res-star'), me.rank === 1 ? `★ ${G.n}人・${G.m}番手 獲得` : `${G.n}人・${G.m}番手の★はまだ`);
  const list = $('res-list'); list.innerHTML = '';
  [...G.players].sort((a, b) => a.rank - b.rank).forEach(p => {
    list.append(el('li', { class: p.isPlayer ? 'me' : '' }, el('span', { text:p.name }), el('span', { class:'rk', text:`${p.rank}位` })));
  });
  show('result');
  $('btn-again').focus();
}
// 「結果まで飛ばす」: 残りを演出なしで最後まで進める（プレイヤーが抜けた後）
function skipToEnd(){
  if (!G || G.over) return;
  const players = G.players, st = { players, caller:G.caller, exits:G.exits };
  let guardN = 0;
  while (players.filter(isIn).length > 1 && guardN++ < 2000){ if (autoRound(st, Math.random)) break; }
  G.caller = st.caller; G.exits = st.exits;
  G.over = true;
  syncHandsInstant(players); updateLabels(); moveGlow(-1);
  setCount(upTotal(players), false);
  finishGame();
}

/* ---------- 対戦画面のボタンと操作をつなぐ ---------- */
export function initMatch(){
  $('btn-pause').addEventListener('click', openPause);
  $('btn-resume').addEventListener('click', () => { closePause(); $('btn-pause').focus(); });
  $('btn-restart').addEventListener('click', restart);
  $('btn-to-title').addEventListener('click', toTitle);
  $('btn-voice').addEventListener('click', () => { settings.voice = !settings.voice; saveSettings(); setVoiceBtn(); if (!settings.voice) stopVoice(); });
  $('btn-ff').addEventListener('click', () => { if (!G) return; G.ff = !G.ff; $('btn-ff').setAttribute('aria-pressed', String(G.ff)); $('btn-ff').textContent = G.ff ? '早送り中' : '早送り'; if (G.ff) stopVoice(); });
  $('btn-skip').addEventListener('click', () => { if (!G || G.over) return; G.skip = true; G.ff = true; $('btn-skip').disabled = true; $('btn-ff').disabled = true; stopVoice(); });
  $('btn-again').addEventListener('click', restart);
  $('btn-title').addEventListener('click', toTitle);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!$('modal-pause').hidden){ closePause(); $('btn-pause').focus(); return; }
    let closed = false;
    for (const m of ['modal-rules', 'modal-call']) if (!$(m).hidden){ $(m).hidden = true; closed = true; }
    if (!closed && G && !G.over && !$('game-screen').hidden) openPause();   // 対戦中は Esc でも一時停止
  });
  // 画面の自分の手: クリック（タップ）で親指を切り替え、マウスを乗せると輪郭が光る（選んでいる最中だけ）
  const pickable = (ev) => (G && G.toggleThumb) ? handUnderPointer(ev) : -1;
  canvas.addEventListener('click', (ev) => { const j = pickable(ev); if (j >= 0) G.toggleThumb(j); });
  let pickQueued = null;
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    if (!pickQueued) requestAnimationFrame(() => {
      const j = pickable(pickQueued), h = j >= 0 && G ? G.players[0].hands[j] : null;
      setHover(h && h.alive && !h.up ? j : -1);
      pickQueued = null;
    });
    pickQueued = ev;
  });
  canvas.addEventListener('pointerleave', () => setHover(-1));
}
