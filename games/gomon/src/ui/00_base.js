// 五門の兵：はじまりのファイル。保存、実績、音とのつなぎ、文字の表示の道具、ゲームの決まりごと（定数）
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

const G = window.GateLogic;
const app = document.getElementById('app');
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

if (!window.THREE) {
  const f = document.createElement('div');
  f.className = 'fatal';
  f.innerHTML = '<p class="stage-name">3D 表示を読み込めませんでした</p><p class="meta-line">通信状況を確かめて、ページを再読み込みしてください。</p>';
  app.appendChild(f);
  $('title').hidden = true;
  return; // 3D が使えないときは、ここで止める（ui/ のファイルは全部1つの関数の中なので、このあとは動かない）
}
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 保存（このブラウザだけ） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('gomon.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gomon.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};
// (n/2)d2 は (n/2)d3 に変わった。前の版で登録していた人はそのまま引き継ぐ
const dex = new Set(store.get('dex', []).map((id) => (id === 'halfnd2' ? 'halfnd3' : id)));
const achieved = new Set(store.get('ach', []));
let best = store.get('best', 0);                              // エンドレスで突破した最高のステージ
let reach = Math.max(store.get('reach', 0), best);            // エンドレスで到達した最高のステージ（タイトルの BEST）
let sel = store.get('sel', 'endless');                        // タイトルで選んだステージ（endless / early / final / nocommon）
if (!['endless', 'early', 'final', 'nocommon'].includes(sel)) sel = 'endless';
let muted = store.get('muted', false);
// 実績の並び（id は保存に使うので、名前を変えても id はそのまま）
const ACH = [
  { id: 'mu', name: '無', cond: '途中でちょうど0人になり、そこから復活する' },
  { id: 'hanten', name: '反転軍', cond: '初めて兵士がマイナスになる' },
  { id: 'futabi', name: '負旅行', cond: '途中でマイナスを経由して、プラスでゴールする' },
  { id: 'shinen', name: '深淵', cond: '兵士が −1000 以下になる' },
  { id: 'manjin', name: '万人隊、結成', cond: '兵士が10000を超える' },
  { id: 'hachimon', name: '天下統一', cond: 'エンドレスモードでステージ8をクリアする' },
  { id: 'horizon', name: '事象の地平線', cond: '0除算でブラックホールに吸い込まれる' },
  { id: 'nan', name: 'NaN', cond: '定義できない計算でバグる' },
  { id: 'master', name: 'ゲートマスター', cond: '全種類のゲートを通過する' },
];

// ---------- 音（audio.js にまとめてある） ----------
const AU = window.GomonAudio;
const { sfx, stepSound, bumpSound, bhSound, stopBhSound, brookSound, brookNear, brookDrops } = AU;
const ensureAudio = () => AU.ensure();
AU.setMuted(muted);
const VOL_KEYS = ['se', 'env', 'bgm'];
// 音量は 0〜200（100 がふつう）。前の版（0〜100、70 がふつう）で保存した値は、100/70 倍して引き継ぐ
let savedVol = store.get('vol2', null);
if (!savedVol) { const old = store.get('vol', {}); savedVol = {}; VOL_KEYS.forEach((k) => { if (typeof old[k] === 'number') savedVol[k] = Math.round((old[k] * 100) / 70); }); store.set('vol2', savedVol); }
VOL_KEYS.forEach((k) => { if (typeof savedVol[k] === 'number') AU.setVolume(k, savedVol[k]); });

// ---------- 表示の道具 ----------
function tokensHTML(tokens) {
  return tokens.map((t) => {
    if (typeof t === 'string') return esc(t);
    const inner = (s, it) => (it ? '<i>' + esc(s) + '</i>' : esc(s));
    if (t.sup != null) return '<sup>' + inner(t.sup, t.it) + '</sup>';
    if (t.sub != null) return '<sub>' + inner(t.sub, t.it) + '</sub>';
    if (t.frac) return '<span class="frac"><span>' + esc(t.frac[0]) + '</span><span>' + esc(t.frac[1]) + '</span></span>';
    if (t.stack) return '<span class="lim"><span>' + esc(t.stack[0]) + '</span><span>' + esc(t.stack[1]) + '</span></span>';
    if (t.it) return '<i>' + esc(t.it) + '</i>';
    return '';
  }).join('');
}
// 札には数式だけを書く（カテゴリの印はゲート本体の飾り）
const gateHTML = (typeId, p) => tokensHTML(G.TYPES[typeId].label(p));
const digits = (n) => (n < 0n ? -n : n).toString().length;
const fmtBig = (n) => (G.isMine(n) ? G.fmtJa(n) : digits(n) <= 12 ? G.fmtComma(n) : G.fmtJa(n));
const fmtShort = (n) => (G.isMine(n) ? G.fmtJa(n) : digits(n) <= 7 ? G.fmtComma(n) : G.fmtJa(n));
function unitsFor(n) {
  const a = n < 0n ? -n : n;
  if (a <= 100n) return [{ tier: 0, count: Number(a) }];
  const s = a.toString(), res = [];
  for (let i = 0; i < s.length; i++) { const c = +s[i]; if (c) res.push({ tier: s.length - 1 - i, count: c }); }
  return res;
}
function toast(kicker, text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<b>' + esc(kicker) + '</b>' + esc(text);
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3300);
}
function unlock(id) {
  if (achieved.has(id)) return;
  achieved.add(id);
  store.set('ach', [...achieved]);
  const a = ACH.find((x) => x.id === id);
  toast('実績解除', a.name);
  noticeSound('ach');
}
// 知らせの音が同時に重なったら、少しずらして順に鳴らす
let noticeAt = 0;
function noticeSound(kind) {
  const now = performance.now(), wait = Math.max(0, noticeAt + 450 - now);
  noticeAt = now + wait;
  if (wait) setTimeout(() => sfx(kind), wait); else sfx(kind);
}
function registerDex(typeId) {
  if (dex.has(typeId)) return;
  dex.add(typeId);
  store.set('dex', [...dex]);
  toast('図鑑に登録', G.TYPES[typeId].name);
  if (dex.size >= G.TYPE_LIST.length) unlock('master');
}

// 真上から見るとき、横長の画面では兵士が右から左へ進む。縦長の画面では文字が詰まらないよう下から上へ進む。
const rtl = () => app.clientWidth >= app.clientHeight;
function laneName(L, i) {
  const names = rtl() ? { 1: ['中'], 2: ['下', '上'], 3: ['下', '中', '上'] } : { 1: ['中'], 2: ['左', '右'], 3: ['左', '中', '右'] };
  return names[L][i];
}
function routeName(lay, r) {
  if (lay.kind === 'u') return r.name;
  if (lay.kind === 'plaza') return laneName(lay.L1, r.lanes[0]) + '→' + laneName(lay.L2, r.lanes[1]);
  return laneName(lay.L, r.lanes[0]);
}

// ---------- ゲームの決まりごと：大きさ・速さ・時間 ----------
const GH = 6;            // ゲートの板の高さ
const RUN_SPEED = 9, TIMER_SEC = 30, INTRO_SEC = 2.4, KEY_SPEED = 16;
const ROAD_END = 380, PLAZA_LEN = 36;
const GAP = 16;          // ゲートとゲートの間隔（中州の長さとは別）
const GZ = (p) => -GAP * p;
// 川と橋：LS レーンの間隔、BW 橋の幅、LOCK レーンが決まる線、WAIT 兵士が待つ場所、BANK 手前の岸、WATER_Y 水面、BED_Y 川底、X 川の長さの半分（地面の端から端まで）、
// BOSS 橋を渡りきったところからボスまで（足場の半径 14 ＋ 歩く間 WALK。約0.8秒）
const RIVER = { LS: 15, BW: 10, LOCK: 16, WAIT: 23, BANK: 4, WATER_Y: -2.4, BED_Y: -3.2, X: 1400, BOSS: 21, WALK: 7 };
// レーンが決まる線と、待つ場所（コースの形によって変わる）
const lockZ = () => (course && course.geo.lockZ) || RIVER.LOCK;
const waitZ = () => (course && course.geo.waitZ) || RIVER.WAIT;
const FOV_FOLLOW = 50, FOV_OVER = 30; // 真上から見るときは、画角を狭めて高いところから眺める
const laneX = (l, L, w) => (l - (L - 1) / 2) * w;
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }; // 0〜1 をなめらかに
const HORIZON = 0xdcecf8;
