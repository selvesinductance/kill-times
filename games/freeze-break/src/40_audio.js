// 効果音（WebAudio でその場合成）と、区間ごとの効果音のキューシート。
// 音の経路: 効果音バス ─┐
//          BGM → ローパス → ダッキング ─┴→ コンプレッサー → マスター（音量・消音）
const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicIn: null,
  musicFilter: null,
  duckGain: null,
  noiseBuf: null,
  muted: false,
  volume: 0.8,

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = (this.ctx = new AC());
        this.master = c.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(c.destination);
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.analyser = c.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.5; // 背景のスペクトログラム用（消音より手前で取るので、消音中も動く）
        comp.connect(this.analyser);
        this.analyser.connect(this.master);
        this.sfxBus = c.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(comp);
        this.duckGain = c.createGain();
        this.duckGain.connect(comp);
        this.musicFilter = c.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 18000;
        this.musicFilter.connect(this.duckGain);
        this.musicIn = c.createGain();
        this.musicIn.gain.value = 0.5;
        this.musicIn.connect(this.musicFilter);
        const n = c.sampleRate;
        const b = c.createBuffer(1, n, n);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
        Music.init();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (_) {
      this.ctx = null;
    }
  },

  loadMuted() {
    try {
      this.muted = localStorage.getItem('freeze-break.muted') === '1';
    } catch (_) {
      /* 使えない環境 */
    }
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem('freeze-break.muted', m ? '1' : '0');
    } catch (_) {
      /* 使えない環境 */
    }
  },
  // 大きな効果音の瞬間に BGM を一瞬下げる
  duck(amount = 0.35, rel = 0.25) {
    const c = this.ctx;
    if (!c) return;
    const g = this.duckGain.gain;
    const t = c.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(amount, t + 0.01);
    g.setTargetAtTime(1, t + 0.05, rel);
  },

  // ---- 音源の部品（o.at で絶対時刻、o.delay で今からの遅れ、o.out で接続先） ----
  tone(freq, dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = o.at != null ? o.at : c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    const v = o.vol == null ? 0.3 : o.vol;
    const a = o.attack || 0.004;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = o.q || 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.out || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    if (o.onNode) o.onNode(osc, t + dur + 0.05); // BGM が鳴っている音を覚えておく（減速で音程を下げるため）
  },
  noise(dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = o.at != null ? o.at : c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const v = o.vol == null ? 0.3 : o.vol;
    src.buffer = this.noiseBuf;
    src.loop = true;
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.out || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    if (o.onNode) o.onNode(src, t + dur + 0.05);
  },

  // 鳴らし続けて、途中で高さと大きさを変えられる音（パチンコのゴムの張り）
  hold() {
    const c = this.ctx;
    if (!c || this.muted) return null;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 80;
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.Q.value = 4;
    g.gain.value = 0;
    o.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    o.start();
    return {
      set: (fr, v) => {
        const t = c.currentTime;
        o.frequency.setTargetAtTime(fr, t, 0.03);
        f.frequency.setTargetAtTime(500 + fr * 3, t, 0.03);
        g.gain.setTargetAtTime(v, t, 0.03);
      },
      stop: () => {
        const t = c.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.025);
        o.stop(t + 0.2);
      },
    };
  },
  // ---- 効果音 ----
  sfx(name, o = {}) {
    if (name === 'stamp') Music.finale();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'success': {
        // ゲートごとに全音ずつ上がる和音＋種類ごとの音
        const base = 392 * Math.pow(2, ((o.step || 0) * 2) / 12);
        [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.35, { type: i % 2 ? 'sine' : 'triangle', vol: 0.15, delay: i * 0.012 }));
        this.noise(0.3, { filter: 'highpass', freq: 2000, to: 8000, vol: 0.1 });
        const extra = { pull: 'whoosh', slide: 'clank', swipe: 'slash', rotate: 'whirr', mash: 'explode' }[o.kind];
        if (extra) this.sfx(extra);
        this.duck(0.3, 0.3);
        break;
      }
      case 'miss':
        this.tone(140, 0.14, { type: 'square', vol: 0.07, lp: 600 });
        break;
      case 'tick':
        this.tone(1100 + (o.k || 0) * 900, 0.03, { type: 'square', vol: 0.04 });
        break;
      case 'hit':
        this.tone(320 + (o.k || 0) * 700, 0.12, { type: 'triangle', vol: 0.25, to: 160 + (o.k || 0) * 350 });
        this.noise(0.05, { freq: 3000, vol: 0.1 });
        break;
      case 'snap':
        this.tone(700, 0.06, { type: 'triangle', vol: 0.2, to: 320 });
        this.noise(0.03, { freq: 4000, vol: 0.12 });
        break;
      case 'lock': {
        // 鍵が掛かる「カ・チッ」: 軽い一音目と、少し遅れて鋭い二音目
        const t = this.ctx.currentTime;
        this.tone(1400, 0.035, { at: t, type: 'triangle', vol: 0.2, to: 850 });
        this.noise(0.022, { at: t, freq: 2600, vol: 0.12 });
        this.tone(2700, 0.05, { at: t + 0.1, type: 'square', vol: 0.12, to: 1700, lp: 6500 });
        this.noise(0.035, { at: t + 0.1, filter: 'highpass', freq: 5200, vol: 0.2 });
        break;
      }
      case 'bounce': {
        const f = o.f || 520;
        this.tone(f, 0.14, { vol: 0.2, to: f * 1.5, glide: 0.06 });
        break;
      }
      case 'whoosh':
        this.noise(0.35, { freq: 400, to: 2400, q: 1.2, vol: 0.2 });
        break;
      // 扉のセンサーが玉を検知した「ピピッ」
      case 'detect': {
        const t = this.ctx.currentTime;
        [0, 0.09].forEach(d => this.tone(2093, 0.05, { at: t + d, type: 'square', vol: 0.05, lp: 5200 }));
        break;
      }
      case 'airpass':
        this.noise(0.62, { freq: 280, to: 1500, q: 0.9, vol: 0.13, attack: 0.28 });
        break; // 輪をくぐる風切り（立ち上がりがゆるやか）
      case 'slash':
        this.noise(0.18, { filter: 'highpass', freq: 3000, to: 9000, vol: 0.25 });
        this.tone(2400, 0.12, { vol: 0.06, to: 1200 });
        break;
      case 'clank':
        this.tone(180, 0.25, { type: 'square', vol: 0.12, lp: 900 });
        this.tone(1250, 0.4, { vol: 0.06 });
        this.noise(0.08, { freq: 2500, vol: 0.2 });
        break;
      case 'whirr':
        this.tone(160, 0.8, { type: 'sawtooth', vol: 0.08, to: 900, lp: 1800 });
        break;
      case 'impact':
        this.tone(90, 0.5, { vol: 0.6, to: 32 });
        this.noise(0.45, { filter: 'lowpass', freq: 1400, to: 150, vol: 0.4 });
        this.duck(0.25, 0.35);
        break;
      case 'shatter':
        for (let i = 0; i < 5; i++)
          this.noise(0.12 + Math.random() * 0.1, { filter: 'highpass', freq: 2500 + Math.random() * 3000, vol: 0.12, delay: i * 0.03 });
        break;
      case 'charge':
        this.tone(110, 2.2, { type: 'sawtooth', vol: 0.08, to: 880, glide: 2.2, lp: 2400, attack: 2.0 });
        break;
      case 'explode':
        this.tone(70, 1.0, { vol: 0.7, to: 25 });
        this.noise(1.2, { filter: 'lowpass', freq: 3000, to: 100, vol: 0.5 });
        this.duck(0.2, 0.5);
        break;
      case 'stamp':
        this.tone(110, 0.3, { vol: 0.5, to: 50 });
        this.noise(0.12, { freq: 1200, vol: 0.3 });
        break;
      default:
        break;
    }
  },
};

// 区間ごとの効果音: [区間内の時刻 u, 名前, オプション]
const SoundCues = {
  A: [
    [0.01, 'charge'],
    [0.75 / 3, 'whoosh'],
    [1.0 / 3, 'snap'],
    [1.25 / 3, 'snap'],
    [1.75 / 3, 'snap'],
    [1.5 / 3, 'bounce', { f: 520 }],
    [2.0 / 3, 'bounce', { f: 660 }],
  ], // 溜め → 発射、8分の格子（区間Aの U_* と同じ）
  B: [], // 発射と扉の音は区間Bのイベント（2D/3Dで間合いが違う）
  C: [[0.01, 'whoosh']], // 着地の音は区間Cのイベント
  D: [
    [1 / 14, 'impact'],
    [1 / 14, 'shatter'],
    [6 / 7, 'snap'],
  ],
  E: [
    [1 / 14, 'charge'],
    [5 / 7, 'snap'],
    [6 / 7, 'shatter'],
  ],
  F: [
    [0.001, 'explode'],
    [6 / 7, 'stamp'],
  ],
};
