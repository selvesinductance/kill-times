// ゲームの決まり（画面と切り離した部分）
// 人: { hands:[{ alive, up }, { alive, up }], rank }  alive = まだ下ろしていない手 / up = 親指が立って固定された手
export const hCount = (p) => p.hands.filter(h => h.alive).length;
export const uCount = (p) => p.hands.filter(h => h.alive && h.up).length;
export const isIn = (p) => hCount(p) > 0 && !p.rank;
export const upTotal = (players) => players.reduce((a, p) => a + uCount(p), 0);   // いま立っている親指の数
export const newHands = () => [{ alive:true, up:false }, { alive:true, up:false }];

// 宣言者から時計回りに、残っている人の並び
export function aliveOrder(players, caller){
  const n = players.length, ord = [caller];
  for (let t = (caller + 1) % n; t !== caller; t = (t + 1) % n) if (isIn(players[t])) ord.push(t);
  return ord;
}
// 次の宣言者（隣の、まだ残っている人）
export function nextCaller(players, caller){
  let t = caller; do { t = (t + 1) % players.length; } while (!isIn(players[t]));
  return t;
}
export const aliveIndices = (players) => players.map((p, i) => isIn(p) ? i : -1).filter(i => i >= 0);
// 場の手の数（残っている人の、下ろしていない手）
export function tableHands(players){ return players.reduce((a, p) => a + (isIn(p) ? hCount(p) : 0), 0); }
// 固定された親指の数（except の人を除く）
export function lockedSum(players, except){ return players.reduce((a, p, i) => a + (isIn(p) && i !== except ? uCount(p) : 0), 0); }
