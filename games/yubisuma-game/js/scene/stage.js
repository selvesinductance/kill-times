// 3D の舞台の土台: 描画の準備・カメラ・光・共通の道具・トゥイーン
// THREE は index.html で読み込む three.js r128（グローバル）
// 単位: 1 = 約25cm。手は y=0 付近の空中に浮かび、教室の床は FLOOR_Y にある
export const canvas = document.getElementById('scene');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 影は毎フレームではなく、必要なときだけ計算し直す（render.js の renderFrame が判断する）
renderer.shadowMap.autoUpdate = false;
renderer.outputEncoding = THREE.sRGBEncoding;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
export const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
export const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7e0cc');
export const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
export const camTarget = new THREE.Vector3(0, -0.35, -1.2);
export const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 描き直しの印: background = ぼかした教室を描き直す / handShadows = 浮かんでいる手の影を計算し直す
export const redraw = { background:true, handShadows:true };

// 教室の寸法
export const FLOOR_Y = -4.6, CEIL_Y = 7.6;
export const ROOM = { x0:-15, x1:15, z0:-10, z1:20 };
export const WIN_Y0 = -1.0, WIN_Y1 = 6.8;       // 窓の下端と上端
export const WAIN_Y = FLOOR_Y + 3.4;            // 腰壁の高さ（約85cm）

/* ---------- 共通の道具 ---------- */
export function canvasTex(w, h, draw, opts){
  const o = Object.assign({ srgb:true, repeat:null, aniso:false }, opts || {});
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb) t.encoding = THREE.sRGBEncoding;
  if (o.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  if (o.aniso) t.anisotropy = Math.min(8, MAX_ANISO);
  t.userData = t.userData || {};
  t.userData.redraw = () => { const x = c.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h); t.needsUpdate = true; };
  return t;
}
export const stdMat = (hex, opts) => new THREE.MeshStandardMaterial(Object.assign({ color:C(hex), roughness:0.85, metalness:0 }, opts || {}));
export function addBox(parent, mat, w, h, d, x, y, z, cast = true){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
export function addPlane(parent, mat, w, h, x, y, z, ry, cast){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry || 0; m.receiveShadow = true; m.castShadow = !!cast; parent.add(m); return m;
}

/* ---------- 光 ---------- */
scene.add(new THREE.HemisphereLight(C('#eef2ff'), C('#a08060'), 0.62));
// 天井の蛍光灯のような、上からのやわらかい光（影なし）
const ceilLight = new THREE.DirectionalLight(C('#f5f7ff'), 0.45);
ceilLight.position.set(0.6, 10, 2.5); scene.add(ceilLight);
// 窓側（左）から低い角度で差し込む午後の日差し
const SUN_DIR = new THREE.Vector3(1, -0.36, 0.28).normalize();   // 光が進む向き
const sun = new THREE.DirectionalLight(C('#ffdcae'), 1.35);
sun.target.position.set(0, 0, 4);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, -45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-21, right:21, top:15, bottom:-15, near:5, far:95 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* ---------- 簡単なトゥイーン（loop.js が毎フレーム進める） ---------- */
export const tweens = [];
export const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInQuad = (t) => t * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export function tween(obj, key, to, ms, fn){
  return new Promise(res => {
    const from = obj[key];
    if (ms <= 0 || from === to){ obj[key] = to; res(); return; }
    tweens.push({ obj, key, from, to, ms, t0:performance.now(), res, fn: fn || ease });
  });
}
