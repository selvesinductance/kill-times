// プレイヤーの設定（★・手の色・掛け声・音声）。ブラウザに保存する
import { STORE_KEY, SWATCHES } from './config.js';

export const settings = { stars:{}, color:SWATCHES[0], call:'いっせーの', customCall:'', voice:true };
export function loadSettings(){
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); Object.assign(settings, s); } catch {}
}
export function saveSettings(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch {}
}
// いま使う掛け声（「どれでもない」で空欄なら いっせーの）
export function callWord(){ return settings.call === '__custom' ? (settings.customCall.trim() || 'いっせーの') : settings.call; }
