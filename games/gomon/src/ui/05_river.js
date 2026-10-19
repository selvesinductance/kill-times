// 五門の兵：川：岸の線（入り江・半島・中州）、水面と土手、川の飾り（葦・岩・蓮・魚）、川の音の聞こえ方
// （src/ui/ のファイルは、build.py が決まった順につなげて1つの関数に入れる。変数はすべてのファイルで共有）

// ---------- 川（太い1本の川。地面の端から端まで） ----------
// 手前の岸は橋の正面だけ川へ張り出し、橋と橋の間は自然な形の入り江になる。
// レーンが決まる線（RIVER.LOCK）は入り江のいちばん奥より少し手前で、どのステージでも同じ位置。
// 岸の線（x が増える向きに並んだ点）。
// 橋が出ていく岸は、橋の正面だけ張り出して、間は入り江（レーンが決まる線は入り江の奥の少し手前）。
// 橋が着く岸は、橋の間が少し張り出す。spec：
//   nearCols / farCols：橋の両はしの x の組（並び順）、farEdge：向こう岸で橋が着く z、padHalf：向こうの道の半分の幅
//   farCoast(x, base)：向こう岸の外側の形を変えるとき（アンコールの張り出しの横）
//   peninsula：合流の半島（向こう岸の本体から、陸の道に沿って細く張り出す）
//   nearBay：{ x0, x1, z }（手前の岸の x0〜x1 を z まで下げる。U字路の中州のまわり）
//   island：{ z0, z1, IW: [左, 右], xc, colsA, colsB, lock, colsS, flat, sand }
//     中州：手前の橋（colsA）が z0 に着き、先の橋（colsB）が z1 から出る
//     U字路：向こうから戻る橋（colsS）が z1 に着き、z0 の側は橋のない岸（flat：形を変えない真ん中の半分の幅）
function riverShores(rng, spec) {
  const { BANK, LOCK, X } = RIVER;
  const wave = () => { const k = [rng(), rng(), rng()].map((v) => v * 6.283); return (x) => 0.55 * Math.sin(x * 0.021 + k[0]) + 0.3 * Math.sin(x * 0.057 + k[1]) + 0.15 * Math.sin(x * 0.13 + k[2]); };
  const nw = wave(), fw = wave(), jw = wave();
  // a→b の間の点（端は含まない）。edge から peak へふくらむ（入り江も張り出しも同じ形）
  const bumpPts = (out, a, b, edge, peak, half, o, pr) => {
    const p = pr ? pr[0] + rng() * (pr[1] - pr[0]) : 0.45 + rng() * 0.35, sk = 0.8 + rng() * 0.4, N = 18;
    for (let i = 1; i < N; i++) {
      const s = i / N, xx = a + (b - a) * s;
      let u = Math.pow(s, sk);
      if (half === 'L') u = 0.5 + u / 2; else if (half === 'R') u = u / 2;
      const bump = Math.pow(Math.max(0, Math.sin(Math.PI * u)), p);
      out.push({ x: xx, z: edge + (peak - edge) * bump + 0.3 * Math.sin(Math.PI * u) * jw(xx * 9) * Math.sign(peak - edge), o });
    }
  };
  // 橋が出ていく岸（land は +z 側）。outer：外側にも入り江をつけて、ふつうの岸へなじませる
  const depart = (cols, edge, tipBase, x0, x1, coast, blend, outer, step) => {
    const out = [], tipOf = () => tipBase + (rng() - 0.5) * 2;
    const eL = cols[0][0], eR = cols[cols.length - 1][1];
    const inner = () => cols.forEach(([a, b], i) => {
      out.push({ x: a, z: edge, o: 0.7 }, { x: b, z: edge, o: 0.7 });
      if (i < cols.length - 1) bumpPts(out, b, cols[i + 1][0], edge, tipOf(), null, 0.9); // 入り江は狭いので、土手を急にして水を奥まで見せる
    });
    if (outer) {
      const OUT = 8 + rng() * 4, tipL = tipOf(), tipR = tipOf();
      for (let x = x0; x < eL - OUT; x += step) { const d = eL - OUT - x; out.push({ x, z: tipL + (coast(x) - tipL) * smoothstep(d / blend) }); }
      out.push({ x: eL - OUT, z: tipL });
      bumpPts(out, eL - OUT, eL, edge, tipL, 'L', 1.6);
      inner();
      bumpPts(out, eR, eR + OUT, edge, tipR, 'R', 1.6);
      out.push({ x: eR + OUT, z: tipR });
      for (let x = eR + OUT + step; x < x1; x += step) { const d = x - eR - OUT; out.push({ x, z: tipR + (coast(x) - tipR) * smoothstep(d / blend) }); }
    } else {
      for (let x = x0; x < eL; x += step) out.push({ x, z: coast(x) });
      inner();
      for (let x = eR + step; x < x1; x += step) out.push({ x, z: coast(x) });
    }
    out.push({ x: x1, z: coast(x1) });
    return out;
  };
  // 橋が着く岸（land は −z 側）。橋の間は少し張り出す
  const arrive = (cols, edge, x0, x1, coast, blend, guardHalf, step) => {
    const out = [], eL = cols[0][0], eR = cols[cols.length - 1][1];
    const g = (x, z) => (guardHalf && Math.abs(x) <= guardHalf + 1.5 ? Math.max(z, edge) : z); // 向こうの道の下に水が来ないように
    for (let x = x0; x < eL; x += step) { const d = eL - x; out.push({ x, z: g(x, edge + (coast(x) - edge) * smoothstep(d / blend)) }); }
    cols.forEach(([a, b], i) => {
      out.push({ x: a, z: edge, o: 0.9 }, { x: b, z: edge, o: 0.9 });
      if (i < cols.length - 1) { const c = cols[i + 1][0], H = 1 + rng() * 3; for (let k = 1; k < 10; k++) { const s = k / 10; out.push({ x: b + (c - b) * s, z: edge + H * Math.pow(Math.sin(Math.PI * s), 0.8) }); } }
    });
    for (let x = eR + step; x < x1; x += step) { const d = x - eR; out.push({ x, z: g(x, edge + (coast(x) - edge) * smoothstep(d / blend)) }); }
    out.push({ x: x1, z: g(x1, coast(x1)) });
    return out;
  };
  // 合流の半島：陸の道に沿った細い陸。先は橋が着く幅で、道が1本にまとまると細くなり、根もとで向こう岸の本体へ広がってつながる
  //   pen：{ roads（道の点の列。先から根もとへ）, half（道の半分の幅）, tipZ（橋が着く z）, len（半島の長さ） }
  const peninsula = (pen) => {
    const { roads, half, tipZ, len } = pen, zB = tipZ - len;
    const main = (x) => zB + 1.5 + 3 * fw(x); // 向こう岸の本体の岸
    const cx = roads.map((pts) => { const ps = pts.slice().sort((a, b) => a.z - b.z); return (z) => { if (z <= ps[0].z) return ps[0].x; for (let i = 1; i < ps.length; i++) if (ps[i].z >= z) { const a = ps[i - 1], b = ps[i], t = (z - a.z) / ((b.z - a.z) || 1); return a.x + (b.x - a.x) * t; } return ps[ps.length - 1].x; }; });
    const hwz = (f, z) => half * Math.sqrt(1 + Math.pow((f(z + 0.5) - f(z - 0.5)), 2)); // 斜めの道は、横から見た幅が広い
    const edgeL = (z) => Math.min(...cx.map((f) => f(z) - hwz(f, z))), edgeR = (z) => Math.max(...cx.map((f) => f(z) + hwz(f, z)));
    const wob = () => { const k = [rng(), rng()].map((v) => v * 6.283), a = 0.5 + rng() * 0.6; return (z) => a * (0.6 * Math.sin(z * 0.17 + k[0]) + 0.4 * Math.sin(z * 0.43 + k[1])); };
    const side = () => { // 片側の陸の幅（道のふちから）。左右で別々に決める
      const tip = 1 + rng() * 1.8, neck = 2.6 + rng() * 2.2, w = wob(), FL = 7 + rng() * 9, F = 7 + rng() * 7;
      const bumps = [...Array(rng() < 0.5 ? 1 : 2)].map(() => ({ z: tipZ - 10 - rng() * Math.max(1, len - 18), w: 2.5 + rng() * 3.5, h: 1.2 + rng() * 2.6 }));
      return (z) => {
        const d = tipZ - z, t = smoothstep(d / 9), u = Math.max(0, (zB + F - z) / F);
        let m = tip + (neck - tip) * t + w(z) * t + FL * u * u;
        for (const b of bumps) m += b.h * Math.exp(-Math.pow((z - b.z) / b.w, 2)) * t;
        return m;
      };
    };
    const mL = side(), mR = side();
    // 片側を、先から根もとへ（本体の岸の中に入ったところで止める）
    const walk = (sg) => {
      const out = [];
      for (let z = tipZ - 1.2, i = 0; i < 400; z -= 1, i++) {
        const x = sg < 0 ? edgeL(z) - mL(z) : edgeR(z) + mR(z);
        out.push({ x, z, o: 2.2 });
        if (z < main(x) - 0.5) break;
      }
      return out;
    };
    const left = walk(-1).reverse(), right = walk(1);
    // 先：橋が着くところ。橋と橋の間は、少しだけ切れこむ（道が近づいて閉じるところまで）
    const tip = [];
    const cols = spec.farCols;
    tip.push({ x: edgeL(tipZ) - mL(tipZ) * 0.55, z: tipZ - 0.25, o: 1.4 });
    cols.forEach(([a, b], i) => {
      tip.push({ x: a, z: tipZ, o: 0.9 }, { x: b, z: tipZ, o: 0.9 });
      if (i < cols.length - 1) {
        const fA = cx[i], fB = cx[i + 1], deep = 2 + rng() * 5, dn = [], up = [];
        for (let d = 0.8; d <= deep; d += 0.8) {
          const z = tipZ - d, mn = 0.3 + d * 0.32, xa = fA(z) + hwz(fA, z) + mn, xb = fB(z) - hwz(fB, z) - mn;
          if (xb - xa < 0.8) break;
          dn.push({ x: xa, z, o: 0.9 }); up.unshift({ x: xb, z, o: 0.9 });
        }
        if (dn.length) { const l = dn[dn.length - 1], r = up[0]; tip.push(...dn, { x: (l.x + r.x) / 2, z: l.z - 0.7, o: 0.9 }, ...up); }
      }
    });
    tip.push({ x: edgeR(tipZ) + mR(tipZ) * 0.55, z: tipZ - 0.25, o: 1.4 });
    const line = left.concat(tip, right);
    const xJL = left[0].x, xJR = right[right.length - 1].x;
    const mainPts = (x0, x1) => { const out = []; for (let x = x0; x < x1; x += Math.abs(x) < 80 ? 2.5 : 7) out.push({ x, z: main(x) }); return out; };
    const far = mainPts(-X, xJL - 1).concat(line, mainPts(xJR + 1, X), [{ x: X, z: main(X) }]);
    const poly = line.concat([{ x: xJR, z: main(xJR) - 40 }, { x: xJL, z: main(xJL) - 40 }]);
    return { far, main, poly };
  };
  const lookup = (arr) => (x) => {
    if (x <= arr[0].x) return arr[0].z;
    for (let i = 1; i < arr.length; i++) if (arr[i].x >= x) { const a = arr[i - 1], b = arr[i], t = (x - a.x) / ((b.x - a.x) || 1); return a.z + (b.z - a.z) * t; }
    return arr[arr.length - 1].z;
  };
  let near = depart(spec.nearCols, BANK, LOCK - 3.6, -X, X, (x) => BANK + 7 + 5 * nw(x), 30, true, 7);
  // 手前の岸の入り江（U字路の中州のまわり）：x0 から急に奥へ下がり、x1 から先でふつうの岸へ戻る
  if (spec.nearBay) {
    const B = spec.nearBay, z0 = lookup(near)(B.x0), coastN = (x) => BANK + 7 + 5 * nw(x), pts = [];
    for (let i = 0; i <= 12; i++) { const th = (i / 12) * Math.PI / 2; pts.push({ x: B.x0 + 2 * (1 - Math.cos(th)), z: z0 + (B.z - z0) * Math.sin(th), o: 1.2 }); }
    for (let x = B.x0 + 4; x < B.x1; x += 2.5) pts.push({ x, z: B.z + 2 * nw(x * 3) });
    for (let x = B.x1; x < B.x1 + 30; x += 2.5) pts.push({ x, z: B.z + 2 * nw(x * 3) + (coastN(x) - B.z - 2 * nw(x * 3)) * smoothstep((x - B.x1) / 30) });
    near = near.filter((p) => p.x < B.x0).concat(pts, near.filter((p) => p.x >= B.x1 + 30));
  }
  const fe = spec.farEdge;
  const pen = spec.peninsula ? peninsula(spec.peninsula) : null;
  const far = pen ? pen.far : arrive(spec.farCols, fe, -X, X, (x) => (spec.farCoast ? spec.farCoast(x, fe + 1.5 + 4 * fw(x)) : fe + 1.5 + 4 * fw(x)), 14, spec.padHalf, 7);
  let island = null;
  if (spec.island) {
    const I = spec.island, zc = (I.z0 + I.z1) / 2, xc = I.xc || 0; // 島の形は、島の真ん中（xc）からの x で考える
    const loc = (cols) => (cols || []).map(([a, b]) => [a - xc, b - xc]);
    // 島の形は毎回ちがう：左右の長さ、両はしの形（丸い・とがる）と向き、岸のでこぼこ、小さな張り出しや入り江。
    // 橋のたもとと兵士が動ける砂地のまわりは変えない（はしへ向かうほど形を変える）
    const half = (I.z0 - I.z1) / 2;
    const ends = I.IW.map((IW) => ({ IW, zEnd: zc + (rng() - 0.5) * 0.7 * half, p: 1.5 + rng() * 1.5, q: 1.3 + rng() * 1.5 }));
    const shape = (cols, zEdge, out) => {
      const xin = cols.length ? Math.max(Math.abs(cols[0][0]), Math.abs(cols[cols.length - 1][1])) + 2 : I.flat, w = wave();
      const bumps = [-1, 1].flatMap((sg) => [...Array(1 + Math.floor(rng() * 2))].map(() => ({ x: sg * (xin + (ends[sg < 0 ? 0 : 1].IW - xin) * (0.3 + rng() * 0.45)), w: 1.8 + rng() * 2.5, h: (rng() < 0.55 ? 1 : -1) * (1 + rng() * 1.8) })));
      return (x) => {
        const e = ends[x < 0 ? 0 : 1], t = (Math.abs(x) - xin) / (e.IW - xin);
        if (t <= 0) return zEdge;
        const tt = Math.min(1, t);
        const z = e.zEnd + (zEdge - e.zEnd) * Math.pow(Math.max(0, 1 - Math.pow(tt, e.p)), 1 / e.q);
        let d = 1.1 * w(x * 4);
        for (const b of bumps) d += b.h * Math.exp(-Math.pow((x - b.x) / b.w, 2));
        return z + out * d * smoothstep(t / 0.3) * (1 - smoothstep((t - 0.8) / 0.2));
      };
    };
    const x0 = -ends[0].IW, x1 = ends[1].IW, cA = loc(I.colsA), cB = loc(I.colsB), cS = loc(I.colsS);
    const plain = (f) => { const out = []; for (let x = x0; x < x1; x += 2) out.push({ x, z: f(x) }); out.push({ x: x1, z: f(x1) }); return out; };
    // +z 側の岸：手前から来る橋が着く（中州）か、橋のない岸（U字路）
    const nE = cA.length ? arrive(cA, I.z0, x0, x1, shape(cA, I.z0, 1), 1, 0, 2) : plain(shape([], I.z0, 1));
    // −z 側の岸：先へ出る橋（中州。橋の間は入り江）か、向こうから戻ってくる橋が着く（U字路。橋の間は少し張り出す）
    let fE;
    if (cB.length) fE = depart(cB, I.z1, I.lock - 3.6, x0, x1, shape(cB, I.z1, -1), 1, false, 2);
    else { const f = shape(cS, I.z1, -1); fE = arrive(cS, I.z1, x0, x1, (x) => 2 * I.z1 - f(x), 1, 0, 2).map((p) => ({ ...p, z: 2 * I.z1 - p.z })); }
    const back = (arr) => arr.map((p) => ({ ...p, x: p.x + xc }));
    const nW = back(nE), fW = back(fE);
    island = { near: nW, far: fW, outline: nW.concat(fW.slice().reverse()), nearZ: null, farZ: null };
  }
  const nearZ = lookup(near), farZf = pen ? pen.main : lookup(far);
  const penSD = pen ? polySD(pen.poly) : null;
  // 向こう岸の陸の上か（m だけ内側。m が負なら外へ広げる）。半島があるときは、本体の岸と半島の両方を見る
  const farLand = (x, z, m) => z < farZf(x) - m || (penSD && penSD(x, z) < -m);
  if (island) {
    island.nearZ = lookup(island.near); island.farZ = lookup(island.far);
    // 兵士が動ける砂地：x0〜x1 の間（zHi より奥へは広げない）
    const S = spec.island.sand;
    if (S) {
      const zHi = S.zHi === undefined ? Infinity : S.zHi, cl = (z) => Math.min(zHi, z);
      const top = [{ x: S.x0, z: cl(island.nearZ(S.x0)) }].concat(island.near.filter((p) => p.x > S.x0 && p.x < S.x1).map((p) => ({ x: p.x, z: cl(p.z) })), [{ x: S.x1, z: cl(island.nearZ(S.x1)) }]);
      const bot = [{ x: S.x0, z: island.farZ(S.x0) }].concat(island.far.filter((p) => p.x > S.x0 && p.x < S.x1), [{ x: S.x1, z: island.farZ(S.x1) }]);
      island.sand = top.concat(bot.reverse());
    }
  }
  const zs = near.map((p) => p.z).concat(far.map((p) => p.z));
  return {
    near, far, nearZ, farZ: farZf, farLand, island,
    zMin: Math.min(...zs), zMax: Math.max(...zs),
    inRiver: (x, z, m) => Math.abs(x) < X + m && z < nearZ(x) + m && !farLand(x, z, m),
  };
}
// 川の水面・岸の斜面・手前の岸の砂地をつくる
function buildRiver(root, river, padX0, padX1, flip) {
  const { WATER_Y, BED_Y, X } = RIVER;
  // 水面
  const wg = new THREE.PlaneGeometry(2 * X + 60, river.zMax - river.zMin + 20);
  const uv = wg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * X + 60) / 26, uv.getY(i) * (river.zMax - river.zMin + 20) / 26);
  const water = ownMesh(wg, BMAT.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, (river.zMax + river.zMin) / 2);
  root.add(water);
  // 岸の斜面：岸の線から、川の内側へ下がっていく帯（手前の岸と向こう岸で、別々に作る）
  const bankStrip = (line, sg, mat) => {
    const pos = [], idx = [];
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = sg * tz, nz = -sg * tx, p = line[i];
      const o = p.o || 3.0; // ふつうはなだらかな土手。入り江と橋のたもとは急にする
      pos.push(p.x, 0.0, p.z, p.x + nx * o, BED_Y, p.z + nz * o);
      if (i < line.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    root.add(ownMesh(bg, mat));
  };
  if (river.island) { // 中州：草の島に、兵士が動ける砂地をのせる。まわりは土手
    const I = river.island;
    bankStrip(I.near, -1, BMAT.bank);
    bankStrip(I.far, 1, BMAT.bank);
    root.add(ownMesh(polyGeo(I.outline, [], 0, 1 / 20), ground.material));
    if (I.sand) root.add(ownMesh(polyGeo(I.sand, [], 0.012, 1), MAT.approach));
  }
  bankStrip(river.near, 1, BMAT.bank); // 手前の岸：水は −z 側
  bankStrip(river.far, -1, WASTE[flip ? 1 : 0].bank); // 向こう岸（荒地）：水は +z 側
  // 手前の岸の砂地（兵士が待つところから橋のたもとまで）。岸の線にぴったり合わせる
  const beach = [{ x: padX0, z: ROAD_END }, { x: padX0, z: river.nearZ(padX0) }];
  for (const p of river.near) if (p.x > padX0 && p.x < padX1) beach.push(p);
  beach.push({ x: padX1, z: river.nearZ(padX1) }, { x: padX1, z: ROAD_END });
  root.add(ownMesh(polyGeo(beach, [], 0.012, 1), MAT.approach));
}

// ---------- 川の飾り：岸の葦と岩、泳ぐ魚（水面に影が見える）、ときどき跳ねる魚 ----------
const REED_GEO = (() => { const g = new THREE.ConeGeometry(0.075, 1, 4, 1); g.translate(0, 0.5, 0); return g; })();
const DECO_MAT = { reed: new THREE.MeshLambertMaterial({ color: 0xffffff }), rock: new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }) };
const FISH_GEO = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.9); sh.quadraticCurveTo(0.34, 0.3, 0.12, -0.42); sh.lineTo(0.4, -0.85); sh.lineTo(-0.4, -0.85); sh.lineTo(-0.12, -0.42); sh.quadraticCurveTo(-0.34, 0.3, 0, 0.9); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; })();
const FISH_MAT = new THREE.MeshBasicMaterial({ color: 0x143c5a, transparent: true, opacity: 0.3, depthWrite: false });
const JUMP_MAT = new THREE.MeshLambertMaterial({ color: 0xe0a060 });
// 蓮の葉：切れこみのある丸い葉。ときどき花
const LOTUS_GEO = (() => { const g = new THREE.CircleGeometry(1, 22, 0.35, Math.PI * 2 - 0.7); g.rotateX(-Math.PI / 2); return g; })();
const LOTUS_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const LOTUS_FLOWER_GEO = (() => { const g = new THREE.ConeGeometry(0.3, 0.42, 7, 1, true); g.rotateX(Math.PI); g.translate(0, 0.21, 0); return g; })();
const LOTUS_FLOWER_MAT = new THREE.MeshLambertMaterial({ color: 0xf3a6c4, side: THREE.DoubleSide });
const RIPPLE_GEO = (() => { const g = new THREE.RingGeometry(0.62, 0.8, 28); g.rotateX(-Math.PI / 2); return g; })();
// 橋の床の上か：{ type, wide（アンコールの張り出し）, noRail } か null
function makeOnBridge(geo) {
  if (!geo.river) return () => null;
  const hw = RIVER.BW / 2;
  const bul = (geo.bulges || []).map((b) => { const o = b.outline; return { type: b.type, sd: polySD(o.concat([{ x: b.edge - b.dir * 0.3, z: o[o.length - 1].z }, { x: b.edge - b.dir * 0.3, z: o[0].z }])) }; });
  const segD = (x, z, a, b) => { const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2)); return Math.hypot(a.x + ex * t - x, a.z + ez * t - z); };
  return (x, z) => {
    for (const b of bul) if (b.sd(x, z) < 0) return { type: b.type, wide: true };
    for (const c of geo.curves || []) for (let i = 1; i < c.pts.length; i++) if (segD(x, z, c.pts[i - 1], c.pts[i]) < hw) return { type: c.type };
    for (const b of geo.bridges) if (Math.abs(x - b.x) < hw + 0.2 && z < b.z0 + 0.8 && z > b.z1 - 0.8) return { type: b.type, noRail: !!(b.o && b.o.noRail) };
    return null;
  };
}
function decorateRiver(root, geo, seed) {
  const rv = geo.river;
  if (!rv) return null;
  const rng = G.mulberry32((seed ^ 0x51ed27) >>> 0), hw = RIVER.BW / 2, e = geo.ext, xMid = (e.x0 + e.x1) / 2;
  const isl = rv.island ? polySD(rv.island.outline) : null;
  const bul = (geo.bulges || []).map((b) => polySD(b.outline.concat([{ x: b.edge, z: b.outline[b.outline.length - 1].z }, { x: b.edge, z: b.outline[0].z }])));
  const nearBridge = (x, z, m) =>
    geo.bridges.some((b) => Math.abs(x - b.x) < hw + m && z < b.z0 + 0.8 + m && z > b.z1 - 0.8 - m) ||
    (geo.curves || []).some((c) => c.pts.some((q) => Math.hypot(q.x - x, q.z - z) < hw + m)) ||
    bul.some((f) => f(x, z) < m);
  const water = (x, z, m) => rv.inRiver(x, z, -m) && !(isl && isl(x, z) < m);
  // 岸の線に沿って、水ぎわ（斜面が水面に入るところ）に葦と岩
  const reeds = [], reedC = [], rocksM = [], rockC = [];
  const flip = !!geo.farFlip;
  const shore = (line, sg, kind) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (Math.abs(a.x - xMid) > 95 && Math.abs(b.x - xMid) > 95) continue;
      for (let u = rng() * 1.8; u < L; u += 1.4 + rng() * 1.6) {
        const t = u / (L || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        if (Math.abs(x - xMid) > 95) continue;
        const tx = (b.x - a.x) / (L || 1), tz = (b.z - a.z) / (L || 1), nx = sg * tz, nz = -sg * tx, o = (a.o || 3) * 0.75 + 0.15;
        const wx = x + nx * o, wz = z + nz * o;
        if (nearBridge(wx, wz, 1.6)) continue;
        const dry = kind === 'far';
        if (rng() < (dry ? 0.22 : 0.42)) { // 葦のひとかたまり
          const nb = 4 + Math.floor(rng() * 6), hgt = (dry ? 2.5 : 2.8) + rng() * 1.1;
          for (let k = 0; k < nb; k++) {
            const r = rng() * 0.55, th = rng() * 6.28, h = hgt * (0.7 + rng() * 0.4);
            dummy.position.set(wx + Math.cos(th) * r + nx * (rng() - 0.3) * 0.6, RIVER.WATER_Y - 0.15, wz + Math.sin(th) * r + nz * (rng() - 0.3) * 0.6);
            dummy.rotation.set((rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.5);
            dummy.scale.set(1, h, 1); dummy.updateMatrix(); reeds.push(dummy.matrix.clone());
            const c = new THREE.Color();
            if (dry) c.setHSL(0.1 + rng() * 0.04, 0.38 + rng() * 0.14, 0.46 + rng() * 0.14); else c.setHSL(0.21 + rng() * 0.09, 0.42 + rng() * 0.2, 0.3 + rng() * 0.16);
            if (dry && flip) flipColor(c);
            reedC.push(c);
          }
        }
        if (rng() < 0.16) { // 水ぎわの岩
          const sc = 0.35 + rng() * 0.7;
          dummy.position.set(wx + (rng() - 0.5) * 1.2, RIVER.WATER_Y + sc * 0.15, wz + (rng() - 0.5) * 1.2);
          dummy.rotation.set(rng() * 3, rng() * 6.28, rng() * 3);
          dummy.scale.set(sc * (0.9 + rng() * 0.5), sc * (0.6 + rng() * 0.3), sc * (0.9 + rng() * 0.5)); dummy.updateMatrix(); rocksM.push(dummy.matrix.clone());
          const c = new THREE.Color(), v = 0.42 + rng() * 0.2;
          c.setRGB(v * 1.04, v, v * 0.92);
          if (kind === 'far') { c.setRGB(v * 1.15, v * 0.86, v * 0.7); if (flip) flipColor(c); }
          rockC.push(c);
        }
      }
    }
  };
  // 蓮の葉：岸から少し離れた水の上に、いくつか集めて浮かべる
  const pads = [], padC = [], flowers = [];
  const lotus = (line, sg, kind) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], L = Math.hypot(b.x - a.x, b.z - a.z);
      for (let u = rng() * 4; u < L; u += 3 + rng() * 4) {
        if (rng() > (kind === 'far' ? 0.08 : 0.3)) continue;
        const t = u / (L || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        if (Math.abs(x - xMid) > 90) continue;
        const tx = (b.x - a.x) / (L || 1), tz = (b.z - a.z) / (L || 1), nx = sg * tz, nz = -sg * tx, d = (a.o || 3) * 0.75 + 1.8 + rng() * 3;
        const cx = x + nx * d, cz = z + nz * d;
        if (!water(cx, cz, 1.2) || nearBridge(cx, cz, 2.5)) continue;
        const nl = 4 + Math.floor(rng() * 6);
        for (let k = 0; k < nl; k++) {
          const r = rng() * 2.8, th = rng() * 6.28, px = cx + Math.cos(th) * r, pz = cz + Math.sin(th) * r, sc = 0.75 + rng() * 0.8;
          if (!water(px, pz, sc * 0.9) || nearBridge(px, pz, 1.2)) continue;
          dummy.position.set(px, RIVER.WATER_Y + 0.035 + pads.length * 0.0004, pz);
          dummy.rotation.set((rng() - 0.5) * 0.06, rng() * 6.28, (rng() - 0.5) * 0.06);
          dummy.scale.set(sc, 1, sc); dummy.updateMatrix(); pads.push(dummy.matrix.clone());
          padC.push(new THREE.Color().setHSL(0.26 + rng() * 0.07, 0.45 + rng() * 0.15, 0.27 + rng() * 0.12));
          if (k === 0 && rng() < 0.25) { dummy.position.y += 0.02; dummy.scale.setScalar(0.9 + rng() * 0.4); dummy.updateMatrix(); flowers.push(dummy.matrix.clone()); }
        }
      }
    }
  };
  shore(rv.near, 1, 'near');
  shore(rv.far, -1, 'far');
  lotus(rv.near, 1, 'near');
  lotus(rv.far, -1, 'far');
  if (rv.island) { shore(rv.island.near, -1, 'island'); shore(rv.island.far, 1, 'island'); lotus(rv.island.near, -1, 'island'); lotus(rv.island.far, 1, 'island'); }
  instM(root, REED_GEO, DECO_MAT.reed, reeds, reedC);
  instM(root, ROCK_GEO, DECO_MAT.rock, rocksM, rockC);
  instM(root, LOTUS_GEO, LOTUS_MAT, pads, padC);
  instM(root, LOTUS_FLOWER_GEO, LOTUS_FLOWER_MAT, flowers);
  // 泳ぐ魚：水面に映る影。ときどき1匹が跳ねる
  const fish = [];
  for (let i = 0; i < 400 && fish.length < 9; i++) {
    const x = e.x0 - 25 + rng() * (e.x1 - e.x0 + 50), z = rv.zMin + rng() * (rv.zMax - rv.zMin);
    if (water(x, z, 3)) fish.push({ x, z, a: rng() * 6.28, v: 1 + rng() * 1.3, s: 0.9 + rng() * 0.7, ph: rng() * 6.28, turn: 0 });
  }
  const fm = new THREE.InstancedMesh(FISH_GEO, FISH_MAT, Math.max(1, fish.length));
  fm.count = fish.length; fm.userData.inst = true; fm.frustumCulled = false; root.add(fm);
  const jm = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), JUMP_MAT); jm.userData.own = true; jm.visible = false; root.add(jm);
  const ripples = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(RIPPLE_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; root.add(m); return { m, t: 9 }; });
  return { fish, fm, jm, ripples, jump: null, next: 2 + rng() * 3, water };
}
function ripple(F, x, z) {
  const r = F.ripples.reduce((a, b) => (a.t > b.t ? a : b));
  r.t = 0; r.m.position.set(x, RIVER.WATER_Y + 0.04, z); r.m.visible = true;
}
// 川の音を聞く位置：ふつうはカメラ。真上から見下ろすときは、見ているところ（画面の真ん中の地面）の少し上で聞く
const earPos = new THREE.Vector3();
function ear() {
  if (game.screen === 'game' && camMode === 'over' && !bossCamOn() && !(game.phase === 'mine' && hole)) return earPos.set(camLook.x, RIVER.WATER_Y + 15, camLook.z);
  return earPos.copy(camera.position);
}
// 聞く位置からの近さ（22 より近いと 1、60 より遠いと 0）：川の音の大きさに使う
const fade = (d) => 1 - smoothstep((d - 22) / 38);
const nearness = (x, y, z) => { const e = ear(); return fade(Math.hypot(e.x - x, e.y - y, e.z - z)); };
// 川にどれだけ近いか：川から離れた陸の上や、高いところからでは聞こえない（真上から見下ろすときは、見ているところで聞く）
function riverNearness() {
  const rv = course && course.geo.river;
  if (!rv) return 0;
  const p = ear();
  let h = 0; // 水の上からの横のへだたり
  if (!rv.inRiver(p.x, p.z, 0)) { const nz = rv.nearZ(p.x), fz = rv.farZ(p.x); h = p.z > nz ? p.z - nz : p.z < fz ? fz - p.z : 0; }
  return fade(Math.hypot(h, p.y - RIVER.WATER_Y));
}
function updateFish(F, dt) {
  if (!F) return;
  for (const f of F.fish) {
    f.turn += (Math.random() - 0.5) * dt * 1.6; f.turn *= 1 - Math.min(1, dt * 0.8);
    f.a += f.turn * dt;
    const hx = Math.sin(f.a), hz = Math.cos(f.a);
    if (!F.water(f.x + hx * 3.5, f.z + hz * 3.5, 1.5)) f.a += dt * 3.2; // 岸に近づいたら向きを変える
    f.x += Math.sin(f.a) * f.v * dt; f.z += Math.cos(f.a) * f.v * dt;
  }
  F.fish.forEach((f, i) => {
    dummy.position.set(f.x, RIVER.WATER_Y + 0.03, f.z);
    dummy.rotation.set(0, Math.atan2(-Math.sin(f.a), -Math.cos(f.a)) + Math.sin(clock * 7 + f.ph) * 0.18, 0);
    dummy.scale.setScalar(f.s); dummy.updateMatrix(); F.fm.setMatrixAt(i, dummy.matrix);
  });
  F.fm.instanceMatrix.needsUpdate = true;
  // 跳ねる魚
  F.next -= dt;
  if (!F.jump && F.next <= 0 && F.fish.length) {
    const f = F.fish[Math.floor(Math.random() * F.fish.length)];
    F.jump = { x: f.x, z: f.z, hx: Math.sin(f.a), hz: Math.cos(f.a), t: 0, d: 0.8, h: 1.6 + Math.random() * 0.8, L: 2.6 + Math.random() * 1.2 };
    F.next = 3 + Math.random() * 4;
    ripple(F, f.x, f.z);
    if (game.screen === 'game') sfx('plop', nearness(f.x, RIVER.WATER_Y, f.z)); // 近くで跳ねたときだけ聞こえる
  }
  if (F.jump) {
    const j = F.jump;
    j.t += dt;
    const u = Math.min(1, j.t / j.d), y = RIVER.WATER_Y + j.h * Math.sin(Math.PI * u);
    F.jm.visible = true;
    F.jm.position.set(j.x + j.hx * j.L * u, y, j.z + j.hz * j.L * u);
    F.jm.rotation.set(0, 0, 0);
    F.jm.lookAt(j.x + j.hx * j.L * (u + 0.05), RIVER.WATER_Y + j.h * Math.sin(Math.PI * Math.min(1, u + 0.05)), j.z + j.hz * j.L * (u + 0.05));
    F.jm.scale.set(0.2, 0.26, 0.62);
    if (u >= 1) { F.jm.visible = false; ripple(F, j.x + j.hx * j.L, j.z + j.hz * j.L); F.jump = null; }
  }
  for (const r of F.ripples) {
    if (r.t > 1.2) { r.m.visible = false; continue; }
    r.t += dt;
    r.m.scale.setScalar(1 + r.t * 2.4);
    r.m.material.opacity = Math.max(0, 0.55 * (1 - r.t / 1.2));
  }
}
