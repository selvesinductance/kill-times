// 手袋をはめた手（3D の部品）: 本体は計算済みの 1 枚の面、動く親指だけ別の部品
// 右手をひとつ作り、左手は左右反転して使う。モデル内の単位は cm（HAND_SCALE で縮める）
import { C, redraw, FLOOR_Y } from './stage.js';
import { buildGloveMesh, decodeGlove, THUMB_PIVOT, THUMB_BASE_R } from './glove-shape.js';

const HAND_SCALE = 0.068;   // 実物よりひと回り大きく

let GLOVE_GEO = null;
function gloveFromMesh(m){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
  g.setIndex(new THREE.BufferAttribute(m.index instanceof Array ? Uint32Array.from(m.index) : m.index, 1));
  g.computeBoundingSphere();
  return g;
}
// 手袋の形は前もって計算したもの（data/glove.txt: GLV2 形式を base64 にした文字列）を読み込む。読めなかったときだけ、その場で計算する
export function loadGlove(){
  return fetch('data/glove.txt')
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
    .then(t => { const s = atob(t.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; })
    .then(b => { if (!GLOVE_GEO) GLOVE_GEO = gloveFromMesh(decodeGlove(b)); })
    .catch(() => {});
}
function gloveGeometry(){
  if (!GLOVE_GEO) GLOVE_GEO = gloveFromMesh(buildGloveMesh());
  return GLOVE_GEO;
}
const geoCache = new Map();
function cached(key, make){ let g = geoCache.get(key); if (!g){ g = make(); geoCache.set(key, g); } return g; }
function capsuleGeo(len, r1, r2){
  return cached(`c|${len.toFixed(2)}|${r1.toFixed(2)}|${r2.toFixed(2)}`, () => {
    const pts = [], N = 12;
    for (let i = 0; i <= N; i++){ const a = -Math.PI / 2 + (i / N) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), -len / 2 + Math.sin(a) * r1)); }
    for (let i = 0; i <= N; i++){ const a = (i / N) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r2), len / 2 + Math.sin(a) * r2)); }
    return new THREE.LatheGeometry(pts, 32);
  });
}
const UP = new THREE.Vector3(0, 1, 0);
function segment(parent, mat, a, b, r1, r2){
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(capsuleGeo(len, r1, r2), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function addMesh(parent, geo, mat, x, y, z){
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const ringMat = new THREE.MeshStandardMaterial({ color:C('#f2c14e'), roughness:0.3, metalness:0.7, emissive:C('#5a3d00'), emissiveIntensity:0.45 });
// 表面に凹凸のない、なめらかな手袋
function gloveMats(color){
  const col = C(color);
  return {
    body: new THREE.MeshStandardMaterial({ color:col.clone(), roughness:0.68, metalness:0, vertexColors:true }),
    thumb: new THREE.MeshStandardMaterial({ color:col.clone(), roughness:0.68, metalness:0 }),
  };
}
const TH = { downZ:-1.45, upZ:0, downTilt:0.8, upTilt:0.1, downBend:-0.5, upBend:-0.05 };
export function makeHand(color, mirror){
  const mats = gloveMats(color);
  const g = new THREE.Group();            // 位置・向き（落ちる動きもここ）
  const body = new THREE.Group(); g.add(body);   // 待機中のわずかな上下
  const model = new THREE.Group(); model.scale.set(mirror ? -HAND_SCALE : HAND_SCALE, HAND_SCALE, HAND_SCALE); body.add(model);
  const bodyMesh = addMesh(model, gloveGeometry(), mats.body, 0, 0, 0);
  // 親指: 付け根の球の中心で回るので、どの角度でも付け根に境目が出ない
  const thumb = new THREE.Group(); thumb.position.set(THUMB_PIVOT[0], THUMB_PIVOT[1], THUMB_PIVOT[2]); model.add(thumb);
  const tilt = new THREE.Group(); thumb.add(tilt);
  const proxMesh = segment(tilt, mats.thumb, [0, 0, 0], [0, 3.0, 0], THUMB_BASE_R - 0.03, 1.2);
  const dj = new THREE.Group(); dj.position.set(0, 3.0, 0); tilt.add(dj);
  const distMesh = segment(dj, mats.thumb, [0, 0, 0], [0, 2.2, 0], 1.18, 1.05);
  const ring = addMesh(tilt, cached('ring', () => new THREE.TorusGeometry(1.52, 0.3, 10, 36)), ringMat, 0, 1.45, 0);
  ring.rotation.x = Math.PI / 2; ring.visible = false;
  const lerp = (a, b, t) => a + (b - a) * t;
  const th = {
    _t: 0,
    get t(){ return this._t; },
    set t(v){ this._t = v; redraw.handShadows = true; thumb.rotation.z = lerp(TH.downZ, TH.upZ, v); tilt.rotation.x = lerp(TH.downTilt, TH.upTilt, v); dj.rotation.z = lerp(TH.downBend, TH.upBend, v); },
  };
  th.t = 0;
  return { group:g, body, model, th, ring, mats, mirror, fallen:false, parts:[bodyMesh, proxMesh, distMesh], outline:null };
}
// マウスを乗せたときの輪郭（手の形を法線の向きに少し膨らませ、裏面だけを黄色で描く）
const OUTLINE_U = { tint:{ value:C('#ffd84a') }, thickness:{ value:0.45 } };   // thickness は手のモデルの単位（cm）
const outlineMat = new THREE.ShaderMaterial({
  uniforms:OUTLINE_U,
  vertexShader:'uniform float thickness; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0); }',
  fragmentShader:'uniform vec3 tint; void main(){ gl_FragColor = linearToOutputTexel(vec4(tint, 1.0)); }',
  side:THREE.BackSide,
});
// 手袋の本体用: 袖口の内側（頂点の色が暗いところ）には輪郭を出さない
const outlineBodyMat = new THREE.ShaderMaterial({
  uniforms:OUTLINE_U, vertexColors:true,
  vertexShader:'uniform float thickness; varying float vIn; void main(){ vIn = color.r; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0); }',
  fragmentShader:'uniform vec3 tint; varying float vIn; void main(){ if (vIn < 0.6) discard; gl_FragColor = linearToOutputTexel(vec4(tint, 1.0)); }',
  side:THREE.BackSide,
});
export function addOutline(o){
  o.outline = o.parts.map((m, i) => {
    const e = new THREE.Mesh(m.geometry, i === 0 ? outlineBodyMat : outlineMat);
    e.position.copy(m.position); e.quaternion.copy(m.quaternion); e.scale.copy(m.scale);
    e.visible = false; e.castShadow = false; e.receiveShadow = false;
    m.parent.add(e);
    return e;
  });
}
export function setHandColor(hand, color){
  const c = C(color);
  hand.mats.body.color.copy(c); hand.mats.thumb.color.copy(c);
}
// 床に落ちた手袋の置き方（手のひら側を上にして横たわる）
export function floorPose(o){
  return { y: FLOOR_Y + 0.15, rx: 0, rz: o.mirror ? -Math.PI / 2 : Math.PI / 2, ry: o.base.ry + o.dropYaw };
}
export function placeHand(o, fallen){
  o.fallen = fallen; o.landed = fallen; redraw.background = true;
  if (fallen){ const p = floorPose(o); o.group.position.y = p.y; o.group.rotation.set(p.rx, p.ry, p.rz); o.body.position.y = 0; }
  else { o.group.position.y = o.base.y; o.group.rotation.set(o.base.rx, o.base.ry, 0); }
}
