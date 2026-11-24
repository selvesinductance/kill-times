// 手袋の形（親指の先以外を 1 枚の面にしたもの）の計算と、計算済みデータの読み書き。
// three.js に依存しないので、tools/gen-glove.mjs からも同じものを使う。
// モデル内の単位は cm、右手。向き: +z が指先（輪の中心）側、+y が親指側（上）、+x が手のひら側
import { polygonize } from './meshing.js';

const FINGERS = [
  { y: 3.0, dy: 0.1, r: 1.16, p: 3.9, m: 2.6, d: 1.9 },    // 人さし指
  { y: 0.95, dy: 0.03, r: 1.2, p: 4.25, m: 2.8, d: 2.0 },  // 中指
  { y: -1.1, dy: -0.05, r: 1.15, p: 4.0, m: 2.6, d: 1.9 }, // 薬指
  { y: -3.0, dy: -0.12, r: 1.0, p: 3.3, m: 2.1, d: 1.7 },  // 小指
];
export const THUMB_PIVOT = [1.9, 4.6, 5.9];
export const THUMB_BASE_R = 1.36;

// 距離関数をなめらかにつないで手袋の面を作る（数百ミリ秒かかるので、ふだんは計算済みのデータを使う）
export function buildGloveMesh(){
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function roundCone(px, py, pz, A, B, r1, r2){
    const bax = B[0] - A[0], bay = B[1] - A[1], baz = B[2] - A[2];
    const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pax = px - A[0], pay = py - A[1], paz = pz - A[2];
    const y = pax * bax + pay * bay + paz * baz, z = y - l2;
    const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
    const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }
  function ellipsoid(px, py, pz, c, r){
    const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
    const k0 = Math.sqrt(x * x + y * y + z * z);
    const k1 = Math.sqrt(x * x / (r[0] * r[0]) + y * y / (r[1] * r[1]) + z * z / (r[2] * r[2]));
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
  }
  // 甲と手のひら: 手首から指の付け根へ幅が広がる、角の丸い箱
  function palm(px, py, pz){
    let t = pz / 9.5; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const s = 0.74 + 0.26 * (t * t * (3 - 2 * t));
    const qx = Math.abs(px - 0.15) - 0.62, qy = Math.abs(py / s) - 3.45, qz = Math.abs(pz - 5.1) - 4.2;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return (Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0)) * s - 0.95;
  }
  // 手首から袖口へ少し広がる楕円の筒（inset ぶん細くしたものは、袖口の中の空洞）
  function cuffTube(px, py, pz, inset, zEnd, zStart, k){
    let t = -pz / 4.2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const rx = 1.72 + 0.22 * t - inset, ry = 3.2 + 0.25 * t - inset;
    const x = (px - 0.05) / rx, y = py / ry;
    const dr = (Math.sqrt(x * x + y * y) - 1) * Math.min(rx, ry);
    const dz = Math.max(zEnd - pz, pz - zStart);
    return smax(dr, dz, k);
  }
  const segs = FINGERS.map(f => {
    const y2 = f.y + f.dy;
    return {
      r: f.r,
      kn: [-0.55, f.y, 9.75],
      mcp: [-0.3, f.y, 9.25], pip: [f.p, y2, 9.55], dip: [f.p - 0.3, y2, 9.55 - f.m], tip: [f.p - 0.3 - f.d * 0.85, y2, 9.55 - f.m - 0.3],
    };
  });
  const hollow = (px, py, pz) => cuffTube(px, py, pz, 0.45, -6, -2.3, 0.6);
  function sdf(px, py, pz){
    let d = palm(px, py, pz);
    d = smin(d, ellipsoid(px, py, pz, [1.1, 2.3, 3.3], [1.25, 1.9, 2.8]), 1.2);     // 親指のつけ根のふくらみ
    d = smin(d, ellipsoid(px, py, pz, [1.15, -2.85, 4.6], [1.0, 1.45, 3.0]), 1.2);  // 小指側のふくらみ
    let fd = 1e9;
    for (const f of segs){
      let g = roundCone(px, py, pz, f.mcp, f.pip, f.r * 1.04, f.r);
      g = smin(g, roundCone(px, py, pz, f.pip, f.dip, f.r, f.r * 0.95), 0.45);
      g = smin(g, roundCone(px, py, pz, f.dip, f.tip, f.r * 0.95, f.r * 0.86), 0.45);
      g = smin(g, ellipsoid(px, py, pz, f.kn, [f.r * 1.05, f.r, f.r]), 0.6);
      fd = smin(fd, g, 0.3);
    }
    d = smin(d, fd, 0.9);
    d = smin(d, roundCone(px, py, pz, [0.6, 2.6, 2.1], [1.9, 4.5, 5.7], 1.55, 1.3), 1.0);   // 親指の中手骨
    const dx = px - THUMB_PIVOT[0], dy = py - THUMB_PIVOT[1], dz = pz - THUMB_PIVOT[2];
    d = smin(d, Math.sqrt(dx * dx + dy * dy + dz * dz) - THUMB_BASE_R, 0.35);                 // 親指の付け根の球（ここを中心に回る）
    d = smin(d, cuffTube(px, py, pz, 0, -4.2, 2.0, 0.5), 1.2);
    d = smax(d, -hollow(px, py, pz), 0.3);
    return d;
  }
  // 格子で値を取り、Surface Nets で面を作る。袖口の内側は暗く（中が空洞に見えるように）
  return polygonize(sdf, -2.6, -5.1, -4.9, 6.4, 6.6, 11.7, 0.25, (x, y, z) => {
    const hd = hollow(x, y, z);
    let f = (hd - 0.05) / 0.4; f = f < 0 ? 0 : f > 1 ? 1 : f; f = f * f * (3 - 2 * f);
    return 0.2 + 0.8 * f;
  });
}

// 計算済みデータ（'GLV2' 形式）を読み、手袋の形（位置・法線・明るさ・添字）に戻す
export function decodeGlove(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'GLV2') throw new Error('手袋のデータの形式が違います');
  const n = dv.getUint32(4, true), m = dv.getUint32(8, true);
  const min = [0, 1, 2].map(k => dv.getFloat32(12 + 4 * k, true)), step = [0, 1, 2].map(k => dv.getFloat32(24 + 4 * k, true));
  let p = 36;
  const next = () => { let v = 0, mul = 1, b; do { b = u8[p++]; v += (b & 127) * mul; mul *= 128; } while (b & 128); return v % 2 ? -(v + 1) / 2 : v / 2; };
  const stream = (count, stride) => { const out = new Int32Array(count), prev = new Array(stride).fill(0); for (let i = 0; i < count; i++){ const k = i % stride; prev[k] += next(); out[i] = prev[k]; } return out; };
  const qpos = stream(3 * n, 3), qoct = stream(2 * n, 2), qcol = stream(n, 1), idx = stream(m, 1);
  const position = new Float32Array(3 * n), normal = new Float32Array(3 * n), color = new Float32Array(3 * n);
  for (let i = 0; i < 3 * n; i++){ const k = i % 3; position[i] = Math.fround(min[k]) + qpos[i] * Math.fround(step[k]); }
  for (let i = 0; i < n; i++){
    let x = qoct[i * 2] / 32767, y = qoct[i * 2 + 1] / 32767, z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0){ const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; }
    const l = Math.hypot(x, y, z) || 1;
    normal[i * 3] = x / l; normal[i * 3 + 1] = y / l; normal[i * 3 + 2] = z / l;
    color[i * 3] = color[i * 3 + 1] = color[i * 3 + 2] = qcol[i] / 255;
  }
  return { position, normal, color, index: n < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx) };
}

// 手袋の形を 'GLV2' 形式に書き出す（tools/gen-glove.mjs が使う。decodeGlove の逆）
// 形式（リトルエンディアン）: 'GLV2', 頂点数 n, 添字数 m, 位置の最小値 xyz(f32), 位置の刻み xyz(f32)、
// 続けて可変長整数（ジグザグ・前の値との差）の並び: 位置 3n（16ビットの刻み）, 法線 2n（八面体の2成分, 16ビット）,
// 明るさ n（8ビット）, 添字 m。差はそれぞれ成分ごと（位置は x,y,z ごと、法線は 2 成分ごと）に取る
export function encodeGlove(g){
  const n = g.position.length / 3, m = g.index.length;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++){ const v = g.position[i * 3 + k]; min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); }
  const minF = Float32Array.from(min), stepF = Float32Array.from(min.map((v, k) => (max[k] - v) / 65535));
  const bytes = [];
  const put = (v) => { v = v >= 0 ? v * 2 : -v * 2 - 1; while (v >= 128){ bytes.push((v % 128) | 128); v = Math.floor(v / 128); } bytes.push(v); };
  const stream = (vals, stride) => { const prev = new Array(stride).fill(0); vals.forEach((v, i) => { const k = i % stride; put(v - prev[k]); prev[k] = v; }); };
  const qpos = []; for (let i = 0; i < 3 * n; i++){ const k = i % 3; qpos.push(Math.min(65535, Math.max(0, Math.round((g.position[i] - minF[k]) / stepF[k])))); }
  const qoct = [];
  for (let i = 0; i < n; i++){
    let x = g.normal[i * 3], y = g.normal[i * 3 + 1], z = g.normal[i * 3 + 2];
    const s = Math.abs(x) + Math.abs(y) + Math.abs(z); x /= s; y /= s; z /= s;
    if (z < 0){ const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; }
    qoct.push(Math.round(x * 32767), Math.round(y * 32767));
  }
  const qcol = []; for (let i = 0; i < n; i++) qcol.push(Math.round(g.color[i * 3] * 255));
  stream(qpos, 3); stream(qoct, 2); stream(qcol, 1); stream(Array.from(g.index), 1);
  const out = new Uint8Array(36 + bytes.length), dv = new DataView(out.buffer);
  out.set([71, 76, 86, 50], 0);   // 'GLV2'
  dv.setUint32(4, n, true); dv.setUint32(8, m, true);
  for (let k = 0; k < 3; k++){ dv.setFloat32(12 + 4 * k, minF[k], true); dv.setFloat32(24 + 4 * k, stepF[k], true); }
  out.set(bytes, 36);
  return out;
}
