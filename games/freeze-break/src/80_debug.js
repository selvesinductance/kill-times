// デバッグ: ?debug（情報表示とスクラブバー）、?t=秒（その時刻から）、?auto（自動成功）、?hold（時間を止める）
// 検証スクリプト用に window.__fb で状態を公開する
const Debug = (() => {
  const q = new URLSearchParams(location.search);
  const D = {
    on: q.has('debug'),
    auto: q.has('auto'),
    hold: q.has('hold'),
    startT: q.has('t') ? parseFloat(q.get('t')) : null,
    reducedMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
    fps: 0,
    frames: 0,
    acc: 0,
    errors: [],
    bar: null,
  };

  D.reportError = e => {
    const msg = String((e && e.stack) || e);
    if (D.errors.length < 20 && !D.errors.includes(msg)) {
      D.errors.push(msg);
      console.error(msg);
    }
  };

  D.init = () => {
    addEventListener('error', e => D.reportError(e.error || e.message));
    addEventListener('unhandledrejection', e => D.reportError(e.reason));
    window.__fb = {
      get state() {
        return Game.state;
      },
      get t() {
        return Game.t;
      },
      get stage() {
        return Game.stage.id;
      },
      get playTime() {
        return Game.playTime;
      },
      get realPlay() {
        return Game.realPlay;
      },
      get results() {
        return JSON.parse(JSON.stringify(Game.results));
      },
      get errors() {
        return D.errors.slice();
      },
      gateScreenPos() {
        const g = Game.stage.gateObj;
        return g ? Space.toScreen(g.x, g.y) : null;
      },
      retryScreenPos() {
        return View.toClient(UI.retry.x, UI.retry.y);
      },
      // 検証用: いまのゲートを正しく操作する手順（画面座標）と、ミスの回数
      gateDemo() {
        const g = Game.stage.gateObj;
        const kind = g && GateKinds[g.kindName];
        if (!kind || !kind.demo) return null;
        return kind.demo(g).map(([a, x, y, steps]) => {
          const c = Space.toScreen(x, y);
          return { a, x: c.x, y: c.y, steps: steps || 1 };
        });
      },
      gateMisses() {
        const g = Game.stage.gateObj;
        return g ? g.misses : 0;
      },
      audio() {
        return { ctx: Sound.ctx ? Sound.ctx.state : null, mode: Music.mode, level: Music.level, muted: Sound.muted };
      },
      mutePos() {
        const m = UI.mutePos();
        return View.toClient(m.x, m.y);
      },
      w3d() {
        if (!World3D.ok) return { ok: false };
        const c = World3D.camera;
        return {
          ok: true,
          spec: World3D.specAmp ? [Math.max(...World3D.specAmp.slice(0, 64)), Sound.ctx ? Sound.ctx.state : 'none'] : null,
          vis: World3D.canvas.style.visibility,
          objs: World3D.scene.children.length,
          cam: [c.position.x, c.position.y, c.position.z].map(Math.round),
          pm: World3D.pm,
          size: [World3D.canvas.width, World3D.canvas.height],
        };
      },
      jumpTo(t) {
        Game.jumpTo(t);
      },
      dump() {
        // 検証用: 3Dの場面の指紋（全ての物の見え方・位置・向き・大きさ・材質。粒と音のスペクトルは乱数と音で変わるので形だけ）
        if (!World3D.ok) return null;
        const r = (v, d = 1) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
        const out = [];
        World3D.scene.traverse(o => {
          const m = o.material && !Array.isArray(o.material) ? o.material : null;
          const rnd = m && (m === World3D.fxMat || m === World3D.specMat);
          const e = [o.type, o.visible ? 1 : 0];
          if (!rnd) {
            const spin = o === World3D.bg || o.parent === World3D.bg; // 背景の図形は実時間で回るので向きは比べない
            e.push(
              o.position.toArray().map(v => r(v)),
              spin ? 0 : [o.rotation.x, o.rotation.y, o.rotation.z].map(v => r(v, 3)),
              o.scale.toArray().map(v => r(v, 3)),
            );
            if (m)
              e.push([
                m.color ? m.color.getHexString() : '',
                r(m.opacity, 3),
                m.emissiveIntensity != null ? r(m.emissiveIntensity, 3) : '',
                m.visible ? 1 : 0,
              ]);
            if (o.isInstancedMesh) {
              let sm = 0;
              o.instanceMatrix.array.forEach((v, i) => {
                sm += v * ((i % 13) + 1);
              });
              e.push(r(sm, 0));
            }
            if (m && m.uniforms && m.uniforms.k) e.push(r(m.uniforms.k.value, 3));
          } else if (o.geometry && o.geometry.drawRange && m === World3D.fxMat && o.geometry !== World3D.fxGeo) {
            const pa = o.geometry.attributes.position.array;
            const n = Math.min(o.geometry.drawRange.count, pa.length / 3);
            let sm = 0;
            for (let i = 0; i < n * 3; i++) sm += pa[i] * ((i % 7) + 1);
            e.push(n, r(sm, 0));
          }
          out.push(e);
        });
        const c = World3D.camera;
        return {
          cam: c.position.toArray().map(v => r(v)),
          fov: r(c.fov, 2),
          pm: World3D.pm ? Object.values(World3D.pm).map(v => r(v, 2)) : null,
          stage: Game.stage.id,
          objs: out,
        };
      },
      // 検証用: 区間の3Dカメラ
      cam(st, u) {
        const c = StageDefs[st].three.camera(u);
        return { pos: c.pos.map(Math.round), look: c.look.map(Math.round) };
      },
      hide(name) {
        const [st, key] = name.split('.');
        const T = StageDefs[st].three.T;
        [].concat(T[key]).forEach(m => {
          m.visible = false;
          m.userData.dbgHidden = true;
        });
      },
      probe(name) {
        // 検証用: 区間の3Dの部品の画面上の四隅（例 probe('C.tiles')）
        const [st, key] = name.split('.');
        const T = StageDefs[st] && StageDefs[st].three && StageDefs[st].three.T;
        if (!T || !T[key]) return null;
        return []
          .concat(T[key])
          .slice(0, 12)
          .map(m => {
            m.updateMatrixWorld(true);
            const bb = new THREE.Box3().setFromObject(m);
            const pts = [];
            for (const x of [bb.min.x, bb.max.x])
              for (const y of [bb.min.y, bb.max.y])
                for (const z of [bb.min.z, bb.max.z]) {
                  const q = World3D.project(x, y, z);
                  pts.push([Math.round(q.x), Math.round(q.y)]);
                }
            return {
              min: bb.min.toArray().map(Math.round),
              max: bb.max.toArray().map(Math.round),
              rot: [m.rotation.x, m.rotation.y, m.rotation.z].map(v => +v.toFixed(2)),
              scr: pts,
            };
          });
      },
    };
    if (!D.on) return;
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;display:flex;gap:10px;align-items:center;z-index:10;font:12px ui-monospace,monospace;color:#f4f1ea';
    const bar = document.createElement('input');
    Object.assign(bar, { type: 'range', min: 0, max: 20, step: 0.05, value: 0 });
    bar.style.flex = '1';
    const hold = document.createElement('input');
    hold.type = 'checkbox';
    hold.checked = D.hold;
    const label = document.createElement('label');
    label.append(hold, ' hold (H)');
    bar.addEventListener('input', () => {
      Game.jumpTo(parseFloat(bar.value));
      Game.hold = true;
      hold.checked = true;
    });
    hold.addEventListener('change', () => {
      Game.hold = hold.checked;
    });
    addEventListener('keydown', e => {
      if (e.key === 'h' || e.key === 'H') {
        Game.hold = !Game.hold;
        hold.checked = Game.hold;
      }
    });
    wrap.append(bar, label);
    document.body.append(wrap);
    D.bar = bar;
  };

  D.tick = dt => {
    D.frames++;
    D.acc += dt;
    if (D.acc >= 0.5) {
      D.fps = Math.round(D.frames / D.acc);
      D.frames = 0;
      D.acc = 0;
    }
    if (D.bar && document.activeElement !== D.bar) D.bar.value = Game.t;
  };

  D.draw = ctx => {
    if (!D.on) return;
    const g = Game.stage.gateObj;
    const lines = [
      `t ${Game.t.toFixed(2)}  stage ${Game.stage.id}  ${Game.state}  x${Game.timeScale.toFixed(2)}${Game.hold ? '  HOLD' : ''}`,
      `fps ${D.fps}  play ${Game.playTime.toFixed(2)}  real ${Game.realPlay.toFixed(2)}`,
      g ? `gate ${g.id} ${g.kindName}  ${g.elapsed.toFixed(2)}s  hint ${g.hint}  miss ${g.misses}` : 'gate -',
      ...CONFIG.scoredGates.map(id => {
        const r = Game.results[id];
        return r ? `${id} ${r.reaction.toFixed(2)} ${r.rank}` : `${id} -`;
      }),
    ];
    View.pixelTransform(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 330, 14 + lines.length * 16);
    ctx.fillStyle = '#9ff5e9';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, 16, 15 + i * 16));
  };

  return D;
})();
