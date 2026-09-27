// 2D の描画の部品: 色（灰色・暗い灰色・穴の色、色の透明度と明暗）、線・円・角丸の四角・歯車、文字、光点、押しボタン。
// ゲート・区間・UI のどこからでも使う（ゲートより先に読み込む）

const GREY = '#c9cbe0';
const GREY_D = '#4a4e6e';
const PIT = '#15172a';

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// amt > 0 で白へ、amt < 0 で黒へ寄せる
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const tgt = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v + (tgt - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function drawText(ctx, str, x, y, size, color, o = {}) {
  if (size < 1) return;
  ctx.save();
  ctx.font = o.display ? `400 ${size}px ${CONFIG.displayFont}` : `${o.weight || 800} ${size}px ${CONFIG.font}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.letter) ctx.letterSpacing = `${o.letter}px`;
  // 縁取り（明るい背景の上でも読めるように）
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.stroke;
    ctx.strokeStyle = o.strokeColor || 'rgba(14,10,34,0.9)';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawSpark(ctx, x, y, r, color = CONFIG.colors.spark) {
  r *= 1 + 0.12 * Beat.pulse + 0.12 * Beat.heart; // 拍と心拍で光が脈打つ
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, color);
  g.addColorStop(0.45, hexA(color, 0.35));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, TAU);
  ctx.fill();
}

// 盛り上がった円形ボタン（押せるというシグニファイア）。g: {x, y, r, color, press, hint, done, elapsed}
function drawButton(ctx, g) {
  const pulse = g.done ? 1 : 1 + 0.035 * Math.sin(FX.time * 4.2);
  const press = g.press || 0;
  const r = g.r * pulse * (1 - 0.08 * press);
  const lift = g.r * 0.16 * (1 - press);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y + lift + r * 0.12, r * 1.02, r * 0.98, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shade(g.color, -0.4);
  ctx.beginPath();
  ctx.arc(g.x, g.y + lift * 0.5, r, 0, TAU);
  ctx.fill();
  const top = g.y - lift * 0.5;
  const grd = ctx.createRadialGradient(g.x - r * 0.35, top - r * 0.4, r * 0.1, g.x, top, r);
  grd.addColorStop(0, shade(g.color, 0.45));
  grd.addColorStop(1, g.color);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(g.x, top, r * 0.94, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = r * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(g.x, top, r * 0.78, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  if (g.hint >= 1 && !g.done) {
    // ヒント段階1: 輪郭の明滅
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin((g.elapsed || 0) * 7);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r * 1.28, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function lineW(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function gear(ctx, x, y, r, n, rot, color, th = r * 0.14) {
  // 歯のある円
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) ctx.arc(x, y, i % 2 ? r - th : r, rot + (i / (n * 2)) * TAU, rot + ((i + 1) / (n * 2)) * TAU);
  ctx.closePath();
  ctx.fill();
}
