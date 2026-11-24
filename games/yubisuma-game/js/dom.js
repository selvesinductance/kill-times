// 画面の部品づくりと、日本語を文節の切れ目でだけ改行させる仕組み
export const $ = (id) => document.getElementById(id);
// 日本語の文を「文節」ぐらいのまとまりに分け、その切れ目だけで改行できるようにする
const SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity:'word' }) : null;
const KANJI = /[㐀-䶿一-鿿々〆]/, KATA = /[ァ-ヺｦ-ﾟ]/, HIRA = /[ぁ-ゟ]/;
const OPEN = /[「『（(【［\[〈《]/, CLOSE = /[」』）)】］\]〉》]/;
const NO_START = /[、。，．！？!?：:」』）)】］\]〉》ー・ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;
export function jaPieces(text){
  if (!SEG || !/[぀-ヿ㐀-鿿]/.test(text)) return [text];
  const out = []; let cur = '';
  for (const { segment:s } of SEG.segment(text)){
    if (!cur){ cur = s; continue; }
    const p = cur[cur.length - 1], c = s[0];
    let brk = false;
    if (/\s/.test(c) || NO_START.test(c)) brk = false;                   // 空白はひとつ前のまとまりにつける。行頭に来てはいけない文字の前は切らない
    else if (/\s/.test(p)) brk = !/[0-9０-９]/.test(c) && !/[0-9０-９]\s*$/.test(cur);   // 空白の後（数字の前後の空白はつなげる: 「合計 6 本」）
    else if (/[、。，．！？!?]/.test(p)) brk = true;                          // 句読点の後
    else if (CLOSE.test(p)) brk = !HIRA.test(c);                            // 閉じかっこの後（助詞が続くときはつなげる）
    else if (OPEN.test(p)) brk = false;                                     // 開きかっこの直後
    else if (OPEN.test(c)) brk = true;                                      // 開きかっこの前
    else if (KANJI.test(c) || KATA.test(c) || /[A-Za-z0-9０-９★]/.test(c)){ // 漢字・カタカナ・英数字で始まるまとまりの前
      brk = !((KANJI.test(p) && KANJI.test(c)) || (KATA.test(p) && KATA.test(c)) || /[0-9０-９A-Za-z〜～\-]/.test(p));
    }
    if (brk){ out.push(cur); cur = s; } else cur += s;
  }
  if (cur) out.push(cur);
  return out;
}
// 文節ごとに「途中で改行しない」まとまり（span.jw）にして、文節の切れ目でだけ改行させる。
// まとまりは 1 つの span.jt に入れるので、flex の中でも 1 つの文として並ぶ
const HAS_JA = /[\u3040-\u30FF\u3400-\u9FFF]/;
export function jaFrag(text){
  text = String(text);
  const ps = jaPieces(text);
  if (ps.length < 2){
    if (!HAS_JA.test(text)) return document.createTextNode(text);
    const w = document.createElement('span'); w.className = 'jw'; w.textContent = text; return w;   // 1 文節だけでも途中では切らない
  }
  const box = document.createElement('span'); box.className = 'jt';
  for (const t of ps){ const w = document.createElement('span'); w.className = 'jw'; w.textContent = t; box.append(w); }
  return box;
}
export function setText(node, text){ node.replaceChildren(jaFrag(text)); }
// 最初から HTML に書いてある文章にも切れ目を入れる
export function jaWrapStatic(root){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(n.parentElement.tagName)) || !n.data.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; let n; while ((n = w.nextNode())) list.push(n);
  for (const t of list){ if (HAS_JA.test(t.data)) t.replaceWith(jaFrag(t.data)); }
}
export function el(tag, props, ...kids){
  const e = document.createElement(tag);
  if (props) for (const k in props){
    if (k === 'class') e.className = props[k];
    else if (k === 'text') e.append(jaFrag(props[k]));
    else if (k === 'style') e.style.cssText = props[k];
    else e.setAttribute(k, props[k]);
  }
  for (const c of kids) if (c != null) e.append(typeof c === 'string' ? jaFrag(c) : c);
  return e;
}
