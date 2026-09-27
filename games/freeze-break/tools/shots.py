#!/usr/bin/env python3
"""見た目の比較用スクショ: python3 tools/shots.py <出力フォルダ>（各時刻を ?hold&t= で撮る）。
python3 tools/shots.py --pair A B … 2つのフォルダの同じ時刻を左右に並べた画像を A_vs_B/ に作る"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = (ROOT / 'dist' / 'preview.html').as_uri()
TIMES = [0.5, 1.5, 2.6, 3.3, 4.6, 5.4, 6.2, 6.5, 6.9, 8.4, 9.9, 10.8, 12.0, 13.4, 14.8, 16.2, 16.95, 17.6, 18.6, 19.6]
async def one(b, t, out):
    pg = await b.new_page(viewport={'width': 390, 'height': 844})
    await pg.goto(HTML + f'?hold&t={t}'); await pg.wait_for_timeout(1100)
    await pg.screenshot(path=str(out / f'{t:05.2f}.png')); await pg.close()
async def main():
    if sys.argv[1] == '--pair':
        from PIL import Image
        a, b = ROOT / sys.argv[2], ROOT / sys.argv[3]; out = ROOT / f'{sys.argv[2]}_vs_{pathlib.Path(sys.argv[3]).name}'; out.mkdir(exist_ok=True)
        for f in sorted(a.glob('*.png')):
            im = Image.new('RGB', (790, 844), 'white'); im.paste(Image.open(f), (0, 0)); im.paste(Image.open(b / f.name), (400, 0)); im.save(out / f.name)
        print('paired', out); return
    out = ROOT / sys.argv[1]; out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for i in range(0, len(TIMES), 5): await asyncio.gather(*[one(br, t, out) for t in TIMES[i:i + 5]])
        await br.close()
    print('saved', out)
asyncio.run(main())
