// HUD・タイトルの文字・リザルト・音のボタン
function storeBest(v) {
  try {
    localStorage.setItem('freeze-break.best', String(v));
  } catch (_) {
    /* 使えない環境 */
  }
}
function loadBest() {
  try {
    const v = parseFloat(localStorage.getItem('freeze-break.best'));
    return isFinite(v) ? v : null;
  } catch (_) {
    return null;
  }
}

const UI = {
  resultAge: 0,
  summary: null,
  best: null,
  newBest: false,
  played: {},
  retry: { x: 0, y: 360, r: 84 }, // 論理座標（画面中央が原点）

  update(dt) {
    if (Game.phase !== 'RESULT') return;
    this.resultAge += dt;
    CONFIG.scoredGates.forEach((id, i) => this.cue(`row${i}`, 0.43 + i * 0.16, () => Sound.sfx('snap'))); // 評価の判を押す音
    this.cue('grade', 1.35, () => {
      Sound.sfx('impact');
      FX.addTrauma(0.35);
    });
    if (this.newBest) this.cue('best', 1.75, () => Sound.sfx('success', { step: 6 }));
  },
  cue(key, at, fn) {
    if (!this.played[key] && this.resultAge >= at) {
      this.played[key] = true;
      fn();
    }
  },

  onResult(results) {
    this.resultAge = 0;
    this.played = {};
    this.newBest = false;
    this.summary = overallGrade(results);
    if (this.summary.complete && !Debug.auto && (this.best == null || this.summary.total < this.best)) {
      this.newBest = this.best != null; // 初めてのクリアは記録するだけ
      this.best = this.summary.total;
      storeBest(this.best);
    }
  },
  onResultDown(p) {
    if (this.resultAge < CONFIG.resultInputDelay) return;
    const reach = Math.max(this.retry.r * 1.3, CONFIG.hitRadiusMin);
    if (Math.hypot(p.lx - this.retry.x, p.ly - this.retry.y) <= reach) Game.restart();
  },

  draw(ctx) {
    View.screenTransform(ctx);
    const st = Game.state;
    if (st === 'TITLE') this.drawTitle(ctx);
    else if (st !== 'RESULT') {
      this.drawDots(ctx, -View.halfH + 50);
      if (st === 'GATE')
        drawText(ctx, Game.stage.gateObj.elapsed.toFixed(2), 0, -View.halfH + 92, 24, CONFIG.colors.ink, { alpha: 0.55, weight: 700 });
    }
    if (st === 'RESULT') this.drawResult(ctx);
    this.drawMute(ctx);
  },

  // 凍ったロゴ: 横に切れ目が入り、下半分が少しずれて止まっている
  drawTitle(ctx) {
    const c = CONFIG.colors;
    const y = -250;
    const cut = y - 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-600, cut - 90, 1200, 88);
    ctx.clip();
    drawText(ctx, 'FREEZE BREAK', 0, y, 84, c.ink, { display: true, letter: 3 });
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(-600, cut + 2, 1200, 90);
    ctx.clip();
    drawText(ctx, 'FREEZE BREAK', 14, y + 3, 84, c.ink, { display: true, letter: 3 });
    ctx.restore();
    ctx.globalAlpha = 0.8;
    lineW(ctx, -420, cut, 420, cut, 2, c.cyan);
    ctx.globalAlpha = 1;
    drawText(ctx, '20 SEC · 5 FREEZES', 0, y + 78, 22, c.ink, { alpha: 0.55, weight: 700, letter: 8 });
    if (this.best != null)
      drawText(ctx, `BEST ${this.best.toFixed(2)}s`, 0, View.halfH - 70, 26, c.spark, { alpha: 0.85, weight: 700, letter: 4 });
  },

  drawDots(ctx, y) {
    CONFIG.scoredGates.forEach((id, i) => {
      const r = Game.results[id];
      const x = (i - 2) * 44;
      ctx.beginPath();
      ctx.arc(x, y, 10 + 3 * Beat.pulse, 0, TAU);
      if (r) {
        ctx.fillStyle = CONFIG.rankColor[r.rank];
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(238,240,255,0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  },

  drawResult(ctx) {
    const c = CONFIG.colors;
    const a = this.resultAge;
    const s = this.summary || { grade: '-', total: 0, misses: 0 };
    ctx.fillStyle = `rgba(8,8,16,${0.93 * Ease.outCubic(clamp(a / 0.5))})`; // 後ろのロゴが行と重ならない濃さ
    ctx.fillRect(-View.halfW, -View.halfH, View.halfW * 2, View.halfH * 2);
    CONFIG.scoredGates.forEach((id, i) => {
      // 行が順に入り、評価の判が押される
      const t0 = 0.35 + i * 0.16;
      const rk = clamp((a - t0) / 0.25);
      if (rk <= 0) return;
      const y = -250 + i * 62;
      const r = Game.results[id];
      const e = Ease.outCubic(rk);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(-40 * (1 - e), 0);
      drawText(ctx, CONFIG.gates[id].label, -230, y, 32, c.ink, { align: 'left', weight: 700, alpha: 0.85 });
      drawText(ctx, r ? `${r.reaction.toFixed(2)}s` : '—', 70, y, 34, c.ink, { align: 'right', weight: 800 });
      ctx.restore();
      const sk = clamp((a - t0 - 0.08) / 0.18);
      if (r && sk > 0) {
        const sc = lerp(2, 1, Ease.outBack(sk));
        ctx.save();
        ctx.translate(170, y);
        ctx.rotate(-0.06);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, sk * 2);
        drawText(ctx, r.rank, 0, 2, 26, CONFIG.rankColor[r.rank], { display: true, letter: 2 });
        ctx.restore();
      }
    });
    const tk = clamp((a - 1.05) / 0.5); // 合計は数え上がって止まる
    if (tk > 0) {
      drawText(ctx, 'TOTAL', -230, 92, 24, c.ink, { align: 'left', weight: 700, alpha: 0.6, letter: 4 });
      drawText(ctx, `${(s.total * Ease.outCubic(tk)).toFixed(2)}s`, 70, 90, 46, c.ink, { align: 'right', weight: 900 });
      if (s.misses) drawText(ctx, `MISS ${s.misses}`, 170, 92, 22, c.ink, { alpha: 0.5, weight: 700, letter: 2 });
    }
    const gk = clamp((a - 1.35) / 0.22); // 総合評価の大きな判
    if (gk > 0) {
      const sc = lerp(3, 1, Ease.outBack(gk));
      ctx.save();
      ctx.translate(0, -385);
      ctx.rotate(-0.08);
      ctx.scale(sc, sc);
      ctx.globalAlpha = Math.min(1, gk * 2);
      drawText(ctx, s.grade, 0, 0, 150, c.spark, { display: true });
      ctx.restore();
    }
    if (a > 1.7 && this.best != null) {
      if (this.newBest)
        drawText(ctx, `NEW BEST  ${this.best.toFixed(2)}s`, 0, 172, 30, c.spark, {
          display: true,
          alpha: 0.6 + 0.4 * Math.sin(a * 8),
          letter: 3,
        });
      else drawText(ctx, `BEST ${this.best.toFixed(2)}s`, 0, 172, 26, c.ink, { alpha: 0.55, weight: 700, letter: 3 });
    }
    // もう一度ボタン（再生の矢印つき）
    const b = this.retry;
    const ready = a >= CONFIG.resultInputDelay;
    ctx.globalAlpha = ready ? 1 : 0.4;
    drawButton(ctx, { x: b.x, y: b.y, r: b.r, color: c.coral, press: 0, hint: 0, done: !ready, elapsed: 0 });
    const cx = b.x;
    const cy = b.y - b.r * 0.1;
    const R = 30;
    const th = Math.PI * 1.35;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI * 0.35, th);
    ctx.stroke();
    const px = cx + Math.cos(th) * R;
    const py = cy + Math.sin(th) * R;
    const tx = -Math.sin(th);
    const ty = Math.cos(th);
    const nx = Math.cos(th);
    const ny = Math.sin(th);
    ctx.beginPath();
    ctx.moveTo(px + tx * 18, py + ty * 18);
    ctx.lineTo(px + nx * 14, py + ny * 14);
    ctx.lineTo(px - nx * 14, py - ny * 14);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  // 右上の音のボタン（M キーでも切り替え）
  mutePos() {
    return { x: View.halfW - 56, y: -View.halfH + 56 };
  },
  pressCorner(p) {
    const m = this.mutePos();
    if (Math.hypot(p.lx - m.x, p.ly - m.y) > 60) return false;
    Sound.setMuted(!Sound.muted);
    return true;
  },
  drawMute(ctx) {
    const { x, y } = this.mutePos();
    const c = CONFIG.colors.ink;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -9);
    ctx.lineTo(-11, -9);
    ctx.lineTo(2, -22);
    ctx.lineTo(2, 22);
    ctx.lineTo(-11, 9);
    ctx.lineTo(-22, 9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    if (Sound.muted) {
      ctx.moveTo(12, -10);
      ctx.lineTo(30, 10);
      ctx.moveTo(30, -10);
      ctx.lineTo(12, 10);
    } else {
      ctx.arc(6, 0, 12, -0.9, 0.9);
      ctx.moveTo(6 + 22 * Math.cos(-0.9), 22 * Math.sin(-0.9));
      ctx.arc(6, 0, 22, -0.9, 0.9);
    }
    ctx.stroke();
    ctx.restore();
  },
};
