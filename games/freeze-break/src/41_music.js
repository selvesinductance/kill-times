// BGM（WebAudio でその場合成・120BPM）。ゲートを越えるたびに楽器が1つずつ増える。
// 凍結の手前ではテープが止まるように音程とテンポが落ち、凍結中は心拍だけになる。
// 時間が動き出す瞬間（ヒットストップ明け）をその小節の頭として全開で再開する。
const Music = (() => {
  const STEP = CONFIG.beat / 4; // 16分音符 = 0.125 秒
  const CHORDS = [
    // 4小節の進行 Am – F – C – G
    { bass: 55.0, notes: [220.0, 261.63, 329.63] },
    { bass: 43.65, notes: [174.61, 220.0, 261.63] },
    { bass: 65.41, notes: [261.63, 329.63, 392.0] },
    { bass: 49.0, notes: [196.0, 246.94, 293.66] },
  ];
  const LEAD = { 0: 659.25, 3: 587.33, 6: 523.25, 8: 440.0, 10: 523.25, 12: 587.33, 14: 659.25 };
  const M = {
    mode: 'off',
    level: 0,
    step: 0,
    bar: 0,
    next: 0,
    timer: null,
    voices: [],
    windT0: 0,
    windEnd: 0,
    stretch: 1,
    g0: 0,
    k: 0,
    spinT0: 0,
    spinEnd: 0,
  };
  const track = (node, end) => M.voices.push({ node, end });
  // 減速で下がる音程・凍結明けに駆け上がる音程（オクターブ）
  const OCT = 2;
  const SPIN_OCT = 3;
  const pitch = t =>
    M.mode === 'wind'
      ? Math.pow(2, -OCT * clamp((t - M.windT0) / Math.max(0.01, M.windEnd - M.windT0)))
      : t < M.spinEnd
        ? Math.pow(2, -SPIN_OCT * (1 - Ease.inQuad(clamp((t - M.spinT0) / Math.max(0.01, M.spinEnd - M.spinT0)))))
        : 1; // 減速中は下がり、凍結明けは下から上がる
  const tone = (f, d, o) => {
    const p = pitch(o.at);
    if (M.mode === 'play' && o.at < M.spinEnd && !o.to)
      return Sound.tone(
        f * p,
        d,
        Object.assign({ out: Sound.musicIn, onNode: track }, o, { to: f, glide: Math.max(0.02, M.spinEnd - o.at) }),
      ); // 回り出しの間は元の音程へ滑り上がる
    return Sound.tone(f * p, d, Object.assign({ out: Sound.musicIn, onNode: track }, o, o.to ? { to: o.to * p } : {}));
  };
  const noise = (d, o) => Sound.noise(d, Object.assign({ out: Sound.musicIn, onNode: track }, o));

  const kick = t => tone(150, 0.35, { at: t, vol: 0.8, to: 42, glide: 0.12 });
  const hat = (t, v) => noise(0.05, { at: t, filter: 'highpass', freq: 7500, vol: v });
  const clap = t => {
    noise(0.16, { at: t, freq: 1800, q: 1.2, vol: 0.28 });
    tone(190, 0.08, { at: t, type: 'triangle', vol: 0.12 });
  };
  const crash = t => noise(1.4, { at: t, filter: 'highpass', freq: 4000, vol: 0.22 });
  const tapeStop = (t, end) =>
    // 止まっていくうなり
    Sound.tone(220, end - t + 0.1, {
      at: t,
      type: 'sawtooth',
      vol: 0.05,
      to: 40,
      glide: end - t,
      lp: 900,
      out: Sound.musicIn,
      onNode: track,
    });
  const tapeStart = (t, end) => {
    // 回り出すうなり（大げさに: 2つの唸り＋駆け上がるノイズ）
    const d = end - t;
    Sound.tone(30, d + 0.05, { at: t, type: 'sawtooth', vol: 0.12, to: 440, glide: d, lp: 2400, out: Sound.musicIn, onNode: track });
    Sound.tone(60, d + 0.05, { at: t, type: 'square', vol: 0.05, to: 880, glide: d, lp: 3000, out: Sound.musicIn, onNode: track });
    Sound.noise(d + 0.05, { at: t, freq: 250, to: 7000, q: 2, vol: 0.18, out: Sound.musicIn, onNode: track });
  };
  const heart = t => {
    tone(62, 0.16, { at: t, vol: 0.6 });
    tone(58, 0.14, { at: t + 0.2, vol: 0.4 });
  };

  M.init = () => {
    if (M.timer) return;
    M.timer = setInterval(() => {
      try {
        M.tick();
      } catch (e) {
        Debug.reportError(e);
      }
    }, 25);
  };
  M.tick = () => {
    const c = Sound.ctx;
    if (!c || M.mode === 'off') return;
    const now = c.currentTime;
    if (M.voices.length > 64) M.voices = M.voices.filter(v => v.end > now);
    if (M.mode === 'play') {
      // 演奏中は刻みをゲームの時計に合わせる（再開の加速も含めて映像と同じ拍）
      const ts = Math.max(0.2, Game.timeScale || 1);
      const lat = c.outputLatency || c.baseLatency || 0;
      const live = Game.phase === 'PLAY' && !Game.hold;
      const gNow = Game.t + (live ? clamp(now - (Game.audioAt || now), 0, 0.1) * ts : 0); // 前のコマからの経過ぶん進めた今のゲーム時刻（止まったコマの先読みは 0.1秒まで）
      for (let guard = 0; guard < 32; guard++) {
        const at = now + (M.g0 + M.k * STEP - gNow) / ts - lat; // この刻みが聞こえるべき時刻（出力の遅れぶん早く鳴らす）
        if (at > now + 0.12) break;
        if (at > now - 0.06) M.play(M.step, Math.max(now, at)); // 大きく遅れた刻みは飛ばす
        M.k++;
        M.step = (M.step + 1) % 16;
        if (M.step === 0) M.bar++;
      }
      return;
    }
    if (M.next < now - 0.2) M.next = now + 0.02; // 裏に回って遅れたら詰め直す
    while (M.next < now + 0.12) {
      if (M.mode === 'wind' && M.next > M.windEnd) break; // 止まりきったら次を刻まない
      M.play(M.step, M.next);
      M.next += M.mode === 'wind' ? STEP * (M.stretch *= 1.35) : STEP; // 減速中は1歩ごとに間が伸びる
      M.step = (M.step + 1) % 16;
      if (M.step === 0) M.bar++;
    }
  };

  M.play = (s, t) => {
    const ch = CHORDS[M.bar % 4];
    if (M.mode === 'heart') {
      if (s === 0 || s === 8) heart(t);
      return;
    }
    if (M.mode === 'calm') {
      if (s === 0)
        ch.notes.forEach((f, i) => tone(f, 1.9, { at: t, type: 'triangle', vol: 0.05, attack: 0.3, lp: 1400, detune: (i - 1) * 6 }));
      if (s % 4 === 2) tone(ch.notes[((s / 4) | 0) % 3] * 2, 0.4, { at: t, vol: 0.03 });
      return;
    }
    const L = M.level;
    if (L >= 1) {
      // ドラム
      if (s % 4 === 0) kick(t);
      if (s % 4 === 2) hat(t, 0.09);
      else if (s % 2 === 1) hat(t, 0.03);
      if (s === 4 || s === 12) clap(t);
    }
    if (L >= 2 && s % 2 === 0) tone(ch.bass * (s % 4 === 2 ? 2 : 1), 0.2, { at: t, type: 'sawtooth', vol: 0.22, lp: 700, q: 3 }); // ベース
    if (L >= 3) tone(ch.notes[s % 3] * (s % 8 < 4 ? 2 : 4), 0.12, { at: t, type: 'square', vol: 0.045, lp: 2600 }); // アルペジオ
    if (L >= 4 && s === 0)
      ch.notes.forEach((f, i) => tone(f, 1.9, { at: t, type: 'sawtooth', vol: 0.035, attack: 0.05, lp: 1500, detune: (i - 1) * 8 })); // コード
    if (L >= 5 && LEAD[s]) tone(LEAD[s], s === 14 ? 0.5 : 0.22, { at: t, type: 'square', vol: 0.05, lp: 3200 }); // メロディ
  };

  // 凍結の手前: テープが止まるように、鳴っている音の音程を下げ、刻みの間隔を伸ばし、こもらせる
  M.windDown = dur => {
    const c = Sound.ctx;
    if (!c || M.mode !== 'play') return;
    const now = c.currentTime;
    const end = now + Math.max(0.2, dur);
    M.mode = 'wind';
    M.windT0 = now;
    M.windEnd = end;
    M.stretch = 1;
    for (const v of M.voices) {
      if (v.end < now) continue;
      try {
        const p = v.node.detune || v.node.playbackRate;
        const to = v.node.detune ? -1200 * OCT : Math.pow(2, -OCT);
        p.cancelScheduledValues(now);
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(to, end);
      } catch (_) {
        /* 終わった音は無視 */
      }
    }
    const f = Sound.musicFilter.frequency;
    const g = Sound.musicIn.gain;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(260, end);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.18, end);
    tapeStop(now, end);
  };
  M.onFreeze = () => {
    const c = Sound.ctx;
    if (!c || (M.mode !== 'play' && M.mode !== 'wind')) return;
    const now = c.currentTime;
    const f = Sound.musicFilter.frequency;
    const g = Sound.musicIn.gain;
    f.cancelScheduledValues(now);
    f.setTargetAtTime(380, now, 0.06);
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.5, now, 0.1);
    M.mode = 'heart';
    M.step = 0;
    M.next = now + 0.25; // 心拍は凍結の 0.25 秒後から1秒ごと（画面の脈動と同じ）
  };
  M.onResume = idx => {
    const c = Sound.ctx;
    if (!c) return;
    const now = c.currentTime;
    const f = Sound.musicFilter.frequency;
    const g = Sound.musicIn.gain;
    M.level = Math.min(6, idx + 1);
    M.mode = 'play';
    const r = CONFIG.resume;
    if (idx >= 5) {
      // コアを壊した後: 回り出しではなく、いきなり全開の爆発
      M.spinT0 = M.spinEnd = now;
      f.cancelScheduledValues(now);
      f.setValueAtTime(18000, now);
      g.cancelScheduledValues(now);
      g.setValueAtTime(0.5, now);
      Sound.tone(120, 1.8, { at: now, vol: 0.6, to: 26, glide: 1.4, out: Sound.musicIn, onNode: track }); // 地響きのように沈む低音
      Sound.noise(2.2, { at: now, filter: 'lowpass', freq: 9000, to: 120, vol: 0.4, out: Sound.musicIn, onNode: track }); // 爆風
      [110, 220, 329.63, 440, 659.25].forEach((fq, i) =>
        tone(fq, 2.4, {
          at: now + 0.02,
          type: i ? 'sawtooth' : 'square',
          vol: i ? 0.045 : 0.09,
          attack: 0.005,
          lp: 3600,
          detune: i % 2 ? 7 : -7,
        }),
      ); // 解き放たれた和音
      crash(now + 0.02);
      crash(now + 0.5);
    } else {
      // 凍結明け: 減速の逆（音程・こもり・音量が下から大げさに駆け上がる）
      M.spinT0 = now;
      M.spinEnd = now + r.dur;
      f.cancelScheduledValues(now);
      f.setValueAtTime(150, now);
      f.exponentialRampToValueAtTime(18000, M.spinEnd);
      g.cancelScheduledValues(now);
      g.setValueAtTime(0.15, now);
      g.linearRampToValueAtTime(0.5, M.spinEnd);
      tapeStart(now, M.spinEnd);
    }
    M.step = 0;
    M.bar = 0;
    M.g0 = Game.t;
    M.k = 0;
    Game.audioAt = now; // 動き出した瞬間（区間の頭）を小節の頭にする
    M.next = now + 0.01;
    if (idx >= 5) tone(55, 1.6, { at: M.next, type: 'sawtooth', vol: 0.3, lp: 400 }); // フィナーレの大きな一撃
  };
  M.stinger = () => {
    // パチンコの発射: 派手な和音（Am）と一撃
    const c = Sound.ctx;
    if (!c) return;
    const t = c.currentTime + 0.005;
    [110, 220, 329.63, 440, 523.25, 659.25].forEach((f, i) =>
      Sound.tone(f, 1.3, {
        at: t,
        type: i ? 'sawtooth' : 'square',
        vol: i ? 0.05 : 0.1,
        attack: 0.005,
        lp: 3200,
        detune: i % 2 ? 6 : -6,
        out: Sound.musicIn,
        onNode: track,
      }),
    );
    crash(t);
  };
  M.finale = () => {
    // 「CLEAR」の判で終止和音
    const c = Sound.ctx;
    if (!c) return;
    M.mode = 'off';
    const t = c.currentTime + 0.01;
    [110, 220, 261.63, 329.63, 493.88].forEach((f, i) =>
      tone(f, 2.6, { at: t, type: i ? 'triangle' : 'sawtooth', vol: i ? 0.06 : 0.12, lp: 2400 }),
    );
    crash(t);
  };
  M.toResult = () => {
    const c = Sound.ctx;
    if (!c) return;
    const now = c.currentTime;
    const f = Sound.musicFilter.frequency;
    const g = Sound.musicIn.gain;
    M.mode = 'calm';
    M.step = 0;
    M.bar = 0;
    M.next = now + 1.6; // 終止和音が鳴り終わってから
    f.cancelScheduledValues(now);
    f.setValueAtTime(18000, now);
    g.cancelScheduledValues(now);
    g.setValueAtTime(0.5, now);
  };
  M.stop = () => {
    M.mode = 'off';
  };
  return M;
})();
