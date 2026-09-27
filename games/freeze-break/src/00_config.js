// 設定値。時刻・しきい値・色などの数値はここに集める。
const CONFIG = {
  logical: 1000, // 安全領域の一辺（論理単位）
  maxDpr: 2,
  maxDt: 0.05,
  beat: 0.5, // 1拍の秒数（120BPM）
  windDown: { lead: 0.7, minScale: 0.3 }, // 凍結の手前で時間とBGMが一緒に減速する（何秒前から・最小の時間倍率。早めに深く＝大げさに）

  // 区間。gate は区間の終端（to）で凍結するゲートの id
  timeline: [
    { id: 'T', label: 'TITLE', from: 0.0, to: 0.0, gate: 'g0' },
    { id: 'A', label: '点火', from: 0.0, to: 3.0, gate: 'g1' },
    { id: 'B', label: '飛翔', from: 3.0, to: 6.5, gate: 'g2' },
    { id: 'C', label: '落下', from: 6.5, to: 10.0, gate: 'g3' },
    { id: 'D', label: '衝撃', from: 10.0, to: 13.5, gate: 'g4' },
    { id: 'E', label: '充填', from: 13.5, to: 17.0, gate: 'g5' },
    { id: 'F', label: '解放', from: 17.0, to: 20.0, gate: null },
  ],

  gates: {
    g0: { kind: 'tap', label: '押す', scored: false, par: 0, hitStop: 0.06 },
    g1: { kind: 'pull', label: '引いて放す', scored: true, par: 1.2, hitStop: 0.06, pullMin: 140, pullAngleTol: 60 },
    g2: { kind: 'slide', label: '滑らせる', scored: true, par: 1.2, hitStop: 0.08, slideDone: 0.95 },
    g3: { kind: 'swipe', label: '切る', scored: true, par: 0.9, hitStop: 0.09, swipeSpeed: 1.0 },
    g4: { kind: 'rotate', label: '回す', scored: true, par: 1.8, hitStop: 0.11, rotateDeg: 360 },
    g5: { kind: 'mash', label: '連打', scored: true, par: 1.6, hitStop: 0.15, mashCount: 8, mashDecay: 1.5, charge: 0.9 }, // charge: 越えた後、止まったまま力を溜めてから放つ秒数
  },
  scoredGates: ['g1', 'g2', 'g3', 'g4', 'g5'],

  hitRadiusMin: 90,
  hint: { emphasizeAt: 3, ghostAt: 6 },
  freezeFade: 0.2,
  unfreezeFade: 0.12,
  resume: { from: 0.18, dur: 1.0 }, // 凍結明けは減速の逆: ゆっくりから加速して元の速さへ（テープの回り出し。1秒かけて大げさに）
  rank: { great: 2, good: 4 }, // 基準タイムの何倍まで
  grade: [
    ['S', 1.0],
    ['A', 1.6],
    ['B', 2.5],
    ['C', Infinity],
  ], // 合計 ÷ 基準合計
  autoDelay: 0.3,
  resultInputDelay: 0.6,

  colors: {
    bg: '#0b0c16',
    ink: '#eef0ff',
    dim: '#3a3d55',
    spark: '#ffd23f',
    coral: '#ff5a36',
    cyan: '#2ee6d6',
    magenta: '#ff3cac',
    violet: '#7b61ff',
  },
  stageTint: { T: '#0b0c16', A: '#121329', B: '#0e1828', C: '#1a1024', D: '#1a1410', E: '#0d1b1a', F: '#140f22' },
  rankColor: { PERFECT: '#ffd23f', GREAT: '#2ee6d6', GOOD: '#ff3cac', OK: '#8a8fb0' },
  font: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif',
  displayFont: '"Dela Gothic One", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif', // ロゴ・評価・CLEAR
};
