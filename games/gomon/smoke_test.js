// 3D を偽物に差し替えて、画面の流れが例外なく最後まで動くかを確かめる
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

let html = fs.readFileSync(__dirname + '/dist/gomon.html', 'utf8');
html = html.replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/, '');

function mock() {
  const store = {};
  const target = function () {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'then') return undefined;
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toString') return () => 'mock';
      if (prop in store) return store[prop];
      const p = mock(); store[prop] = p; return p;
    },
    set(t, prop, v) { store[prop] = v; return true; },
    apply() { return mock(); },
    construct() { return mock(); },
  });
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', virtualConsole: vc,
  beforeParse(window) {
    const T = mock();
    const real = new Proxy({}, {
      get(o, prop) {
        if (prop === 'WebGLRenderer') return function () { return { domElement: window.document.createElement('canvas'), setPixelRatio() {}, setClearColor() {}, setSize() {}, render() {} }; };
        return T[prop];
      },
    });
    window.THREE = real;
    window.HTMLCanvasElement.prototype.getContext = function () { return mock(); };
    window.__gomonTimeScale = 10;
    window.addEventListener('error', (e) => errors.push('window.error: ' + (e.error && e.error.stack || e.message)));
  },
});
const { window } = dom;
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; }
const key = (k) => { window.dispatchEvent(new window.KeyboardEvent('keydown', { key: k })); setTimeout(() => window.dispatchEvent(new window.KeyboardEvent('keyup', { key: k })), 150); };

(async () => {
  await sleep(600);
  console.log('title visible:', !$('title').hidden, 'ach line:', $('achLine').textContent, 'ach rows:', doc.querySelectorAll('#achMini li').length, 'dex button in master row:', !!doc.querySelector('#achMini li:last-child #dexBtn'));
  $('timerOff').click();
  console.log('best line:', $('bestLine').textContent);
  doc.querySelector('[data-mode="endless"]').click();
  $('startBtn').click();
  for (let s = 0; s < 5; s++) {
    const ok = await until(() => !$('controls').hidden, 5000);
    if (!ok) { errors.push('controls never shown at stage ' + s); break; }
    if (Math.random() < 0.5) key('ArrowRight');
    $('goBtn').click();
    const done = await until(() => { if (!$('controls').hidden && !$('goBtn').hidden) $('goBtn').click(); return !$('result').hidden; }, 25000);
    if (!done) { errors.push('result never shown at stage ' + s); break; }
    const txt = $('resultInner').textContent.replace(/\s+/g, ' ').slice(0, 160);
    console.log('endless', $('stageName').textContent, '|', txt);
    const nb = $('nextBtn'), rb = $('retryBtn');
    (nb || rb).click();
  }
  $('quitBtn').click();
  await sleep(300);
  $('timerOn').click();
  for (let k = 0; k < 12; k++) {
    doc.querySelector('[data-mode="' + (k % 3 === 0 ? 'nocommon' : 'final') + '"]').click();
    $('startBtn').click();
    const ok = await until(() => !$('controls').hidden, 5000);
    if (!ok) { errors.push('once: controls never shown'); break; }
    const L = doc.querySelectorAll('#labels .gl').length;
    const ico = doc.querySelectorAll('#labels .gl .ico').length;
    if (ico) errors.push('gate label still has a mark');
    if (Math.random() < 0.5) key('ArrowRight'); else key('ArrowLeft');
    await sleep(300);
    if (!$('goBtn').hidden) errors.push('timer mode shows a go button');
    const done = await until(() => !$('result').hidden, 25000);
    if (!done) { errors.push('once: result never shown ' + $('modeName').textContent); break; }
    console.log('once', $('modeName').textContent, $('stageName').textContent, 'gates', L, '|', $('resultInner').textContent.replace(/\s+/g, ' ').slice(0, 160));
    $('toTitleBtn').click();
    await sleep(300);
  }
  $('dexBtn').click();
  await sleep(200);
  console.log('dex:', $('dexCount').textContent, 'cards', doc.querySelectorAll('.dex-card').length);
  doc.querySelector('#dexScreen [data-close]').click();
  await sleep(200);
  console.log('ach:', doc.querySelectorAll('#achMini li').length, 'got', doc.querySelectorAll('#achMini li.got').length, '|', $('achLine').textContent, '| dex button:', $('dexBtn').textContent);
  console.log('localStorage dex:', window.localStorage.getItem('gomon.dex'));
  console.log('best line after play:', $('bestLine').textContent, '| sel:', window.localStorage.getItem('gomon.sel'));
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'NO ERRORS');
  window.close();
  process.exit(0);
})();
