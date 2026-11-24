// 掛け声の読み上げ（合成音声）。読み上げられない環境では、すぐ先へ進む
import { settings } from './settings.js';

let jaVoice = null;
function pickVoice(){ try { jaVoice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ja')) || null; } catch {} }
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch {}

// 読み上げ。started は声が出始めたとき、ended は読み終わったときに進む
export function say(text, rate, maxMs){
  let sres, eres;
  const started = new Promise(r => { sres = r; }), ended = new Promise(r => { eres = r; });
  try {
    if (!settings.voice || !('speechSynthesis' in window)){ sres(); eres(); return { started, ended }; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = rate || 1.15; if (jaVoice) u.voice = jaVoice;
    let done = false; const fin = () => { if (!done){ done = true; sres(); eres(); } };
    u.onstart = () => sres(); u.onend = fin; u.onerror = fin;
    setTimeout(sres, 600);              // 始まりの合図が来ないブラウザでも先へ進む
    setTimeout(fin, maxMs || 3200);     // 終わりの合図が来ないブラウザでも先へ進む
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { sres(); eres(); }
  return { started, ended };
}
export function stopVoice(){ try { speechSynthesis.cancel(); } catch {} }
export const canSpeak = () => settings.voice && 'speechSynthesis' in window;

// ブラウザによっては、ボタンを押したときに一度読み上げを始めておかないと声が出ない
let audioUnlocked = false;
export function unlockAudio(){ if (audioUnlocked) return; audioUnlocked = true; try { const u = new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); } catch {} }
