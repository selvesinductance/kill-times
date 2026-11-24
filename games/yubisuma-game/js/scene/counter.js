// 輪の中心の空間に浮かぶ、いま立っている親指の数（半透明の厚みのある数字。光が当たり、その場に止まっている）
// 数字は字形を描いて距離場にし、角の丸い板として立体にする
import { scene, C, reduceMotion, tween, easeOutCubic } from './stage.js';
import { polygonize, edt2d } from './meshing.js';

const COUNT_H = 1.1;             // 数字の高さ（空間の単位）
const digitCache = new Map();
function digitGeometry(n){
  if (digitCache.has(n)) return digitCache.get(n);
  const W = 150, Hc = 180, FONT = 140, SS = 3;   // 3倍の細かさで字を描いて距離を測り、縮めてなめらかにする
  const W2 = W * SS, H2 = Hc * SS;
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.font = `900 ${FONT * SS}px "M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), W2 / 2, H2 / 2 + 6 * SS);
  const img = x.getImageData(0, 0, W2, H2).data;
  const out = new Float64Array(W2 * H2), inn = new Float64Array(W2 * H2);
  for (let i = 0; i < W2 * H2; i++){ const on = img[i * 4 + 3] > 127; out[i] = on ? 0 : 1e20; inn[i] = on ? 1e20 : 0; }
  edt2d(out, W2, H2); edt2d(inn, W2, H2);
  const S0 = new Float32Array(W * Hc);
  for (let j = 0; j < Hc; j++) for (let i = 0; i < W; i++){
    let sum = 0;
    for (let b = 0; b < SS; b++) for (let a = 0; a < SS; a++){
      const q = (j * SS + b) * W2 + (i * SS + a);
      sum += out[q] > 0 ? Math.sqrt(out[q]) - 0.5 : -(Math.sqrt(inn[q]) - 0.5);
    }
    S0[j * W + i] = sum / (SS * SS * SS);
  }
  const S = new Float32Array(W * Hc);   // さらに 3×3 でならす
  for (let j = 0; j < Hc; j++) for (let i = 0; i < W; i++){
    let sum = 0, k = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++){ const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < W && jj < Hc){ sum += S0[jj * W + ii]; k++; } }
    S[j * W + i] = sum / k;
  }
  const sd2 = (px, py) => {   // px, py: 画像の座標。範囲外は外側
    if (px < 0 || py < 0 || px > W - 1.001 || py > Hc - 1.001) return 40;
    const i = Math.floor(px), j = Math.floor(py), fx = px - i, fy = py - j, o = j * W + i;
    return (S[o] * (1 - fx) + S[o + 1] * fx) * (1 - fy) + (S[o + W] * (1 - fx) + S[o + W + 1] * fx) * fy;
  };
  const R = 5, HD = 15;   // 角の丸み・板の厚みの半分（画素）
  const sdf = (px, py, pz) => {
    const d = sd2(px + W / 2, Hc / 2 - py) + R, wy = Math.abs(pz) - (HD - R);
    return Math.min(Math.max(d, wy), 0) + Math.hypot(Math.max(d, 0), Math.max(wy, 0)) - R;
  };
  const m = polygonize(sdf, -W / 2, -Hc / 2, -HD - 4, W / 2, Hc / 2, HD + 4, 2, null);
  const k = COUNT_H / FONT * 1.3;
  for (let i = 0; i < m.position.length; i++) m.position[i] *= k;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setIndex(m.index); g.computeBoundingSphere();
  digitCache.set(n, g);
  return g;
}
const countMat = new THREE.MeshStandardMaterial({ color:C('#ffffff'), roughness:0.28, metalness:0, transparent:true, opacity:0.34, emissive:C('#ffffff'), emissiveIntensity:0.12 });
export const countGroup = new THREE.Group(); countGroup.position.set(0, 0.1, 0); scene.add(countGroup);
const countMesh = new THREE.Mesh(new THREE.BufferGeometry(), countMat);
countMesh.rotation.x = -0.22;   // 少し後ろへ傾けて、上から見下ろしても読みやすく
countMesh.renderOrder = 2;
countGroup.add(countMesh);
const countPop = { s:1 };
let countShown = false, countValue = -1;
// 対戦中だけ表示する（タイトルでは出さない）
export function showCounter(on){ countShown = on; if (on){ countValue = -1; } }
export const counterShown = () => countShown;
// 数が変わったときの弾み（loop.js が毎フレーム呼ぶ）
export function applyCounterScale(){ countGroup.scale.setScalar(countPop.s); }
export function setCount(n, animate){
  if (n === countValue) return;
  countValue = n; countMesh.geometry = digitGeometry(n);
  if (animate && !reduceMotion){ countPop.s = 1.3; tween(countPop, 's', 1, 420, easeOutCubic); }
}
// 字形のフォントが届いたら作り直し、使いそうな数字を先に作っておく
try {
  if (document.fonts && document.fonts.load){
    document.fonts.load('900 140px "M PLUS Rounded 1c"', '0123456789').then(() => {
      digitCache.forEach(g => g.dispose()); digitCache.clear();
      if (countValue >= 0) countMesh.geometry = digitGeometry(countValue);
      let d = 0; const next = () => { if (d <= 8){ digitGeometry(d++); setTimeout(next, 40); } }; setTimeout(next, 200);
    }).catch(() => {});
  }
} catch {}
