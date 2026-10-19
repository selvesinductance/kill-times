// 五門の兵：音（効果音・環境音・BGM の音量。音はすべてここで鳴らす）
// ui.js からは window.GomonAudio を通して使う
(function () {
  'use strict';
  let actx = null, bus = null, muted = false, paused = false, previewT = null;
  let near = 0; // カメラが川にどれだけ近いか（0〜1）。川の音（せせらぎ・しずく・魚の水音）の大きさにかける
  // 音量：システム音（se）・環境音（env）・BGM（bgm）。0〜200。100 がふつうの大きさ
  const VOL = { se: 100, env: 100, bgm: 100 };
  const BASE = { se: 1, env: 1 / 3, bgm: 1 }; // 環境音は、はじめの版の 1/3 をふつうの大きさにする
  const gainOf = (k) => (muted ? 0 : BASE[k] * Math.pow(VOL[k] / 100, 2)); // 耳で感じる大きさに合わせて2乗
  function ensureAudio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        bus = {};
        for (const k of ['se', 'env', 'bgm']) { bus[k] = actx.createGain(); bus[k].gain.value = gainOf(k); bus[k].connect(actx.destination); }
      } catch (e) { actx = null; bus = null; }
    }
    if (actx && actx.state === 'suspended' && !paused) actx.resume().catch(() => {});
  }
  function applyVolumes() {
    if (!actx || !bus) return;
    for (const k of Object.keys(bus)) { try { bus[k].gain.setTargetAtTime(gainOf(k), actx.currentTime, 0.05); } catch (e) { /* なくても動く */ } }
  }
  const silent = (k) => muted || !actx || !bus || gainOf(k) <= 0;
  // 発振器1つを音量1つにつないで鳴らす。shape(高さ, 音量, 鳴らし始め) で、高さと音量の変わり方を決める
  function voice(b, type, dur, shape) {
    b = b || 'se';
    if (silent(b)) return;
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine';
    shape(o.frequency, g.gain, t);
    o.connect(g); g.connect(bus[b]);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // ふつうの短い音（slide があれば、高さを freq × slide まで動かす）
  function tone(freq, dur, type, vol, slide, b) {
    voice(b, type, dur, (f, g, t) => {
      f.setValueAtTime(freq, t);
      if (slide) f.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.setValueAtTime(vol || 0.06, t);
      g.exponentialRampToValueAtTime(0.0001, t + dur);
    });
  }
  // やわらかい短い音（立ち上がりを少しだけなだらかにして、プツッと鳴らないように）
  function blip(freq, dur, vol, b) {
    voice(b, 'sine', dur, (f, g, t) => {
      f.setValueAtTime(freq, t);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(vol, t + 0.008);
      g.exponentialRampToValueAtTime(0.0001, t + dur);
    });
  }
  const FF_STEPS = [784, 1047, 1397, 1865, 3136]; // 早送りの音の段：ソ・ド・ファ・ラ♯・ソ（一つずつ上の音へ。最後のソは2オクターブ上）
  // 早送りの1音：やわらかい短い音に、たたくような短い雑音を添える（高い音は耳に強いので少し小さく）
  const ffNote = (f) => { blip(f, 0.08, f > 2500 ? 0.01 : 0.016); noise(0.025, 'bandpass', 3200, 1400, 0.03); };
  // ブラックホールの音：ドーンと鳴ってから、うねる風の音が高まり、低いうなりが沈んでいく
  let bhAudio = null;
  function bhSound(grow, total) {
    if (silent('se')) return;
    try {
      const t = actx.currentTime, srcs = [];
      const out = actx.createGain();
      out.connect(bus.se);
      const env = (g, peak, at, hold) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + at); g.gain.setValueAtTime(peak, t + hold); g.gain.linearRampToValueAtTime(0.0001, t + total); };
      // 1) 現れた瞬間のドーン（低い音＋ざらっとした破裂音）
      const boom = actx.createOscillator(), bg = actx.createGain();
      boom.frequency.setValueAtTime(120, t); boom.frequency.exponentialRampToValueAtTime(38, t + 0.9);
      bg.gain.setValueAtTime(0.28, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      boom.connect(bg).connect(out); srcs.push(boom);
      const nb = whiteNoise(total);
      const burst = actx.createBufferSource(), bl = actx.createBiquadFilter(), bbg = actx.createGain();
      burst.buffer = nb; bl.type = 'lowpass'; bl.frequency.setValueAtTime(2400, t); bl.frequency.exponentialRampToValueAtTime(200, t + 0.6);
      bbg.gain.setValueAtTime(0.22, t); bbg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      burst.connect(bl).connect(bbg).connect(out); srcs.push(burst);
      // 2) 渦の風：ふくらむのに合わせて高く強くなり、ぐるぐるうねる
      const wind = actx.createBufferSource(), bp = actx.createBiquadFilter(), wg = actx.createGain();
      wind.buffer = nb; bp.type = 'bandpass'; bp.Q.value = 1.3;
      bp.frequency.setValueAtTime(170, t); bp.frequency.exponentialRampToValueAtTime(1300, t + grow);
      const lfo = actx.createOscillator(), lg = actx.createGain();
      lfo.frequency.setValueAtTime(1.2, t); lfo.frequency.linearRampToValueAtTime(5.5, t + grow);
      lg.gain.setValueAtTime(60, t); lg.gain.linearRampToValueAtTime(420, t + grow);
      lfo.connect(lg).connect(bp.frequency);
      env(wg, 0.26, grow, grow + 0.6);
      wind.connect(bp).connect(wg).connect(out); srcs.push(wind, lfo);
      // 3) 低いうなり：少しずらした2本の音が、ゆらぎながら沈んでいく
      for (const f of [110, 113.5]) {
        const o = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f / 2.3, t + total);
        lp.type = 'lowpass'; lp.frequency.value = 650;
        env(g, 0.055, 0.8, grow);
        o.connect(lp).connect(g).connect(out); srcs.push(o);
      }
      srcs.forEach((n) => { n.start(t); n.stop(t + total + 0.05); });
      bhAudio = { out, srcs };
    } catch (e) { bhAudio = null; }
  }
  function stopBhSound() {
    if (!bhAudio || !actx) { bhAudio = null; return; }
    const t = actx.currentTime;
    try { bhAudio.out.gain.setTargetAtTime(0, t, 0.05); } catch (e) { /* 止められなくても動く */ }
    bhAudio.srcs.forEach((n) => { try { n.stop(t + 0.3); } catch (e) { /* もう止まっている */ } });
    bhAudio = null;
  }
  // 白い雑音を sec 秒ぶん
  function whiteNoise(sec) {
    const sr = actx.sampleRate, buf = actx.createBuffer(1, Math.floor(sr * sec), sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  const NOISE_GAIN = 0.5; // 雑音はすべて、この大きさをかける（はじめの版の半分）
  function noise(dur, type, f0, f1, vol, b) {
    b = b || 'se';
    vol *= NOISE_GAIN;
    if (silent(b)) return;
    try {
      // 雑音は、2秒ぶんを1つだけ作って使い回す（鳴らすたびに作らない）。毎回ちがうところから鳴らす
      const t = actx.currentTime, buf = noiseBuf();
      const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = buf; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(bus[b]);
      src.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.01)); src.stop(t + dur);
    } catch (e) { /* 鳴らせなくても動く */ }
  }
  let NOISE = null;
  const noiseBuf = () => (NOISE && NOISE.sampleRate === actx.sampleRate ? NOISE : (NOISE = whiteNoise(2)));
  function sfx(kind, k) {
    if (k === undefined) k = 1;
    switch (kind) {
      case 'up': tone(660, 0.12, 'triangle', 0.06); tone(990, 0.16, 'triangle', 0.04); break;
      case 'down': tone(360, 0.18, 'triangle', 0.06, 0.7); break;
      case 'neg': tone(220, 0.45, 'sawtooth', 0.04, 2.2); tone(440, 0.45, 'sine', 0.05, 0.5); break;
      case 'lane': tone(520, 0.06, 'square', 0.025); break;
      case 'lock': tone(300, 0.1, 'square', 0.03); tone(450, 0.12, 'triangle', 0.04); break;
      case 'tick': tone(880, 0.05, 'square', 0.025); break;
      case 'hit': tone(150 + Math.random() * 140, 0.05, 'square', 0.02); break;
      case 'heal': tone(300, 0.5, 'sine', 0.05, 1.8); break;
      case 'thud': tone(110, 0.6, 'sine', 0.16, 0.4); tone(70, 0.7, 'triangle', 0.09, 0.6); break;
      case 'slash': noise(0.3, 'bandpass', 900, 6000, 0.3); tone(2400, 0.55, 'triangle', 0.045, 0.92); tone(3600, 0.4, 'sine', 0.025); setTimeout(() => tone(95, 0.6, 'sine', 0.2, 0.45), 480); break;
      case 'item': [1046, 1318, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.05), i * 70)); break;
      case 'beep': tone(700 + Math.random() * 700, 0.06, 'square', 0.022); break;
      case 'poof': tone(620, 0.14, 'triangle', 0.05, 0.45); tone(300, 0.22, 'sine', 0.06, 0.6); break;
      case 'roar': tone(130, 0.8, 'sawtooth', 0.05, 0.55); tone(98, 0.8, 'square', 0.025, 0.6); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.06), i * 110)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.04), i * 150)); break;
      case 'bug': for (let i = 0; i < 7; i++) setTimeout(() => tone(200 + Math.random() * 1400, 0.05, 'square', 0.04), i * 55); break;
      case 'ach': tone(1046, 0.15, 'triangle', 0.05); setTimeout(() => tone(1318, 0.25, 'triangle', 0.05), 120); break;
      // 早送り：始めるときは一段ずつ上がっていく音、やめるときは一段ずつ下がっていく音（小さく、やわらかく）
      case 'ffOn': FF_STEPS.forEach((f, i) => setTimeout(() => ffNote(f), i * 45)); break;
      case 'ffOff': FF_STEPS.slice().reverse().forEach((f, i) => setTimeout(() => ffNote(f), i * 45)); break;
      case 'plop': if (k > 0.03) { tone(480 + Math.random() * 160, 0.09, 'sine', 0.02 * k, 2.4, 'env'); noise(0.12, 'bandpass', 1800, 700, 0.025 * k, 'env'); } break; // 魚が跳ねる（環境音。k：近さ）
      default: break;
    }
  }
  // 橋ごとの足音（丸太はコトコト・石はコツコツ・現代的な橋はカンカン）。alt で左右の足の高さを少し変える
  // 足音は環境音として鳴らす（ふつうの大きさは、はじめの版の 1/3）
  function stepSound(type, alt) {
    const k = alt ? 0.93 : 1;
    if (type === 'log') { tone((360 + Math.random() * 50) * k, 0.06, 'triangle', 0.03, 0.75, 'env'); tone(180 * k, 0.08, 'sine', 0.026, 0.8, 'env'); }
    else if (type === 'stone') { noise(0.035, 'bandpass', 2700 * k, 1800 * k, 0.055, 'env'); tone(1150 * k, 0.03, 'square', 0.006, undefined, 'env'); }
    else { const f = (1220 + Math.random() * 60) * k; tone(f, 0.12, 'sine', 0.018, undefined, 'env'); tone(f * 1.47, 0.09, 'sine', 0.01, undefined, 'env'); tone(3100 * k, 0.04, 'triangle', 0.005, undefined, 'env'); }
  }
  // 欄干に当たる音（コツン）
  function bumpSound(type) {
    if (type === 'log') { tone(170, 0.16, 'triangle', 0.09, 0.7); noise(0.08, 'lowpass', 900, 300, 0.09); }
    else if (type === 'stone') { tone(125, 0.14, 'sine', 0.11, 0.6); noise(0.06, 'bandpass', 1500, 600, 0.1); }
    else { tone(880, 0.32, 'sine', 0.045); tone(1320, 0.26, 'sine', 0.028); tone(2350, 0.16, 'sine', 0.014); noise(0.03, 'highpass', 3000, 2000, 0.04); }
  }
  // 川のせせらぎ：こもった流れの音と、ゆらぐさらさらした音。ときどき小さなしずくの音
  let brook = null;
  function brookSound(on) {
    if (!actx) return;
    const t = actx.currentTime;
    if (on && !brook && !silent('env')) {
      try {
        const b = whiteNoise(3), out = actx.createGain();
        out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(Math.max(0.0001, near), t, 0.5);
        out.connect(bus.env);
        const layer = (type, f, q, vol) => {
          const src = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain();
          src.buffer = b; src.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol;
          src.connect(fl).connect(g).connect(out);
          return { src, fl, g };
        };
        const rush = layer('lowpass', 520, 0.5, 0.015), bab = layer('bandpass', 1500, 1.4, 0.007); // ふつうの大きさでは、この 1/3（BASE.env）。はじめの版の半分
        const l1 = actx.createOscillator(), l1g = actx.createGain(); l1.frequency.value = 0.23; l1g.gain.value = 520; l1.connect(l1g).connect(bab.fl.frequency);
        const l2 = actx.createOscillator(), l2g = actx.createGain(); l2.frequency.value = 0.61; l2g.gain.value = 0.0035; l2.connect(l2g).connect(bab.g.gain);
        const nodes = [rush.src, bab.src, l1, l2];
        rush.src.start(t); bab.src.start(t, 1.3); l1.start(t); l2.start(t);
        brook = { out, nodes, next: 0.5 };
      } catch (e) { brook = null; }
    } else if (!on && brook) {
      const bk = brook;
      brook = null;
      try { bk.out.gain.cancelScheduledValues(t); bk.out.gain.setTargetAtTime(0, t, 0.25); } catch (e) { /* 止められなくても動く */ }
      bk.nodes.forEach((n) => { try { n.stop(t + 1.5); } catch (e) { /* もう止まっている */ } });
    }
  }
  // 川の音の大きさ：カメラが川に近いほど大きく、遠いと聞こえない（v：0〜1）
  function brookNear(v) {
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - near) < 0.02 && !(v === 0 && near !== 0)) return;
    near = v;
    if (brook && actx) { try { brook.out.gain.cancelScheduledValues(actx.currentTime); brook.out.gain.setTargetAtTime(Math.max(0.0001, near), actx.currentTime, 0.35); } catch (e) { /* なくても動く */ } }
  }
  function brookDrops(dt) {
    if (!brook || silent('env') || paused || near < 0.05) return;
    brook.next -= dt;
    if (brook.next > 0) return;
    brook.next = 0.2 + Math.random() * 0.8;
    tone(1500 + Math.random() * 1900, 0.035 + Math.random() * 0.03, 'sine', (0.002 + Math.random() * 0.002) * near, 1.25 + Math.random() * 0.4, 'env');
  }
  // 一時停止中は、すべての音を止める（音の時間ごと止めるので、再開すると続きから鳴る）
  function setPaused(v) {
    paused = !!v;
    clearTimeout(previewT);
    if (!actx) return;
    if (paused) actx.suspend().catch(() => {}); else actx.resume().catch(() => {});
  }
  // 音の設定で試しに鳴らす：一時停止中は、少しの間だけ音を通す
  function preview(kind) {
    ensureAudio();
    if (!actx) return;
    if (paused) {
      actx.resume().catch(() => {});
      clearTimeout(previewT);
      previewT = setTimeout(() => { if (paused) actx.suspend().catch(() => {}); }, 700);
    }
    sfx(kind);
  }

  function setMuted(m) {
    muted = !!m;
    applyVolumes();
    if (muted) { stopBhSound(); brookSound(false); }
  }
  function setVolume(k, v) {
    if (!(k in VOL)) return;
    VOL[k] = Math.max(0, Math.min(200, Math.round(v)));
    applyVolumes();
    if (k === 'env' && VOL.env <= 0) brookSound(false);
  }
  // BGM：音量の設定だけある（BGM そのものはこれから）
  window.GomonAudio = {
    ensure: ensureAudio, sfx, stepSound, bumpSound, bhSound, stopBhSound, brookSound, brookNear, brookDrops,
    setMuted, setVolume, setPaused, preview, volume: (k) => VOL[k],
  };
})();
