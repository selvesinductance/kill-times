#!/usr/bin/env python3
"""ヘッドレス Chromium で dist/freeze-break.html を検証する。

使い方: python3 tools/check.py [--shots title,1.5,3.0] [--no-shots]
  1. ?auto で RESULT まで通るか（アニメーション時間・採点ゲート数）、リトライで再開するか
  2. 実際のクリックでタイトル → G1 が進むか（外した場所ではミスになり進まないか）
  3. 指定時刻のスクショ（縦長 390x844・横長 1280x720）を shots/ に保存
  4. コンソールエラーが 0 か
"""
import argparse
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / 'dist' / 'preview.html'
SHOTS = ROOT / 'shots'
VIEWPORTS = {'portrait': (390, 844), 'landscape': (1280, 720)}
DEFAULT_SHOTS = 'title,1.5,3.0,8.0,17.0,19.9'
MOVING = '__fb.state === "PLAY" || __fb.state === "BURST"'


def attach(page, errors):
    # 検証環境から Google Fonts に届かないときの読み込み失敗は数えない（公開先では読める）
    page.on('console', lambda m: errors.append(f'console.error: {m.text}')
            if m.type == 'error' and not m.text.startswith('Failed to load resource') else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))


def run_auto(browser, url, errors):
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    attach(page, errors)
    t0 = time.time()
    page.goto(url + '?auto')
    page.wait_for_function('window.__fb && __fb.state === "RESULT"', timeout=90000)
    info = page.evaluate('({play: __fb.playTime, real: __fb.realPlay, results: __fb.results})')
    n = len(info['results'])
    print(f'[auto] RESULT 到達  壁時計 {time.time() - t0:.1f}s / タイムライン {info["play"]:.2f}s / '
          f'再生の実時間 {info["real"]:.2f}s / 採点ゲート {n}')
    ok = abs(info['play'] - 20) <= 0.5 and 19.5 <= info['real'] <= 26.5 and n == 5   # 凍結の手前の減速ぶん実時間は少し延びる
    if not ok:
        print('  NG: 時間またはゲート数が想定外')
    page.wait_for_timeout(2500)                          # リザルトの登場アニメが終わってから（ヘッドレスは描画が遅い）
    pos = page.evaluate('__fb.retryScreenPos()')
    page.mouse.click(pos['x'], pos['y'])
    page.wait_for_function(MOVING, timeout=10000)   # ヘッドレスは3Dの描画が遅い（横長のリザルトで1コマ約90ms）
    print('[auto] もう一度ボタン → 再開 OK')
    page.close()
    return ok


def perform(page, actions):
    """__fb.gateDemo() の操作列（画面座標）をマウスで実行する"""
    for act in actions:
        a, x, y = act['a'], act['x'], act['y']
        if a == 'down':
            page.mouse.move(x, y)
            page.mouse.down()
        elif a == 'move':
            page.mouse.move(x, y, steps=act['steps'])
        else:
            page.mouse.move(x, y)
            page.mouse.up()


def run_click(browser, url, errors):
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    attach(page, errors)
    page.goto(url)
    page.wait_for_function('window.__fb && __fb.state === "TITLE"', timeout=5000)
    page.mouse.click(12, 12)
    page.wait_for_timeout(150)
    if page.evaluate('__fb.state') != 'TITLE':
        print('[click] NG: 外した場所で進んでしまった')
        return False
    perform(page, page.evaluate('__fb.gateDemo()'))
    page.wait_for_function(MOVING, timeout=3000)
    print('[click] タイトル: ボタンを押す → 開始 OK（外した場所ではミス扱いで停止のまま）')
    ok = True
    for gid in ['g1', 'g2', 'g3', 'g4', 'g5']:
        page.wait_for_function('__fb.state === "GATE"', timeout=10000)
        acts = page.evaluate('__fb.gateDemo()')
        # 違う操作（物体の中心をタップするだけ）では進まないこと
        center = page.evaluate('__fb.gateScreenPos()')
        page.mouse.click(center['x'], center['y'])
        page.wait_for_timeout(120)
        if gid != 'g5':
            wrong_ok = page.evaluate('__fb.state') == 'GATE' and page.evaluate('__fb.gateMisses()') >= 1
            if not wrong_ok:
                ok = False
            print(f'[click] {gid}: タップだけでは進まない {"OK" if wrong_ok else "NG"}')
        perform(page, acts)
        try:
            page.wait_for_function(MOVING, timeout=3000)
            print(f'[click] {gid}: 正しい操作で通過 OK')
        except Exception:
            ok = False
            print(f'[click] {gid}: NG 正しい操作で通過できない')
            break
    if ok:
        page.wait_for_function('__fb.state === "RESULT"', timeout=10000)
        print(f'[click] RESULT {page.evaluate("__fb.results")}')
    page.close()
    return ok


def run_shots(browser, url, errors, shots):
    SHOTS.mkdir(exist_ok=True)
    for name, (w, h) in VIEWPORTS.items():
        page = browser.new_page(viewport={'width': w, 'height': h})
        attach(page, errors)
        for s in shots:
            page.goto(url + ('' if s == 'title' else f'?t={s}&hold'))
            page.wait_for_function('window.__fb', timeout=5000)
            page.wait_for_timeout(450)
            page.screenshot(path=str(SHOTS / f'{name}_{s.replace(".", "_")}.png'))
        page.close()
    print(f'[shots] {len(shots) * len(VIEWPORTS)} 枚を {SHOTS.relative_to(ROOT)}/ に保存')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default=DEFAULT_SHOTS)
    ap.add_argument('--no-shots', action='store_true')
    args = ap.parse_args()
    url = HTML.as_uri()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ok = run_auto(browser, url, errors)
        ok = run_click(browser, url, errors) and ok
        if not args.no_shots:
            run_shots(browser, url, errors, [s.strip() for s in args.shots.split(',') if s.strip()])
        browser.close()
    if errors:
        ok = False
        print('コンソールエラー:')
        for e in errors[:20]:
            print('  ' + e)
    else:
        print('コンソールエラー: 0')
    print('結果: OK' if ok else '結果: NG')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
