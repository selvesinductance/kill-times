// 1 フレームの描画: ぼかした教室を敷き、その上に浮かんでいる手などをくっきり重ねる
import { renderer, scene, camera, redraw, tweens } from './stage.js';
import { room } from './classroom.js';
import { seatObjs, glow } from './seats.js';
import { countGroup, counterShown } from './counter.js';

/* ---------- 背景だけをぼかす ----------
   教室（床の影・床に落ちた手袋を含む）を縮小して別に描き、ガウスぼかしをかけて画面に敷く。
   その上に、浮かんでいる手と宣言者の光の輪をくっきり重ねる。
   対戦中はカメラが動かないので、背景は変化があったときだけ描き直す。 */
const BG_BLUR_SIGMA = 2.6;   // 1/4 解像度での標準偏差（画面上で約10px）
const rtType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
const rtOpts = { minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat, type:rtType };
const rtBG = new THREE.WebGLRenderTarget(2, 2, rtOpts);
const rtA = new THREE.WebGLRenderTarget(2, 2, Object.assign({}, rtOpts, { depthBuffer:false }));
const rtB = new THREE.WebGLRenderTarget(2, 2, Object.assign({}, rtOpts, { depthBuffer:false }));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postScene = new THREE.Scene();
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const blurMat = new THREE.ShaderMaterial({
  uniforms:{ tDiffuse:{ value:null }, dir:{ value:new THREE.Vector2() }, sigma:{ value:BG_BLUR_SIGMA } },
  vertexShader:QUAD_VS,
  fragmentShader:`uniform sampler2D tDiffuse; uniform vec2 dir; uniform float sigma; varying vec2 vUv;
    void main(){
      vec4 sum = vec4(0.0); float ws = 0.0;
      for (int i = -12; i <= 12; i++){ float x = float(i); float w = exp(-0.5 * x * x / (sigma * sigma)); sum += texture2D(tDiffuse, vUv + dir * x) * w; ws += w; }
      gl_FragColor = linearToOutputTexel(sum / ws);
    }`,
  depthTest:false, depthWrite:false,
});
const copyMat = new THREE.ShaderMaterial({
  uniforms:{ tDiffuse:{ value:null } },
  vertexShader:QUAD_VS,
  fragmentShader:'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = linearToOutputTexel(texture2D(tDiffuse, vUv)); }',
  depthTest:false, depthWrite:false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat); quad.frustumCulled = false; postScene.add(quad);
const bgColor = scene.background;
export function sizeTargets(w, h){
  rtBG.setSize(Math.max(2, Math.ceil(w / 2)), Math.max(2, Math.ceil(h / 2)));
  rtA.setSize(Math.max(2, Math.ceil(w / 4)), Math.max(2, Math.ceil(h / 4)));
  rtB.setSize(rtA.width, rtA.height);
  redraw.background = true;
}
function setPass(bg){
  room.visible = bg; scene.background = bg ? bgColor : null; glow.visible = !bg; countGroup.visible = !bg && counterShown();
  for (const s of seatObjs){ s.blobs.forEach(b => { b.visible = bg; }); s.hands.forEach(o => { o.group.visible = o.landed ? bg : !bg; }); }
}
export function renderFrame(){
  if (redraw.background){
    setPass(true);
    renderer.shadowMap.needsUpdate = true;   // 教室の影（床に落ちた手袋を含む）
    renderer.setRenderTarget(rtBG); renderer.render(scene, camera);
    quad.material = blurMat;
    blurMat.uniforms.tDiffuse.value = rtBG.texture; blurMat.uniforms.dir.value.set(1 / rtA.width, 0);
    renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
    blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.dir.value.set(0, 1 / rtB.height);
    renderer.setRenderTarget(rtB); renderer.render(postScene, postCam);
    redraw.background = false;
    redraw.handShadows = true;   // 影は教室用に描き直したので、手の影も描き直す
  }
  setPass(false);
  // 手の影: 親指や手が動いているとき・揺れが少したまったときだけ計算し直す
  if (redraw.handShadows || tweens.length){ renderer.shadowMap.needsUpdate = true; redraw.handShadows = false; }
  renderer.setRenderTarget(null);
  quad.material = copyMat; copyMat.uniforms.tDiffuse.value = rtB.texture;
  renderer.render(postScene, postCam);
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
}
