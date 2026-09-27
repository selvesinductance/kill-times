// ループ・時計・状態機械・カメラ・画面サイズ・イージング

// ---- 数学とイージング ----
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (u, a, b) => clamp((u - a) / (b - a)); // u の [a,b] を 0→1 に
const Ease = {
  inQuad: k => k * k,
  inCubic: k => k * k * k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: k => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};
// シード付き乱数（同じ seed なら同じ列 ＝ 同じ t なら同じ絵）
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 放射状の光の画像を1画素ずつ計算して作る（canvas のグラデーションはブラウザがディザをかけ、拡大すると色のついた粒々に見えるため）
// stops: [[位置0〜1, r, g, b, a], ...]（位置の昇順）
function smoothRadial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const d = img.data;
  const h = size / 2;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const r = Math.min(1, Math.hypot(i + 0.5 - h, j + 0.5 - h) / h);
      let k = 1;
      while (k < stops.length - 1 && stops[k][0] < r) k++;
      const A = stops[k - 1];
      const B = stops[k];
      const t = clamp((r - A[0]) / Math.max(1e-6, B[0] - A[0]));
      const s = t * t * (3 - 2 * t);
      const o = (j * size + i) * 4;
      for (let n = 0; n < 4; n++) d[o + n] = Math.round(lerp(A[n + 1], B[n + 1], s));
    }
  x.putImageData(img, 0, 0);
  return c;
}

// ---- 画面 ----
const View = {
  canvas: null,
  ctx: null,
  w: 1,
  h: 1,
  dpr: 1,
  scale: 1, // scale: 論理1単位あたりの CSS px
  left: 0,
  top: 0, // キャンバスの画面上の位置（安全領域の余白ぶんずれることがある）
  halfW: 500,
  halfH: 500, // 見えている範囲の半分（論理単位）
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const onResize = () => this.resize();
    addEventListener('resize', onResize);
    if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);
    this.resize();
  },
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width || window.innerWidth);
    const h = Math.max(1, r.height || window.innerHeight);
    this.w = w;
    this.h = h;
    this.left = r.left;
    this.top = r.top;
    this.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w, h) / CONFIG.logical;
    this.halfW = w / this.scale / 2;
    this.halfH = h / this.scale / 2;
    if (typeof World3D !== 'undefined' && World3D.ok) World3D.resize();
  },
  // 論理座標（原点＝画面中央）で描くための変換。ox, oy は揺れのずらし（論理単位）
  screenTransform(ctx, ox = 0, oy = 0) {
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, (this.w / 2 + ox * this.scale) * this.dpr, (this.h / 2 + oy * this.scale) * this.dpr);
  },
  pixelTransform(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  toLogical(cx, cy) {
    return { x: (cx - this.left - this.w / 2) / this.scale, y: (cy - this.top - this.h / 2) / this.scale };
  },
  toClient(lx, ly) {
    return { x: lx * this.scale + this.w / 2 + this.left, y: ly * this.scale + this.h / 2 + this.top };
  },
};

// ---- カメラ（論理 ＝ 回転・拡大 ×（ワールド − カメラ位置）） ----
const Camera = {
  make(x = 0, y = 0, zoom = 1, rot = 0) {
    return { x, y, zoom, rot };
  },
  apply(ctx, c) {
    ctx.rotate(c.rot);
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-c.x, -c.y);
  },
  toWorld(c, lx, ly) {
    const cs = Math.cos(-c.rot);
    const sn = Math.sin(-c.rot);
    return { x: c.x + (lx * cs - ly * sn) / c.zoom, y: c.y + (lx * sn + ly * cs) / c.zoom };
  },
  toLogical(c, wx, wy) {
    const dx = (wx - c.x) * c.zoom;
    const dy = (wy - c.y) * c.zoom;
    const cs = Math.cos(c.rot);
    const sn = Math.sin(c.rot);
    return { x: dx * cs - dy * sn, y: dx * sn + dy * cs };
  },
};

// ---- ステージ登録（区間の時刻は CONFIG.timeline、絵と動きはステージファイル） ----
const StageDefs = {};
function defineStage(id, def) {
  StageDefs[id] = def;
}
let Timeline = [];
function buildTimeline() {
  Timeline = CONFIG.timeline.map(row => {
    const def = StageDefs[row.id] || {};
    return Object.assign({}, row, {
      draw: def.draw || (() => {}),
      camera: def.camera || (() => Camera.make()),
      origin: def.origin || [0, 0], // ステージの座標の原点（世界座標）。粒子は世界座標で持つ
      three: def.three || null, // 3Dで描く区間: { build(scene), update(u, o), camera(u), plane }
      events: def.events || null, // [[u, fn], ...] 区間内の時刻 u を通過したら fn
      gateObj: row.gate ? makeGate(row.gate, def.gate || {}) : null,
    });
  });
  if (World3D.ok) for (const st of Timeline) if (st.three && st.three.build) st.three.build(World3D.scene);
}

// ---- 座標の切り替え（2Dの区間はカメラ、3Dの区間はゲート平面） ----
const Space = {
  is3D() {
    return !!(Game.stage.three && World3D.ok && World3D.pm);
  },
  toLocal(cx, cy) {
    // 画面（CSS px）→ 今のゲートの座標
    if (this.is3D()) return World3D.screenToPlane(cx, cy);
    const l = View.toLogical(cx, cy);
    return Camera.toWorld(Game.camera(), l.x, l.y);
  },
  toScreen(x, y) {
    // 今のゲートの座標 → 画面（CSS px）
    if (this.is3D()) return World3D.planeToScreen(x, y);
    const l = Camera.toLogical(Game.camera(), x, y);
    return View.toClient(l.x, l.y);
  },
};

// ---- 採点 ----
function rankFor(reaction, par) {
  if (reaction <= par) return 'PERFECT';
  if (reaction <= par * CONFIG.rank.great) return 'GREAT';
  if (reaction <= par * CONFIG.rank.good) return 'GOOD';
  return 'OK';
}
function scoreGate(g) {
  return { reaction: g.reaction, misses: g.misses, par: g.cfg.par, rank: rankFor(g.reaction, g.cfg.par) };
}
function overallGrade(results) {
  let sum = 0;
  let par = 0;
  let n = 0;
  let misses = 0;
  for (const id in results) {
    sum += results[id].reaction;
    par += results[id].par;
    misses += results[id].misses;
    n++;
  }
  if (!n) return { grade: '-', total: 0, misses: 0, complete: false };
  const ratio = sum / par;
  return { grade: CONFIG.grade.find(([, r]) => ratio <= r)[0], total: sum, misses, complete: n === CONFIG.scoredGates.length };
}

// ---- 拍（音楽と映像をつなぐ）----
// BGM は区間の始まり（ヒットストップ明け）で小節の頭から鳴り直すので、区間内の経過時間から拍が分かる
const Beat = {
  pulse: 0,
  bar: 0,
  heart: 0,
  off: 0,
  onset: false,
  barOnset: false,
  idx: -1,
  update() {
    const s = Game.stage;
    this.pulse = 0;
    this.bar = 0;
    this.heart = 0;
    this.off = 0;
    this.onset = false;
    this.barOnset = false;
    if (Game.phase === 'PLAY' && s.id !== 'T' && !(s.id === 'F' && Game.u() > 0.86)) {
      const bt = Math.max(0, (Game.t - s.from) / CONFIG.beat);
      const ph = bt - Math.floor(bt);
      this.pulse = Math.exp(-ph * 5);
      this.off = Math.exp(-((bt + 0.5) % 1) * 5); // 裏拍
      if (Math.floor(bt) % 4 === 0) this.bar = this.pulse; // 小節の頭は強く
      const bi = Math.floor(bt) + s.from * 10; // 拍の頭（背景の演出を鳴らす）
      if (bi !== this.idx) {
        this.onset = this.idx >= 0;
        this.barOnset = this.onset && Math.floor(bt) % 4 === 0;
        this.idx = bi;
      }
    } else if (Game.phase === 'GATE' && s.id !== 'T' && Game.freezeAge >= 0.25) {
      const h = (Game.freezeAge - 0.25) % 1; // 凍結中は心拍（BGMの心拍と同じ周期）
      this.heart = Math.exp(-h * 7) + (h > 0.2 ? 0.6 * Math.exp(-(h - 0.2) * 7) : 0);
    }
  },
};

// ---- ゲーム本体（状態機械） ----
// phase: 'PLAY' | 'GATE' | 'BURST' | 'RESULT'（タイトルは区間 T のゲートで凍結している状態）
const Game = {
  phase: 'GATE',
  idx: 0,
  t: 0,
  playTime: 0, // タイムライン上で進んだ時間の累計
  realPlay: 0, // PLAY 中に流れた実時間の累計
  timeScale: 1,
  resumeAge: 99,
  burstLeft: 0,
  freezeAge: 0,
  prevU: 0,
  chargeLeft: 0,
  chargeK: 0, // 溜めてから放つゲート（コア）の残り秒数と溜まり具合 0→1
  audioAt: 0, // 最後に時計を進めた瞬間の音の時刻（BGM の刻みをゲームの時計に合わせる対応点）
  results: {},
  hold: false,
  wound: false,

  get stage() {
    return Timeline[this.idx];
  },
  get state() {
    return this.phase === 'GATE' && this.stage.id === 'T' ? 'TITLE' : this.phase;
  },
  u() {
    const s = this.stage;
    return s.to > s.from ? clamp((this.t - s.from) / (s.to - s.from)) : 1;
  },
  camera() {
    return this.stage.camera(this.u());
  },

  clear() {
    this.t = 0;
    this.playTime = 0;
    this.realPlay = 0;
    this.results = {};
    this.timeScale = 1;
    this.resumeAge = 99;
    this.prevU = 0;
    this.wound = false;
    this.chargeLeft = 0;
    this.chargeK = 0;
    FX.reset();
    if (World3D.ok) World3D.restore(); // 前の回で動かされた3Dの物を組み上げた直後の姿へ（やり直すと表示が崩れる不具合の対策）
  },
  reset() {
    this.clear();
    this.idx = 0;
    this.enterGate();
  },
  // リトライ: タイトルのボタンを押したのと同じ流れで区間 A へ
  restart() {
    this.clear();
    this.idx = 0;
    const g = this.stage.gateObj;
    g.enter();
    g.succeed();
    this.phase = 'GATE';
    this.enterBurst();
  },
  // 任意の時刻から開始（検証用）
  jumpTo(t) {
    this.clear();
    t = clamp(t, 0, Timeline[Timeline.length - 1].to);
    let i = 1;
    while (i < Timeline.length - 1 && t > Timeline[i].to) i++;
    this.idx = i;
    this.t = t;
    this.prevU = this.u();
    this.phase = 'PLAY';
    this.prepStage();
    this.checkEnd();
  },

  enterGate() {
    this.phase = 'GATE';
    this.freezeAge = 0;
    Input.markStale();
    this.stage.gateObj.enter();
    if (this.stage.id !== 'T') FX.onFreeze(); // 凍結の効果音は鳴らさない（BGMの減速で表す）
    Music.onFreeze(this.idx);
  },
  enterBurst() {
    const g = this.stage.gateObj;
    if (g.cfg.scored) this.results[g.id] = scoreGate(g);
    this.phase = 'BURST';
    this.burstLeft = g.cfg.hitStop;
    this.chargeLeft = g.cfg.charge || 0;
    this.chargeK = 0;
    // 溜めてから放つゲート（コア）
    if (this.chargeLeft > 0) {
      const kind = GateKinds[g.kindName];
      if (kind.chargeStart) kind.chargeStart(g, this.chargeLeft);
    } else {
      FX.onGateSuccess(g);
      Sound.sfx('success', { step: this.idx, kind: g.kindName });
    }
  },
  leaveBurst() {
    FX.handOff();
    this.idx++;
    this.phase = 'PLAY';
    this.prevU = 0;
    this.resumeAge = 0;
    this.wound = false;
    Music.onResume(this.idx - 1); // 時間が動き出す瞬間に BGM も小節の頭から鳴り直す
    this.prepStage();
    this.checkEnd();
  },
  // 区間の始まりにゲートを初期状態に戻す（区間の終わりで予告として描くため）
  prepStage() {
    const g = this.stage.gateObj;
    if (g) g.enter();
  },
  enterResult() {
    this.phase = 'RESULT';
    UI.onResult(this.results);
    Music.toResult();
  },
  checkEnd() {
    const s = this.stage;
    if (this.t < s.to) return false;
    this.t = s.to;
    if (s.gateObj) this.enterGate();
    else this.enterResult();
    return true;
  },
  fireEvents() {
    const s = this.stage;
    const u = this.u();
    if (s.events) for (const [eu, fn] of s.events) if (this.prevU < eu && eu <= u) fn();
    const cues = SoundCues[s.id];
    if (cues) for (const [eu, name, o] of cues) if (this.prevU < eu && eu <= u) Sound.sfx(name, o);
    this.prevU = u;
  },

  update(dt) {
    FX.update(dt);
    UI.update(dt);
    Beat.update();
    if (this.phase === 'PLAY') {
      this.resumeAge += dt;
      const r = CONFIG.resume;
      const W = CONFIG.windDown;
      const s = this.stage;
      const rem = s.to - this.t;
      this.timeScale = this.resumeAge < r.dur && s.id !== 'F' ? lerp(r.from, 1, Ease.inQuad(this.resumeAge / r.dur)) : 1; // コアを壊した後（区間F）は回り出さず、いきなり全速で爆発
      if (s.gateObj && rem < W.lead) {
        // 凍結の手前: 時間と BGM が一緒に減速する
        this.timeScale *= lerp(W.minScale, 1, rem / W.lead);
        if (!this.wound && !this.hold) {
          this.wound = true;
          Music.windDown(rem / ((1 + W.minScale) / 2));
        }
      }
      if (!this.hold) {
        const nt = Math.min(this.t + dt * this.timeScale, this.stage.to);
        this.audioAt = Sound.ctx ? Sound.ctx.currentTime : 0;
        this.playTime += nt - this.t;
        this.realPlay += dt;
        this.t = nt;
        this.fireEvents();
      }
      this.checkEnd();
    } else if (this.phase === 'GATE') {
      const g = this.stage.gateObj;
      this.freezeAge += dt;
      g.update(dt);
      if (Debug.auto && this.freezeAge >= CONFIG.autoDelay && !g.done) g.succeed();
      if (g.done) this.enterBurst();
    } else if (this.phase === 'BURST') {
      const g = this.stage.gateObj;
      g.update(dt);
      if (this.chargeLeft > 0) {
        // 溜め: 時間は止まったまま、力が集まっていく → 溜まりきったら放つ
        this.chargeLeft -= dt;
        this.chargeK = clamp(1 - this.chargeLeft / g.cfg.charge);
        const kind = GateKinds[g.kindName];
        if (kind.charging) kind.charging(g, this.chargeK, dt);
        if (this.chargeLeft <= 0) {
          FX.onGateSuccess(g);
          Sound.sfx('success', { step: this.idx, kind: g.kindName });
          FX.flash(0.9);
          FX.kick(0.1);
        }
      } else {
        this.burstLeft -= dt;
        if (this.burstLeft <= 0) this.leaveBurst();
      }
    }
  },

  onPointer(type, p) {
    if (this.phase === 'GATE') {
      const g = this.stage.gateObj;
      if (type === 'down') g.down(p);
      else if (type === 'move') g.move(p);
      else g.up(p);
    } else if (this.phase === 'RESULT' && type === 'down') {
      UI.onResultDown(p);
    }
  },
};

// ---- 描画 ----
function render() {
  const ctx = View.ctx;
  const s = Game.stage;
  const t3 = s.three && World3D.ok ? s.three : null;
  const W = View.canvas.width;
  const H = View.canvas.height;
  // 拍でカメラがわずかに寄る
  const u = Game.u();
  const sh = FX.shakeOffset();
  const bz = sh.zoom * (1 + 0.015 * Beat.pulse + 0.02 * Beat.bar);
  const frozen = Game.phase === 'GATE' || Game.phase === 'BURST';
  const g = frozen ? s.gateObj : null;
  World3D.show(!!t3);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (t3) {
    // 3D の区間: 奥に3D、手前の2Dは操作対象・画面効果・UIだけ
    ctx.clearRect(0, 0, W, H);
    for (const st of Timeline) if (st.three && st.three.group) st.three.group.visible = st === s; // 今の区間の3Dだけ見せる（区間の update が前後の区間を見せることはある）
    t3.update(u, { frozen, omitGateObject: frozen, t: Game.t });
    World3D.render(t3.camera(u), sh, bz);
    if (t3.plane) World3D.setPlane(typeof t3.plane === 'function' ? t3.plane(u) : t3.plane);
    if (World3D.pm) {
      World3D.applyPlane(ctx);
      if (t3.overlay) t3.overlay(ctx, u); // 3Dの上に平面に沿って描く2D（文字など）
      if (g) {
        g.draw(ctx);
        g.drawHint(ctx);
      }
      FX.drawLive(ctx, g);
    }
  } else {
    // 2D の区間
    ctx.fillStyle = CONFIG.stageTint[s.id] || CONFIG.colors.bg;
    ctx.fillRect(0, 0, W, H);
    const cam = s.camera(u);
    const toWorld = () => {
      View.screenTransform(ctx, sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.scale(bz, bz);
      Camera.apply(ctx, cam);
    };
    toWorld();
    s.draw(ctx, u, { frozen, omitGateObject: frozen, t: Game.t });
    FX.drawWorld(ctx);
    const fp = s.gateObj ? FX.fxPoint(s.gateObj) : null; // 凍結の見た目は操作対象の周りだけ明るく残す
    FX.drawFreeze(ctx, fp ? Camera.toLogical(cam, fp.x, fp.y) : null);
    toWorld();
    // ゲート物体はフルカラーで上に描く
    if (g) {
      g.draw(ctx);
      g.drawHint(ctx);
    }
    FX.drawLive(ctx, g);
  }
  View.screenTransform(ctx);
  FX.drawScreen(ctx);
  UI.draw(ctx);
  Debug.draw(ctx);
}

// ---- ループ ----
let lastNow = 0;
function frame(now) {
  const dt = lastNow ? Math.min((now - lastNow) / 1000, CONFIG.maxDt) : 0;
  lastNow = now;
  try {
    Game.update(dt);
    render();
    Debug.tick(dt);
  } catch (e) {
    Debug.reportError(e);
  }
  requestAnimationFrame(frame);
}
