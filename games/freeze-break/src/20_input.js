// 入力: Pointer Events → 論理座標 → ワールド座標（現在のカメラの逆変換）。
// ジェスチャ判定の部品（速度・角度の累積など）は P2 で追加する。
const Input = {
  pointers: new Map(), // pointerId -> { stale, x, y, time }
  init(canvas) {
    const conv = e => {
      const l = View.toLogical(e.clientX, e.clientY);
      const w = Space.toLocal(e.clientX, e.clientY); // 2D はカメラ、3D はゲート平面で変換
      return { id: e.pointerId, x: w.x, y: w.y, lx: l.x, ly: l.y, time: performance.now() / 1000, kind: e.pointerType };
    };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sound.unlock(); // 音声はユーザー操作の中で開始する必要がある
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {
        /* 無視 */
      }
      const p = conv(e);
      if (UI.pressCorner(p)) return; // 右上の音のボタン（ゲートには渡さない）
      this.pointers.set(e.pointerId, { stale: false, x: p.x, y: p.y, time: p.time });
      Game.onPointer('down', p);
    });
    canvas.addEventListener('pointermove', e => {
      const rec = this.pointers.get(e.pointerId);
      if (!rec || rec.stale) return;
      const p = conv(e);
      p.prev = { x: rec.x, y: rec.y, time: rec.time };
      rec.x = p.x;
      rec.y = p.y;
      rec.time = p.time;
      Game.onPointer('move', p);
    });
    const end = e => {
      const rec = this.pointers.get(e.pointerId);
      if (!rec) return;
      this.pointers.delete(e.pointerId);
      if (!rec.stale) Game.onPointer('up', conv(e));
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // 連打やダブルタップ、ピンチでブラウザが画面を拡大しないようにする（とくに iPhone の Safari）。操作は Pointer Events で受けているので影響しない
    const stop = e => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener(
      'touchend',
      e => {
        Sound.unlock();
        stop(e);
      },
      { passive: false },
    ); // ダブルタップの拡大を止める（音の開始もここで確実に）
    document.addEventListener(
      'touchstart',
      e => {
        if (e.touches.length > 1) stop(e);
      },
      { passive: false },
    ); // 2本指の拡大
    document.addEventListener('touchmove', stop, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, stop, { passive: false });
    let vp = document.querySelector('meta[name=viewport]'); // 拡大そのものを禁止する指定も加える
    if (!vp) {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      (document.head || document.documentElement).appendChild(vp);
    }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  },
  // 凍結の開始時に呼ぶ。すでに押されている指は、このゲートでは無視する
  markStale() {
    for (const r of this.pointers.values()) r.stale = true;
  },
};
