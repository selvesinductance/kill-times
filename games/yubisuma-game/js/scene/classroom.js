// 背景の教室（床・壁・黒板・掲示板・窓・机と椅子）。描いたあとはほぼ変わらないので、render.js がぼかして敷く
import { scene, C, redraw, canvasTex, stdMat, addBox, addPlane, FLOOR_Y, CEIL_Y, ROOM, WIN_Y0, WIN_Y1, WAIN_Y } from './stage.js';

// 模様の揺らぎに使う乱数（種を固定して、毎回同じ見た目にする）
let _seed = 20261123;
const rnd = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

/* ---------- 教室 ---------- */
export const room = new THREE.Group(); scene.add(room);
const plasterMat = stdMat('#ece5d3', { roughness:0.95, shadowSide:THREE.DoubleSide });
const ceilMat = stdMat('#f3f1ea', { roughness:0.95, shadowSide:THREE.DoubleSide });
const trimMat = stdMat('#6f4a2c', { roughness:0.7 });
const aluMat = stdMat('#c3c7cc', { roughness:0.42, metalness:0.55 });
const steelMat = stdMat('#9aa1a7', { roughness:0.5, metalness:0.45 });

// 床（細い板張り）
function drawBoards(x, w, h, n, base, grainCount){
  const pw = w / n;
  for (let i = 0; i < n; i++){
    const start = rnd() * h; let acc = 0;
    while (acc < h - 1){
      let len = h * (0.35 + rnd() * 0.45); if (acc + len > h - h * 0.2) len = h - acc;
      const tone = 0.84 + rnd() * 0.24;
      const fill = `rgb(${Math.round(base[0] * tone)},${Math.round(base[1] * tone)},${Math.round(base[2] * tone)})`;
      for (const off of [0, -h]){
        const y0 = ((start + acc) % h) + off;
        x.save(); x.beginPath(); x.rect(i * pw, y0, pw, len); x.clip();
        x.fillStyle = fill; x.fillRect(i * pw, y0, pw, len);
        for (let k = 0; k < grainCount; k++){
          x.strokeStyle = `rgba(80,48,20,${0.05 + rnd() * 0.08})`; x.lineWidth = 0.8 + rnd() * 1.6;
          const gx = i * pw + 3 + rnd() * (pw - 6), ph = rnd() * 6;
          x.beginPath(); x.moveTo(gx, y0);
          for (let yy = 0; yy <= len; yy += 20) x.lineTo(gx + Math.sin(yy * 0.018 + ph) * 2.5, y0 + yy);
          x.stroke();
        }
        x.fillStyle = 'rgba(50,30,12,0.55)'; x.fillRect(i * pw, y0, pw, 2);
        x.restore();
      }
      acc += len;
    }
    x.fillStyle = 'rgba(50,30,12,0.6)'; x.fillRect(i * pw, 0, 2, h);
  }
}
const floorTex = canvasTex(1024, 1024, (x, w, h) => drawBoards(x, w, h, 8, [198, 152, 100], 12), { repeat:[30 / 3.6, 30 / 3.6], aniso:true });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map:floorTex, roughness:0.55, metalness:0 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, 5); floor.receiveShadow = true; room.add(floor);

// 天井（日差しを遮るため影も落とす）
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL_Y, 5); ceil.castShadow = true; ceil.receiveShadow = true; room.add(ceil);

// 腰壁の板
const wainTex = canvasTex(512, 256, (x, w, h) => {
  for (let i = 0; i < 8; i++){
    const tone = 0.9 + rnd() * 0.16;
    x.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(132 * tone)},${Math.round(86 * tone)})`; x.fillRect(i * 64, 0, 64, h);
    for (let k = 0; k < 6; k++){ x.strokeStyle = `rgba(90,55,25,${0.06 + rnd() * 0.06})`; x.lineWidth = 1 + rnd(); const gx = i * 64 + 4 + rnd() * 56; x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.7, gx + 1, h); x.stroke(); }
    x.fillStyle = 'rgba(55,32,14,0.6)'; x.fillRect(i * 64, 0, 2, h);
  }
});
function wainscot(len, x, z, ry){
  const t = wainTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 4.8, 1);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
  addBox(g, new THREE.MeshStandardMaterial({ map:t, roughness:0.7 }), len, WAIN_Y - FLOOR_Y, 0.12, 0, (FLOOR_Y + WAIN_Y) / 2, 0.06, false);
  addBox(g, trimMat, len, 0.16, 0.2, 0, WAIN_Y + 0.02, 0.1, false);        // 腰壁の見切り
  addBox(g, trimMat, len, 0.36, 0.16, 0, FLOOR_Y + 0.18, 0.08, false);     // 巾木
}

// 前の壁（黒板側）
addPlane(room, plasterMat, 30, CEIL_Y - FLOOR_Y, 0, (FLOOR_Y + CEIL_Y) / 2, ROOM.z0, 0, true);
wainscot(30, 0, ROOM.z0, 0);

// 黒板（何も書かれていない。消し跡のもやだけ）
const BOARD = { w:15.2, h:4.6, y0:-0.95 };
const boardTex = canvasTex(2048, 620, (x, w, h) => {
  x.fillStyle = '#2b4636'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++){ x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
  // 消したあとのチョークのもや
  for (let i = 0; i < 26; i++){
    x.save(); x.translate(rnd() * w, rnd() * h); x.rotate((rnd() - 0.5) * 0.5);
    x.fillStyle = `rgba(235,240,230,${0.018 + rnd() * 0.03})`;
    x.beginPath(); x.ellipse(0, 0, 120 + rnd() * 260, 22 + rnd() * 40, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
});
{
  const zb = ROOM.z0 + 0.1;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), new THREE.MeshStandardMaterial({ map:boardTex, roughness:0.92 }));
  board.position.set(0, BOARD.y0 + BOARD.h / 2, zb + 0.02); board.receiveShadow = true; room.add(board);
  const fw = 0.2;
  addBox(room, aluMat, BOARD.w + fw * 2, fw, 0.16, 0, BOARD.y0 + BOARD.h + fw / 2, zb, false);
  addBox(room, aluMat, fw, BOARD.h, 0.16, -BOARD.w / 2 - fw / 2, BOARD.y0 + BOARD.h / 2, zb, false);
  addBox(room, aluMat, fw, BOARD.h, 0.16, BOARD.w / 2 + fw / 2, BOARD.y0 + BOARD.h / 2, zb, false);
  addBox(room, aluMat, BOARD.w + fw * 2, 0.1, 0.5, 0, BOARD.y0 - 0.05, zb + 0.22);      // チョーク受け
  addBox(room, aluMat, BOARD.w + fw * 2, 0.12, 0.04, 0, BOARD.y0 + 0.01, zb + 0.46);   // 受けの縁
  const chalkCols = ['#f6f4ee', '#f6f4ee', '#f2d35b', '#e86b6b', '#6fa7e0'];
  chalkCols.forEach((c, i) => {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 10), stdMat(c, { roughness:0.95 }));
    ch.rotation.z = Math.PI / 2; ch.rotation.y = (rnd() - 0.5) * 0.4; ch.position.set(-5.2 + i * 0.5 + rnd() * 0.2, BOARD.y0 + 0.05, zb + 0.24); ch.castShadow = true; room.add(ch);
  });
  const er = new THREE.Group(); er.position.set(4.6, BOARD.y0 + 0.1, zb + 0.24); er.rotation.y = 0.12; room.add(er);
  addBox(er, stdMat('#4b3a2a', { roughness:0.7 }), 0.62, 0.1, 0.24, 0, 0.05, 0);
  addBox(er, stdMat('#2d3f66', { roughness:1 }), 0.62, 0.08, 0.24, 0, -0.04, 0);
}

// 掲示板（コルク）と貼り紙
function drawPapers(x, w, h, kind){
  x.fillStyle = '#b98b57'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++){ x.fillStyle = rnd() < 0.5 ? 'rgba(90,55,25,0.25)' : 'rgba(240,210,160,0.25)'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
  x.strokeStyle = '#7a5530'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14);
  const paper = (px, py, pw, ph, rot, fill, drawIn) => {
    x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate(rot);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(-pw / 2 + 5, -ph / 2 + 6, pw, ph);
    x.fillStyle = fill; x.fillRect(-pw / 2, -ph / 2, pw, ph);
    x.translate(-pw / 2, -ph / 2); drawIn(pw, ph); x.restore();
    x.fillStyle = ['#d94b4b', '#3d79c7', '#e9b93a', '#4c9a5c'][Math.floor(rnd() * 4)];
    x.beginPath(); x.arc(px + pw / 2, py + 10, 7, 0, Math.PI * 2); x.fill();
  };
  const lines = (pw, ph, top, n) => { x.fillStyle = 'rgba(60,60,70,0.55)'; for (let i = 0; i < n; i++) x.fillRect(16, top + i * 22, (pw - 32) * (0.55 + rnd() * 0.45), 7); };
  const title = (t, pw, size) => { x.fillStyle = '#2a2a33'; x.font = `700 ${size}px "Noto Sans JP",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(t, pw / 2, 16); };
  if (kind === 'left'){
    paper(40, 40, 300, 380, -0.03, '#fbfaf4', (pw, ph) => { title('学級だより', pw, 34); lines(pw, ph, 80, 12); });
    paper(370, 60, 250, 170, 0.04, '#fde9a8', (pw, ph) => { title('お知らせ', pw, 30); lines(pw, ph, 64, 4); });
    paper(380, 260, 270, 200, -0.02, '#d9ecf8', (pw, ph) => { title('ほけんだより', pw, 28); lines(pw, ph, 62, 5); });
    paper(680, 50, 300, 230, 0.02, '#fbfaf4', (pw, ph) => { title('学級目標', pw, 32); x.font = '700 38px "Noto Sans JP",sans-serif'; x.fillStyle = '#c23b3b'; x.fillText('あきらめない', pw / 2, 80); x.fillText('親指は上げたら', pw / 2, 130); x.fillText('もどさない', pw / 2, 178); });
    paper(700, 310, 260, 160, -0.05, '#f6d9e4', (pw, ph) => { title('係活動', pw, 28); lines(pw, ph, 62, 4); });
  } else {
    paper(50, 40, 560, 430, 0.01, '#fbfaf4', (pw, ph) => {
      title('時間割', pw, 34);
      const days = ['月', '火', '水', '木', '金'], subj = [['国', '算', '理', '社', '音', '体'], ['算', '英', '国', '体', '図', '図'], ['理', '国', '算', '道', '学', '社'], ['社', '算', '英', '国', '体', '音'], ['国', '理', '算', '家', '家', '学']];
      const gx = 30, gy = 70, cw = (pw - 60) / 6, chh = (ph - 90) / 7;
      x.strokeStyle = 'rgba(40,40,50,0.6)'; x.lineWidth = 2;
      for (let r = 0; r <= 7; r++){ x.beginPath(); x.moveTo(gx, gy + r * chh); x.lineTo(gx + cw * 6, gy + r * chh); x.stroke(); }
      for (let c = 0; c <= 6; c++){ x.beginPath(); x.moveTo(gx + c * cw, gy); x.lineTo(gx + c * cw, gy + chh * 7); x.stroke(); }
      x.font = '700 26px "Noto Sans JP",sans-serif'; x.textBaseline = 'middle';
      days.forEach((d, i) => { x.fillStyle = '#2a2a33'; x.fillText(d, gx + cw * (i + 1.5), gy + chh / 2); subj[i].forEach((s, r) => x.fillText(s, gx + cw * (i + 1.5), gy + chh * (r + 1.5))); });
      for (let r = 1; r <= 6; r++) x.fillText(String(r), gx + cw / 2, gy + chh * (r + 0.5));
    });
    paper(650, 60, 320, 190, -0.03, '#fde9a8', (pw, ph) => { title('そうじ当番', pw, 30); lines(pw, ph, 66, 5); });
    paper(660, 290, 300, 180, 0.03, '#e3f1dc', (pw, ph) => { title('今月の歌', pw, 28); lines(pw, ph, 62, 5); });
  }
}
const corkL = canvasTex(1024, 512, (x, w, h) => drawPapers(x, w, h, 'left'));
const corkR = canvasTex(1024, 512, (x, w, h) => drawPapers(x, w, h, 'right'));
[[corkL, -11.45], [corkR, 11.45]].forEach(([t, cx]) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshStandardMaterial({ map:t, roughness:0.95 }));
  m.position.set(cx, 1.35, ROOM.z0 + 0.05); m.receiveShadow = true; room.add(m);
});

// 教卓
{
  const g = new THREE.Group(); g.position.set(10.2, FLOOR_Y, -8.0); g.rotation.y = -0.18; room.add(g);
  const wd = stdMat('#a86f42', { roughness:0.6 }), wd2 = stdMat('#c48a55', { roughness:0.55 });
  addBox(g, wd, 4.2, 3.8, 1.9, 0, 1.9, 0);
  addBox(g, wd2, 4.5, 0.16, 2.2, 0, 3.88, 0);
  addBox(g, trimMat, 3.6, 2.6, 0.04, 0, 1.75, 0.97, false);
  addBox(g, wd2, 3.4, 2.4, 0.05, 0, 1.75, 0.98, false);
}

// 窓側の壁（左）: 窓枠・桟・カーテン。窓から差し込む光が床に窓の形を落とす
{
  const xw = ROOM.x0, th = 0.3;
  const wallMat = stdMat('#ece5d3', { roughness:0.95 });
  addBox(room, wallMat, th, WIN_Y0 - FLOOR_Y, ROOM.z1 - ROOM.z0, xw - th / 2, (FLOOR_Y + WIN_Y0) / 2, (ROOM.z0 + ROOM.z1) / 2);
  addBox(room, wallMat, th, CEIL_Y - WIN_Y1 + 0.4, ROOM.z1 - ROOM.z0, xw - th / 2, (WIN_Y1 + CEIL_Y + 0.4) / 2, (ROOM.z0 + ROOM.z1) / 2);
  wainscot(ROOM.z1 - ROOM.z0, xw, (ROOM.z0 + ROOM.z1) / 2, Math.PI / 2);
  addBox(room, stdMat('#d9d2c0', { roughness:0.6 }), 0.5, 0.12, ROOM.z1 - ROOM.z0, xw + 0.2, WIN_Y0 + 0.06, (ROOM.z0 + ROOM.z1) / 2);   // 窓台
  const glass = new THREE.MeshStandardMaterial({ color:C('#d8ecff'), transparent:true, opacity:0.1, roughness:0.05, metalness:0, depthWrite:false });
  const curtain = stdMat('#efe5cc', { roughness:1 });
  const pier = 0.5, bays = 6, bayW = ((ROOM.z1 - ROOM.z0) - pier * (bays + 1)) / bays, hW = WIN_Y1 - WIN_Y0;
  addBox(room, aluMat, 0.08, 0.08, ROOM.z1 - ROOM.z0, xw + 0.45, WIN_Y1 + 0.3, (ROOM.z0 + ROOM.z1) / 2, false);   // カーテンレール
  for (let b = 0; b <= bays; b++){
    const zc = ROOM.z0 + pier / 2 + b * (bayW + pier);
    addBox(room, wallMat, th, hW, pier, xw - th / 2, (WIN_Y0 + WIN_Y1) / 2, zc);
    // カーテン（ひだを円柱で）
    if (b > 0 && b < bays){
      for (let k = 0; k < 5; k++){
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, hW + 0.5, 10), curtain);
        cyl.position.set(xw + 0.38 + (k % 2) * 0.1, (WIN_Y0 + WIN_Y1) / 2 + 0.05, zc - 0.55 + k * 0.27); cyl.castShadow = true; cyl.receiveShadow = true; room.add(cyl);
      }
    }
    if (b === bays) break;
    const z0 = zc + pier / 2, zm = z0 + bayW / 2;
    const fr = 0.1;
    addBox(room, aluMat, 0.14, fr, bayW, xw - 0.1, WIN_Y0 + fr / 2, zm);
    addBox(room, aluMat, 0.14, fr, bayW, xw - 0.1, WIN_Y1 - fr / 2, zm);
    addBox(room, aluMat, 0.14, 0.12, bayW, xw - 0.1, WIN_Y0 + hW * 0.72, zm);      // 欄間の横桟
    addBox(room, aluMat, 0.16, hW * 0.72, 0.14, xw - 0.1, WIN_Y0 + hW * 0.36, zm);  // 引き違いの召し合わせ
    addBox(room, aluMat, 0.14, hW, fr, xw - 0.1, (WIN_Y0 + WIN_Y1) / 2, z0 + fr / 2);
    addBox(room, aluMat, 0.14, hW, fr, xw - 0.1, (WIN_Y0 + WIN_Y1) / 2, z0 + bayW - fr / 2);
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(bayW, hW), glass);
    gp.position.set(xw - 0.12, (WIN_Y0 + WIN_Y1) / 2, zm); gp.rotation.y = Math.PI / 2; room.add(gp);
  }
  // 窓の外（夕方の空と校舎・木のシルエット）
  const skyTex = canvasTex(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7fa6d8'); g.addColorStop(0.55, '#f3c9a0'); g.addColorStop(0.75, '#ffd9a6'); g.addColorStop(1, '#e8c9a0');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#8b7f86';
    x.fillRect(80, 300, 520, 150); for (let i = 0; i < 9; i++) for (let r = 0; r < 3; r++){ x.fillStyle = 'rgba(255,236,200,0.5)'; x.fillRect(100 + i * 56, 318 + r * 44, 36, 24); } x.fillStyle = '#8b7f86';
    x.fillStyle = '#5d6b55';
    for (let i = 0; i < 40; i++){ const tx = rnd() * w, tr = 30 + rnd() * 60; x.beginPath(); x.arc(tx, 430 - rnd() * 40, tr, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#6f6a5c'; x.fillRect(0, 450, w, 62);
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(130, 60), new THREE.MeshBasicMaterial({ map:skyTex }));
  sky.position.set(-45, 8, 5); sky.rotation.y = Math.PI / 2; room.add(sky);
}

// 廊下側の壁（右）と後ろの壁
{
  addPlane(room, plasterMat, 30, CEIL_Y - FLOOR_Y, ROOM.x1, (FLOOR_Y + CEIL_Y) / 2, 5, -Math.PI / 2, true);
  wainscot(30, ROOM.x1, 5, -Math.PI / 2);
  const doorMat = stdMat('#b9875a', { roughness:0.6 });
  for (const zc of [-6.2, 15.5]){
    addBox(room, trimMat, 0.2, 8.3, 4.2, ROOM.x1 - 0.1, FLOOR_Y + 4.15, zc);
    addBox(room, doorMat, 0.16, 7.9, 3.8, ROOM.x1 - 0.2, FLOOR_Y + 3.95, zc);
    addBox(room, stdMat('#cfe2f2', { roughness:0.2 }), 0.17, 1.6, 1.4, ROOM.x1 - 0.21, FLOOR_Y + 5.6, zc - 0.8);
  }
  addPlane(room, plasterMat, 30, CEIL_Y - FLOOR_Y, 0, (FLOOR_Y + CEIL_Y) / 2, ROOM.z1, Math.PI, true);
  wainscot(30, 0, ROOM.z1, Math.PI);
  // 後ろのロッカー
  const lk = stdMat('#c9a27a', { roughness:0.7 });
  addBox(room, lk, 24, 4.2, 1.6, 0, FLOOR_Y + 2.1, ROOM.z1 - 0.8);
}

// 机と椅子（同じ形をまとめて描く）
{
  const deskTop = [], deskBox = [], deskLeg = [], seat = [], back = [], cLeg = [], post = [];
  const base = new THREE.Object3D(), part = new THREE.Object3D();
  const push = (list, x, y, z, ry) => { part.position.set(x, y, z); part.rotation.set(0, ry || 0, 0); part.updateMatrix(); list.push(base.matrix.clone().multiply(part.matrix)); };
  const TOP_Y = 2.88;
  for (const cx of [-12.2, -8.6, 8.6, 12.2]) for (const cz of [-5.0, -1.2, 2.6, 6.4, 10.2, 14.0]){
    base.position.set(cx + (rnd() - 0.5) * 0.35, FLOOR_Y, cz + (rnd() - 0.5) * 0.3); base.rotation.set(0, (rnd() - 0.5) * 0.08, 0); base.updateMatrix();
    push(deskTop, 0, TOP_Y, 0);
    push(deskBox, 0, TOP_Y - 0.4, -0.05);
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.72, 0.72]) push(deskLeg, sx, TOP_Y / 2, sz);
    const pull = 1.45 + rnd() * 0.5, cr = (rnd() - 0.5) * 0.3;
    const chairZ = pull;
    push(seat, 0, 1.72, chairZ, cr);
    const bx = Math.sin(cr) * 0.68, bz = Math.cos(cr) * 0.68;
    push(back, bx, 2.75, chairZ + bz, cr);
    for (const sx of [-0.68, 0.68]) for (const sz of [-0.6, 0.6]){
      const rx = sx * Math.cos(cr) + sz * Math.sin(cr), rz = -sx * Math.sin(cr) + sz * Math.cos(cr);
      push(cLeg, rx, 0.84, chairZ + rz, cr);
    }
    for (const sx of [-0.68, 0.68]){ const rx = sx * Math.cos(cr) + 0.66 * Math.sin(cr), rz = -sx * Math.sin(cr) + 0.66 * Math.cos(cr); push(post, rx, 2.4, chairZ + rz, cr); }
  }
  const mk = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; room.add(im); };
  const woodTop = stdMat('#dcbc8c', { roughness:0.55 }), boxMat = stdMat('#7f8d93', { roughness:0.55, metalness:0.3 });
  mk(new THREE.BoxGeometry(2.6, 0.12, 1.8), woodTop, deskTop);
  mk(new THREE.BoxGeometry(2.3, 0.5, 1.45), boxMat, deskBox);
  mk(new THREE.CylinderGeometry(0.07, 0.07, TOP_Y, 8), steelMat, deskLeg);
  mk(new THREE.BoxGeometry(1.6, 0.1, 1.5), woodTop, seat);
  mk(new THREE.BoxGeometry(1.55, 0.75, 0.1), woodTop, back);
  mk(new THREE.CylinderGeometry(0.06, 0.06, 1.68, 8), steelMat, cLeg);
  mk(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), steelMat, post);
}

// フォントが届いたら掲示板の文字を描き直す
try {
  if (document.fonts && document.fonts.load){
    document.fonts.load(`700 30px "Noto Sans JP"`, '学級だよりお知らせほけんだより係活動時間割月火水木金国算理社音体英図道学家そうじ当番今月の歌123456学級目標あきらめない親指は上げたらもどさない')
      .then(() => { _seed = 11; corkL.userData.redraw(); corkR.userData.redraw(); redraw.background = true; }).catch(() => {});
  }
} catch {}
