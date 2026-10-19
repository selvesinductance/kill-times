// ===== 五門の兵 : ゲームロジック（DOM に依存しない） =====
(function (root) {
  'use strict';

  // ---------- 乱数 ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // 整数 [lo,hi]
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function randBig(rng, lo, hi) { // BigInt [lo,hi]
    if (hi < lo) return lo;
    const span = hi - lo + 1n;
    if (span <= 9007199254740991n) return lo + BigInt(Math.floor(rng() * Number(span)));
    const bits = span.toString(2).length + 16;
    let r = 0n;
    for (let i = 0; i < bits; i += 30) r = (r << 30n) | BigInt(Math.floor(rng() * 1073741824));
    return lo + (r % span);
  }
  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- BigInt の道具 ----------
  const absB = (n) => (n < 0n ? -n : n);
  const sgnB = (n) => (n < 0n ? -1n : n > 0n ? 1n : 0n);
  function isqrt(n) {
    if (n < 0n) throw new Error('isqrt of negative');
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) {
      const y = (x + n / x) >> 1n;
      if (y >= x) return x;
      x = y;
    }
  }
  function gcdB(a, b) { a = absB(a); b = absB(b); while (b) { [a, b] = [b, a % b]; } return a; }
  const modB = (n, m) => ((n % m) + m) % m; // 結果は 0〜m−1
  const ceilDiv = (a, b) => (a + b - 1n) / b; // a,b ≧ 0
  const MINE_BH = 'BH', MINE_BUG = 'BUG';
  const isMine = (v) => typeof v === 'string';

  // ---------- 高精度の定数（小数点以下60桁） ----------
  const SCALE = 10n ** 60n;
  function C60(str) {
    const [i, f] = str.split('.');
    return BigInt(i + (f + '0'.repeat(60)).slice(0, 60));
  }
  const K = {
    PI: C60('3.141592653589793238462643383279502884197169399375105820974944592307816'),
    PI2: C60('9.869604401089358618834490999876151135313699407240790626413349376220045'),
    PIE: C60('22.45915771836104547342715220454373502758931513399669224920300255406693'),
    E: C60('2.718281828459045235360287471352662497757247093699959574966967627724077'),
    E2: C60('7.389056098930650227230427460575007813180315570551847324087127822522574'),
    EPI: C60('23.14069263277926900572908636794854738026610624260021199344504640952434'),
  };
  const LOGK = {
    '3_2': C60('0.6309297535714574370995271143427608542995856401318804278706549438386852'),
    '3_4': C60('1.261859507142914874199054228685521708599171280263760855741309887677370'),
    '3_8': C60('1.892789260714372311298581343028282562898756920395641283611964831516056'),
    '3_16': C60('2.523719014285829748398108457371043417198342560527521711482619775354741'),
    '10_2': C60('0.3010299956639811952137388947244930267681898814621085413104274611271082'),
    '10_4': C60('0.6020599913279623904274777894489860535363797629242170826208549222542164'),
    '10_8': C60('0.9030899869919435856412166841734790803045696443863256239312823833813246'),
    '10_16': C60('1.204119982655924780854955578897972107072759525848434165241709844508433'),
    'e_2': C60('0.6931471805599453094172321214581765680755001343602552541206800094933936'),
    'e_4': C60('1.386294361119890618834464242916353136151000268720510508241360018986787'),
    'e_8': C60('2.079441541679835928251696364374529704226500403080765762362040028480181'),
    'e_16': C60('2.772588722239781237668928485832706272302000537441021016482720037973574'),
  };
  const mulK = (n, k) => (n * k) / SCALE; // 0方向に切り捨て
  const mulR = (n, num, den) => (n * num) / den; // den > 0、0方向に切り捨て

  // ---------- ±√a・×√a・÷√a を正確に ----------
  function addSqrt(n, a, s) { // n + s√a を0方向に切り捨て
    const A = BigInt(a), r = isqrt(A);
    if (r * r === A) return n + BigInt(s) * r;
    if (s > 0) return n >= -r ? n + r : n + r + 1n;
    return n >= r + 1n ? n - r - 1n : n - r;
  }
  function mulSqrt(n, a) { const A = BigInt(a); return sgnB(n) * isqrt(n * n * A); }
  function divSqrt(n, a) { const A = BigInt(a); return sgnB(n) * isqrt((n * n) / A); }

  const factI = (k) => { let r = 1n; for (let i = 2n; i <= BigInt(k); i++) r *= i; return r; };
  const combI = (p, q) => factI(p) / (factI(q) * factI(p - q));
  const permI = (p, q) => factI(p) / factI(p - q);

  // ---------- 表示用の小数 ----------
  function decStr(num, den) { // 例：85/100 → "0.85"
    let s = (Number(num) / Number(den)).toFixed(2);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  const MUL_LIST = [];
  for (let k = 50; k <= 100; k += 5) MUL_LIST.push([BigInt(k), 100n]);
  for (let k = 11; k <= 50; k++) MUL_LIST.push([BigInt(k), 10n]);
  const DIV_LIST = [];
  for (let k = 2; k <= 10; k++) DIV_LIST.push([BigInt(k), 10n]);
  for (let k = 3; k <= 20; k++) DIV_LIST.push([BigInt(k), 2n]);
  for (let k = 20; k <= 100; k += 10) DIV_LIST.push([BigInt(k), 1n]);
  const FRAC_LIST = [[25n, 9n], [13n, 4n], [4n, 3n], [2n, 3n], [1n, 3n], [3n, 4n], [1n, 4n]];
  const GCD_LIST = [12, 24, 36, 48, 60, 72, 120, 360];
  const DICE_LIST = [4, 6, 8, 12, 20, 100];
  const SIGN = (s) => (s > 0 ? '+' : '−');

  // ---------- 全40種のゲート ----------
  // rarity: 0 コモン 1 アンコモン 2 レア 3 エピック 4 レジェンド 5 ミシック
  // cat: add 加減 / muldiv 乗除 / sign 符号 / pow 冪・組合せ / mod 剰余・比較 / rand ランダム / const 諸定数
  const N = { it: 'n' };
  const T = [];
  function def(o) { T.push(o); return o; }

  def({ id: 'add', name: '足し算', rarity: 0, cat: 'add', note: '広告ゲームそのもの',
    gen: (c) => ({ a: ri(c.rng, 0, 100) }), label: (p) => ['+' + p.a], apply: (n, p) => n + BigInt(p.a) });
  def({ id: 'sub', name: '引き算', rarity: 0, cat: 'add', note: '広告ゲームそのもの',
    gen: (c) => ({ a: ri(c.rng, 0, 100) }), label: (p) => ['−' + p.a], apply: (n, p) => n - BigInt(p.a) });
  def({ id: 'mul', name: '掛け算', rarity: 0, cat: 'muldiv', note: '×0.9 のような1未満を掛けると減る',
    gen: (c) => { const [u, d] = pick(c.rng, MUL_LIST); return { u: u.toString(), d: d.toString() }; },
    label: (p) => ['×' + decStr(p.u, p.d)], apply: (n, p) => mulR(n, BigInt(p.u), BigInt(p.d)) });
  def({ id: 'div', name: '割り算', rarity: 0, cat: 'muldiv', note: '÷0.8 のように1未満で割ると増える',
    gen: (c) => { const [u, d] = pick(c.rng, DIV_LIST); return { u: u.toString(), d: d.toString() }; },
    label: (p) => ['÷' + decStr(p.u, p.d)], apply: (n, p) => mulR(n, BigInt(p.d), BigInt(p.u)) });

  def({ id: 'neg', name: '符号反転', rarity: 1, cat: 'sign', note: '看板ゲート。2回通ると元に戻る',
    gen: () => ({}), label: () => ['×(−1)'], apply: (n) => -n });
  def({ id: 'abs', name: '絶対値', rarity: 1, cat: 'sign', nonMono: true, note: 'マイナスからの完全救済',
    gen: () => ({}), label: () => ['|', N, '|'], apply: (n) => absB(n) });
  def({ id: 'append', name: '末尾に数字', rarity: 1, cat: 'mod', note: '数字を後ろにくっつける感覚。マイナスだと数式どおりの値になる',
    gen: (c) => ({ a: ri(c.rng, 0, 9) }), label: (p) => ['10', N, '+' + p.a], apply: (n, p) => 10n * n + BigInt(p.a) });
  def({ id: 'dice', name: 'サイコロ', rarity: 1, cat: 'rand', random: 'dice', note: '最悪の目でも勝てるかを考える',
    gen: (c) => ({ s: c.rng() < 0.5 ? 1 : -1, N: pick(c.rng, DICE_LIST) }),
    label: (p) => [SIGN(p.s) + '1d' + p.N],
    outcomes: (n, p) => { const o = []; for (let k = 1; k <= p.N; k++) o.push(n + BigInt(p.s * k)); return o; },
    roll: (n, p, rng) => n + BigInt(p.s * ri(rng, 1, p.N)) });
  def({ id: 'pctPos', name: '百分率', rarity: 1, cat: 'const', note: '×100% は何も起きない',
    gen: (c) => ({ p: ri(c.rng, 50, 500) }), label: (p) => ['×' + p.p + '%'], apply: (n, p) => mulR(n, BigInt(p.p), 100n) });
  def({ id: 'frac', name: '分数', rarity: 1, cat: 'const', note: '小数に直すひと手間',
    gen: (c) => { const [u, d] = pick(c.rng, FRAC_LIST); return { u: u.toString(), d: d.toString() }; },
    label: (p) => ['×', { frac: [p.u, p.d] }], apply: (n, p) => mulR(n, BigInt(p.u), BigInt(p.d)) });
  def({ id: 'pow2', name: '2の累乗', rarity: 1, cat: 'const', note: '2⁰ = 1 の罠もある',
    gen: (c) => (c.rng() < 0.5 ? { op: c.rng() < 0.5 ? '+' : '−', N: ri(c.rng, 0, 10) } : { op: c.rng() < 0.5 ? '×' : '÷', N: ri(c.rng, 0, 3) }),
    label: (p) => [p.op + '2', { sup: String(p.N) }],
    apply: (n, p) => constOp(n, p.op, 2n ** BigInt(p.N)) });

  def({ id: 'negAbs', name: 'マイナス絶対値', rarity: 2, cat: 'sign', nonMono: true, note: 'プラスでも必ずマイナスに落ちる。反転ボス向け',
    gen: () => ({}), label: () => ['−|', N, '|'], apply: (n) => -absB(n) });
  def({ id: 'sq', name: '二乗', rarity: 2, cat: 'pow', explosive: true, nonMono: true, note: '爆発力は大きい。マイナスもプラスに戻る',
    gen: () => ({}), label: () => [N, { sup: '2' }], apply: (n) => n * n });
  def({ id: 'mod', name: '剰余', rarity: 2, cat: 'mod', nonMono: true, note: 'マイナスでも 0〜m−1 に収まる。どん底からの大逆転',
    gen: (c) => { const S = c.S; let m = randBig(c.rng, ceilDiv(S, 4n), (S * 3n) / 5n); if (m < 1n && !c.mineOK) m = 1n; return { m: m.toString() }; },
    label: (p) => ['mod ' + p.m], apply: (n, p) => { const m = BigInt(p.m); return m === 0n ? MINE_BH : modB(n, m); } });
  def({ id: 'min', name: '上限', rarity: 2, cat: 'mod', note: '「定員」。超えた分はいなくなる',
    gen: (c) => ({ a: randBig(c.rng, ceilDiv(c.S, 4n), c.S).toString() }),
    label: (p) => ['min(', N, ', ' + p.a + ')'], apply: (n, p) => { const a = BigInt(p.a); return n < a ? n : a; } });
  def({ id: 'max', name: '下限', rarity: 2, cat: 'mod', note: '「最低保証」。マイナスからの救済にもなる',
    gen: (c) => ({ a: randBig(c.rng, ceilDiv(c.S, 4n), c.S).toString() }),
    label: (p) => ['max(', N, ', ' + p.a + ')'], apply: (n, p) => { const a = BigInt(p.a); return n > a ? n : a; } });
  def({ id: 'gcd', name: '最大公約数', rarity: 2, cat: 'mod', nonMono: true, note: '結果は必ず a の約数。0人なら a 人になる',
    gen: (c) => ({ a: pick(c.rng, GCD_LIST) }), label: (p) => ['gcd(', N, ', ' + p.a + ')'], apply: (n, p) => gcdB(n, BigInt(p.a)) });
  def({ id: 'nd2', name: '全員コイン', rarity: 2, cat: 'rand', random: 'nd2', note: '全員がコイン（1か2）を振る。兵士の数がマイナスのとき、出目の分だけマイナスの兵士が増える。',
    gen: () => ({}), label: () => [N, 'd2'],
    outcomes: (n) => (n === 0n ? [0n] : [n, 2n * n]), roll: (n, p, rng) => coins(n, absB(n), rng) });
  def({ id: 'sqrtConst', name: '平方根（定数）', rarity: 2, cat: 'const', note: '平方数なら簡単、それ以外は近似が要る',
    gen: (c) => ({ s: c.rng() < 0.5 ? 1 : -1, a: ri(c.rng, 1, 144) }),
    label: (p) => [SIGN(p.s) + '√' + p.a], apply: (n, p) => addSqrt(n, p.a, p.s) });
  def({ id: 'pow3', name: '3の累乗', rarity: 2, cat: 'const', note: '3の累乗は2ほど馴染みがない',
    gen: (c) => (c.rng() < 0.5 ? { op: c.rng() < 0.5 ? '+' : '−', N: ri(c.rng, 0, 6) } : { op: c.rng() < 0.5 ? '×' : '÷', N: ri(c.rng, 0, 2) }),
    label: (p) => [p.op + '3', { sup: String(p.N) }], apply: (n, p) => constOp(n, p.op, 3n ** BigInt(p.N)) });
  def({ id: 'fact', name: '階乗', rarity: 2, cat: 'const', note: '0! = 1（0 ではない罠）',
    gen: (c) => ({ s: c.rng() < 0.5 ? 1 : -1, N: ri(c.rng, 0, 6) }),
    label: (p) => [SIGN(p.s) + p.N + '!'], apply: (n, p) => n + BigInt(p.s) * factI(p.N) });
  def({ id: 'pctNeg', name: 'マイナスの百分率', rarity: 2, cat: 'const', note: '×(−1) に見えない符号反転',
    gen: (c) => ({ p: ri(c.rng, 50, 200) }), label: (p) => ['×(−' + p.p + '%)'], apply: (n, p) => mulR(n, -BigInt(p.p), 100n) });
  def({ id: 'pi', name: '円周率', rarity: 2, cat: 'const', note: '3.14 は誰でも知っている',
    gen: () => ({}), label: () => ['×π'], apply: (n) => mulK(n, K.PI) });
  def({ id: 'pi2', name: 'πの二乗', rarity: 2, cat: 'const', note: '約9.87。「π² はほぼ10」で見積もれる',
    gen: () => ({}), label: () => ['×π', { sup: '2' }], apply: (n) => mulK(n, K.PI2) });

  def({ id: 'nC2', name: '握手', rarity: 3, cat: 'pow', explosive: true, nonMono: true, note: '全員が握手した回数。0人・1人だと全滅',
    gen: () => ({}), label: () => [{ sub: 'n', it: true }, 'C', { sub: '2' }], apply: (n) => (n * (n - 1n)) / 2n });
  def({ id: 'sigmaN', name: '総和（兵士数まで）', rarity: 3, cat: 'pow', explosive: true, nonMono: true, note: '1からnまで全部足す。実際はn(n+1)/2を計算する。',
    gen: () => ({}), label: () => ['Σ', { stack: ['n', 'k=1'] }, { it: 'k' }], apply: (n) => (n * (n + 1n)) / 2n });
  def({ id: 'sqrtN', name: '平方根（兵士数）', rarity: 3, cat: 'pow', nonMono: true, note: '大きいほど大きく縮む。マイナスだと虚数',
    gen: () => ({}), label: () => ['√', N], apply: (n) => (n < 0n ? MINE_BUG : isqrt(n)) });
  def({ id: 'lcm', name: '最小公倍数', rarity: 3, cat: 'mod', nonMono: true, note: '約数の持ち方で倍率が決まる、謎の掛け算',
    gen: (c) => ({ a: ri(c.rng, 2, 12) }), label: (p) => ['lcm(', N, ', ' + p.a + ')'],
    apply: (n, p) => { if (n === 0n) return 0n; const a = BigInt(p.a); return (absB(n) * a) / gcdB(n, a); } });
  def({ id: 'halfnd3', name: '半分ダイス', rarity: 3, cat: 'rand', random: 'nd2', note: '半分の兵士が3面ダイス（1～3）を振る。兵士の数がマイナスのとき、出目の分だけマイナスの兵士が増える。',
    gen: () => ({}), label: () => ['(', N, '/2)d3'],
    outcomes: (n) => { const k = absB(n) / 2n; const s = sgnB(n); return k === 0n ? [0n] : [s * k, s * 3n * k]; },
    roll: (n, p, rng) => diceSum(n, absB(n) / 2n, 3, rng) });
  def({ id: 'comb', name: '組合せ', rarity: 3, cat: 'const', note: '₁₂C₂ = 66 のような組合せの計算',
    gen: (c) => { const p = ri(c.rng, 1, 12); return { s: c.rng() < 0.5 ? 1 : -1, p, q: ri(c.rng, 1, p) }; },
    label: (p) => [SIGN(p.s), { sub: String(p.p) }, 'C', { sub: String(p.q) }], apply: (n, p) => n + BigInt(p.s) * combI(p.p, p.q) });
  def({ id: 'perm', name: '順列', rarity: 3, cat: 'const', note: '₅P₂ = 20 のような順列の計算',
    gen: (c) => { const p = ri(c.rng, 1, 6); return { s: c.rng() < 0.5 ? 1 : -1, p, q: ri(c.rng, 1, p) }; },
    label: (p) => [SIGN(p.s), { sub: String(p.p) }, 'P', { sub: String(p.q) }], apply: (n, p) => n + BigInt(p.s) * permI(p.p, p.q) });
  def({ id: 'sigmaConst', name: '総和（定数）', rarity: 3, cat: 'const', note: 'Σ の読み解き',
    gen: (c) => ({ s: c.rng() < 0.5 ? 1 : -1, N: ri(c.rng, 5, 20) }),
    label: (p) => [SIGN(p.s) + 'Σ', { stack: [String(p.N), 'k=1'] }, { it: 'k' }], apply: (n, p) => n + BigInt(p.s * (p.N * (p.N + 1)) / 2) });
  def({ id: 'sqrtMul', name: '平方根の掛け算・割り算', rarity: 3, cat: 'const', note: '無理数を掛ける・割るので近似が要る',
    gen: (c) => ({ op: c.rng() < 0.5 ? '×' : '÷', a: ri(c.rng, 1, 36) }),
    label: (p) => [p.op + '√' + p.a], apply: (n, p) => (p.op === '×' ? mulSqrt(n, p.a) : divSqrt(n, p.a)) });
  def({ id: 'e', name: 'ネイピア数', rarity: 3, cat: 'const', note: 'π ほど知られていない。約2.72',
    gen: () => ({}), label: () => ['×', { it: 'e' }], apply: (n) => mulK(n, K.E) });
  def({ id: 'e2', name: 'eの二乗', rarity: 3, cat: 'const', note: '約7.39。e を知っていれば二乗で見積もれる',
    gen: () => ({}), label: () => ['×', { it: 'e' }, { sup: '2' }], apply: (n) => mulK(n, K.E2) });

  def({ id: 'log', name: '対数', rarity: 4, cat: 'const', note: 'q=1 で全滅、q=0 は地雷',
    gen: (c) => { const qs = c.mineOK ? [0, 1, 2, 4, 8, 16] : [1, 2, 4, 8, 16]; return { p: pick(c.rng, ['2', '3', '10', 'e']), q: pick(c.rng, qs) }; },
    label: (p) => ['×log', { sub: p.p, it: p.p === 'e' }, String(p.q)],
    apply: (n, p) => {
      if (p.q === 0) return MINE_BH;
      if (p.q === 1) return 0n;
      if (p.p === '2') return n * BigInt(Math.round(Math.log2(p.q)));
      return mulK(n, LOGK[p.p + '_' + p.q]);
    } });
  def({ id: 'piE', name: 'πのe乗', rarity: 4, cat: 'const', note: '約22.46。e^π と並ぶとどちらが大きいか悩む',
    gen: () => ({}), label: () => ['×π', { sup: 'e', it: true }], apply: (n) => mulK(n, K.PIE) });
  def({ id: 'ePi', name: 'eのπ乗', rarity: 4, cat: 'const', note: '約23.14',
    gen: () => ({}), label: () => ['×', { it: 'e' }, { sup: 'π' }], apply: (n) => mulK(n, K.EPI) });
  def({ id: 'eIPi', name: 'オイラーの等式', rarity: 4, cat: 'const', note: 'e^(iπ) = −1。虚数が見えるが地雷ではない',
    gen: () => ({}), label: () => ['×', { it: 'e' }, { sup: 'iπ', it: true }], apply: (n) => -n });

  def({ id: 'zeta', name: 'ラマヌジャンの −1/12', rarity: 5, cat: 'const', note: 'ζ(−1) = −1/12。符号が反転しつつ12分の1に縮む',
    gen: () => ({}), label: () => ['×ζ(−1)'], apply: (n) => mulR(n, -1n, 12n) });

  function constOp(n, op, v) {
    if (op === '+') return n + v;
    if (op === '−') return n - v;
    if (op === '×') return n * v;
    return n / v; // ÷（0方向に切り捨て）
  }
  // k 人が 1〜f の目のダイスを振った合計。符号は n に合わせる（f = 2 ならコイン）
  function diceSum(n, k, f, rng) {
    const s = sgnB(n), F = BigInt(f);
    if (k === 0n) return 0n;
    let sum;
    if (k <= 3000n) {
      sum = 0n;
      for (let i = 0n; i < k; i++) sum += BigInt(1 + Math.floor(rng() * f));
    } else {
      // 多いときは正規分布で近似：平均 k(f+1)/2、標準偏差 √(k(f²−1)/12)
      const mean2 = k * (F + 1n); // 平均の2倍
      const sd = isqrt((k * (F * F - 1n)) / 12n);
      const g = BigInt(Math.round(gauss(rng) * 1e6));
      sum = mean2 / 2n + (sd * g) / 1000000n;
      if (sum < k) sum = k;
      if (sum > F * k) sum = F * k;
    }
    return s * sum;
  }
  const coins = (n, k, rng) => diceSum(n, k, 2, rng);

  const TYPES = Object.fromEntries(T.map((t) => [t.id, t]));
  const RARITY_NAMES = ['コモン', 'アンコモン', 'レア', 'エピック', 'レジェンド', 'ミシック'];
  const CATS = {
    add: { name: '加減', material: '木の門' },
    muldiv: { name: '乗除', material: '青銅の歯車の門' },
    sign: { name: '符号', material: '鏡の門' },
    pow: { name: '冪・組合せ', material: '水晶の門' },
    mod: { name: '剰余・比較', material: '鉄格子の門' },
    rand: { name: 'ランダム', material: '象牙の陶器の門' },
    const: { name: '諸定数', material: '大理石の石碑' },
  };
  const BY_RARITY = [0, 1, 2, 3, 4, 5].map((r) => T.filter((t) => t.rarity === r));
  const P0 = [73.89, 20, 5, 1, 0.1, 0.01];

  function rarityWeights(t, difficulty) {
    const total = T.length;
    const P1 = BY_RARITY.map((g) => (g.length / total) * 100);
    if (difficulty === 'nocommon') {
      const rest = total - BY_RARITY[0].length;
      return BY_RARITY.map((g, i) => (i === 0 ? 0 : (g.length / rest) * 100));
    }
    return P0.map((p, i) => (1 - t) * p + t * P1[i]);
  }
  function pickRarity(rng, w) {
    const sum = w.reduce((a, b) => a + b, 0);
    let x = rng() * sum;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
    return w.length - 1;
  }

  // ---------- 進行 ----------
  const progressOf = (stageNo) => Math.min(1, (stageNo - 1) / 7);
  function n0Range(t) { return [Math.round(5 - 4 * t), Math.round(5 + 495 * t)]; }
  const threeLaneProb = (t) => 0.7 * t;

  // ---------- 経路の計算 ----------
  function stepOutcomes(list, type, p) { // 検証用：取りうる値を全部（nd2 系は両端だけ）
    const out = new Map();
    for (const v of list) {
      if (isMine(v)) { out.set(v, v); continue; }
      const vs = type.outcomes ? type.outcomes(v, p) : [type.apply(v, p)];
      for (const w of vs) out.set(isMine(w) ? w : w.toString(), w);
    }
    return [...out.values()];
  }
  function summarize(list) {
    const vals = list.filter((v) => !isMine(v));
    const mines = list.filter(isMine);
    let mn = null, mx = null;
    for (const v of vals) { if (mn === null || v < mn) mn = v; if (mx === null || v > mx) mx = v; }
    return { min: mn, max: mx, mines: [...new Set(mines)], allMine: vals.length === 0 };
  }

  // ---------- コースの形（仕掛けなし：まっすぐ） ----------
  // slot: { id, lane, pos, section, laneCount }
  // route: { name, seq: [slotId, ...] }
  // 真上から見ると兵士は右から左へ進むので、レーンは上・中・下で呼ぶ（index 0 が下）
  const LANE_NAMES = { 1: ['中'], 2: ['下', '上'], 3: ['下', '中', '上'] };
  function mkSlot(slots, o) { const id = slots.length; slots.push(Object.assign({ id, mineOK: false, beforePlaza: false, noExplosive: false }, o)); return id; }
  function layoutStraight(L) {
    const slots = [], routes = [];
    for (let l = 0; l < L; l++) {
      const seq = [];
      for (let p = 0; p < 5; p++) seq.push(mkSlot(slots, { sec: 'A', lane: l, pos: p, laneCount: L, mineOK: L === 3 }));
      routes.push({ name: LANE_NAMES[L][l], lanes: [l], seq });
    }
    return { kind: 'straight', L, slots, routes };
  }
  // 立体交差：c 枚目の手前で、レーン a と b のルートが入れ替わる（a 側が陸橋を渡る）
  function layoutCross(L, rng) {
    const pairs = L === 2 ? [[0, 1]] : [[0, 1], [1, 2], [0, 2]];
    let [a, b] = pick(rng, pairs);
    if (rng() < 0.5) [a, b] = [b, a];
    const c = ri(rng, 1, 4);
    const lay = layoutStraight(L);
    const grid = (l, p) => lay.slots.find((s) => s.lane === l && s.pos === p).id;
    lay.routes = [];
    for (let l = 0; l < L; l++) {
      const to = l === a ? b : l === b ? a : l;
      const seq = [];
      for (let p = 0; p < 5; p++) seq.push(grid(p < c ? l : to, p));
      lay.routes.push({ name: LANE_NAMES[L][l], lanes: [l, to], seq });
    }
    return Object.assign(lay, { kind: 'cross', a, b, c, over: a });
  }
  // 合流：k 枚目のあとで全レーンが1本にまとまり、残りを共通で通る
  function layoutMerge(L, rng) {
    const k = ri(rng, 1, 4);
    const slots = [], routes = [];
    const shared = [];
    const lanesSeq = [];
    for (let l = 0; l < L; l++) { const seq = []; for (let p = 0; p < k; p++) seq.push(mkSlot(slots, { sec: 'A', lane: l, pos: p, laneCount: L, mineOK: L === 3 })); lanesSeq.push(seq); }
    for (let p = k; p < 5; p++) shared.push(mkSlot(slots, { sec: 'M', lane: 0, pos: p, laneCount: 1, mineOK: false }));
    for (let l = 0; l < L; l++) routes.push({ name: LANE_NAMES[L][l], lanes: [l], seq: lanesSeq[l].concat(shared) });
    return { kind: 'merge', L, k, slots, routes };
  }
  // アンコール（ぐるりと回る道）：外側のレーンの p 枚目を2回くぐる
  function layoutLoop(L, rng) {
    const lay = layoutStraight(L);
    const side = rng() < 0.5 ? 0 : L - 1;
    const p = ri(rng, 0, 4);
    const r = lay.routes[side];
    const sid = r.seq[p];
    lay.slots[sid].noExplosive = true;
    r.seq = r.seq.slice(0, p + 1).concat([sid], r.seq.slice(p + 1));
    return Object.assign(lay, { kind: 'loop', side, p });
  }
  // U字路：行きの列に k 枚、奥で折り返して帰りの列に 5−k 枚。ボスは手前にいる
  function layoutU(L, rng) {
    const k = ri(rng, 1, 4);
    const slots = [], routes = [];
    const names = ['外回り', '内回り'];
    for (let r = 0; r < 2; r++) {
      const seq = [];
      for (let p = 0; p < k; p++) seq.push(mkSlot(slots, { sec: 'O', lane: r, pos: p, laneCount: 2 }));
      for (let q = 0; q < 5 - k; q++) seq.push(mkSlot(slots, { sec: 'R', lane: r, pos: q, laneCount: 2 }));
      routes.push({ name: names[r], lanes: [r], seq });
    }
    return { kind: 'u', L: 2, k, slots, routes };
  }
  // 中州（はじめは広場→踊り場）：前半 L1 レーンに k 枚、中州でレーンを選び直して後半 L2 レーンに 5−k 枚
  function layoutPlaza(L, rng, t) {
    const L1 = rng() < threeLaneProb(t) ? 3 : 2;
    const L2 = rng() < threeLaneProb(t) ? 3 : 2;
    const k = ri(rng, 1, 4);
    const slots = [], routes = [];
    const A = [], Bs = [];
    for (let i = 0; i < L1; i++) { const seq = []; for (let p = 0; p < k; p++) seq.push(mkSlot(slots, { sec: 'A', lane: i, pos: p, laneCount: L1, mineOK: L1 === 3, beforePlaza: true })); A.push(seq); }
    for (let j = 0; j < L2; j++) { const seq = []; for (let p = k; p < 5; p++) seq.push(mkSlot(slots, { sec: 'B', lane: j, pos: p, laneCount: L2, mineOK: L2 === 3 })); Bs.push(seq); }
    for (let i = 0; i < L1; i++) for (let j = 0; j < L2; j++) routes.push({ name: LANE_NAMES[L1][i] + '→' + LANE_NAMES[L2][j], lanes: [i, j], seq: A[i].concat(Bs[j]) });
    return { kind: 'plaza', L: L1, L1, L2, k, slots, routes };
  }
  const MECHANICS = ['cross', 'merge', 'loop', 'u', 'plaza'];
  const MECH_NAMES = { straight: 'まっすぐ', cross: '立体交差', merge: '合流', loop: 'アンコール', u: 'U字路', plaza: '中州' };
  const LAYOUTS = { straight: layoutStraight, cross: layoutCross, merge: layoutMerge, loop: layoutLoop, u: layoutU, plaza: layoutPlaza };
  const mechanicProb = (t) => 0.5 * t;

  // ---------- ステージの生成 ----------
  const LIST_CAP = 4000;
  function tryBuild(layout, n0, weights, rng) {
    const { slots, routes } = layout;
    const gates = new Array(slots.length).fill(null);
    const lists = routes.map(() => [n0]);
    const maxLen = Math.max(...routes.map((r) => r.seq.length));
    for (let d = 0; d < maxLen; d++) {
      // この深さで初めて通る slot を決める
      for (let r = 0; r < routes.length; r++) {
        const sid = routes[r].seq[d];
        if (sid === undefined || gates[sid]) continue;
        // この slot に、この深さで来るルートをまとめる
        const comers = [];
        for (let r2 = 0; r2 < routes.length; r2++) if (routes[r2].seq[d] === sid) comers.push(r2);
        let lo = null, hi = null;
        for (const r2 of comers) for (const v of lists[r2]) if (!isMine(v)) { if (lo === null || v < lo) lo = v; if (hi === null || v > hi) hi = v; }
        const S = lo === null ? 0n : absB(lo + hi); // 中央 × 2
        const slot = slots[sid];
        let g = null;
        for (let tries = 0; tries < 60 && !g; tries++) {
          const tier = pickRarity(rng, weights);
          const type = pick(rng, BY_RARITY[tier]);
          if (slot.beforePlaza && type.random) continue;
          if (slot.noExplosive && type.explosive) continue;
          let ok = true;
          for (const r2 of comers) {
            const prev = routes[r2].seq.slice(0, d).map((s) => gates[s]).filter(Boolean);
            if (type.explosive && prev.some((x) => TYPES[x.type].explosive)) ok = false;
            if (type.nonMono && prev.some((x) => TYPES[x.type].random === 'nd2')) ok = false;
          }
          if (!ok) continue;
          g = { type: type.id, p: type.gen({ rng, S, mineOK: slot.mineOK }) };
        }
        if (!g) g = { type: 'add', p: { a: ri(rng, 0, 100) } };
        gates[sid] = g;
      }
      // この深さのゲートを全ルートに適用
      for (let r = 0; r < routes.length; r++) {
        const sid = routes[r].seq[d];
        if (sid === undefined) continue;
        const g = gates[sid];
        const next = stepOutcomes(lists[r], TYPES[g.type], g.p);
        if (next.length > LIST_CAP) return null;
        if (!slots[sid].mineOK && next.some(isMine)) return null;
        lists[r] = next;
      }
    }
    return { gates, lists };
  }

  function judge(lists, reverse) {
    const S = lists.map(summarize);
    let best = -1;
    for (let r = 0; r < S.length; r++) {
      const s = S[r];
      if (s.mines.length || s.allMine) continue;
      if (!reverse) { if (s.min < 1n) continue; if (best < 0 || s.min > S[best].min) best = r; }
      else { if (s.max > -1n) continue; if (best < 0 || s.max < S[best].max) best = r; }
    }
    if (best < 0) return null;
    for (let r = 0; r < S.length; r++) {
      if (r === best || S[r].allMine) continue;
      if (!reverse && S[r].max >= S[best].min) return null;
      if (reverse && S[r].min <= S[best].max) return null;
    }
    const hp = reverse ? -S[best].max : S[best].min;
    return { correct: best, hp, summaries: S };
  }

  function generateStage(opts) {
    const rng = opts.rng || Math.random;
    const t = opts.t;
    const weights = rarityWeights(t, opts.difficulty);
    const wantReverse = opts.allowReverse !== false && t >= 2 / 7 && rng() < 0.15;
    const [lo, hi] = n0Range(t);
    const kind = opts.mechanic || (rng() < mechanicProb(t) ? pick(rng, MECHANICS) : 'straight');
    for (let attempt = 0; attempt < 3000; attempt++) {
      const reverse = wantReverse && attempt < 600;
      const L = rng() < threeLaneProb(t) ? 3 : 2;
      const layout = LAYOUTS[attempt < 2400 ? kind : 'straight'](L, rng, t);
      const n0 = BigInt(ri(rng, lo, hi));
      const built = tryBuild(layout, n0, weights, rng);
      if (!built) continue;
      const j = judge(built.lists, reverse);
      if (!j) continue;
      return { t, n0, reverse, layout, gates: built.gates, outcomes: built.lists, ...j, attempts: attempt + 1 };
    }
    throw new Error('ステージを生成できませんでした');
  }

  // ---------- 実際に走る ----------
  // ゲートを1枚通る（ランダムのゲートは rng で目を決める）
  const applyGate = (n, g, rng) => { const ty = TYPES[g.type]; return ty.roll ? ty.roll(n, g.p, rng) : ty.apply(n, g.p); };
  function runRoute(stage, routeIndex, rng) {
    const r = stage.layout.routes[routeIndex];
    let n = stage.n0;
    const steps = [];
    for (const sid of r.seq) {
      const g = stage.gates[sid], before = n, after = applyGate(n, g, rng);
      steps.push({ sid, type: g.type, before, after });
      if (isMine(after)) return { steps, final: after };
      n = after;
    }
    return { steps, final: n };
  }

  // ---------- 数の表示 ----------
  const UNITS = ['', '万', '億', '兆', '京', '垓', '𥝱', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数'];
  const SUPD = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const supNum = (k) => String(k).split('').map((c) => SUPD[c]).join('');
  function fmtJa(n) { // 例：12億3456万7890
    if (isMine(n)) return n === MINE_BH ? 'ブラックホール' : 'バグ';
    const neg = n < 0n; let s = absB(n).toString();
    if (s.length > 72) {
      const d = s.length - 1;
      return (neg ? '−' : '') + s[0] + '.' + s.slice(1, 4) + '×10' + supNum(d);
    }
    if (s.length <= 4) return (neg ? '−' : '') + s;
    const groups = [];
    while (s.length) { groups.unshift(s.slice(-4)); s = s.slice(0, -4); }
    let out = '';
    groups.forEach((gr, i) => {
      const u = UNITS[groups.length - 1 - i];
      const v = parseInt(gr, 10);
      if (v) out += (out ? gr.replace(/^0+/, '') : String(v)) + u;
    });
    return (neg ? '−' : '') + out;
  }
  function fmtComma(n) {
    if (isMine(n)) return fmtJa(n);
    const neg = n < 0n; const s = absB(n).toString();
    return (neg ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 画面（ui）とテストから使うもの
  const API = {
    mulberry32, TYPES, TYPE_LIST: T, BY_RARITY, RARITY_NAMES, CATS, progressOf,
    generateStage, runRoute, applyGate, isMine, MINE_BH, MINE_BUG, MECHANICS, MECH_NAMES,
    fmtJa, fmtComma, absB,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.GateLogic = API;
})(typeof window !== 'undefined' ? window : globalThis);
