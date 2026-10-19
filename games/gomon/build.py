# 五門の兵：src/ のファイルをつなげて、1つの HTML（dist/gomon.html）にする
#   page.html の /*LOGIC*/・/*AUDIO*/・/*UI*/ のところに、それぞれの中身を入れる
#   ui/ は役割ごとに分けたファイル。番号の順につなげて1つの関数に入れる（変数はすべてのファイルで共有）
import pathlib

root = pathlib.Path(__file__).parent
src = root / 'src'
read = lambda p: p.read_text(encoding='utf-8')
page = read(src / 'page.html')
logic = read(src / 'logic.js')   # ゲームのしくみ（画面に依存しない）
audio = read(src / 'audio.js')   # 音（効果音・環境音・BGM）はこのファイルにまとめる
parts = sorted((src / 'ui').glob('[0-9][0-9]_*.js'))
assert parts, 'src/ui/ にファイルがない'
indent = lambda s: '\n'.join(('  ' + l) if l.strip() else '' for l in s.rstrip('\n').split('\n'))
ui = "(function () {\n  'use strict';\n" + '\n\n'.join(indent(read(p)) for p in parts) + '\n})();\n'
assert '/*LOGIC*/' in page and '/*AUDIO*/' in page and '/*UI*/' in page
out = page.replace('/*LOGIC*/', logic).replace('/*AUDIO*/', audio).replace('/*UI*/', ui)
dist = root / 'dist' / 'gomon.html'
dist.write_text(out, encoding='utf-8')
print('wrote', dist, len(out.encode('utf-8')), 'bytes', '(ui:', len(parts), 'files)')
