// 手袋の形を計算し直して data/glove.txt に書き出す（手袋の形を変えたときに実行する）
//   node tools/gen-glove.mjs
import { writeFileSync } from 'node:fs';
import { buildGloveMesh, encodeGlove, decodeGlove } from '../js/scene/glove-shape.js';

const t0 = Date.now();
const g = buildGloveMesh();
const bin = encodeGlove(g);
// 書き出したものを読み戻して、元の形と一致するか確かめる
const d = decodeGlove(bin.buffer);
let posErr = 0; for (let i = 0; i < g.position.length; i++) posErr = Math.max(posErr, Math.abs(d.position[i] - g.position[i]));
const idxSame = g.index.every((v, i) => d.index[i] === v);
writeFileSync(new URL('../data/glove.txt', import.meta.url), Buffer.from(bin).toString('base64') + '\n');
console.log(`頂点 ${g.position.length / 3}, 三角形 ${g.index.length / 3}, ${bin.length} バイト, 位置の誤差 最大 ${posErr.toExponential(2)} cm, 添字 ${idxSame ? '一致' : '不一致'}, ${Date.now() - t0}ms`);
