// 五門の兵：コースの形：道すじ（Path）と、形ごと（まっすぐ・立体交差・合流・アンコール・U字路・中州）の配置
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 経路（道筋）の道具 ----------
function Path(x, z, y) { this.pts = [{ x, y: y || 0, z }]; this.gates = []; }
Path.prototype.last = function () { return this.pts[this.pts.length - 1]; };
Path.prototype.to = function (x, z, step, y) {
  this.pts.push({ x, y: y || 0, z });
  if (step !== undefined) this.gates.push({ step, idx: this.pts.length - 1 });
  return this;
};
Path.prototype.bez = function (x1, z1, d0, d1, h, yFn, n) {
  const p0 = this.last(), h0 = Array.isArray(h) ? h[0] : h, h1 = Array.isArray(h) ? h[1] : h; // 手前と先で、曲がり始めの強さを変えられる
  const c1 = { x: p0.x + d0[0] * h0, z: p0.z + d0[1] * h0 }, c2 = { x: x1 - d1[0] * h1, z: z1 - d1[1] * h1 };
  n = n || 20;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * x1;
    const z = u * u * u * p0.z + 3 * u * u * t * c1.z + 3 * u * t * t * c2.z + t * t * t * z1;
    this.pts.push({ x, y: yFn ? yFn(t) : 0, z });
  }
  return this;
};
// 半円：いまの点（中心から −side 側）から、中心の反対側（+side 側）まで回る。fwd は膨らむ向き（−1 なら −z、+1 なら +z）
Path.prototype.semi = function (cx, cz, r, side, fwd, n) {
  n = n || 24;
  for (let i = 1; i <= n; i++) { const th = (Math.PI * i) / n; this.pts.push({ x: cx - side * r * Math.cos(th), y: 0, z: cz + fwd * r * Math.sin(th) }); }
  return this;
};
// ボス戦の視点に切り替えるところ（橋を渡りきったところ）のしるし
Path.prototype.mark = function () { this.markIdx = this.pts.length - 1; return this; };
Path.prototype.done = function () {
  const c = [0];
  for (let i = 1; i < this.pts.length; i++) { const a = this.pts[i - 1], b = this.pts[i]; c.push(c[i - 1] + Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y)); }
  this.cum = c;
  this.len = c[c.length - 1];
  this.markS = this.markIdx !== undefined ? c[this.markIdx] : undefined;
  this.events = this.gates.map((g) => ({ step: g.step, s: c[g.idx] })).sort((a, b) => a.s - b.s);
  this.gi = 0;
  return this;
};
// 点の並び（高さ y つき）を通る道すじ
const pathThrough = (pts) => { const P = new Path(pts[0].x, pts[0].z, pts[0].y); for (let i = 1; i < pts.length; i++) P.to(pts[i].x, pts[i].z, undefined, pts[i].y); return P.done(); };
Path.prototype.at = function (s) {
  const c = this.cum;
  s = Math.max(0, Math.min(this.len, s));
  let i = 1;
  while (i < c.length - 1 && c[i] < s) i++;
  const a = this.pts[i - 1], b = this.pts[i];
  const seg = c[i] - c[i - 1] || 1;
  const t = (s - c[i - 1]) / seg;
  const dx = b.x - a.x, dz = b.z - a.z, dl = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * t, y: a.y + (b.y - a.y) * t, z: a.z + dz * t, hx: dx / dl, hz: dz / dl };
};
const bridgeY = (h) => (t) => { const k = Math.min(1, Math.min(t, 1 - t) / 0.3); return h * k * k * (3 - 2 * k); };
const FWD = [0, -1], BACK = [0, 1];


// ---------- コースの形ごとの配置 ----------
// geo: slotPos（ゲートの位置）、strips（レーンの床）、walls（レーンを仕切る壁）、ribbons（曲がる道）、pads（床）、
//      road（ゲートまでの道）、freeA（自由に動ける幅）、startXs（入口のレーン）、routePath(i, fromX, fromZ)、plaza、ext（真上から見る範囲）
// 橋の種類：3種類の並び順をランダムにする（2本なら先頭の2つ）
function bridgeTypes(rng) {
  const t = BRIDGE_TYPES.slice();
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const q = t[i]; t[i] = t[j]; t[j] = q; }
  return t;
}
// レーンが決まったら、早めに橋の正面へ寄る（入り江の水の上を歩かないように）
const riverEnter = (fx, fz, x, bankZ) => new Path(fx, fz).bez(x, bankZ - 0.5, FWD, FWD, [1, Math.max(1, (fz - bankZ) * 0.75)], null, 18);
function buildGeo(stage, rng) {
  const lay = stage.layout, { LS, BW } = RIVER;
  const geo = { kind: lay.kind, colW: BW, lockZ: RIVER.LOCK, waitZ: RIVER.WAIT, slotPos: [], pads: [], hl: null };
  const bossAt = (x, z, rot, r) => {
    const f = rot ? { x: 0, z: -1 } : { x: 0, z: 1 };
    geo.boss = { x, z, rot: rot || 0, f };
    geo.bossFar = z - f.z * 10;
    geo.arena = { x, z, r };
    geo.bossFront = { x: x + f.x * 8, z: z + f.z * 8 };
  };
  // 入口の L 本のレーン：手前の砂地と道の幅、自由に動ける幅、入口のレーンの x。xs(l) はレーン l の x
  const lanes = (L) => {
    const xs = (l) => laneX(l, L, LS), padHalf = (L * LS) / 2 + 2;
    geo.startXs = [...Array(L)].map((_, l) => xs(l));
    geo.nameA = (i) => laneName(L, i);
    geo.freeA = { x0: -(L * LS) / 2 + 2, x1: (L * LS) / 2 - 2 };
    geo.road = { x0: -padHalf, x1: padHalf };
    geo.beachX = [-padHalf, padHalf];
    return { xs, padHalf };
  };
  // 向こう岸（荒地）：橋が着く farZ から少し歩いたところにボス（足場の半径 14）と、ボスへ続く道（幅 width）。反転ボスのときは色を反転する
  const farBoss = (farZ, width) => {
    const bossZ = farZ - RIVER.BOSS;
    bossAt(0, bossZ, 0, 14);
    geo.farFlip = !!stage.reverse;
    geo.arenaMat = WASTE[geo.farFlip ? 1 : 0].arena;
    geo.pads.push({ x: 0, z0: farZ, z1: bossZ - 16, w: Math.max(width + 4, 30), matObj: WASTE[geo.farFlip ? 1 : 0].path, y: -0.02 }); // 橋の床（0.03）と同じ高さにしない（ちらつき防止）
  };
  const farPad = (width) => Math.max(width + 4, 30) / 2; // 向こう岸の道の半分の幅（川の形に使う）
  // 橋を渡りきった (x, z) からボスの前へ。そこまでを1本の道すじにする（渡りきったところで、ボス戦の視点に切り替わる）
  const toBoss = (P, x, z) => P.to(x, z).mark().to(geo.bossFront.x, geo.bossFront.z).done();
  const colsOf = (bridges) => bridges.map((b) => [b.x - BW / 2, b.x + BW / 2]); // 橋の両はしの x

  // 中州：手前の橋で川の中の中州へ渡り、中州の上でレーンを選び直して、先の橋で向こう岸へ
  if (lay.kind === 'plaza') {
    const { L1, L2, k } = lay, { xs: xa } = lanes(L1), xb = (l) => laneX(l, L2, LS);
    const zp0 = GZ(k - 1) - 6, zp1 = zp0 - PLAZA_LEN, zLock = zp1 + (RIVER.LOCK - RIVER.BANK);
    const gz = (p) => (p < k ? GZ(p) : zp1 - 6 - GAP * (p - k));
    lay.slots.forEach((s) => { geo.slotPos[s.id] = { x: s.sec === 'A' ? xa(s.lane) : xb(s.lane), z: gz(s.pos), rot: 0, w: BW }; });
    const last = gz(4), farZ = last - 6, wmax = Math.max(L1, L2) * LS;
    geo.hl = { z0: RIVER.LOCK, z1: zp0 };
    farBoss(farZ, L2 * LS);
    // 中州の手前と先で、橋の種類はそれぞれ別にランダム
    const tA = bridgeTypes(rng), tB = bridgeTypes(rng);
    geo.bridges = [...Array(L1)].map((_, l) => ({ type: tA[l], x: xa(l), z0: RIVER.BANK, z1: zp0 }))
      .concat([...Array(L2)].map((_, l) => ({ type: tB[l], x: xb(l), z0: zp1, z1: farZ })));
    const colsA = colsOf(geo.bridges.slice(0, L1)), colsB = colsOf(geo.bridges.slice(L1));
    geo.river = riverShores(rng, { nearCols: colsA, farCols: colsB, farEdge: farZ, padHalf: farPad(L2 * LS), island: { colsA, colsB, z0: zp0, z1: zp1, lock: zLock, IW: [wmax / 2 + 9 + rng() * 11, wmax / 2 + 9 + rng() * 11], sand: { x0: -wmax / 2 - 2, x1: wmax / 2 + 2 } } });
    geo.plaza = {
      zIn: zp0, zOut: zp1, zMid: zp1 + (RIVER.WAIT - RIVER.BANK), zLock,
      xsB: [...Array(L2)].map((_, l) => xb(l)), nameB: (j) => laneName(L2, j), hlB: { z0: zLock, z1: farZ },
      free: { x0: -wmax / 2 + 2, x1: wmax / 2 - 2 },
      pathA: (i, fx, fz) => { const P = riverEnter(fx, fz, xa(i), RIVER.BANK); for (let p = 0; p < k; p++) P.to(xa(i), gz(p), p); return P.to(xa(i), zp0 - 1).done(); },
      pathB: (j, fx, fz) => { const P = riverEnter(fx, fz, xb(j), zp1); for (let p = k; p < 5; p++) P.to(xb(j), gz(p), p); return toBoss(P, xb(j), farZ); },
    };
    geo.ext = { x0: -wmax / 2 - 3, x1: wmax / 2 + 3, z0: last - 8, z1: RIVER.WAIT + 5 };
    return geo;
  }
  // 合流：向こう岸が川へ張り出した半島。橋はそれぞれ半島の先に着き、残りのゲートは半島の陸の道に並ぶ
  if (lay.kind === 'merge') {
    const { L, k } = lay, { xs, padHalf } = lanes(L);
    const zm0 = GZ(k - 1) - 5, zm1 = zm0 - 14;
    const gz = (p) => (p < k ? GZ(p) : zm1 - 5 - GAP * (p - k));
    lay.slots.forEach((s) => { geo.slotPos[s.id] = { x: s.sec === 'M' ? 0 : xs(s.lane), z: gz(s.pos), rot: 0, w: BW }; });
    const last = gz(4), tail = last - 6;
    geo.hl = { z0: RIVER.LOCK, z1: zm0 };
    farBoss(tail, L * LS);
    const types = bridgeTypes(rng);
    geo.bridges = [...Array(L)].map((_, l) => ({ type: types[l], x: xs(l), z0: RIVER.BANK, z1: zm0 }));
    const cols = colsOf(geo.bridges);
    // 半島の上の道：橋の先から1本にまとまり、ボスへ
    geo.landRoads = [...Array(L)].map((_, l) => new Path(xs(l), zm0 + 0.5).bez(0, zm1, FWD, FWD, 6).to(0, tail).pts);
    // 半島：道に沿った細い陸（長さ・首の細さ・左右のかたより・でこぼこは毎回ちがう）。根もとで向こう岸の本体へ広がる
    geo.river = riverShores(rng, { nearCols: cols, farCols: cols, farEdge: zm0, padHalf: 0, peninsula: { roads: geo.landRoads, half: BW / 2, tipZ: zm0, len: 24 + rng() * 16 } });
    geo.routePath = (ri, fx, fz) => {
      const x = xs(lay.routes[ri].lanes[0]);
      const P = riverEnter(fx, fz, x, RIVER.BANK);
      for (let p = 0; p < k; p++) P.to(x, gz(p), p);
      P.to(x, zm0).bez(0, zm1, FWD, FWD, 6);
      for (let p = k; p < 5; p++) P.to(0, gz(p), p);
      return toBoss(P, 0, tail);
    };
    geo.ext = { x0: -padHalf, x1: padHalf, z0: last - 8, z1: RIVER.WAIT + 5 };
    return geo;
  }
  // 立体交差：2本の橋が川の上で入れ替わる。上を通る橋は太鼓橋のように持ち上がり、下の橋をまたぐ
  if (lay.kind === 'cross') {
    const { L, c } = lay, H = 4.6, hw = BW / 2, { xs, padHalf } = lanes(L);
    const zc0 = GZ(c - 1) - 5, zc1 = zc0 - 18;
    const gz = (p) => (p < c ? GZ(p) : zc1 - 5 - GAP * (p - c));
    lay.slots.forEach((s) => { geo.slotPos[s.id] = { x: xs(s.lane), z: gz(s.pos), rot: 0, w: BW }; });
    const last = gz(4), farZ = last - 6;
    geo.hl = { z0: RIVER.LOCK, z1: zc0 };
    farBoss(farZ, L * LS);
    const types = bridgeTypes(rng), xa = xs(lay.a), xb = xs(lay.b);
    const ptsA = new Path(xa, zc0).bez(xb, zc1, FWD, FWD, 8, bridgeY(H), 28).pts, ptsB = new Path(xb, zc0).bez(xa, zc1, FWD, FWD, 8, null, 28).pts;
    const nearLine = (pts, x, z, d) => pts.some((q) => Math.hypot(q.x - x, q.z - z) < d);
    const mids = [...Array(L)].map((_, l) => l).filter((l) => l !== lay.a && l !== lay.b && xs(l) > Math.min(xa, xb) && xs(l) < Math.max(xa, xb));
    const inMid = (x, z) => mids.some((l) => Math.abs(x - xs(l)) < hw + 0.4 && z < zc0 + 1 && z > zc1 - 1);
    geo.bridges = []; geo.curves = [];
    for (let l = 0; l < L; l++) {
      const t = types[l];
      if (l === lay.a || l === lay.b) {
        const x0 = xs(l), x1 = l === lay.a ? xb : xa;
        geo.bridges.push({ type: t, x: x0, z0: RIVER.BANK, z1: zc0, o: { joinFar: true } }, { type: t, x: x1, z0: zc1, z1: farZ, o: { joinNear: true } });
        if (l === lay.a) geo.curves.push({ type: t, pts: ptsA, avoid: (x, z, kind) => kind === 'pier' && (nearLine(ptsB, x, z, hw + 1) || inMid(x, z)) });
        else geo.curves.push({ type: t, pts: ptsB, avoid: (x, z) => inMid(x, z) });
      } else if (mids.includes(l)) { // 下の橋が横切る橋：交わるところは欄干をつけない
        geo.bridges.push({ type: t, x: xs(l), z0: RIVER.BANK, z1: zc0, o: { joinFar: true } }, { type: t, x: xs(l), z0: zc0, z1: zc1, o: { joinNear: true, joinFar: true, noRail: true } }, { type: t, x: xs(l), z0: zc1, z1: farZ, o: { joinNear: true } });
      } else geo.bridges.push({ type: t, x: xs(l), z0: RIVER.BANK, z1: farZ });
    }
    const cols = [...Array(L)].map((_, l) => [xs(l) - hw, xs(l) + hw]);
    geo.river = riverShores(rng, { nearCols: cols, farCols: cols, farEdge: farZ, padHalf: farPad(L * LS) });
    geo.routePath = (ri, fx, fz) => {
      const r = lay.routes[ri], l = r.lanes[0], to = r.lanes[1], x = xs(l), x2 = xs(to);
      const P = riverEnter(fx, fz, x, RIVER.BANK);
      for (let p = 0; p < c; p++) P.to(x, gz(p), p);
      P.to(x, zc0);
      if (l === to) P.to(x, zc1); else P.bez(x2, zc1, FWD, FWD, 8, l === lay.over ? bridgeY(H) : null);
      for (let p = c; p < 5; p++) P.to(x2, gz(p), p);
      return toBoss(P, x2, farZ);
    };
    geo.ext = { x0: -padHalf, x1: padHalf, z0: last - 8, z1: RIVER.WAIT + 5 };
    return geo;
  }
  // U字路：行きの2本の橋で向こう岸へ渡り、荒地で折り返して、帰りの2本の橋で川の中の中州へ戻る。ボスは中州にいる
  if (lay.kind === 'u') {
    const k = lay.k, m = Math.max(k, 5 - k), D = 10; // D：帰りの橋を右へずらす（スタートの岸と中州の間に水を通す）
    const ox = [-1.5 * LS, -0.5 * LS], rx = [1.5 * LS + D, 0.5 * LS + D];
    const rz = (q) => -GAP * (m - 1 - q);
    const zfar = -GAP * (m - 1) - 6;
    lay.slots.forEach((s) => { geo.slotPos[s.id] = s.sec === 'O' ? { x: ox[s.lane], z: GZ(s.pos), rot: 0, w: BW } : { x: rx[s.lane], z: rz(s.pos), rot: Math.PI, w: BW }; });
    geo.startXs = ox.slice();
    const names = ['外回り', '内回り'];
    geo.nameA = (i) => names[i];
    geo.freeA = { x0: -2 * LS + 2, x1: -2 };
    const half = 2 * LS + 2;
    geo.road = { x0: -half, x1: 0 };
    // 中州：帰りの橋が着く岸（zS）から少し歩いたところにボス
    const xc = (rx[0] + rx[1]) / 2, zS = 6, bz = zS + RIVER.WALK + 11, zN = bz + 11 + 4 + rng() * 4;
    bossAt(xc, bz, Math.PI, 11);
    geo.farFlip = !!stage.reverse;
    geo.hl = { z0: RIVER.LOCK, z1: zfar };
    const types = bridgeTypes(rng);
    geo.bridges = [0, 1].flatMap((r) => [{ type: types[r], x: ox[r], z0: RIVER.BANK, z1: zfar }, { type: types[r], x: rx[r], z0: zS, z1: zfar }]);
    const colAt = (x) => [x - BW / 2, x + BW / 2];
    const outCols = [colAt(ox[0]), colAt(ox[1])], retCols = [colAt(rx[1]), colAt(rx[0])];
    const flankX = outCols[1][1] + 1.3, xin = rx[0] - xc + BW / 2 + 2; // スタートの岸の右のはし、中州の橋のたもとの広さ
    const IWL = Math.min(xc - (flankX + 2) - 5.5, xin + 2 + rng() * 3), IWR = xin + 5 + rng() * 9;
    geo.river = riverShores(rng, {
      nearCols: outCols, farCols: outCols.concat(retCols), farEdge: zfar, padHalf: 0,
      nearBay: { x0: flankX, x1: xc + IWR + 6, z: zN + 9 },
      island: { colsS: retCols, z0: zN, z1: zS, xc, IW: [IWL, IWR], flat: 13, sand: { x0: retCols[0][0] - 1, x1: retCols[1][1] + 1, zHi: bz } },
    });
    geo.beachX = [-half, flankX - 0.2];
    const turn = (r) => new Path(ox[r], zfar + 0.5).bez(rx[r], zfar + 0.5, FWD, BACK, Math.abs(rx[r] - ox[r]) * 0.62, null, 28).pts;
    geo.landRoads = [turn(0), turn(1)]; // 向こう岸（荒地）で折り返す道
    geo.routePath = (ri, fx, fz) => {
      const P = riverEnter(fx, fz, ox[ri], RIVER.BANK);
      for (let p = 0; p < k; p++) P.to(ox[ri], GZ(p), p);
      P.to(ox[ri], zfar).bez(rx[ri], zfar, FWD, BACK, Math.abs(rx[ri] - ox[ri]) * 0.62, null, 28);
      for (let q = 0; q < 5 - k; q++) P.to(rx[ri], rz(q), k + q);
      return toBoss(P, rx[ri], zS + 1);
    };
    geo.ext = { x0: -half, x1: rx[0] + BW / 2 + 3, z0: zfar - 26, z1: zN + 4 };
    return geo;
  }
  // アンコール：外側の橋の床が、外へ丸く張り出す（穴はない）。兵士は張り出しの上をぐるりと回って、同じゲートをもう一度くぐる
  // 張り出しは、まるごと水の上に出す（1枚目のゲートで回るときはゲートを全部先へずらし、5枚目で回るときは橋を長くする）
  if (lay.kind === 'loop') {
    const L = lay.L, hw = BW / 2, { xs, padHalf } = lanes(L);
    const R = 6, Ro = R + hw + 0.5; // R：兵士が回る半円の半径、Ro：張り出しのふちの半径
    const reachN = 4 + Ro, reachF = 3 + Ro; // 張り出しが、ゲートから手前・先へ出る長さ
    const shift = lay.p === 0 ? Math.ceil(reachN - (RIVER.BANK - 1.5)) : 0;
    const gz = (p) => GZ(p) - shift;
    lay.slots.forEach((s) => { geo.slotPos[s.id] = { x: xs(s.lane), z: gz(s.pos), rot: 0, w: BW }; });
    const sx = xs(lay.side), dir = lay.side === 0 ? -1 : 1, xo = sx + dir * 2 * R, zp = gz(lay.p);
    const last = gz(4), farZ = Math.min(last - 6, zp - reachF - 2);
    geo.hl = { z0: RIVER.LOCK, z1: farZ };
    farBoss(farZ, L * LS);
    const loopPath = (P) => P.to(sx, zp - 3).semi(sx + dir * R, zp - 3, R, dir, -1).to(xo, zp + 4).semi(sx + dir * R, zp + 4, R, -dir, 1);
    const edge = sx + dir * hw, outside = (x) => (x - edge) * dir;
    // 張り出しのふち：手前の半円 → 外のまっすぐ → 先の半円（本体の橋のふちから、ふちまで）
    const cxB = sx + dir * R, thA = Math.acos((hw - R) / Ro), outline = [];
    for (let i = 0; i <= 22; i++) { const th = thA * (1 - i / 22); outline.push({ x: cxB + dir * Ro * Math.cos(th), z: zp + 4 + Ro * Math.sin(th) }); }
    for (let i = 0; i <= 22; i++) { const th = -thA * (i / 22); outline.push({ x: cxB + dir * Ro * Math.cos(th), z: zp - 3 + Ro * Math.sin(th) }); }
    const zJn = outline[0].z, zJf = outline[outline.length - 1].z;
    const types = bridgeTypes(rng);
    geo.bridges = [...Array(L)].map((_, l) => ({ type: types[l], x: xs(l), z0: RIVER.BANK, z1: farZ, o: l === lay.side ? { gaps: [{ side: dir, z0: zJn + 0.2, z1: zJf - 0.2 }] } : undefined }));
    geo.bulges = [{ type: types[lay.side], outline, edge, dir, loop: loopPath(new Path(sx, zp - 3)).pts }];
    const cols = colsOf(geo.bridges);
    // 張り出しの横では、向こう岸が川へ張り出さないようにする
    const ringW = (x) => { const o = outside(x); return o < 0 ? 1 : smoothstep(1 - (o - (R + Ro - hw + 2)) / 10); };
    geo.river = riverShores(rng, {
      nearCols: cols, farCols: cols, farEdge: farZ, padHalf: farPad(L * LS),
      farCoast: (x, base) => base - Math.max(0, base - (farZ - 1)) * ringW(x),
    });
    geo.routePath = (ri, fx, fz) => {
      const r = lay.routes[ri], x = xs(r.lanes[0]);
      const P = riverEnter(fx, fz, x, RIVER.BANK);
      let step = 0;
      for (let p = 0; p < 5; p++) {
        P.to(x, gz(p), step++);
        if (r.lanes[0] === lay.side && p === lay.p) loopPath(P).to(x, gz(p), step++);
      }
      return toBoss(P, x, farZ);
    };
    const extra = R + Ro - hw + 3;
    geo.ext = { x0: -padHalf - (lay.side === 0 ? extra : 0), x1: padHalf + (lay.side !== 0 ? extra : 0), z0: farZ - 2, z1: RIVER.WAIT + 5 };
    return geo;
  }
  // まっすぐ：太い川に、橋を L 本かける
  if (lay.kind === 'straight') {
    const L = lay.L, { xs, padHalf } = lanes(L);
    lay.slots.forEach((s) => { geo.slotPos[s.id] = { x: xs(s.lane), z: GZ(s.pos), rot: 0, w: BW }; });
    const last = GZ(4), farZ = last - 6;
    geo.hl = { z0: RIVER.LOCK, z1: farZ };
    farBoss(farZ, L * LS);
    // 橋の種類：3レーンなら3種類すべて、2レーンなら3種類から2つ。並び順は毎回ランダム
    const types = bridgeTypes(rng);
    geo.bridges = [...Array(L)].map((_, l) => ({ type: types[l], x: xs(l), z0: RIVER.BANK, z1: farZ }));
    const cols = colsOf(geo.bridges);
    geo.river = riverShores(rng, { nearCols: cols, farCols: cols, farEdge: farZ, padHalf: farPad(L * LS) });
    geo.routePath = (ri, fx, fz) => {
      const x = xs(lay.routes[ri].lanes[0]);
      const P = riverEnter(fx, fz, x, RIVER.BANK);
      for (let p = 0; p < 5; p++) P.to(x, GZ(p), p);
      return toBoss(P, x, farZ);
    };
    geo.ext = { x0: -padHalf, x1: padHalf, z0: last - 8, z1: RIVER.WAIT + 5 };
    return geo;
  }

  throw new Error('unknown layout: ' + lay.kind);
}
