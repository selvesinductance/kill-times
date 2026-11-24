// 席（各人の両手・名札・床の影）と、宣言者の光の輪、自分の手の当たり判定
import { canvas, scene, camera, redraw, canvasTex, tween, easeInQuad, easeOutCubic, reduceMotion, FLOOR_Y } from './stage.js';
import { makeHand, addOutline, placeHand, floorPose } from './glove.js';
import { $, el } from '../dom.js';

export const seatObjs = [];     // 席ごとの 3D（{ group, hands:[左,右], blobs, label, below, above, npc, across }）

// 席の配置（上から見て時計回り。0 はプレイヤーで手前）
function seatPositions(n){
  const R = 2.25, out = [];
  for (let i = 0; i < n; i++){
    const phi = (i / n) * Math.PI * 2;
    out.push(new THREE.Vector3(-Math.sin(phi) * R, 0, Math.cos(phi) * R));
  }
  return out;
}

// 宣言者の手の下に浮かぶ光の輪
const glowTex = canvasTex(256, 256, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,214,110,0)'); g.addColorStop(0.55, 'rgba(255,214,110,0.95)'); g.addColorStop(0.68, 'rgba(255,214,110,0.35)'); g.addColorStop(1, 'rgba(255,214,110,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
export const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map:glowTex, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
glow.rotation.x = -Math.PI / 2; glow.position.y = -0.6; scene.add(glow);
// 手の真下の床に落ちる、ぼんやりした影
const blobTex = canvasTex(128, 128, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(20,14,8,0.55)'); g.addColorStop(0.5, 'rgba(20,14,8,0.25)'); g.addColorStop(1, 'rgba(20,14,8,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const blobMat = new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false, opacity:0.75 });
const blobGeo = new THREE.PlaneGeometry(1, 1);

export function clearSeats(){
  for (const s of seatObjs) scene.remove(s.group);
  seatObjs.length = 0;
  hoverHand = -1;
  redraw.background = true;
  $('labels').innerHTML = '';
}
// players: [{ name, color, hands }]。手と名札を並べ直す
export function buildSeats(players){
  clearSeats();
  const pos = seatPositions(players.length);
  players.forEach((p, i) => {
    const grp = new THREE.Group();
    grp.position.copy(pos[i]);
    grp.lookAt(0, 0, 0);
    const left = makeHand(p.color, true), right = makeHand(p.color, false);
    if (i === 0){ addOutline(left); addOutline(right); }   // 自分の手だけ、マウスを乗せると輪郭が光る
    const blobs = [];
    [[left, 0.5, -0.12], [right, -0.5, 0.12]].forEach(([o, x, ry]) => {
      o.base = { y:0, rx:-0.42, ry };
      o.dropYaw = (Math.random() - 0.5) * 1.2;
      o.group.position.set(x, 0, -0.41);
      placeHand(o, false);
      grp.add(o.group);
      const b = new THREE.Mesh(blobGeo, blobMat);
      b.rotation.x = -Math.PI / 2; b.position.set(x * 0.74, FLOOR_Y + 0.015, 0); b.scale.set(0.9, 1.2, 1);
      grp.add(b); blobs.push(b);
    });
    scene.add(grp);
    // 名札: NPC は手の下（真向かいの席は手の右横）、プレイヤーは手の右横
    const label = el('div', { class: i === 0 ? 'seat-label side' : 'seat-label below' },
      el('div', { class:'nm', text:p.name }), el('div', { class:'chips' }));
    $('labels').append(label);
    // 広い画面では手の下、狭い画面（掛け声が下に出る）では手の上に名札を置く
    const across = players.length % 2 === 0 && i === players.length / 2;   // 真向かいの席（中央の数字と重ならないよう名札は横）
    const below = i === 0 ? new THREE.Vector3(pos[i].x + 1.3, -0.1, pos[i].z)
      : across ? new THREE.Vector3(pos[i].x + 1.35, 0.05, pos[i].z) : new THREE.Vector3(pos[i].x * 0.9, -0.55, pos[i].z * 0.9);
    const above = i === 0 ? below : new THREE.Vector3(pos[i].x * 0.86, 1.3, pos[i].z * 0.86);
    seatObjs.push({ group:grp, hands:[left, right], blobs, label, below, above, npc: i !== 0, across });
  });
}
// 手の状態（親指・下ろした手）を、動きなしでそのまま反映する
export function syncHandsInstant(players){
  players.forEach((p, i) => {
    p.hands.forEach((h, j) => {
      const o = seatObjs[i].hands[j];
      o.th.t = h.up ? 1 : 0;
      o.ring.visible = h.up;
      placeHand(o, !h.alive);
    });
  });
}

// 宣言者の席に光の輪を移す（-1 で消す）
export function moveGlow(i){
  if (i < 0 || !seatObjs[i]){ glow.material.opacity = 0; return; }
  const p = seatObjs[i].group.position;
  glow.position.set(p.x, -0.6, p.z); glow.material.opacity = 0.7;
}
export function pulseGlow(now){ glow.material.opacity = glow.material.opacity > 0 ? 0.5 + 0.18 * Math.sin(now / 300) : 0; }

// 下ろした手は、手袋が床へ落ちてそのまま残る
export async function dropHand(i, hi, fast){
  const o = seatObjs[i].hands[hi], p = floorPose(o), ms = fast ? 160 : 640;
  o.fallen = true; o.body.position.y = 0;
  await Promise.all([
    tween(o.group.position, 'y', p.y, ms, easeInQuad),
    tween(o.group.rotation, 'z', p.rz, ms, easeOutCubic),
    tween(o.group.rotation, 'x', p.rx, ms, easeOutCubic),
    tween(o.group.rotation, 'y', p.ry, ms, easeOutCubic),
  ]);
  o.landed = true; redraw.background = true;   // 床に着いたら背景（ぼかす側）に入れる
}
// 固定された親指の手を押したとき、手を小さく揺らして知らせる
export async function shakeHand(o){
  if (o.shaking || reduceMotion) return;
  o.shaking = true;
  for (const a of [0.1, -0.09, 0.06, -0.03, 0]) await tween(o.body.rotation, 'z', a, 60);
  o.shaking = false;
}

// 手のわずかな上下（待機の動き）
export function bobHands(bob){
  seatObjs.forEach((s, i) => s.hands.forEach((o, j) => { if (!o.fallen) o.body.position.y = bob * (j ? 1 : -1) * (i % 2 ? 1 : -1); }));
}

// 名札を、手の位置に合わせて画面上に置く
const tmpV = new THREE.Vector3();
export function placeLabels(){
  const w = window.innerWidth, h = window.innerHeight;
  const narrow = w < 900;
  seatObjs.forEach(s => {
    if (s.npc){ s.label.classList.toggle('below', !narrow && !s.across); s.label.classList.toggle('side', !narrow && s.across); }
    tmpV.copy(narrow ? s.above : s.below).project(camera);
    s.label.style.left = `${(tmpV.x * 0.5 + 0.5) * w}px`;
    s.label.style.top = `${(-tmpV.y * 0.5 + 0.5) * h}px`;
  });
}

/* ---------- 自分の手の当たり判定と、マウスを乗せたときの輪郭 ---------- */
const pickRay = new THREE.Raycaster(), pickNdc = new THREE.Vector2(), pickBox = new THREE.Box3(), pickCenter = new THREE.Vector3();
// 画面上の位置にある自分の手（0 = 左手, 1 = 右手。なければ -1）。手の形に当たらなくても、手のすぐそばなら拾う
export function handUnderPointer(ev){
  if (!seatObjs[0]) return -1;
  const r = canvas.getBoundingClientRect();
  pickNdc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  pickRay.setFromCamera(pickNdc, camera);
  let best = -1, bestD = Infinity, near = -1, nearD = Infinity;
  seatObjs[0].hands.forEach((o, j) => {
    if (o.fallen) return;
    const hit = pickRay.intersectObject(o.group, true)[0];
    if (hit && hit.distance < bestD){ bestD = hit.distance; best = j; }
    pickBox.setFromObject(o.group).getCenter(pickCenter);
    const d = pickRay.ray.distanceToPoint(pickCenter);
    if (d < 0.32 && d < nearD){ nearD = d; near = j; }
  });
  return best >= 0 ? best : near;
}
// マウスを乗せている自分の手（切り替えられる手だけ）の輪郭を光らせる。-1 で消す
let hoverHand = -1;
export function setHover(j){
  if (j === hoverHand) return;
  hoverHand = j;
  canvas.style.cursor = j >= 0 ? 'pointer' : '';
  if (seatObjs[0]) seatObjs[0].hands.forEach((o, k) => { if (o.outline) o.outline.forEach(m => { m.visible = k === j; }); });
}
