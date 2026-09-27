// 起動と結線
function boot() {
  View.init(document.getElementById('stage'));
  World3D.init(document.getElementById('world'));
  buildTimeline();
  // やり直し用に組み上げた直後の姿を覚え、全ての材質を先に用意しておく
  if (World3D.ok) {
    World3D.snapshot();
    World3D.precompile();
  }
  Input.init(View.canvas);
  Debug.init();
  UI.best = loadBest();
  if (document.fonts && document.fonts.load)
    document.fonts.load('80px "Dela Gothic One"').catch(() => {
      /* 読めなければ代わりの書体 */
    });
  Sound.loadMuted();
  addEventListener('keydown', e => {
    if (e.key === 'm' || e.key === 'M') Sound.setMuted(!Sound.muted);
  });
  Game.hold = Debug.hold;
  Game.reset();
  if (Debug.startT != null && isFinite(Debug.startT)) Game.jumpTo(Debug.startT);
  requestAnimationFrame(frame);
}
boot();
