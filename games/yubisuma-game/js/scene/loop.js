// 画面の大きさに合わせたカメラの調整と、毎フレームの更新
import { renderer, camera, camTarget, redraw, tweens, reduceMotion } from './stage.js';
import { sizeTargets, renderFrame } from './render.js';
import { bobHands, placeLabels, pulseGlow } from './seats.js';
import { applyCounterScale } from './counter.js';

const onTitle = () => !document.getElementById('title-screen').hidden;

// 画面の重なり方に合わせて、描画の中心をずらす（タイトルは左のパネル、対戦は右の列か下の操作パネルを避ける）
export function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  sizeTargets(w, h);
  camera.aspect = w / h;
  const portrait = w / h < 0.9;
  camera.fov = portrait ? 58 : 46;
  // 縦長の画面は横の視野が狭いので、手の輪全体が入るようにカメラを引く
  const back = portrait ? Math.min(1.9, 0.95 / Math.max(0.42, w / h)) : 1;
  camera.position.set(0, 3.6 * back, 6.9 * back);
  camera.lookAt(camTarget);
  let ox = 0, oy = 0;
  if (onTitle()){ if (w >= 1000) ox = -Math.round(Math.min(600, w * 0.45) / 2); }
  else if (w >= 900) ox = 181;
  else oy = Math.round(h * (portrait ? 0.17 : 0.16));
  camera.setViewOffset(w, h, ox, oy, w, h);
  camera.updateProjectionMatrix();
}

// 待機中（動いているものも操作もないとき）は、1フレームおきに描く
let lastInputAt = 0, idleTick = 0;
let shadowBob = 0;   // 最後に手の影を計算したときの、手の上下の揺れの位置
function frame(now){
  if (!tweens.length && now - lastInputAt > 500 && (++idleTick & 1)){ requestAnimationFrame(frame); return; }
  for (let i = tweens.length - 1; i >= 0; i--){
    const t = tweens[i], k = Math.min(1, (now - t.t0) / t.ms);
    t.obj[t.key] = t.from + (t.to - t.from) * t.fn(k);
    if (k >= 1){ tweens.splice(i, 1); t.res(); }
  }
  // 手のわずかな上下（待機の動き）。揺れが少したまったら手の影を計算し直す
  const bob = reduceMotion ? 0 : Math.sin(now / 900) * 0.012;
  bobHands(bob);
  if (Math.abs(bob - shadowBob) > 0.003){ shadowBob = bob; redraw.handShadows = true; }
  const title = onTitle();
  // タイトルではカメラをゆっくり左右に振る
  if (title && !reduceMotion){
    const a = Math.sin(now / 5200) * 0.35;
    camera.position.x = Math.sin(a) * 1.2; camera.lookAt(camTarget); redraw.background = true;
  }
  if (!title) placeLabels();   // 席の名札（対戦中と結果画面）
  pulseGlow(now);
  applyCounterScale();         // 中央の数字: 揺らさず、その場に止めておく（数が変わったときだけ少し弾む）
  renderFrame();
  requestAnimationFrame(frame);
}

export function startLoop(){
  window.addEventListener('resize', resize);
  for (const t of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(t, () => { lastInputAt = performance.now(); }, { passive:true });
  resize();
  requestAnimationFrame(frame);
}
