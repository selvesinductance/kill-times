// 3D の世界（three.js / WebGL）。奥のキャンバスに描き、手前の2Dキャンバス（操作対象・画面効果・UI）と重ねる。
// three.js が読めない・WebGL が使えないときは ok = false のまま（2D版で動く）。
// 3D の座標は y が上向き。ゲート平面の2D座標は y が下向き（今までの2Dと同じ）。
const World3D = (() => {
  const W = {
    ok: false,
    canvas: null,
    renderer: null,
    scene: null,
    camera: null,
    rt: null,
    post: null,
    postScene: null,
    postCam: null,
    plane: null,
    pm: null,
  };
  const PMAX = 2600; // 粒の上限（フィナーレの花火で増やした）
  const colors = {};
  const rgb = hex =>
    colors[hex] ||
    (colors[hex] = (() => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    })());

  W.init = canvas => {
    W.canvas = canvas;
    if (typeof THREE === 'undefined' || /[?&]flat\b/.test(location.search)) return; // ?flat で 2D版を確かめる
    try {
      const r = new THREE.WebGLRenderer({ canvas, antialias: true });
      r.setClearColor(new THREE.Color(CONFIG.colors.bg), 1);
      W.renderer = r;
      W.scene = new THREE.Scene();
      W.scene.fog = new THREE.Fog(CONFIG.colors.bg, 3200, 12000);
      W.camera = new THREE.PerspectiveCamera(50, 1, 10, 20000); // near 10: 深度の精度を上げる
      W.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(0.4, 1, 0.8);
      W.scene.add(key);
      // 凍結の見た目: 3D を一度テクスチャに描き、全画面の四角形で彩度落とし・暗転・周辺減光（心拍で脈打つ）
      W.rt = new THREE.WebGLRenderTarget(4, 4, { stencilBuffer: true }); // ステンシル付きにすると深度が 24bit になる（16bit だと離れた壁とタイルがちらつく）
      W.post = new THREE.ShaderMaterial({
        uniforms: { tex: { value: W.rt.texture }, freeze: { value: 0 }, heart: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tex; uniform float freeze; uniform float heart; varying vec2 vUv;',
          'void main() {',
          '  vec4 c = texture2D(tex, vUv);',
          '  float g = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
          '  vec3 col = mix(c.rgb, vec3(g), 0.85 * freeze) * (1.0 - 0.35 * freeze);',
          '  float d = distance(vUv, vec2(0.5));',
          '  col *= 1.0 - freeze * smoothstep(0.22 + 0.03 * heart, 0.8, d) * (0.6 + 0.12 * heart);',
          '  gl_FragColor = vec4(col, 1.0);',
          '}',
        ].join('\n'),
        depthTest: false,
        depthWrite: false,
      });
      W.postScene = new THREE.Scene();
      W.postScene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), W.post));
      W.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      initFx();
      initBg();
      initSpectrum();
      // 背景の星（奥行きと視差を出す。全3D区間で共通）
      const R = rng(7);
      const N = 700;
      const sp = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        sp[i * 3] = (R() - 0.5) * 7000;
        sp[i * 3 + 1] = -2500 + R() * 7000;
        sp[i * 3 + 2] = -500 - R() * 5000;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      W.stars = new THREE.Points(
        sg,
        new THREE.PointsMaterial({
          color: 0xa9b8ff,
          size: 9,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          map: new THREE.CanvasTexture(
            smoothRadial(32, [
              [0, 255, 255, 255, 255],
              [1, 255, 255, 255, 0],
            ]),
          ),
        }),
      ); // 足し合わせのみ（光の上で暗い点にならない）
      W.scene.add(W.stars);
      W.ok = true;
      W.resize();
    } catch (e) {
      W.ok = false;
      Debug.reportError(e);
    }
  };

  W.resize = () => {
    if (!W.ok) return;
    W.pr = Math.min(View.dpr, 2); // 3D の描画解像度の上限（スマホの dpr 3 では 2 に抑えて軽く）
    W.renderer.setPixelRatio(W.pr);
    W.renderer.setSize(View.w, View.h, false);
    W.rt.setSize(Math.round(View.w * W.pr), Math.round(View.h * W.pr));
    W.camera.aspect = View.w / View.h;
    W.camera.updateProjectionMatrix();
  };
  W.show = on => {
    if (W.canvas) W.canvas.style.visibility = on ? 'visible' : 'hidden';
  };
  // 画面の短辺に span 単位が収まるカメラ距離（2D の論理 1000 単位と同じ見え方にする）
  W.fitDist = (fov = 50, span = CONFIG.logical) => span / 2 / (Math.tan((fov * Math.PI) / 360) * Math.min(1, View.w / View.h));

  // cam: { pos, look, fov, roll }。sh: 揺れ（論理単位）、zoom: 突きと拍の寄り
  W.render = (cam, sh = { x: 0, y: 0, rot: 0 }, zoom = 1) => {
    const c = W.camera;
    const fov = (cam.fov || 50) / zoom;
    c.fov = fov;
    c.updateProjectionMatrix();
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    const up = cam.up || [0, 1, 0]; // 真上を見上げるときは up を (0,0,-1) などにする
    c.up.set(up[0], up[1], up[2]);
    c.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    c.rotateZ((cam.roll || 0) + sh.rot);
    const dist = Math.hypot(cam.pos[0] - cam.look[0], cam.pos[1] - cam.look[1], cam.pos[2] - cam.look[2]);
    const k = dist / 1000;
    c.translateX(sh.x * k);
    c.translateY(-sh.y * k);
    c.updateMatrixWorld();
    if (W.bg) updateBg(c);
    if (W.specGeo) {
      const now = performance.now() / 1000;
      updateSpectrum(Math.min(0.1, now - (W.specT || now)));
      W.specT = now;
    }
    W.fxMat.uniforms.scale.value = (View.h * (W.pr || View.dpr)) / (2 * Math.tan((fov * Math.PI) / 360));
    W.post.uniforms.freeze.value = FX.freezeK * (Game.stage && Game.stage.id === 'T' ? 0.3 : 1); // タイトルはボタンの色を残す（押す場所が分かるように）
    W.post.uniforms.heart.value = Beat.heart;
    if (W.stars) W.stars.material.opacity = 0.35 + 0.35 * Beat.pulse + 0.25 * Beat.heart; // 拍と心拍で星が瞬く
    W.renderer.setRenderTarget(W.rt);
    W.renderer.render(W.scene, c);
    W.renderer.setRenderTarget(null);
    W.renderer.render(W.postScene, W.postCam);
  };

  // 3D の点 → 画面（CSS px）
  W.project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(W.camera);
    return { x: (v.x * 0.5 + 0.5) * View.w + View.left, y: (-v.y * 0.5 + 0.5) * View.h + View.top, z: v.z };
  };

  // ---- ゲート平面: 平面の2D座標（y下向き）↔ 3D ↔ 画面 ----
  // plane: { o: 原点, r: 右方向の単位ベクトル, d: 下方向の単位ベクトル }（平面の1単位 = 世界の1単位）
  W.setPlane = pl => {
    W.plane = pl;
    const S = 100;
    const o = pl.o;
    const r = pl.r;
    const d = pl.d;
    const p0 = W.project(o[0], o[1], o[2]);
    const pr = W.project(o[0] + r[0] * S, o[1] + r[1] * S, o[2] + r[2] * S);
    const pd = W.project(o[0] + d[0] * S, o[1] + d[1] * S, o[2] + d[2] * S);
    W.pm = { a: (pr.x - p0.x) / S, b: (pr.y - p0.y) / S, c: (pd.x - p0.x) / S, d: (pd.y - p0.y) / S, e: p0.x, f: p0.y };
  };
  W.planeToScreen = (x, y) => {
    const m = W.pm;
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  };
  W.screenToPlane = (sx, sy) => {
    const m = W.pm;
    const det = m.a * m.d - m.b * m.c;
    const X = sx - m.e;
    const Y = sy - m.f;
    return { x: (m.d * X - m.c * Y) / det, y: (-m.b * X + m.a * Y) / det };
  };
  W.applyPlane = ctx => {
    const m = W.pm;
    const k = View.dpr;
    ctx.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, (m.e - View.left) * k, (m.f - View.top) * k);
  };
  W.planePoint = (x, y) => {
    const p = W.plane;
    return [0, 1, 2].map(i => p.o[i] + p.r[i] * x + p.d[i] * y);
  };
  W.planeVec = (x, y) => {
    const p = W.plane;
    return [0, 1, 2].map(i => p.r[i] * x + p.d[i] * y);
  };
  W.planeNormal = () => {
    const r = W.plane.r;
    const d = W.plane.d;
    return [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  };

  // ---- 3D の粒子と衝撃波（世界座標）。凍結中とヒットストップ中は空中で止まる ----
  W.fx = { parts: [], rings: [] };
  function initFx() {
    const geo = new THREE.BufferGeometry();
    W.fxPos = new Float32Array(PMAX * 3);
    W.fxCol = new Float32Array(PMAX * 3);
    W.fxSize = new Float32Array(PMAX);
    W.fxAlpha = new Float32Array(PMAX);
    W.fxSeed = new Float32Array(PMAX);
    W.fxMix = new Float32Array(PMAX);
    geo.setAttribute('position', new THREE.BufferAttribute(W.fxPos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(W.fxCol, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(W.fxSize, 1));
    geo.setAttribute('palpha', new THREE.BufferAttribute(W.fxAlpha, 1));
    geo.setAttribute('pseed', new THREE.BufferAttribute(W.fxSeed, 1));
    geo.setAttribute('pmix', new THREE.BufferAttribute(W.fxMix, 1)); // 虹色の混ぜ具合（ふつうは 0.65、花火は自分の色を強く）
    W.fxMat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 1 }, time: { value: 0 } }, // 粒: 虹色に移ろい、瞬き、十字に光る
      vertexShader: [
        'attribute vec3 pcolor; attribute float psize; attribute float palpha; attribute float pseed; attribute float pmix; uniform float scale; uniform float time; varying vec3 vC; varying float vA; varying float vS; varying float vM;',
        'void main() { vC = pcolor; vA = palpha; vS = pseed; vM = pmix; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 1.8 * psize * scale / -mv.z * (1.0 + 0.35 * sin(time * 11.0 + pseed * 60.0)); gl_Position = projectionMatrix * mv; }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vC; varying float vA; varying float vS; varying float vM; uniform float time;',
        'vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }',
        'void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; float core = smoothstep(0.55, 0.0, d);',
        '  float rays = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.0) + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.0);',
        '  float tw = 0.5 + 0.5 * sin(time * 17.0 + vS * 50.0); vec3 col = mix(vC, hue(fract(vS + time * 0.4)), vM);',
        '  float a = (core + rays * (0.35 + 0.65 * tw)) * vA; gl_FragColor = vec4(col * a * (0.8 + 0.7 * tw) + vec3(pow(core, 5.0)) * vA, a); }',
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    W.fxGeo = geo;
    const pts = new THREE.Points(geo, W.fxMat);
    pts.frustumCulled = false;
    W.scene.add(pts);
    W.ringGeo = new THREE.RingGeometry(0.92, 1, 64);
  }
  W.spawn = q => {
    // q: { p, v, g, life, size, color（または c: [r,g,b]）, drag, live, mix（虹色の混ぜ具合）, trail: { dt, life, size }（尾を引く） }
    if (W.fx.parts.length >= PMAX) W.fx.parts.shift();
    W.fx.parts.push({
      p: q.p.slice(),
      v: q.v.slice(),
      g: q.g || [0, 0, 0],
      life: q.life,
      age: 0,
      size: q.size,
      c: q.c || rgb(q.color),
      drag: q.drag == null ? 3 : q.drag,
      live: !!q.live,
      seed: Math.random(),
      mix: q.mix == null ? 0.65 : q.mix,
      trail: q.trail || null,
      tacc: 0,
    });
  };
  // 決まった道を動く「きらめく粒」の群れ（3Dの粒と同じくっきりした見た目。位置は毎フレーム begin → add … → end で与える）
  W.sparkles = (n, parent) => {
    const g = new THREE.BufferGeometry();
    const A = {
      pos: new Float32Array(n * 3),
      col: new Float32Array(n * 3),
      size: new Float32Array(n),
      alpha: new Float32Array(n),
      seed: new Float32Array(n),
      mix: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) A.seed[i] = Math.random();
    [
      ['position', A.pos, 3],
      ['pcolor', A.col, 3],
      ['psize', A.size, 1],
      ['palpha', A.alpha, 1],
      ['pseed', A.seed, 1],
      ['pmix', A.mix, 1],
    ].forEach(([k, arr, w]) => g.setAttribute(k, new THREE.BufferAttribute(arr, w)));
    const pts = new THREE.Points(g, W.fxMat);
    pts.frustumCulled = false;
    (parent || W.scene).add(pts);
    let cnt = 0;
    return {
      pts,
      begin() {
        cnt = 0;
      },
      add(p, size, color, alpha = 1, mix = 0.65) {
        if (cnt >= n) return;
        A.pos.set(p, cnt * 3);
        A.col.set(rgb(color), cnt * 3);
        A.size[cnt] = size;
        A.alpha[cnt] = alpha;
        A.mix[cnt] = mix;
        cnt++;
      },
      end() {
        g.setDrawRange(0, cnt);
        ['position', 'pcolor', 'psize', 'palpha', 'pmix'].forEach(k => {
          g.attributes[k].needsUpdate = true;
        });
      },
    };
  };
  // 輪のまわりにきらめく粒を散らす（c: 中心、ax/ay: 輪の面の2軸、out: 外へ飛ぶ速さ）
  W.sparkRing = (c, ax, ay, r, n, out = 300, life = 0.8, size = 26) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const d = [0, 1, 2].map(k => ax[k] * ca + ay[k] * sa);
      W.spawn({
        p: c.map((v, k) => v + d[k] * r),
        v: d.map(v => v * out * (0.5 + Math.random())),
        life: life * (0.6 + 0.8 * Math.random()),
        size: size * (0.6 + 0.8 * Math.random()),
        color: '#ffffff',
        drag: 1.5,
      });
    }
  };
  // 背景: 音に合わせて脈打つ図形と、拍ごとにはじけるきらめき（ゲームとは関係なく、カメラのまわりに浮かぶ）
  function initBg() {
    const R = rng(123);
    const cols = [CONFIG.colors.cyan, CONFIG.colors.magenta, CONFIG.colors.violet, CONFIG.colors.spark, CONFIG.colors.coral];
    W.bg = new THREE.Group();
    W.bgItems = [];
    for (let i = 0; i < 56; i++) {
      const t = i % 4;
      const s = 60 + R() * 140;
      const geo =
        t === 0
          ? new THREE.IcosahedronGeometry(s, 0)
          : t === 1
            ? new THREE.OctahedronGeometry(s, 0)
            : t === 2
              ? new THREE.TorusGeometry(s, s * 0.08, 6, 24)
              : new THREE.TetrahedronGeometry(s, 0);
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: cols[i % cols.length],
          wireframe: t !== 2,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      const th = R() * TAU;
      const ph = Math.acos(2 * R() - 1);
      const rad = 3200 + R() * 4000;
      m.position.set(rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph), rad * Math.sin(ph) * Math.sin(th));
      m.userData = { spin: [(R() - 0.5) * 1.2, (R() - 0.5) * 1.2], off: i % 2 === 1, base: 1 };
      W.bg.add(m);
      W.bgItems.push(m);
    }
    W.scene.add(W.bg);
  }
  // スペクトログラム: 音の周波数（x）× 強さ（y）× 時間（z、新しい行が 0、古い行ほど −1 へ流れる）を、虹色に瞬く粒の立体で描く。
  // 形（粒の位置）は1つを共有し、場面ごとに世界の中へ置いた複数の「物」として映す（W.addSpectrum）
  // 粒の数（1つにつき 1728 粒）
  const SB = 48;
  const SR = 36;
  function initSpectrum() {
    const n = SB * SR;
    const geo = new THREE.BufferGeometry();
    W.specPos = new Float32Array(n * 3);
    W.specAmp = new Float32Array(n);
    W.specSeed = new Float32Array(n);
    W.specBin = new Float32Array(n);
    W.specRows = Array.from({ length: SR }, () => new Float32Array(SB));
    W.specHead = 0;
    W.specAcc = 0;
    for (let i = 0; i < n; i++) {
      W.specSeed[i] = Math.random();
      W.specBin[i] = (i % SB) / (SB - 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(W.specPos, 3));
    geo.setAttribute('pamp', new THREE.BufferAttribute(W.specAmp, 1));
    geo.setAttribute('pseed', new THREE.BufferAttribute(W.specSeed, 1));
    geo.setAttribute('pbin', new THREE.BufferAttribute(W.specBin, 1));
    W.specMat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 1 }, time: { value: 0 } },
      vertexShader: [
        'attribute float pamp; attribute float pseed; attribute float pbin; uniform float scale; uniform float time; varying float vA; varying float vS; varying float vB;',
        'void main() { vA = pamp; vS = pseed; vB = pbin; vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = (32.0 + 64.0 * pamp) * scale / -mv.z * (1.0 + 0.3 * sin(time * 9.0 + pseed * 40.0)); gl_Position = projectionMatrix * mv; }',
      ].join('\n'),
      fragmentShader: [
        'varying float vA; varying float vS; varying float vB; uniform float time;',
        'vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }',
        'void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; float core = smoothstep(0.6, 0.0, d);',
        '  float rays = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.0) + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.0);',
        '  float tw = 0.5 + 0.5 * sin(time * 13.0 + vS * 50.0); vec3 col = hue(fract(0.72 - vB * 0.8 + time * 0.05));',
        '  float a = (core + rays * (0.25 + 0.75 * vA) * (0.3 + 0.7 * tw)) * (0.35 + 0.65 * vA); gl_FragColor = vec4(col * a * (0.8 + 0.6 * tw) + vec3(pow(core, 5.0)) * vA * 0.6, a); }',
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    W.specGeo = geo;
    W.specData = null;
  }
  // 世界の中にスペクトログラムを1つ置く。o: { parent, pos, x, y, z（周波数・強さ・時間の向きの世界ベクトル。右手系）, size: [横の半分, 高さ, 奥行き] }
  W.addSpectrum = o => {
    const m = new THREE.Points(W.specGeo, W.specMat);
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    const V = a => new THREE.Vector3(...a).normalize();
    const [sx, sy, sz] = o.size;
    const mx = new THREE.Matrix4().makeBasis(V(o.x).multiplyScalar(sx), V(o.y).multiplyScalar(sy), V(o.z).multiplyScalar(sz));
    mx.setPosition(new THREE.Vector3(...o.pos));
    m.matrix.copy(mx);
    (o.parent || W.scene).add(m);
    return m;
  };
  function specRow() {
    // 今の音の周波数の強さ（低音→高音を対数で 64 本に）。音が無いときは拍から作る
    const row = new Float32Array(SB);
    const an = Sound.analyser;
    if (an && Sound.ctx && Sound.ctx.state === 'running') {
      const N = an.frequencyBinCount;
      if (!W.specData || W.specData.length !== N) W.specData = new Uint8Array(N);
      an.getByteFrequencyData(W.specData);
      for (let b = 0; b < SB; b++) {
        const f0 = Math.floor(2 * Math.pow(N / 2, b / SB));
        const f1 = Math.max(f0 + 1, Math.floor(2 * Math.pow(N / 2, (b + 1) / SB)));
        let m = 0;
        for (let f = f0; f < Math.min(N, f1); f++) m = Math.max(m, W.specData[f]);
        row[b] = Math.pow(m / 255, 1.6);
      }
    } else {
      for (let b = 0; b < SB; b++)
        row[b] = clamp(
          (0.25 + 0.75 * Beat.pulse) * Math.exp(-b / 26) * (0.55 + 0.45 * Math.sin(FX.time * 3 + b * 0.7)) +
            0.25 * Beat.off * Math.exp(-Math.abs(b - 40) / 6) +
            0.3 * Beat.heart * Math.exp(-b / 8),
        );
    }
    return row;
  }
  function updateSpectrum(dt) {
    W.specAcc += dt;
    // 1秒に30行
    if (W.specAcc >= 1 / 30) {
      W.specAcc = 0;
      W.specHead = (W.specHead + 1) % SR;
      W.specRows[W.specHead] = specRow();
    }
    const frac = W.specAcc * 30; // 行の間を滑らかに流す
    for (let r = 0; r < SR; r++) {
      const row = W.specRows[(W.specHead - r + SR) % SR];
      const z = -(r + frac) / SR;
      for (let b = 0; b < SB; b++) {
        const i = r * SB + b;
        const a = row[b];
        W.specPos[i * 3] = (b / (SB - 1)) * 2 - 1;
        W.specPos[i * 3 + 1] = a;
        W.specPos[i * 3 + 2] = z;
        W.specAmp[i] = a * (1 - (r / SR) * 0.6);
      }
    }
    W.specGeo.attributes.position.needsUpdate = true;
    W.specGeo.attributes.pamp.needsUpdate = true;
    W.specMat.uniforms.time.value = FX.time;
    W.specMat.uniforms.scale.value = W.fxMat.uniforms.scale.value;
  }
  function updateBg(cam) {
    W.bg.position.copy(cam.position);
    W.bg.rotation.y = FX.time * 0.02;
    for (const m of W.bgItems) {
      const u = m.userData;
      const p = u.off ? Beat.off : Beat.pulse;
      m.rotation.x = FX.time * u.spin[0];
      m.rotation.y = FX.time * u.spin[1];
      m.scale.setScalar(1 + 0.45 * p + 0.3 * Beat.bar + 0.35 * Beat.heart);
      m.material.opacity = 0.25 + 0.55 * p + 0.3 * Beat.heart;
    }
    if (Beat.onset && Game.phase === 'PLAY') {
      // 拍の頭で背景のどこかにきらめきがはじける（小節の頭は輪）
      for (let j = 0; j < (Beat.barOnset ? 3 : 1); j++) {
        const th = Math.random() * TAU;
        const ph = 0.6 + Math.random() * 1.9;
        const rad = 1800 + Math.random() * 1600;
        const c = [
          cam.position.x + rad * Math.sin(ph) * Math.cos(th),
          cam.position.y + rad * Math.cos(ph),
          cam.position.z + rad * Math.sin(ph) * Math.sin(th),
        ];
        W.sparkRing(c, [1, 0, 0], [0, 1, 0], 40 + Math.random() * 60, Beat.barOnset ? 30 : 18, 500, 0.7, 34);
      }
    }
  }
  W.ring = (pos, normal, color, size, life, live) => {
    const m = new THREE.Mesh(W.ringGeo, W.addMat(color, { side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(pos[0] + normal[0], pos[1] + normal[1], pos[2] + normal[2]);
    m.scale.setScalar(0.001);
    W.scene.add(m);
    W.fx.rings.push({ m, size, life, age: 0, live: !!live });
  };
  W.updateFx = (dt, wdt) => {
    if (!W.ok) return;
    let j = 0;
    const tails = [];
    for (const p of W.fx.parts) {
      const d = p.live ? dt : wdt;
      if (d > 0) {
        p.age += d;
        const k = Math.exp(-p.drag * d);
        for (let i = 0; i < 3; i++) {
          p.v[i] = p.v[i] * k + p.g[i] * d;
          p.p[i] += p.v[i] * d;
        }
        if (p.trail) for (p.tacc += d; p.tacc >= p.trail.dt; p.tacc -= p.trail.dt) tails.push(p); // 尾: 通った所に小さく短い粒を置いていく
      }
      if (p.age < p.life) W.fx.parts[j++] = p;
    }
    W.fx.parts.length = j;
    for (const p of tails)
      W.spawn({
        p: p.p,
        v: [p.v[0] * 0.05, p.v[1] * 0.05 - 30, p.v[2] * 0.05],
        g: [0, -80, 0],
        life: p.trail.life,
        size: p.size * p.trail.size,
        c: p.c,
        drag: 2,
        live: p.live,
        mix: p.mix,
      });
    j = W.fx.parts.length;
    for (let i = 0; i < j; i++) {
      const p = W.fx.parts[i];
      const k = p.age / p.life;
      W.fxPos.set(p.p, i * 3);
      W.fxCol.set(p.c, i * 3);
      W.fxSize[i] = p.size * (1.6 - k);
      W.fxAlpha[i] = 1 - k;
      W.fxSeed[i] = p.seed;
      W.fxMix[i] = p.mix;
    }
    W.fxGeo.setDrawRange(0, j);
    W.fxMat.uniforms.time.value = FX.time; // 凍結中も瞬きは続く
    for (const a of ['position', 'pcolor', 'psize', 'palpha', 'pseed', 'pmix']) W.fxGeo.attributes[a].needsUpdate = true;
    W.fx.rings = W.fx.rings.filter(r => {
      r.age += r.live ? dt : wdt;
      const k = r.age / r.life;
      if (k >= 1) {
        W.scene.remove(r.m);
        r.m.material.dispose();
        return false;
      }
      r.m.scale.setScalar(Math.max(0.001, Ease.outCubic(k) * r.size));
      r.m.material.opacity = 1 - k;
      return true;
    });
  };
  // 組み上げた直後の姿を覚えておき、やり直すときに戻す（後の区間が前の区間の物を動かしたり隠したりするため）
  W.snapshot = () => {
    W.snap = [];
    W.scene.traverse(o => {
      const m = o.material && !Array.isArray(o.material) ? o.material : null;
      W.snap.push([
        o,
        o.position.clone(),
        o.quaternion.clone(),
        o.scale.clone(),
        o.visible,
        m && { op: m.opacity, ei: m.emissiveIntensity, c: m.color ? m.color.clone() : null, e: m.emissive ? m.emissive.clone() : null },
      ]);
    });
  };
  W.restore = () => {
    if (!W.snap) return;
    for (const [o, p, q, s, v, m] of W.snap) {
      if (o.matrixAutoUpdate !== false) {
        o.position.copy(p);
        o.quaternion.copy(q);
        o.scale.copy(s);
      }
      o.visible = v;
      if (m) {
        const mm = o.material;
        mm.opacity = m.op;
        if (m.ei != null) mm.emissiveIntensity = m.ei;
        if (m.c) mm.color.copy(m.c);
        if (m.e) mm.emissive.copy(m.e);
      }
    }
  };
  // 全ての材質のシェーダーを起動時に用意（場面が初めて映るときの引っかかりを防ぐ）
  W.precompile = () => {
    try {
      W.renderer.compile(W.scene, W.camera);
    } catch (_) {
      /* 古い環境では省く */
    }
  };
  W.clearFx = () => {
    W.fx.parts.length = 0;
    W.fx.rings.forEach(r => {
      W.scene.remove(r.m);
      r.m.material.dispose();
    });
    W.fx.rings.length = 0;
  };

  // 円柱（高さ1、y 方向）を a から b へ渡す（ゴムなど）
  W.stretch = (mesh, a, b) => {
    const va = new THREE.Vector3(a[0], a[1], a[2]);
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const L = Math.max(0.01, d.length());
    mesh.position.copy(va).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh.scale.set(1, L, 1);
  };

  // 材質: 自分でも光る標準の材質（区間ごとに粗さ・金属感が少し違う）と、足し合わせて光る材質
  W.mat = (color, e, roughness = 0.55, metalness = 0.1, extra) =>
    new THREE.MeshStandardMaterial(Object.assign({ color, emissive: color, emissiveIntensity: e, roughness, metalness }, extra));
  W.addMat = (color, extra) =>
    new THREE.MeshBasicMaterial(Object.assign({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }, extra));

  // 光のスプライト（加算合成）
  let glowTex = null;
  W.glow = (color, size) => {
    if (!glowTex) {
      glowTex = new THREE.CanvasTexture(
        smoothRadial(256, [
          [0, 255, 255, 255, 255],
          [0.3, 255, 255, 255, 140],
          [1, 255, 255, 255, 0],
        ]),
      ); // ディザのない滑らかな光
    }
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    s.scale.setScalar(size);
    return s;
  };

  return W;
})();
