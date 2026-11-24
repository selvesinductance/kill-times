// 起動: 3D の舞台を用意し、設定を読み、タイトル画面を出す。戦略データと手袋の形が届いたらボタンを押せるようにする
// 3D の舞台は、光 → 教室 → 光の輪と床の影 → 中央の数字 の順に用意する
import './scene/stage.js';
import './scene/classroom.js';
import './scene/seats.js';
import './scene/counter.js';
import { $, setText, jaWrapStatic } from './dom.js';
import { loadSettings } from './settings.js';
import { loadGlove } from './scene/glove.js';
import { startLoop } from './scene/loop.js';
import { loadTables } from './game/strategy.js';
import { startGame, initMatch, currentGame } from './game/match.js';
import { initTitle, renderModes, renderColors, showTitleScene } from './ui/title.js';
import { show } from './ui/screens.js';

const gloveReady = loadGlove();   // 手袋の形（計算済みのデータ）を先に読み始める
const tablesReady = loadTables()
  .then(() => { $('load-status').textContent = ''; return true; })
  .catch((e) => {
    const st = $('load-status');
    setText(st, `戦略データを読み込めませんでした：${e.message}。ページを開き直してください。`);
    st.classList.add('err');
    return false;
  });

jaWrapStatic(document.body);   // HTML に書いてある日本語も、文節の切れ目でだけ改行させる
document.querySelectorAll('.modal [data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
initTitle({ start: startGame });
initMatch();

loadSettings();
renderColors();
renderModes(false);
show('title');
startLoop();
gloveReady.then(() => { if ($('game-screen').hidden && !currentGame()) showTitleScene(); });
Promise.all([tablesReady, gloveReady]).then(([ok]) => renderModes(ok));
