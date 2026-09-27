#!/usr/bin/env python3
"""src/*.js を番号順に連結し、template.html に差し込んで dist/freeze-break.html を出力する。
連結した JS は node --check で構文確認する（node があれば）。"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'dist' / 'freeze-break.html'
PREVIEW = ROOT / 'dist' / 'preview.html'
WRAP = ('<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '</head>\n<body>\n{}</body>\n</html>\n')
BUNDLE = ROOT / 'build' / 'bundle.js'
MARKER = '//__SCRIPT__'


def main():
    files = sorted(SRC.glob('*.js'))
    parts = [f'// ===== {f.name} =====\n{f.read_text(encoding="utf-8").rstrip()}\n' for f in files]
    bundle = "(() => {\n'use strict';\n" + '\n'.join(parts) + '})();\n'
    if '</script' in bundle.lower():
        sys.exit('NG: JS に </script が含まれている')
    BUNDLE.parent.mkdir(exist_ok=True)
    BUNDLE.write_text(bundle, encoding='utf-8')
    if shutil.which('node'):
        r = subprocess.run(['node', '--check', str(BUNDLE)], capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr)
            sys.exit('NG: 構文エラー')
    tpl = (SRC / 'template.html').read_text(encoding='utf-8')
    if tpl.count(MARKER) != 1:
        sys.exit('NG: template.html の差し込み口が見つからない')
    html = tpl.replace(MARKER, bundle)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')   # 公開用（外枠は公開時に付く）
    PREVIEW.write_text(WRAP.format(html), encoding='utf-8')   # 手元の検証用（外枠つき）
    print(f'built {OUT.relative_to(ROOT)} ({len(html) / 1024:.1f} KB, {len(files)} modules) + {PREVIEW.name}')


if __name__ == '__main__':
    main()
