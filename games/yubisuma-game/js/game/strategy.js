// NPC の戦略: 人数ごとの均衡戦略 CSV を読み、状態に応じて親指の本数・宣言・下ろす手を決める
import { hCount, uCount, isIn, aliveOrder, nextCaller, aliveIndices, tableHands, lockedSum } from './rules.js';

// CSV の列: 人数,状態,位置,立てる本数,予想,確率,望みなし,他の人の本数
const POS_INDEX = { '宣言者':0, '次':1, '2つ後':2, '3つ後':3 };
// TABLES[人数][状態] = { c:[[立てる本数, 予想(-1=わざと外す), 確率]], pos:{1:[p0,p1,p2],…}, dead:Set, down:Set('本数;次|2つ後…') }
export const TABLES = {};
export function parseCSV(text){
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const rows = lines.slice(1).map(l => l.split(','));
  for (const r of rows){
    const [n, state, pos, kStr, guess, prob, dead, others] = r;
    const T = (TABLES[n] = TABLES[n] || {});
    const e = (T[state] = T[state] || { c:[], pos:{}, dead:new Set(), down:new Set() });
    if (pos === '当てたら下がっている手を下ろす'){ e.down.add(`${kStr};${others}`); continue; }
    const idx = POS_INDEX[pos];
    const k = Number(kStr), p = Number(prob);
    if (dead === '1') e.dead.add(idx);
    if (idx === 0) e.c.push([k, guess === '外す' ? -1 : Number(guess), p]);
    else { (e.pos[idx] = e.pos[idx] || [0, 0, 0])[k] += p; }
  }
}
// 3 人数ぶんの CSV を同時に読み込む。読めなければ理由つきで失敗する
export async function loadTables(){
  const texts = await Promise.all([2, 3, 4].map(async (n) => {
    const res = await fetch(`data/yubisuma_eq_${n}p.csv`);
    if (!res.ok) throw new Error(`${n}人の戦略ファイル（${res.status}）`);
    return res.text();
  }));
  texts.forEach(parseCSV);
}
export const tablesReady = () => [2, 3, 4].every(n => TABLES[n]);

// 状態の名前（例: 両2固1 = 手が 2 本残っていて、そのうち親指が固定された手が 1 本）
const LABEL = { '2,0':'両2固0', '2,1':'両2固1', '2,2':'両2固2', '1,0':'片1固0', '1,1':'片1固1' };
export function entryFor(players, ord){
  const key = ord.map(i => LABEL[`${hCount(players[i])},${uCount(players[i])}`]).join('|');
  return TABLES[ord.length] ? TABLES[ord.length][key] : null;
}
function sampleIdx(probs, rng){ const tot = probs.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < probs.length; i++){ r -= probs[i]; if (r < 0) return i; } let last = 0; probs.forEach((p, i) => { if (p > 0) last = i; }); return last; }

// NPC の出し方: { k: 立てる本数, call: 宣言する数（宣言者のみ）, miss: 均衡戦略の「わざと外す」（場の手＋1 を言う） }
export function npcDecide(players, ord, i, e, rng){
  const p = players[i], pos = ord.indexOf(i), h = hCount(p), u = uCount(p);
  const th = tableHands(players);
  if (!e){ return pos === 0 ? { k:u, call:lockedSum(players, -1) + Math.floor(rng() * (th - lockedSum(players, -1) + 1)) } : { k:u }; }
  if (pos === 0){
    const pick = e.c[sampleIdx(e.c.map(x => x[2]), rng)];
    const k = Math.min(h, Math.max(u, pick[0]));
    return { k, call: pick[1] < 0 ? th + 1 : k + pick[1], miss: pick[1] < 0 };
  }
  const k = sampleIdx(e.pos[pos] || [1, 0, 0], rng);
  return { k: Math.min(h, Math.max(u, k)) };
}
// 立てる本数 k から、どの手の親指を新しく立てるか（NPC は無作為）
export function raiseHands(p, k, rng){
  const free = p.hands.map((h, i) => (h.alive && !h.up) ? i : -1).filter(i => i >= 0);
  for (let j = free.length - 1; j > 0; j--){ const r = Math.floor(rng() * (j + 1)); [free[j], free[r]] = [free[r], free[j]]; }
  return free.slice(0, Math.max(0, k - uCount(p)));
}
// 当てた宣言者が下ろす手（NPC）: 均衡の表が「下がっている手」を示す場面以外は、親指が上がっている手
export function npcLowerHand(p, e, kC, othersKs){
  const upI = p.hands.findIndex(h => h.alive && h.up), downI = p.hands.findIndex(h => h.alive && !h.up);
  if (upI < 0) return downI;
  if (downI < 0) return upI;
  return (e && e.down.has(`${kC};${othersKs.join('|')}`)) ? downI : upI;
}

// 全員 NPC で 1 ラウンドを演出なしで進める（「結果まで飛ばす」と自動対戦で使う）
// st = { players, caller, exits }。抜けた人に順位を付け、st.caller を次の宣言者にする。最後の 1 人まで決まったら true
export function autoRound(st, rng){
  const { players } = st, c = st.caller, ord = aliveOrder(players, c), e = entryFor(players, ord);
  const dec = {}; for (const i of ord) dec[i] = npcDecide(players, ord, i, e, rng);
  for (const i of ord) for (const hi of raiseHands(players[i], dec[i].k, rng)) players[i].hands[hi].up = true;
  const total = ord.reduce((a, i) => a + uCount(players[i]), 0);
  if (dec[c].call === total){
    const hi = npcLowerHand(players[c], e, dec[c].k, ord.slice(1).map(i => dec[i].k));
    players[c].hands[hi].alive = false;
    if (hCount(players[c]) === 0) players[c].rank = ++st.exits;
  }
  const alive = aliveIndices(players);
  if (alive.length === 1){ players[alive[0]].rank = ++st.exits; return true; }
  st.caller = nextCaller(players, c);
  return false;
}

// 自動対戦（確認用）: 全員を NPC にして n 人戦を games 回。宣言順ごとの1抜け率を返す
export function simulate(n, games, seed){
  let s = seed || 12345;
  const rng = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const first = new Array(n).fill(0);
  for (let gi = 0; gi < games; gi++){
    const st = { players:Array.from({ length:n }, () => ({ hands:[{ alive:true, up:false }, { alive:true, up:false }], rank:0 })), caller:0, exits:0 };
    let guard = 0;
    while (st.players.filter(isIn).length > 1 && guard++ < 1000){ if (autoRound(st, rng)) break; }
    const w = st.players.findIndex(p => p.rank === 1);
    if (w >= 0) first[w]++;
  }
  return first.map(x => x / games);
}
