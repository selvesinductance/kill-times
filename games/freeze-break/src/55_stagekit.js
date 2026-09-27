// 区間（ステージ）の共通部品: 時間の流れが見える背景の点格子、3Dで描いているかの判定

// 時間の流れが見える背景の点格子（t の純関数）
function drawFlowGrid(ctx, t, color) {
  const sp = 80;
  const off = (t * 140) % sp;
  const d = 6 + 4 * Beat.bar;
  const hw = View.halfW * 1.3 + sp * 2;
  const hh = View.halfH * 1.3 + sp * 2;
  ctx.fillStyle = hexA(color, 0.14 + 0.18 * Beat.pulse); // 拍で明るくなる
  for (let x = -hw; x <= hw; x += sp) {
    for (let y = -hh; y <= hh; y += sp) ctx.fillRect(x + off - d / 2, y - d / 2, d, d);
  }
}

// 3Dで描いているか（WebGL が使えないときは 2D の代替表示）
const is3D = () => World3D.ok;
