# 五門の兵

ブラウザで遊ぶ 3D パズルゲーム。完成品は `dist/gomon.html`（1つのファイル）。

## 作り方

```
python3 build.py
```

`src/` のファイルをつなげて `dist/gomon.html` を作ります（Python 3 だけで動きます）。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `build.py` | `src/` をつなげて `dist/gomon.html` を作る |
| `src/page.html` | 画面の部品と見た目（CSS）。`/*LOGIC*/`・`/*AUDIO*/`・`/*UI*/` のところに下のコードが入る |
| `src/logic.js` | ゲームのしくみ：ゲート40種、コースの形、ステージの生成と正解の判定、数の表示（画面に依存しない） |
| `src/audio.js` | 音：効果音・環境音・BGM の音量（`window.GomonAudio`） |
| `src/ui/00_base.js` | 決まりごと（大きさ・速さ・時間）、保存、実績、音とのつなぎ、文字の表示 |
| `src/ui/01_world.js` | 描く道具、空・地面・荒地・丘と雲・木と草・岩、共通の素材と形 |
| `src/ui/02_gates.js` | ゲート：板の数式、素材、レアリティの縁取り、上の印 |
| `src/ui/03_layouts.js` | 道すじと、コースの形（まっすぐ・立体交差・合流・アンコール・U字路・中州）ごとの配置 |
| `src/ui/04_bridges.js` | 橋：丸太・石・赤い鋼、曲がる橋、アンコールの張り出し |
| `src/ui/05_river.js` | 川：岸の線、水面と土手、葦・岩・蓮・魚、川の音の聞こえ方 |
| `src/ui/06_course.js` | コースの組み立てと片づけ、ボス |
| `src/ui/07_army.js` | 兵士と旗、欄干に当たったときのゆれ |
| `src/ui/08_effects.js` | 演出：火花・煙、ブラックホール、バグ |
| `src/ui/09_camera.js` | カメラと画面上の札 |
| `src/ui/10_play.js` | ゲームの進み：レーン選び、ゲート、地雷、ボス戦、アイテム、結果 |
| `src/ui/11_screens.js` | タイトル・図鑑・実績・一時停止・音の設定と、操作 |
| `src/ui/12_main.js` | 毎フレームの更新と起動 |

`src/ui/` のファイルは、`build.py` が番号の順につなげて1つの関数に入れます。変数はすべてのファイルで共有なので、ファイルの順番を入れ替えるときは、上で作ったものを下で使っている順を崩さないようにしてください。

3D の表示には three.js r128 を CDN（cdnjs）から読み込みます。

## 確かめ方（任意）

```
npm install
node test_logic.js    # ゲームのしくみのテスト（ALL OK）
node smoke_test.js    # 画面の流れが最後まで例外なく動くか（NO ERRORS）
```

## 資料

- `docs/spec.md`：仕様（✅ 決めたこと、🟡 実装で仮に決めたこと）
- `docs/bridges.md`：川と橋まわりの仕様
