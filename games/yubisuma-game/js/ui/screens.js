// 画面（タイトル・対戦・結果）の切り替え
import { $ } from '../dom.js';
import { resize } from '../scene/loop.js';

export function show(which){
  $('title-screen').hidden = which !== 'title';
  $('game-screen').hidden = which !== 'game';
  $('result-screen').hidden = which !== 'result';
  $('labels').style.display = which === 'title' ? 'none' : '';
  resize();
}
