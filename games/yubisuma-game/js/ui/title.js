// タイトル画面: 人数・番手のボタン（★と目安の色）、手の色、掛け声設定、ルール、タイトル用の 3D の場面
import { PAR, SWATCHES, SWATCH_NAMES, NPC_COLORS, CALL_PRESETS } from '../config.js';
import { settings, saveSettings, callWord } from '../settings.js';
import { $, el } from '../dom.js';
import { say, unlockAudio } from '../voice.js';
import { newHands } from '../game/rules.js';
import { seatObjs, buildSeats, clearSeats } from '../scene/seats.js';
import { setHandColor } from '../scene/glove.js';
import { showCounter } from '../scene/counter.js';

let onStart = () => {};   // 人数・番手のボタンを押したときに呼ぶ（main.js が対戦の開始をつなぐ）

/* ---------- 目安の大きさをボタンの色で表す ----------
   小さいほど赤系で暗く、大きいほど緑系で明るい（明るさも順に変わるので、赤と緑の区別がしにくくても順番は分かる。数値もボタンに書いてある） */
function oklchHex(L, Cc, hDeg){
  const h = hDeg * Math.PI / 180;
  const toRgb = (c) => {
    const a = c * Math.cos(h), b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  };
  let rgb = toRgb(Cc);
  while (Cc > 0 && rgb.some(x => x < 0 || x > 1)){ Cc -= 0.004; rgb = toRgb(Math.max(0, Cc)); }   // 表示できる範囲まで鮮やかさを下げる
  return '#' + rgb.map(x => { x = Math.min(1, Math.max(0, x)); const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(v * 255).toString(16).padStart(2, '0'); }).join('');
}
const PAR_ALL = Object.values(PAR).flat(), PAR_MIN = Math.min(...PAR_ALL), PAR_MAX = Math.max(...PAR_ALL);
const parT = (v) => (v - PAR_MIN) / (PAR_MAX - PAR_MIN);
const parHue = (t) => 25 + 120 * t;   // 赤(25°) → 黄みの茶 → 緑(145°)
const parFill = (v) => { const t = parT(v); return oklchHex(0.30 + 0.22 * t, 0.095 + 0.06 * t, parHue(t)); };
const parEdge = (v) => { const t = parT(v); return oklchHex(0.40 + 0.22 * t, 0.11 + 0.06 * t, parHue(t)); };

// 人数・番手のボタン。enabled = 戦略データがそろって押せる状態か
export function renderModes(enabled){
  const box = $('modes'); box.innerHTML = '';
  // 列の見出し（何番手に宣言するか）。ボタンの中には書かない
  const head = el('div', { class:'mode-row mode-head', 'aria-hidden':'true' }, el('span'));
  for (let m = 1; m <= 4; m++) head.append(el('span', { text:`${m}番手` }));
  box.append(head);
  for (const n of [2, 3, 4]){
    const row = el('div', { class:'mode-row' }, el('div', { class:'rowname', text:`${n}人` }));
    for (let m = 1; m <= 4; m++){
      if (m > n){ row.append(el('span')); continue; }
      const won = !!settings.stars[`${n}-${m}`];
      const b = el('button', { class:'btn mode-btn', type:'button', 'aria-label':`${n}人で${m}番手に宣言して始める。目安 ${Math.round(PAR[n][m - 1] * 100)}%${won ? '。1抜け済み' : ''}` },
        el('span', { class:'s', text:'目安' }),
        el('span', { class:'t' }, `${Math.round(PAR[n][m - 1] * 100)}%`, won ? el('span', { class:'star', text:'★', 'aria-hidden':'true' }) : null));
      b.style.setProperty('--mb', parFill(PAR[n][m - 1]));
      b.style.setProperty('--mbb', parEdge(PAR[n][m - 1]));
      if (!enabled) b.disabled = true;
      b.addEventListener('click', () => { unlockAudio(); onStart(n, m); });
      row.append(b);
    }
    box.append(row);
  }
  // 9 つすべてに★が付いていたら、タイトルをゲーミング色にする
  const allStars = [2, 3, 4].every(n => Array.from({ length:n }, (_, i) => settings.stars[`${n}-${i + 1}`]).every(Boolean));
  document.querySelector('.title-panel h1').classList.toggle('gaming', allStars);
}

/* ---------- あなたの手の色 ---------- */
const RAINBOW = 'conic-gradient(#e94b4b,#e9b93a,#4fb05e,#3d8fd6,#8a5cd6,#e94b4b)';
export function renderColors(){
  const box = $('colors'); box.innerHTML = '';
  SWATCHES.forEach((c, i) => {
    const b = el('button', { class:'swatch', type:'button', style:`background:${c}`, 'aria-label':SWATCH_NAMES[i], 'data-c':c });
    b.addEventListener('click', () => setPlayerColor(c));
    box.append(b);
  });
  const pick = el('input', { type:'color', id:'color-pick', value:settings.color, 'aria-label':'好きな色を選ぶ' });
  pick.addEventListener('input', () => setPlayerColor(pick.value));
  box.append(el('label', { class:'picker', for:'color-pick' }, '好きな色', el('span', { class:'picker-box', id:'picker-box' }, pick)));
  syncColorUI();
}
// 選ばれている色の表示だけを更新する（色選びの最中に部品を作り直さない）
function syncColorUI(){
  const cur = settings.color.toLowerCase(), preset = SWATCHES.includes(cur);
  document.querySelectorAll('#colors .swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === cur)));
  const pb = $('picker-box');
  if (pb){ pb.dataset.on = String(!preset); pb.style.background = preset ? RAINBOW : settings.color; }
}
function setPlayerColor(c){
  settings.color = c; saveSettings(); syncColorUI();
  if (onTitleScene) seatObjs[0].hands.forEach(h => setHandColor(h, c));
}

/* ---------- タイトル用の場面（プレイヤーの手＋NPC 3人） ---------- */
let onTitleScene = false;
export function showTitleScene(){
  clearSeats();
  showCounter(false);
  const players = [{ name:'あなた', color:settings.color }, { name:'NPC1', color:NPC_COLORS[0] }, { name:'NPC2', color:NPC_COLORS[1] }, { name:'NPC3', color:NPC_COLORS[2] }]
    .map(p => ({ ...p, hands:newHands(), rank:0 }));
  buildSeats(players);
  $('labels').innerHTML = '';
  onTitleScene = true;
  // 何本か立てておく
  seatObjs[0].hands[0].th.t = 1;
  seatObjs[2].hands[1].th.t = 1; seatObjs[2].hands[1].ring.visible = true;
  seatObjs[3].hands[0].th.t = 1; seatObjs[3].hands[0].ring.visible = true;
}
// 対戦が始まったら、タイトル用の場面ではなくなる
export function leaveTitleScene(){ onTitleScene = false; }

/* ---------- 掛け声設定 ---------- */
function renderCallChoices(){
  const box = $('call-choices'); box.innerHTML = '';
  for (const w of CALL_PRESETS){
    const r = el('input', { type:'radio', name:'callw', value:w, id:`cw-${w}` });
    if (settings.call === w) r.checked = true;
    r.addEventListener('change', () => { settings.call = w; saveSettings(); });
    box.append(el('label', { class:'radio', for:`cw-${w}` }, r, w + (w === 'いっせーの' ? '（初期設定）' : '')));
  }
  const r = el('input', { type:'radio', name:'callw', value:'__custom', id:'cw-custom' });
  if (settings.call === '__custom') r.checked = true;
  const t = el('input', { type:'text', id:'cw-text', maxlength:'20', placeholder:'掛け声を入力', value:settings.customCall, 'aria-label':'自分で決める掛け声' });
  r.addEventListener('change', () => { settings.call = '__custom'; saveSettings(); t.focus(); });
  t.addEventListener('input', () => { settings.customCall = t.value; settings.call = '__custom'; r.checked = true; saveSettings(); });
  box.append(el('label', { class:'radio', for:'cw-custom' }, r, el('span', { style:'white-space:nowrap', text:'どれでもない：' }), t));
}

// タイトル画面のボタンをつなぐ。start(n, m) = 対戦を始める
export function initTitle({ start }){
  onStart = start;
  $('btn-rules').addEventListener('click', () => { $('modal-rules').hidden = false; $('modal-rules').querySelector('[data-close]').focus(); });
  $('btn-call').addEventListener('click', () => { renderCallChoices(); $('modal-call').hidden = false; });
  $('btn-try').addEventListener('click', () => { unlockAudio(); const was = settings.voice; settings.voice = true; const w = callWord(); say(w).ended.then(() => say('3').ended).then(() => { settings.voice = was; }); });
}
