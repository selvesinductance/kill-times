// NPC どうしで自動対戦し、宣言順ごとの1抜け率を出す（均衡の値 = タイトルの「目安」と比べる確認用）
//   node tools/simulate.mjs [対戦回数]
import { readFileSync } from 'node:fs';
import { parseCSV, simulate } from '../js/game/strategy.js';
import { PAR } from '../js/config.js';

const games = Number(process.argv[2] || 100000);
for (const n of [2, 3, 4]) parseCSV(readFileSync(new URL(`../data/yubisuma_eq_${n}p.csv`, import.meta.url), 'utf8'));
for (const n of [2, 3, 4]){
  const r = simulate(n, games, 777 + n);
  console.log(`${n}人: 自動対戦 ${r.map(x => (x * 100).toFixed(2)).join(' / ')}  均衡 ${PAR[n].map(x => (x * 100).toFixed(2)).join(' / ')}`);
}
