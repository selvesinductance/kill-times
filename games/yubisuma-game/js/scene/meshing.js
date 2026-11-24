// 形を作るための計算（three.js に依存しない。tools/ からも使う）
//   polygonize: 距離関数の 0 の面を三角形の面にする
//   edt2d: 2 次元の距離変換（数字の字形から距離場を作るのに使う）
// 距離関数 sdf の 0 の面を、格子（間隔 H）の Surface Nets で三角形の面にする。
// 頂点は面の上へ寄せ、法線は距離関数の勾配から取るので、なめらかに光る
export function polygonize(sdf, X0, Y0, Z0, X1, Y1, Z1, H, shade){
  const NX = Math.ceil((X1 - X0) / H) + 1, NY = Math.ceil((Y1 - Y0) / H) + 1, NZ = Math.ceil((Z1 - Z0) / H) + 1;
  const F = new Float32Array(NX * NY * NZ);
  const id = (i, j, k) => i + NX * (j + NY * k);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) F[id(i, j, k)] = sdf(X0 + i * H, Y0 + j * H, Z0 + k * H);
  const vid = new Int32Array(NX * NY * NZ).fill(-1);
  const pos = [];
  const C8 = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float64Array(8);
  for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++){
    let mask = 0;
    for (let c = 0; c < 8; c++){ v[c] = F[id(i + C8[c][0], j + C8[c][1], k + C8[c][2])]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 12; e++){
      const a = E12[e][0], b = E12[e][1];
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C8[a][0] + (C8[b][0] - C8[a][0]) * t; sy += C8[a][1] + (C8[b][1] - C8[a][1]) * t; sz += C8[a][2] + (C8[b][2] - C8[a][2]) * t; n++;
    }
    vid[id(i, j, k)] = pos.length / 3;
    pos.push(X0 + (i + sx / n) * H, Y0 + (j + sy / n) * H, Z0 + (k + sz / n) * H);
  }
  const ind = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) ind.push(a, c, b, a, d, c); else ind.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++){
    const a = F[id(i, j, k)], ina = a < 0;
    if (i < NX - 1 && j > 0 && k > 0 && ina !== (F[id(i + 1, j, k)] < 0))
      quad(vid[id(i, j - 1, k - 1)], vid[id(i, j, k - 1)], vid[id(i, j, k)], vid[id(i, j - 1, k)], !ina);
    if (j < NY - 1 && i > 0 && k > 0 && ina !== (F[id(i, j + 1, k)] < 0))
      quad(vid[id(i - 1, j, k - 1)], vid[id(i - 1, j, k)], vid[id(i, j, k)], vid[id(i, j, k - 1)], !ina);
    if (k < NZ - 1 && i > 0 && j > 0 && ina !== (F[id(i, j, k + 1)] < 0))
      quad(vid[id(i - 1, j - 1, k)], vid[id(i, j - 1, k)], vid[id(i, j, k)], vid[id(i - 1, j, k)], !ina);
  }
  // 頂点を面の上へ寄せ、法線は距離関数の勾配から（継ぎ目なくなめらかに光る）
  const nv = pos.length / 3, P = new Float32Array(pos), N = new Float32Array(nv * 3), COL = shade ? new Float32Array(nv * 3) : null;
  const e = H * 0.16;
  for (let q = 0; q < nv; q++){
    let x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2], gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++){
      const d0 = sdf(x, y, z);
      gx = (sdf(x + e, y, z) - sdf(x - e, y, z)) / (2 * e);
      gy = (sdf(x, y + e, z) - sdf(x, y - e, z)) / (2 * e);
      gz = (sdf(x, y, z + e) - sdf(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (it < 2 && g2 > 1e-8){ x -= d0 * gx / g2; y -= d0 * gy / g2; z -= d0 * gz / g2; }
    }
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    P[q * 3] = x; P[q * 3 + 1] = y; P[q * 3 + 2] = z;
    N[q * 3] = gx / gl; N[q * 3 + 1] = gy / gl; N[q * 3 + 2] = gz / gl;
    if (shade){ const c = shade(x, y, z); COL[q * 3] = c; COL[q * 3 + 1] = c; COL[q * 3 + 2] = c; }
  }
  // 三角形の向きを法線にそろえる（裏向きの面で穴が見えないように）
  for (let t = 0; t < ind.length; t += 3){
    const a = ind[t], b = ind[t + 1], c = ind[t + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0){ ind[t + 1] = c; ind[t + 2] = b; }
  }
  return { position:P, normal:N, color:COL, index:ind };
}

// 1 次元・2 次元のユークリッド距離変換（Felzenszwalb–Huttenlocher）
function edt1d(f, n, d, v, z){
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++){
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]){ k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++){ while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
export function edt2d(g, w, h){   // g: 0 = 基準の画素、1e20 = それ以外。二乗距離に置き換える
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++){ for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++){ for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; }
}
