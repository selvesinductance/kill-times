const L = require('./src/logic.js');
const T = L.TYPES;
let fail = 0;
function eq(label, got, want) {
  const ser = (x) => JSON.stringify(x, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  const g = ser(got);
  const w = ser(want);
  if (g !== w) { fail++; console.log('NG', label, 'got', g, 'want', w); }
}
const A = (id, n, p = {}) => T[id].apply(BigInt(n), p);

eq('types', L.TYPE_LIST.length, 40);
eq('rarity sizes', L.BY_RARITY.map((g) => g.length), [4, 7, 13, 11, 4, 1]);
eq('mod', A('mod', 100, { m: '90' }), 10n);
eq('mod neg', A('mod', -1, { m: '90' }), 89n);
eq('mod0', A('mod', 5, { m: '0' }), 'BH');
// スケッチの上レーン
function chain(n, ops) { n = BigInt(n); for (const [id, p] of ops) n = T[id].apply(n, p); return n; }
const sketch = [['mul', { u: '9', d: '10' }], ['div', { u: '8', d: '10' }], ['comb', { s: -1, p: 12, q: 2 }], ['add', { a: 20 }], ['mod', { m: '90' }]];
eq('sketch40', chain(40, sketch), 89n);
eq('sketch50', chain(50, sketch), 10n);
eq('sqrt+ pos', A('sqrtConst', 5, { s: 1, a: 2 }), 6n);
eq('sqrt+ neg', A('sqrtConst', -5, { s: 1, a: 2 }), -3n);
eq('sqrt- pos', A('sqrtConst', 5, { s: -1, a: 2 }), 3n);
eq('sqrt- neg', A('sqrtConst', -5, { s: -1, a: 2 }), -6n);
eq('sqrt+ square', A('sqrtConst', 3, { s: 1, a: 144 }), 15n);
eq('sqrt- edge', A('sqrtConst', 1, { s: -1, a: 2 }), 0n);
eq('mulsqrt', A('sqrtMul', 100, { op: '×', a: 2 }), 141n);
eq('divsqrt', A('sqrtMul', 100, { op: '÷', a: 2 }), 70n);
eq('divsqrt neg', A('sqrtMul', -100, { op: '÷', a: 2 }), -70n);
eq('pi', A('pi', 30), 94n);
eq('pi2', A('pi2', 30), 296n);
eq('piE', A('piE', 30), 673n);
eq('e', A('e', 30), 81n);
eq('e2', A('e2', 30), 221n);
eq('ePi', A('ePi', 30), 694n);
eq('eIPi', A('eIPi', 30), -30n);
eq('zeta120', A('zeta', 120), -10n);
eq('zeta100', A('zeta', 100), -8n);
eq('zeta-100', A('zeta', -100), 8n);
eq('log2_8', A('log', 100, { p: '2', q: 8 }), 300n);
eq('log3_16', A('log', 100, { p: '3', q: 16 }), 252n);
eq('log10_16', A('log', 100, { p: '10', q: 16 }), 120n);
eq('ln16', A('log', 100, { p: 'e', q: 16 }), 277n);
eq('log1', A('log', 100, { p: 'e', q: 1 }), 0n);
eq('log0', A('log', 100, { p: 'e', q: 0 }), 'BH');
eq('nC2', A('nC2', 10), 45n);
eq('nC2 neg', A('nC2', -5), 15n);
eq('nC2 1', A('nC2', 1), 0n);
eq('sigmaN', A('sigmaN', 10), 55n);
eq('sigmaN neg', A('sigmaN', -5), 10n);
eq('gcd', A('gcd', 84, { a: 60 }), 12n);
eq('gcd neg', A('gcd', -84, { a: 60 }), 12n);
eq('gcd 0', A('gcd', 0, { a: 60 }), 60n);
eq('lcm', A('lcm', 18, { a: 12 }), 36n);
eq('lcm2', A('lcm', 35, { a: 12 }), 420n);
eq('append', A('append', -12, { a: 7 }), -113n);
eq('pctNeg', A('pctNeg', 30, { p: 50 }), -15n);
eq('pctPos', A('pctPos', 25, { p: 150 }), 37n);
eq('frac', A('frac', 100, { u: '25', d: '9' }), 277n);
eq('fact0', A('fact', 10, { s: 1, N: 0 }), 11n);
eq('perm', A('perm', 30, { s: -1, p: 5, q: 2 }), 10n);
eq('sigmaConst', A('sigmaConst', 0, { s: 1, N: 10 }), 55n);
eq('pow2 div', A('pow2', 25, { op: '÷', N: 3 }), 3n);
eq('pow2 div neg', A('pow2', -25, { op: '÷', N: 3 }), -3n);
eq('div 0.8', A('div', 25, { u: '8', d: '10' }), 31n);
eq('div 0.8 neg', A('div', -25, { u: '8', d: '10' }), -31n);
eq('mul 0.85', A('mul', 100, { u: '85', d: '100' }), 85n);
eq('sqrtN', A('sqrtN', 50), 7n);
eq('sqrtN neg', A('sqrtN', -4), 'BUG');
eq('nd2 out', T.nd2.outcomes(100n), [100n, 200n]);
eq('halfnd3 out', T.halfnd3.outcomes(101n), [50n, 150n]);
eq('halfnd3 out neg', T.halfnd3.outcomes(-100n), [-50n, -150n]);
eq('halfnd3 out 1', T.halfnd3.outcomes(1n), [0n]);
// コインの範囲
const rng = L.mulberry32(7);
for (const n of [1n, 7n, 100n, -100n, 5000n, -12345678901234567890n]) {
  for (let i = 0; i < 20; i++) {
    const v = T.nd2.roll(n, {}, rng);
    const lo = n < 0n ? 2n * n : n, hi = n < 0n ? n : 2n * n;
    if (v < lo || v > hi) { fail++; console.log('NG coin range', n, v); }
    const w = T.halfnd3.roll(n, {}, rng);
    const k = L.absB(n) / 2n, s = n < 0n ? -1n : 1n;
    const lo2 = n < 0n ? s * 3n * k : k, hi2 = n < 0n ? s * k : 3n * k;
    if (w < lo2 || w > hi2) { fail++; console.log('NG half d3 range', n, w); }
  }
}
// (n/2)d3 の平均は、ほぼ n（少ないときは実際に振る、多いときは正規分布）
for (const n of [200n, 100000n]) {
  let tot = 0;
  for (let i = 0; i < 400; i++) tot += Number(T.halfnd3.roll(n, {}, rng));
  const avg = tot / 400 / Number(n);
  if (Math.abs(avg - 1) > 0.03) { fail++; console.log('NG half d3 mean', n, avg); }
}
// 表示
eq('fmt1', L.fmtJa(1234567890n), '12億3456万7890');
eq('fmt2', L.fmtJa(10000n), '1万');
eq('fmt3', L.fmtJa(100000005n), '1億5');
eq('fmt4', L.fmtJa(-5n), '−5');
eq('fmt5', L.fmtJa(10000n * 10000n * 10000n + 1n), '1兆1');

// 生成：保証どおりか
const t0 = Date.now();
let stages = 0, rev = 0, three = 0, attempts = 0, maxAtt = 0, mineRoutes = 0;
const rarityCount = [0, 0, 0, 0, 0, 0];
for (const [t, diff] of [[0, 'n'], [1 / 7, 'n'], [3 / 7, 'n'], [5 / 7, 'n'], [1, 'n'], [1, 'nocommon']]) {
  for (let i = 0; i < 120; i++) {
    const r = L.mulberry32(1000 + i + Math.round(t * 1e4));
    const st = L.generateStage({ t, difficulty: diff === 'nocommon' ? 'nocommon' : undefined, rng: r });
    stages++; attempts += st.attempts; maxAtt = Math.max(maxAtt, st.attempts);
    if (st.reverse) rev++;
    if (st.layout.L === 3) three++;
    for (const g of st.gates) rarityCount[T[g.type].rarity]++;
    if (t === 0 && st.n0 !== 5n) { fail++; console.log('NG n0 early', st.n0); }
    // 2レーンに地雷がないこと
    st.outcomes.forEach((list, ri) => { if (list.some(L.isMine)) { mineRoutes++; if (st.layout.L === 2) { fail++; console.log('NG mine in 2 lanes'); } } });
    // 実際に何度も走らせて勝敗を確かめる
    for (let ri = 0; ri < st.layout.routes.length; ri++) {
      for (let k = 0; k < 15; k++) {
        const res = L.runRoute(st, ri, L.mulberry32(k * 31 + ri));
        const f = res.final;
        const win = !L.isMine(f) && (st.reverse ? -f >= st.hp : f >= st.hp);
        if ((ri === st.correct) !== win) { fail++; console.log('NG judge', { t, ri, correct: st.correct, f: String(f), hp: String(st.hp), rev: st.reverse }); break; }
        if (ri === st.correct && k === 0 && !st.gates.some((g) => T[g.type].random)) {
          // 確定ルートはHPとぴったり
          if (f !== (st.reverse ? -st.hp : st.hp)) { fail++; console.log('NG exact hp'); }
        }
      }
    }
  }
}
console.log('stages', stages, 'reverse', rev, '3lanes', three, 'avg attempts', (attempts / stages).toFixed(1), 'max', maxAtt, 'mineRoutes', mineRoutes, 'ms', Date.now() - t0);

// 仕掛けごと
for (const mech of L.MECHANICS) {
  const t1 = Date.now();
  let n = 0, att = 0, fell = 0, routesTotal = 0;
  for (let i = 0; i < 80; i++) {
    const t = [0, 0.5, 1][i % 3];
    const st = L.generateStage({ t, mechanic: mech, rng: L.mulberry32(5000 + i) });
    n++; att += st.attempts; if (st.layout.kind !== mech) fell++;
    routesTotal += st.layout.routes.length;
    const lay = st.layout;
    // 踊り場の前にランダムがないこと
    lay.slots.forEach((s) => { if (s.beforePlaza && T[st.gates[s.id].type].random) { fail++; console.log('NG random before plaza'); } });
    lay.slots.forEach((s) => { if (s.noExplosive && T[st.gates[s.id].type].explosive) { fail++; console.log('NG explosive on loop'); } });
    // 2レーン区間に地雷がないこと
    for (let ri = 0; ri < lay.routes.length; ri++) {
      for (const sid of lay.routes[ri].seq) {
        const g = st.gates[sid];
        if (!lay.slots[sid].mineOK && g.type === 'log' && g.p.q === 0) { fail++; console.log('NG log0 in safe slot'); }
      }
      for (let k = 0; k < 10; k++) {
        const res = L.runRoute(st, ri, L.mulberry32(k * 7 + ri));
        const f = res.final;
        const win = !L.isMine(f) && (st.reverse ? -f >= st.hp : f >= st.hp);
        if ((ri === st.correct) !== win) { fail++; console.log('NG judge', mech, ri, st.correct, String(f), String(st.hp)); break; }
        if (L.isMine(f)) {
          const sid = res.steps[res.steps.length - 1].sid;
          if (!lay.slots[sid].mineOK) { fail++; console.log('NG mine in safe slot', mech); }
        }
      }
    }
    if (mech === 'loop') { const r = lay.routes[lay.side]; if (r.seq.length !== 6) { fail++; console.log('NG loop len'); } }
    if (mech === 'plaza' && lay.routes.length !== lay.L1 * lay.L2) { fail++; console.log('NG plaza routes'); }
  }
  console.log(mech, 'stages', n, 'avg attempts', (att / n).toFixed(1), 'fell back', fell, 'avg routes', (routesTotal / n).toFixed(1), 'ms', Date.now() - t1);
}
console.log('rarity counts', rarityCount);
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
