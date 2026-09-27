#!/usr/bin/env python3
"""リファクタリングの前後で見え方が変わっていないかを確かめる。
  python3 tools/regress.py save  … 今の dist/preview.html から基準を取る（tools/regress_base.json）
  python3 tools/regress.py check … 基準と比べ、違いがあれば時刻と物の番号を出す
各時刻（?hold&t=）で3Dの場面の指紋（__fb.dump）と、3D区間のカメラの道（__fb.cam）を記録する。粒・音のスペクトルは乱数と音で変わるので比べない。"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = (ROOT / 'dist' / 'preview.html').as_uri()
BASE = ROOT / 'tools' / 'regress_base.json'
TIMES = [round(0.1 + 0.25 * i, 2) for i in range(80)] + [6.14, 6.2, 6.26, 6.62, 6.9, 7.05, 13.9, 15.3, 17.05, 17.4]
async def one(b, t):
    pg = await b.new_page(viewport={'width': 390, 'height': 844})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(HTML + f'?hold&t={t}'); await pg.wait_for_timeout(900)
    d = await pg.evaluate('__fb.dump()')
    await pg.close()
    return t, d, errs
async def main(mode):
    out = {'scenes': {}, 'cams': {}}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for i in range(0, len(TIMES), 6):
            for t, d, errs in await asyncio.gather(*[one(b, t) for t in TIMES[i:i + 6]]):
                if errs: print('ERR', t, errs)
                out['scenes'][str(t)] = d
        pg = await b.new_page(viewport={'width': 390, 'height': 844})
        await pg.goto(HTML + '?hold&t=0.1'); await pg.wait_for_timeout(800)
        for st in 'ABCDEF':
            out['cams'][st] = await pg.evaluate(f"[...Array(51).keys()].map(i => __fb.cam('{st}', i / 50))")
        await b.close()
    if mode == 'save':
        BASE.write_text(json.dumps(out)); print('saved', len(out['scenes']), 'scenes')
        return
    base = json.loads(BASE.read_text()); bad = 0
    for st in 'ABCDEF':
        if base['cams'][st] != out['cams'][st]: bad += 1; print('CAM DIFF', st)
    for t, d in out['scenes'].items():
        b0 = base['scenes'][t]
        if b0 == d: continue
        bad += 1
        if b0 is None or d is None: print('SCENE NONE', t); continue
        for k in ('cam', 'fov', 'pm', 'stage'):
            if b0[k] != d[k]: print('DIFF', t, k, b0[k], '→', d[k])
        if len(b0['objs']) != len(d['objs']): print('DIFF', t, 'objects', len(b0['objs']), '→', len(d['objs']))
        n = 0
        for i, (x, y) in enumerate(zip(b0['objs'], d['objs'])):
            if x != y and n < 6: print('DIFF', t, 'obj', i, x, '→', y); n += 1
    print('RESULT', 'OK' if bad == 0 else f'{bad} differences')
asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'check'))
