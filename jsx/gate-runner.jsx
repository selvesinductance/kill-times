import { useState, useEffect, useRef, useMemo } from "react";

// ============================================================
//  🚪 ゲートランナー — 数式ゲートで動物を増やせ！
//  ・数式は全64種類（三角関数・対数・微積分・ビット演算入り）
//  ・|n| が 2³² を超えると「オーバーフロー」→ ブルースクリーン強制終了
//  ・0除算 / 定義域エラー(√負, log負 など)→ トロイの木馬に侵入され強制終了
//  ・毎ステージ、片方のゲートは必ず減少、もう片方は必ず±0か増加
//    （ただし…罠やオーバーフロー餌にすり替わっていることがある）
//  ※ 光過敏対策: 高速な明滅・色反転フラッシュは不使用
// ============================================================

const LIMIT = 4294967296; // 2^32
const STAGE_COUNT = 12;
const START_N = 5;
const ANIMALS = ["🐶","🐱","🐰","🐻","🐼","🐨","🐯","🦊","🐸","🐵","🐔","🐧","🐷","🦁","🐮","🐹"];
const SPEEDS = [
  { key: "slow", label: "ゆったり", time: 10, emoji: "🐢" },
  { key: "normal", label: "ふつう", time: 6, emoji: "🐇" },
  { key: "oni", label: "鬼", time: 3, emoji: "👹" },
];
const D = Math.PI / 180;

// ===== 数学ヘルパー =====
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function fib(k) { let a = 0, b = 1; for (let i = 0; i < k; i++) { [a, b] = [b, a + b]; } return a; }
function revDigits(n) {
  const s = Math.sign(n) || 1;
  return s * Number(String(Math.abs(Math.trunc(n))).split("").reverse().join(""));
}
function digitSum(n) { return String(Math.abs(Math.trunc(n))).split("").reduce((s, c) => s + +c, 0); }
function factorial(n) {
  if (n < 0) return NaN;
  if (n > 20) return Infinity;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

// ===== 64種類のゲート数式 =====
// den: 分母を返す関数（0なら「0除算」でクラッシュ）
const OPS = [
  // --- 四則演算 (14) ---
  { label: "n×2", fn: n => n * 2 },
  { label: "n×3", fn: n => n * 3 },
  { label: "n×10", fn: n => n * 10 },
  { label: "n+7", fn: n => n + 7 },
  { label: "n+100", fn: n => n + 100 },
  { label: "n−8", fn: n => n - 8 },
  { label: "n−100", fn: n => n - 100 },
  { label: "n÷2", fn: n => n / 2 },
  { label: "n÷3", fn: n => n / 3 },
  { label: "n÷10", fn: n => n / 10 },
  { label: "2n−10", fn: n => 2 * n - 10 },
  { label: "100−n", fn: n => 100 - n },
  { label: "(n+20)÷2", fn: n => (n + 20) / 2 },
  { label: "3(n−5)", fn: n => 3 * (n - 5) },
  // --- 累乗・ルート (10) ---
  { label: "n²", fn: n => n * n },
  { label: "n³", fn: n => n * n * n },
  { label: "√n", fn: n => Math.sqrt(n) },
  { label: "∛n", fn: n => Math.cbrt(n) },
  { label: "n√n", fn: n => n * Math.sqrt(n) },
  { label: "2ⁿ", fn: n => Math.pow(2, n) },
  { label: "1.1ⁿ", fn: n => Math.pow(1.1, n) },
  { label: "n⁰", fn: n => Math.pow(n, 0) },
  { label: "√(n−100)", fn: n => Math.sqrt(n - 100) },
  { label: "n!", fn: n => factorial(n) },
  // --- 剰余・割り算トラップ (8) ---
  { label: "n%7", fn: n => n % 7 },
  { label: "n%100", fn: n => n % 100 },
  { label: "n+n%10", fn: n => n + (n % 10) },
  { label: "n×(n%2)", fn: n => n * (n % 2) },
  { label: "n÷(n%5)", fn: n => n / (n % 5), den: n => n % 5 },
  { label: "n÷(n−10)", fn: n => n / (n - 10), den: n => n - 10 },
  { label: "n²÷(n%9)", fn: n => (n * n) / (n % 9), den: n => n % 9 },
  { label: "n÷(n%3+1)", fn: n => n / ((n % 3) + 1), den: n => (n % 3) + 1 },
  // --- 三角関数（度数法）(8) ---
  { label: "n·sin n°", fn: n => n * Math.sin(n * D) },
  { label: "n·cos n°", fn: n => n * Math.cos(n * D) },
  { label: "n+100sin n°", fn: n => n + 100 * Math.sin(n * D) },
  { label: "n·|tan n°|", fn: n => n * Math.abs(Math.tan(n * D)) },
  { label: "n·sin 90°", fn: n => n * Math.sin(90 * D) },
  { label: "n(1+cos180°)", fn: n => n * (1 + Math.cos(180 * D)) },
  { label: "100·atan n", fn: n => 100 * Math.atan(n) },
  { label: "√(n²+n²)", fn: n => Math.hypot(n, n) },
  // --- 対数・指数 (8) ---
  { label: "log₂ n", fn: n => (n > 0 ? Math.log2(n) : NaN) },
  { label: "log₁₀ n", fn: n => (n > 0 ? Math.log10(n) : NaN) },
  { label: "n+ln n", fn: n => (n > 0 ? n + Math.log(n) : NaN) },
  { label: "n·ln n", fn: n => (n > 0 ? n * Math.log(n) : NaN) },
  { label: "n·log₁₀ n", fn: n => (n > 0 ? n * Math.log10(n) : NaN) },
  { label: "100·ln(n−50)", fn: n => (n > 50 ? 100 * Math.log(n - 50) : NaN) },
  { label: "eⁿ", fn: n => Math.exp(n) },
  { label: "n+e²", fn: n => n + Math.E * Math.E },
  // --- 微分・積分 (8) ---
  { label: "d/dn[n²]", fn: n => 2 * n },
  { label: "d/dn[n³]", fn: n => 3 * n * n },
  { label: "d/dn[7n]", fn: () => 7 },
  { label: "d²/dn²[n³]", fn: n => 6 * n },
  { label: "∫₀ⁿ x dx", fn: n => (n * n) / 2 },
  { label: "∫₀ⁿ x² dx", fn: n => (n * n * n) / 3 },
  { label: "∫₀ⁿ dx", fn: n => n },
  { label: "∫₁ⁿ dx/x", fn: n => (n >= 1 ? Math.log(n) : NaN) },
  // --- ビット・数論・その他 (8) ---
  { label: "n⊕255", fn: n => { if (n < 0) return NaN; const low = n % 256; return n - low + (255 - low); } },
  { label: "n≫2", fn: n => n / 4 },
  { label: "rev(n)", fn: n => revDigits(n) },
  { label: "Σ桁(n)", fn: n => digitSum(n) },
  { label: "gcd(n,360)", fn: n => (n === 0 ? 360 : gcd(n, 360)) },
  { label: "fib(n%20)", fn: n => fib(((n % 20) + 20) % 20) },
  { label: "|n−1000|", fn: n => Math.abs(n - 1000) },
  { label: "⌊πn⌋", fn: n => Math.PI * n },
];

// ===== ゲート評価 =====
// {type:"div0"} | {type:"nan"} | {type:"overflow", sign} | {type:"ok", value}
function evalOp(op, n) {
  if (op.den && op.den(n) === 0) return { type: "div0" };
  const r = op.fn(n);
  if (Number.isNaN(r)) return { type: "nan" };
  if (!Number.isFinite(r) || Math.abs(r) >= LIMIT) {
    return { type: "overflow", sign: r > 0 ? 1 : -1 };
  }
  return { type: "ok", value: Math.floor(r) };
}

// ===== ステージのゲートペア生成 =====
// 保証: 片方は必ず「減少」(または罠)、もう片方は必ず「±0か増加」(またはオーバーフロー餌)
function makeGates(n, avoid, stageIdx) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const evals = OPS.filter(op => !avoid.includes(op.label)).map(op => ({ op, res: evalOp(op, n) }));

  // 負のオーバーフローも「確実に減少する」選択肢として扱う（選ぶと爆発エンド）
  const downs = evals.filter(e =>
    (e.res.type === "ok" && e.res.value < n) ||
    (e.res.type === "overflow" && e.res.sign < 0)
  );
  const ups = evals.filter(e =>
    (e.res.type === "ok" && e.res.value >= n) ||
    (e.res.type === "overflow" && e.res.sign > 0)
  );
  const traps = evals.filter(e => e.res.type === "div0" || e.res.type === "nan");

  let down = downs.length ? pick(downs) : { op: { label: "n−10", fn: x => x - 10 }, res: { type: "ok", value: n - 10 } };

  // 増加側: オーバーフロー餌は約25%に抑える（nが大きいと餌だらけになるので）
  const okUps = ups.filter(e => e.res.type === "ok");
  const baitUps = ups.filter(e => e.res.type === "overflow");
  let up;
  if (okUps.length && baitUps.length) up = Math.random() < 0.25 ? pick(baitUps) : pick(okUps);
  else if (ups.length) up = pick(ups);
  else up = { op: { label: "n+10", fn: x => x + 10 }, res: { type: "ok", value: n + 10 } };

  // 「どっちを選んでも即死」は理不尽なので、両方クラッシュ系なら安全な方に差し替える
  if (down.res.type === "overflow" && up.res.type === "overflow") {
    const safeUps = ups.filter(e => e.res.type === "ok");
    if (safeUps.length) up = pick(safeUps);
    else {
      const safeDowns = downs.filter(e => e.res.type === "ok");
      if (safeDowns.length) down = pick(safeDowns);
    }
  }

  // ステージ3以降、たまに「減少側」が罠（0除算・定義域エラー）にすり替わる
  // ただし増加側がオーバーフロー餌のときは罠を入れない（両方即死は理不尽なので）
  const upIsBait = up.res.type === "overflow";
  if (!upIsBait && stageIdx >= 2 && traps.length && Math.random() < 0.3) {
    down = pick(traps);
  }

  return Math.random() < 0.5 ? [down.op, up.op] : [up.op, down.op];
}

// 時間切れのとき「悪い方」を選ぶ（クラッシュ > より小さい値）
function pickWorse(pair, n) {
  const score = op => {
    const r = evalOp(op, n);
    return r.type !== "ok" ? -Infinity : r.value;
  };
  const [a, b] = pair.map(score);
  if (a === b) return pair[Math.random() < 0.5 ? 0 : 1];
  return a < b ? pair[0] : pair[1];
}

// ===== 表示ヘルパー =====
function fmt(n) { return n.toLocaleString("ja-JP"); }
function jpUnit(n) {
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e10 ? 0 : 1) + "億";
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 0 : 1) + "万";
  return null;
}
function rankOf(n) {
  if (n >= 100000000) return ["🌌", "宇宙級レジェンド"];
  if (n >= 1000000) return ["👑", "ミリオン王"];
  if (n >= 100000) return ["💎", "ダイヤモンド"];
  if (n >= 10000) return ["🥇", "ゴールド"];
  if (n >= 1000) return ["🥈", "シルバー"];
  if (n >= 100) return ["🥉", "ブロンズ"];
  if (n >= 0) return ["🌱", "みならい飼育員"];
  return ["👻", "反転世界の住人"];
}

// 0除算クラッシュで画面に湧く文字（🐴多め＝トロイの木馬）
const GLITCH_POOL = "🐴🐴🐴🐴🐴🎠▓░÷0?！🐴🐴ヒヒーン🐴";
const TITLE_TEXT = "ゲートランナー";
const TITLE_COLORS = ["#ff5d8f", "#ff9f1c", "#ffd23f", "#4cd964", "#37b6ff", "#a06bff", "#ff7b54"];

// ===== 称号コレクション（全7種） =====
const TITLES = [
  { id: "overflow", icon: "🖥️", name: "限界突破エンジニア", hint: "2³² の壁を突破してみよう" },
  { id: "div0",     icon: "🐴", name: "宇宙を割った者",     hint: "0 で割ってみよう" },
  { id: "domain",   icon: "🌀", name: "虚数世界の迷子",     hint: "√ や log に入れちゃダメな数を…" },
  { id: "negative", icon: "👻", name: "反物質ブリーダー",   hint: "マイナスの数でクリアしよう" },
  { id: "zero",     icon: "🕳️", name: "虚無の飼育員",       hint: "ぴったり 0 匹でクリアしよう" },
  { id: "one",      icon: "🐺", name: "一匹狼マスター",     hint: "ぴったり 1 匹でクリアしよう" },
  { id: "giant",    icon: "🌌", name: "int32を超えし者",    hint: "2³¹（約21.5億）以上でクリアしよう" },
];
const HALF_LIMIT = 2147483648; // 2^31

// ===== どうぶつグリッド =====
function AnimalGrid({ count, animal }) {
  const abs = Math.abs(count);
  const neg = count < 0;
  const display = Math.min(abs, 120);
  const size = abs > 60 ? 15 : abs > 30 ? 21 : 27;
  return (
    <div style={{ position: "relative", padding: 6, maxWidth: 360, margin: "0 auto" }}>
      {neg && (
        <div style={{ textAlign: "center", fontSize: 13, color: "#c62828", fontWeight: 700, marginBottom: 4 }}>
          👻 マイナス{fmt(abs)}匹（反転世界！）
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, filter: neg ? "hue-rotate(180deg)" : "none", opacity: neg ? 0.8 : 1 }}>
        {Array.from({ length: display }, (_, i) => (
          <span key={i} style={{ fontSize: size, lineHeight: 1, animation: `pop 0.3s ease ${Math.min(i * 0.012, 1.2)}s both`, transform: neg ? "scaleX(-1)" : "none" }}>
            {animal}
          </span>
        ))}
        {display === 0 && <span style={{ fontSize: 32, opacity: 0.4 }}>🕳️</span>}
      </div>
      {abs > 120 && (
        <div style={{ fontSize: 12, color: "#888", textAlign: "center", marginTop: 4 }}>
          …ほか {fmt(abs - 120)} 匹{jpUnit(abs) ? `（全部で約${jpUnit(abs)}匹）` : ""}
        </div>
      )}
    </div>
  );
}

// ===== 履歴 =====
function HistoryList({ history }) {
  if (!history.length) return null;
  return (
    <div style={{ margin: "16px auto 0", maxWidth: 340, textAlign: "left", background: "rgba(0,0,0,0.05)", borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#777", marginBottom: 6 }}>ログ</div>
      {history.map((h, i) => (
        <div key={i} style={{ fontSize: 12.5, padding: "3px 0", display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "ui-monospace, Menlo, monospace" }}>
          <span style={{
            color: h.crash === "overflow" ? "#e65100" : h.crash ? "#ad1457" : h.next >= h.prev ? "#2e7d32" : "#c62828",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {h.stage}. {fmt(h.prev)} → {h.label} → {h.crash === "overflow" ? "💥OVERFLOW" : h.crash ? "🌀ERROR" : fmt(h.next)}
          </span>
          {h.timeout && <span style={{ color: "#c62828", fontSize: 11, flexShrink: 0 }}>⏰</span>}
        </div>
      ))}
    </div>
  );
}

// ===== 称号コレクション表示 =====
// earned: 獲得済みID配列 / justEarned: 今回のプレイで獲得したID配列 / dark: 暗い背景用
function TitleCollection({ earned, justEarned, dark }) {
  return (
    <div style={{
      margin: "14px auto 0", maxWidth: 350, textAlign: "left", borderRadius: 12, padding: "12px 14px",
      background: dark ? "rgba(255,255,255,0.10)" : "rgba(123,31,162,0.07)",
      border: dark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(123,31,162,0.18)",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: dark ? "#fff" : "#6a1b9a", marginBottom: 8 }}>
        🏅 称号コレクション <span style={{ fontFamily: "ui-monospace, monospace" }}>{earned.length}/{TITLES.length}</span>
        {earned.length === TITLES.length && " 🎊コンプリート！"}
      </div>
      {TITLES.map(t => {
        const got = earned.includes(t.id);
        const isNew = justEarned.includes(t.id);
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", fontSize: 12.5,
            borderRadius: 8, background: isNew ? (dark ? "rgba(255,213,79,0.22)" : "rgba(255,213,79,0.4)") : "none",
          }}>
            <span style={{ fontSize: 16, filter: got ? "none" : "grayscale(1)", opacity: got ? 1 : 0.45 }}>
              {got ? t.icon : "🔒"}
            </span>
            {got ? (
              <span style={{ fontWeight: 700, color: dark ? "#fff" : "#333" }}>
                {t.name}
                {isNew && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 900, color: "#e65100", background: "#ffd54f", borderRadius: 6, padding: "1px 6px" }}>NEW!</span>}
              </span>
            ) : (
              <span style={{ color: dark ? "rgba(255,255,255,0.55)" : "#999" }}>？？？ <span style={{ fontSize: 11 }}>（{t.hint}）</span></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("start"); // start|play|feedback|timeout|result|overflow|zerodiv
  const [count, setCount] = useState(START_N);
  const [stage, setStage] = useState(0);
  const [pair, setPair] = useState(null);
  const [animal, setAnimal] = useState("🐶");
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [speed, setSpeed] = useState(SPEEDS[1]);
  const [timeLeft, setTimeLeft] = useState(SPEEDS[1].time);
  const [crash, setCrash] = useState(null);
  const [crashReady, setCrashReady] = useState(false);
  const [spinner, setSpinner] = useState("4294967296");
  const [best, setBest] = useState(null); // セッション内ベスト（artifactではlocalStorage不可のためメモリ保持）
  const [earnedTitles, setEarnedTitles] = useState([]); // 獲得済み称号ID（セッション内）

  const tickRef = useRef(null);
  const fbRef = useRef(null);
  const runEarnedRef = useRef([]); // 今回のプレイで獲得した称号ID
  const countRef = useRef(START_N);
  const stageRef = useRef(0);
  const historyRef = useRef([]);
  const pairRef = useRef(null);
  const phaseRef = useRef("start");
  phaseRef.current = phase;

  // ---- タイマー ----
  useEffect(() => {
    if (phase !== "play") return;
    clearInterval(tickRef.current);
    setTimeLeft(speed.time);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) {
          clearInterval(tickRef.current);
          setPhase(p => (p === "play" ? "timeout" : p));
          return 0;
        }
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(tickRef.current);
  }, [phase, stage, speed]);

  // ---- 時間切れ → 悪い方を自動選択 ----
  useEffect(() => {
    if (phase !== "timeout" || !pairRef.current) return;
    doChoose(pickWorse(pairRef.current, countRef.current), true);
  }, [phase]);

  // ---- クラッシュ演出タイマー ----
  useEffect(() => {
    if (phase !== "overflow" && phase !== "zerodiv") return;
    setCrashReady(false);
    const t = setTimeout(() => setCrashReady(true), 2100);
    return () => clearTimeout(t);
  }, [phase]);

  // ---- オーバーフローの数字スロット演出 ----
  useEffect(() => {
    if (phase !== "overflow" || crashReady) return;
    const iv = setInterval(() => {
      let s = "";
      for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10);
      setSpinner(s);
    }, 85);
    return () => clearInterval(iv);
  }, [phase, crashReady]);

  // ---- 0除算のグリッチ文字 ----
  const glitchChars = useMemo(() => {
    if (phase !== "zerodiv") return [];
    const pool = Array.from(GLITCH_POOL); // 絵文字(サロゲートペア)対応
    return Array.from({ length: 30 }, () => ({
      ch: pool[Math.floor(Math.random() * pool.length)],
      x: Math.random() * 90, y: Math.random() * 88,
      d: Math.random() * 1.4, s: 16 + Math.random() * 26, r: Math.random() * 60 - 30,
    }));
  }, [phase]);

  // 称号を獲得（今回分の記録＋コレクションに追加）
  const earnTitle = id => {
    if (!runEarnedRef.current.includes(id)) runEarnedRef.current = [...runEarnedRef.current, id];
    setEarnedTitles(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const nextStage = (nextCount, nextStageIdx, avoid) => {
    if (nextStageIdx >= STAGE_COUNT) {
      // 特殊クリア称号の判定
      if (nextCount < 0) earnTitle("negative");
      if (nextCount === 0) earnTitle("zero");
      if (nextCount === 1) earnTitle("one");
      if (nextCount >= HALF_LIMIT) earnTitle("giant");
      setBest(b => (b === null || nextCount > b ? nextCount : b));
      setPhase("result");
      return;
    }
    const np = makeGates(nextCount, avoid, nextStageIdx);
    setPair(np); pairRef.current = np;
    setStage(nextStageIdx); stageRef.current = nextStageIdx;
    setPhase("play");
  };

  const doChoose = (op, viaTimeout) => {
    clearInterval(tickRef.current);
    const prev = countRef.current;
    const res = evalOp(op, prev);

    if (res.type === "div0" || res.type === "nan") {
      earnTitle(res.type === "div0" ? "div0" : "domain");
      const h = [...historyRef.current, { stage: stageRef.current + 1, label: op.label, prev, crash: "zero", timeout: viaTimeout }];
      historyRef.current = h; setHistory(h);
      setCrash({ kind: res.type, label: op.label, prev });
      setPhase("zerodiv");
      return;
    }
    if (res.type === "overflow") {
      earnTitle("overflow");
      const h = [...historyRef.current, { stage: stageRef.current + 1, label: op.label, prev, crash: "overflow", timeout: viaTimeout }];
      historyRef.current = h; setHistory(h);
      setCrash({ kind: "overflow", label: op.label, prev, sign: res.sign });
      setPhase("overflow");
      return;
    }

    const next = res.value;
    const h = [...historyRef.current, { stage: stageRef.current + 1, label: op.label, prev, next, timeout: viaTimeout }];
    countRef.current = next; historyRef.current = h;
    setCount(next); setHistory(h);
    setFeedback({ diff: next - prev, label: op.label, prev, next });
    setPhase("feedback");
    clearTimeout(fbRef.current);
    fbRef.current = setTimeout(() => {
      setFeedback(null);
      nextStage(next, stageRef.current + 1, [op.label, ...pairRef.current.map(p => p.label)]);
    }, 1000);
  };

  const choose = op => { if (phaseRef.current === "play") doChoose(op, false); };

  const startGame = () => {
    clearInterval(tickRef.current); clearTimeout(fbRef.current);
    runEarnedRef.current = [];
    setAnimal(ANIMALS[Math.floor(Math.random() * ANIMALS.length)]);
    setCount(START_N); countRef.current = START_N;
    setStage(0); stageRef.current = 0;
    setHistory([]); historyRef.current = [];
    setFeedback(null); setCrash(null); setCrashReady(false);
    const p = makeGates(START_N, [], 0);
    setPair(p); pairRef.current = p;
    setTimeLeft(speed.time);
    setPhase("play");
  };

  // タイトル画面へ戻る（難易度を選び直せる）
  const goHome = () => {
    clearInterval(tickRef.current); clearTimeout(fbRef.current);
    setCount(START_N); countRef.current = START_N;
    setStage(0); stageRef.current = 0;
    setHistory([]); historyRef.current = [];
    setPair(null); pairRef.current = null;
    setFeedback(null); setCrash(null); setCrashReady(false);
    setPhase("start");
  };

  const isGood = feedback && feedback.diff >= 0;
  const barPct = (timeLeft / speed.time) * 100;
  const barColor = timeLeft <= speed.time * 0.25 ? "#c62828" : timeLeft <= speed.time * 0.5 ? "#ef6c00" : "#7b1fa2";
  const crashing = (phase === "overflow" || phase === "zerodiv") && !crashReady;
  const unit = jpUnit(count);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "system-ui, sans-serif", padding: "16px 12px 32px",
      background: phase === "zerodiv" && crashReady
        ? "#1b1b22"
        : phase === "overflow" && crashReady
          ? "#0067b8"
          : "linear-gradient(180deg, #f3e5f5 0%, #fff 100%)",
      transition: "background 0.6s",
      animation: crashing ? "bigshake 0.25s linear infinite" : "none",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=M+PLUS+Rounded+1c:wght@800&display=swap');
        @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        /* 揺れは残すが振幅を小さく・ゆっくりに（光の明滅は一切なし） */
        @keyframes bigshake {
          0% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-4px,2px) rotate(-0.3deg); }
          50% { transform: translate(3px,-3px) rotate(0.25deg); } 75% { transform: translate(-2px,-2px) rotate(-0.2deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        /* ゆっくりした揺らぎ（旧グリッチの代替。色の点滅なし） */
        @keyframes wobble {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          25% { transform: translate(-2px,1px) rotate(-1.2deg); }
          50% { transform: translate(2px,-1px) rotate(1deg); }
          75% { transform: translate(-1px,-1px) rotate(-0.8deg); }
        }
        /* 穏やかな呼吸（不透明度は 0.75〜1 の範囲・2秒周期） */
        @keyframes breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.75; } }
        @keyframes floatchar {
          from { opacity: 0; transform: scale(0.3) rotate(0deg); }
          30% { opacity: 1; }
          to { opacity: 0.2; transform: scale(1.5) rotate(18deg); }
        }
        /* トロイの木馬が左からトコトコ入ってくる */
        @keyframes trot {
          from { transform: translateX(-46vw) rotate(0deg); }
          40% { transform: translateX(-24vw) rotate(-4deg); }
          70% { transform: translateX(-8vw) rotate(4deg); }
          to { transform: translateX(0) rotate(0deg); }
        }
        /* 異常事態の赤フレーム: 2秒周期でゆっくり脈動（点滅ではない） */
        @keyframes framepulse {
          0%,100% { opacity: 0.65; box-shadow: inset 0 0 26px rgba(211,47,47,0.35); }
          50% { opacity: 1; box-shadow: inset 0 0 52px rgba(211,47,47,0.55); }
        }
        button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-iteration-count: 1 !important; animation-duration: 0.01s !important; transition: none !important; }
        }
      `}</style>

      {/* ==== 異常事態の赤フレーム（両バグ演出共通・ゆっくり脈動のみ） ==== */}
      {crashing && (
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 49, boxSizing: "border-box",
          border: "10px solid #d32f2f", borderRadius: 4,
          animation: "framepulse 2s ease-in-out infinite",
        }} />
      )}

      {/* ==== クラッシュ用オーバーレイ（点滅なし・一回きりのフェード出現のみ） ==== */}
      {crashing && phase === "zerodiv" && (
        <>
          {glitchChars.map((g, i) => (
            <span key={i} style={{
              position: "fixed", left: `${g.x}%`, top: `${g.y}%`, fontSize: g.s, zIndex: 51,
              color: "#8d6e63", fontWeight: 900,
              transform: `rotate(${g.r}deg)`, pointerEvents: "none",
              animation: `floatchar 1.4s ease ${g.d}s both`, fontFamily: "ui-monospace, monospace",
            }}>{g.ch}</span>
          ))}
        </>
      )}

      <h1 style={{
        margin: "0 0 8px", fontSize: 27, letterSpacing: 1, fontWeight: 800,
        fontFamily: "'Mochiy Pop One', 'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'ヒラギノ丸ゴ ProN W4', 'HG丸ｺﾞｼｯｸM-PRO', sans-serif",
        userSelect: "none",
      }}>
        <span style={{ marginRight: 4 }}>🚪</span>
        {TITLE_TEXT.split("").map((c, i) => (
          <span key={i} style={{
            color: TITLE_COLORS[i % TITLE_COLORS.length],
            display: "inline-block",
            transform: `rotate(${i % 2 ? 3.5 : -3.5}deg) translateY(${i % 2 ? 1.5 : -1.5}px)`,
            textShadow: "0 2px 0 rgba(0,0,0,0.15), 0 0 6px rgba(255,255,255,0.6)",
          }}>{c}</span>
        ))}
      </h1>

      {/* ================= スタート ================= */}
      {phase === "start" && (
        <div style={{ textAlign: "center", marginTop: 18, animation: "slideUp 0.4s ease", maxWidth: 380 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🐶🐱🐰🐻🐼</div>
          <p style={{ fontSize: 14.5, color: "#444", lineHeight: 1.8, margin: "0 0 10px" }}>
            数式ゲートを選んで動物を増やそう！<br />
            全{STAGE_COUNT}ステージ・数式は<b>64種類</b>（三角関数・log・微積分も！）
          </p>
          <div style={{ textAlign: "left", background: "#fff", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#555", lineHeight: 1.9, boxShadow: "0 2px 10px rgba(123,31,162,0.12)" }}>
            <div>🚪 毎回、片方は<b style={{ color: "#2e7d32" }}>必ず±0か増加</b>、もう片方は<b style={{ color: "#c62828" }}>必ず減少</b>。どっちがどっちかは計算で見抜け！</div>
            <div>💥 <b style={{ color: "#e65100" }}>n が 2³² (約43億) を超える</b>とオーバーフローで強制終了</div>
            <div>🌀 <b style={{ color: "#ad1457" }}>0除算・√(負の数)・log(負の数)</b> はバグって強制終了</div>
            <div>⏰ 時間切れは<b>悪い方</b>が自動で選ばれる</div>
          </div>
          <div style={{ margin: "16px 0 6px", fontSize: 13, color: "#777", fontWeight: 700 }}>制限時間</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            {SPEEDS.map(s => (
              <button key={s.key} onClick={() => setSpeed(s)} style={{
                fontSize: 14, padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700,
                border: speed.key === s.key ? "3px solid #7b1fa2" : "3px solid #ddd",
                background: speed.key === s.key ? "#f3e5f5" : "#fff", color: "#333",
              }}>
                {s.emoji} {s.label}<br /><span style={{ fontSize: 12, color: "#7b1fa2" }}>{s.time}秒</span>
              </button>
            ))}
          </div>
          {(best !== null || earnedTitles.length > 0) && (
            <div style={{ fontSize: 13, color: "#7b1fa2", fontWeight: 700, marginBottom: 10 }}>
              {best !== null && <>🏆 セッションベスト: {fmt(best)} 匹　</>}
              🏅 称号: {earnedTitles.length}/{TITLES.length}
            </div>
          )}
          <button onClick={startGame} style={{ fontSize: 20, padding: "14px 52px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#7b1fa2,#9c27b0)", color: "#fff", cursor: "pointer", fontWeight: 800, boxShadow: "0 4px 14px rgba(123,31,162,0.4)" }}>
            スタート！
          </button>
        </div>
      )}

      {/* ================= プレイ中 ================= */}
      {(phase === "play" || phase === "feedback" || phase === "timeout") && pair && (
        <div style={{ width: "100%", maxWidth: 400, animation: "slideUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "6px 0 4px", padding: "0 4px" }}>
            <span style={{ fontSize: 13, color: "#777" }}>ステージ {stage + 1}/{STAGE_COUNT}</span>
            <span style={{ fontSize: 12, color: "#bbb", fontFamily: "ui-monospace, monospace" }}>MAX 2³²</span>
          </div>

          {/* n 表示 */}
          <div style={{ textAlign: "center", background: "#fff", borderRadius: 14, padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", fontVariantNumeric: "tabular-nums", color: count < 0 ? "#c62828" : "#333" }}>
              {animal} n = {fmt(count)}
            </span>
            {unit && <span style={{ fontSize: 13, color: "#9c27b0", fontWeight: 700, marginLeft: 8 }}>≈{unit}匹</span>}
          </div>

          {/* タイマー */}
          <div style={{ width: "100%", height: 8, background: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: 8, borderRadius: 4, background: barColor, width: `${barPct}%`, transition: "width 0.1s linear, background 0.3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 2, marginTop: 8, marginRight: 10 }}>
              <div style={{ height: 4, background: "#7b1fa2", borderRadius: 2, width: `${(stage / STAGE_COUNT) * 100}%`, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: barColor, fontFamily: "ui-monospace, monospace" }}>{timeLeft.toFixed(1)}s</span>
          </div>

          <AnimalGrid count={count} animal={animal} />

          {feedback && (
            <div style={{
              textAlign: "center", margin: "10px 0", fontSize: 20, fontWeight: 800,
              color: isGood ? "#2e7d32" : "#c62828", fontFamily: "ui-monospace, Menlo, monospace",
              animation: isGood ? "pulse 0.5s ease" : "shake 0.4s ease", wordBreak: "break-all",
            }}>
              {fmt(feedback.prev)} → {feedback.label} → {fmt(feedback.next)} {isGood ? "🎉" : "💀"}
            </div>
          )}

          {phase === "play" && (
            <>
              <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                {pair.map((g, i) => (
                  <button key={i} onClick={() => choose(g)} style={{
                    flex: 1, fontWeight: 800, padding: "26px 6px", borderRadius: 20,
                    fontSize: g.label.length > 9 ? 17 : g.label.length > 6 ? 20 : 24,
                    border: "3px solid #ce93d8", background: "#fff", color: "#4a148c",
                    cursor: "pointer", transition: "transform 0.1s", lineHeight: 1.3,
                    fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "keep-all",
                    boxShadow: "0 3px 10px rgba(123,31,162,0.15)",
                  }}
                    onPointerDown={e => (e.currentTarget.style.transform = "scale(0.93)")}
                    onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
                    onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: 11.5, color: "#aaa", marginTop: 10 }}>
                片方は必ず⬆(±0含む)、片方は必ず⬇ …でも罠かも？
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= オーバーフロー演出（点滅なし） ================= */}
      {phase === "overflow" && !crashReady && (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <div style={{ fontSize: 15, color: "#c62828", fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>
            {fmt(crash.prev)} → {crash.label} → ⚠️
          </div>
          <div style={{
            fontSize: 42, fontWeight: 900, color: "#e65100", margin: "16px 0",
            fontFamily: "ui-monospace, Menlo, monospace", fontVariantNumeric: "tabular-nums",
            animation: "wobble 0.9s ease-in-out infinite",
          }}>
            {spinner}
          </div>
          <div style={{ fontSize: 58, animation: "pulse 0.9s ease infinite" }}>💥</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 14, fontFamily: "ui-monospace, monospace" }}>
            メモリ限界を突破しています…
          </div>
        </div>
      )}

      {/* ================= オーバーフロー結果（ブルースクリーン風） ================= */}
      {phase === "overflow" && crashReady && (
        <div style={{ marginTop: 10, animation: "slideUp 0.5s ease", color: "#fff", maxWidth: 400, width: "100%" }}>
          <div style={{ textAlign: "left", padding: "18px 8px 6px", fontFamily: "'Segoe UI', 'Hiragino Sans', system-ui, sans-serif" }}>
            <div style={{ fontSize: 76, lineHeight: 1, fontWeight: 300 }}>:(</div>
            <p style={{ fontSize: 15, lineHeight: 1.9, margin: "18px 0 10px" }}>
              この牧場は問題が発生したため、再起動が必要となりました。<br />
              動物データを回収しています…
            </p>
            <div style={{ fontSize: 22, fontWeight: 600, margin: "6px 0 16px" }}>100% 完了</div>
            <div style={{ fontSize: 12, lineHeight: 1.9, color: "#cfe6ff", fontFamily: "ui-monospace, Menlo, monospace", background: "rgba(0,0,0,0.14)", borderRadius: 8, padding: "10px 12px" }}>
              停止コード: <b>INTEGER_OVERFLOW_2_32</b><br />
              失敗した処理: {fmt(crash.prev)} → {crash.label}<br />
              |n| が 4,294,967,296 (2³²) を超えました{crash.sign < 0 ? "（マイナス方向）" : ""}。<br />
              🐾 動物たちはビットの彼方へ消えました。
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 10, padding: "6px 16px", fontSize: 13, color: "#fff", fontWeight: 700, margin: "10px 0 0" }}>
              🏅 称号「限界突破エンジニア」を獲得
            </div>
            <div style={{ fontSize: 12.5, color: "#cfe6ff", marginTop: 6 }}>ステージ {history.length}/{STAGE_COUNT} でクラッシュ</div>
            <HistoryList history={history} />
            <TitleCollection earned={earnedTitles} justEarned={runEarnedRef.current} dark />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <button onClick={startGame} style={{ fontSize: 16, padding: "12px 30px", borderRadius: 14, border: "none", background: "#fff", color: "#0067b8", cursor: "pointer", fontWeight: 800 }}>
                もう一回！
              </button>
              <button onClick={goHome} style={{ fontSize: 16, padding: "12px 24px", borderRadius: 14, border: "2px solid rgba(255,255,255,0.7)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                🏠 ホームへ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 0除算/定義域エラー演出（トロイの木馬・点滅なし） ================= */}
      {phase === "zerodiv" && !crashReady && (
        <div style={{ textAlign: "center", marginTop: 56, width: "100%", overflow: "hidden" }}>
          <div style={{
            fontSize: 32, fontWeight: 900, fontFamily: "ui-monospace, Menlo, monospace",
            color: "#ad1457", animation: "wobble 0.8s ease-in-out infinite", wordBreak: "break-all",
          }}>
            {crash.kind === "div0" ? `${fmt(crash.prev)} ÷ 0 = ？？` : `${crash.label} … ？？`}
          </div>
          <div style={{ fontSize: 15, color: "#8d6e63", fontWeight: 800, margin: "20px 0 4px" }}>
            計算の穴から、なにかが侵入…！
          </div>
          <div style={{ fontSize: 64, animation: "trot 1.6s ease-out both" }}>🐴</div>
        </div>
      )}

      {/* ================= 0除算/定義域エラー結果（トロイの木馬検出アラート） ================= */}
      {phase === "zerodiv" && crashReady && (
        <div style={{ marginTop: 12, animation: "slideUp 0.4s ease", maxWidth: 390, width: "100%" }}>
          <div style={{
            background: "#f7f8fb", borderRadius: 12, overflow: "hidden", textAlign: "left",
            boxShadow: "0 10px 34px rgba(0,0,0,0.55)", color: "#2b2b2b",
            fontFamily: "'Segoe UI', 'Hiragino Sans', system-ui, sans-serif",
          }}>
            {/* ウィンドウのタイトルバー */}
            <div style={{ background: "#b23b3b", color: "#fff", padding: "9px 14px", fontWeight: 800, fontSize: 13.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚠️ セキュリティ警告 — どうぶつ防衛システム</span>
              <span style={{ opacity: 0.8, fontWeight: 400 }}>✕</span>
            </div>
            <div style={{ padding: "14px 16px", fontSize: 13.5, lineHeight: 1.9 }}>
              <div style={{ textAlign: "center", fontSize: 46, margin: "2px 0 6px", animation: "breathe 2s ease-in-out infinite" }}>🐴</div>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, color: "#b23b3b", marginBottom: 8 }}>
                トロイの木馬を検出しました！
              </div>
              <div style={{ background: "#fff", border: "1px solid #e0e0e6", borderRadius: 8, padding: "8px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>
                脅威名: <b style={{ color: "#b23b3b" }}>{crash.kind === "div0" ? "Trojan.DivideByZero" : "Trojan.MathDomain"}</b><br />
                侵入経路: {fmt(crash.prev)} → {crash.label}
              </div>
              <p style={{ margin: "10px 0 4px" }}>
                {crash.kind === "div0"
                  ? "0で割ってできた「穴」から木馬が侵入。動物たちはぜんぶ木馬にすり替えられました…"
                  : "√ や log に入れてはいけない数のスキマから木馬が侵入。動物たちは連れ去られました…"}
              </p>
              <div style={{ textAlign: "center", fontSize: 22, letterSpacing: 2 }}>🐴🐴🐴🐴🐴</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-block", background: "rgba(178,59,59,0.15)", border: "1px solid #d98080", borderRadius: 10, padding: "6px 16px", fontSize: 13, color: "#ffb3b3", fontWeight: 700, margin: "12px 0 0" }}>
              🏅 称号「{crash.kind === "div0" ? "宇宙を割った者" : "虚数世界の迷子"}」を獲得
            </div>
            <div style={{ fontSize: 12.5, color: "#aaa", marginTop: 6 }}>ステージ {history.length}/{STAGE_COUNT} でクラッシュ</div>
            <div style={{ color: "#ccc" }}><HistoryList history={history} /></div>
            <TitleCollection earned={earnedTitles} justEarned={runEarnedRef.current} dark />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <button onClick={startGame} style={{ fontSize: 16, padding: "12px 30px", borderRadius: 14, border: "none", background: "#b23b3b", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                駆除して再挑戦！
              </button>
              <button onClick={goHome} style={{ fontSize: 16, padding: "12px 24px", borderRadius: 14, border: "2px solid #888", background: "transparent", color: "#ddd", cursor: "pointer", fontWeight: 800 }}>
                🏠 ホームへ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= クリア結果 ================= */}
      {phase === "result" && (() => {
        const [medal, title] = rankOf(count);
        return (
          <div style={{ textAlign: "center", marginTop: 14, animation: "slideUp 0.4s ease", maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 46 }}>🎊</div>
            <h3 style={{ margin: "0 0 2px", fontSize: 21 }}>全ステージクリア！</h3>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#7b1fa2", margin: "6px 0 0", fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" }}>
              {animal} × {fmt(count)}
            </p>
            {unit && <div style={{ fontSize: 15, color: "#9c27b0", fontWeight: 700 }}>（約{unit}匹！）</div>}
            <div style={{ display: "inline-block", background: "#f3e5f5", border: "2px solid #ce93d8", borderRadius: 12, padding: "6px 18px", fontSize: 15, fontWeight: 800, color: "#6a1b9a", margin: "10px 0 4px" }}>
              {medal} ランク: {title}
            </div>
            {/* 特殊クリアで獲得した称号 */}
            {TITLES.filter(t => runEarnedRef.current.includes(t.id)).map(t => (
              <div key={t.id} style={{ margin: "4px 0" }}>
                <span style={{ display: "inline-block", background: "#fff8e1", border: "2px solid #ffd54f", borderRadius: 12, padding: "5px 16px", fontSize: 14, fontWeight: 800, color: "#e65100", animation: "pop 0.5s ease" }}>
                  {t.icon} 称号「{t.name}」を獲得！
                </span>
              </div>
            ))}
            {best !== null && (
              <div style={{ fontSize: 13, color: count >= best ? "#e65100" : "#999", fontWeight: 700 }}>
                {count >= best ? "🏆 セッションベスト更新！" : `セッションベスト: ${fmt(best)} 匹`}
              </div>
            )}
            <AnimalGrid count={count} animal={animal} />
            <HistoryList history={history} />
            <TitleCollection earned={earnedTitles} justEarned={runEarnedRef.current} dark={false} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
              <button onClick={startGame} style={{ fontSize: 17, padding: "12px 34px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7b1fa2,#9c27b0)", color: "#fff", cursor: "pointer", fontWeight: 800, boxShadow: "0 4px 14px rgba(123,31,162,0.4)" }}>
                もう一回！
              </button>
              <button onClick={goHome} style={{ fontSize: 17, padding: "12px 24px", borderRadius: 14, border: "3px solid #ce93d8", background: "#fff", color: "#6a1b9a", cursor: "pointer", fontWeight: 800 }}>
                🏠 ホームへ
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
