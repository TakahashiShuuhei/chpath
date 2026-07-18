# chpath

入力した文字列を、ペンプロッタのような卓上ロボットで描けるだけの
**直線と円弧の組み合わせ**に変換するツールです。ブラウザで動く
TypeScript製のデモと、フォントデータを埋め込んだ単体のC++実装の
2つを用意しています。

## できること

- 常用漢字・ひらがな・カタカナ・英数字・基本的な記号(合計2409文字)を、
  少ない直線・円弧のコマンド列に変換
- 誤差許容値をスライダーで調整し、コマンド数と再現度のトレードオフを
  その場で確認できる
- ペンアップ移動(次のストロークへ移る際の移動距離)が短くなるよう、
  貪欲法でストロークの描画順を最適化
- 文字がどの直線・円弧に分割されているかを、描画順に色分けして可視化
- 生成された直線・円弧のコマンド一覧をテキストで確認・コピー

## Webデモ

```sh
npm install
npm run dev
```

`http://localhost:5173/chpath/` を開くと、テキストを入力してその場で
変換結果を確認できます。

```sh
npm run build     # 型チェック + 本番ビルド(dist/に出力)
npm run test      # 単体テスト(Vitest)
```

## 使い方(C++版)

フォントデータを埋め込んだ`chpath.h`/`chpath.cpp`の2ファイルのみで、
外部ファイル・ネットワーク不要で組み込めます。詳しくは
[cpp/README.md](./cpp/README.md)を参照してください。

```cpp
#include "chpath.h"

auto strokes = chpath::textToStrokes("こんにちは", /*fontSize=*/48.0);
// strokes: std::vector<chpath::Stroke>(std::vector<Segment>の配列)
```

## 仕組み

1. **フォントデータの取得**(`scripts/sources/`): 英数字は
   [Hershey Fonts](https://github.com/techninja/hersheytextjs)、
   漢字・かなは[KanjiVG](http://kanjivg.tagaini.net/)のストロークデータ
   (直線・3次ベジエ)を取得し、点列に平坦化して`public/glyphs.json`に
   保存する(`npm run build-glyphs`)。
2. **直線・円弧へのフィッティング**(`src/core/fitPath.ts`): 平坦化済みの
   点列を、指定した誤差許容値以内でできるだけ少ない直線・円弧に変換する。
   ベジエで滑らかに表された曲線(KanjiVG)も、折れ線で近似された曲線
   (Hershey)も、同じアルゴリズムで扱う。誤差許容値はUIから動的に変わる
   ため、この変換は実行時に行う。
3. **ストローク順序の最適化**(`src/core/orderStrokes.ts`): 書き順は無視し、
   現在のペン位置から最も近い未描画のストロークを貪欲法で選び続けることで、
   ペンアップ移動の総距離を減らす。
4. **レイアウト**(`src/core/layout.ts`): 文字列を1文字ずつ配置し、改行や
   未対応文字の処理、文字をまたいだストローク順序の継続を行う。
5. **描画**(`src/core/renderSvg.ts`): SVGとして描画する。

## プロジェクト構成

```
src/
  core/          変換ロジック本体(SVGパース・直線円弧フィッティング・
                 ストローク順序最適化・レイアウト・SVG描画)。*.test.tsが対応するテスト
  main.ts        Webデモのエントリーポイント
  style.css
scripts/
  sources/       Hershey Fonts・KanjiVGからのデータ取得
  build-glyphs.ts   public/glyphs.json を生成
  export-cpp.ts     cpp/chpath.cpp を生成
public/
  glyphs.json    生成済みフォントデータ(実行時にfetchされる)
cpp/
  chpath.h       C++版の公開API
  chpath.cpp     C++版の実装+埋め込みフォントデータ(export-cppで生成)
  README.md      C++版の詳しい使い方
```

## ライセンス

- **ソースコード**(アルゴリズム・ビルドスクリプト・UI等): 特に指定なし。
  必要であれば追加してください。
- **フォントデータ**(`public/glyphs.json`、`cpp/chpath.cpp`内の埋め込み
  データ): Hershey Fonts(Public Domain)とKanjiVG(CC BY-SA 3.0)から
  生成した派生データです。KanjiVG由来のデータはCC BY-SA 3.0の継承義務が
  あります。詳細は[NOTICE.md](./NOTICE.md)を参照してください。
