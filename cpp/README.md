# chpath (C++版)

文字列を、ペンプロッタ等で描くための「直線」と「円弧」の組み合わせ(ストローク列)に
変換するライブラリです。TypeScript版(Webデモ)のロジックをC++に移植したもので、
フォントデータ(英数字・常用漢字・ひらがな・カタカナ、2409文字分)を`chpath.cpp`に
埋め込んでおり、実行時に外部ファイルやネットワークアクセスは一切必要ありません。

## ファイル

- `chpath.h` — 公開する型と関数の宣言のみ。これ以外の内部実装には依存しません。
- `chpath.cpp` — アルゴリズム(UTF-8デコード・レイアウト・ストローク順序の最適化)と、
  埋め込みフォントデータの両方を含みます。`scripts/export-cpp.ts`により自動生成される
  ファイルなので、直接編集しないでください(データを更新したい場合は後述の
  「フォントデータの再生成」を参照)。

## 使い方

C++17以降、標準ライブラリ以外の依存はありません。自分のビルドに2ファイルを
そのまま追加するだけで使えます。

```cpp
#include "chpath.h"

int main() {
  std::vector<chpath::Stroke> strokes = chpath::textToStrokes("こんにちは", /*fontSize=*/48.0);

  for (const chpath::Stroke& stroke : strokes) {
    // strokeは「ペンを下ろしたまま描き続ける一続きの経路」
    for (const chpath::Segment& seg : stroke) {
      if (seg.type == chpath::Segment::Type::Line) {
        // 直線: seg.from -> seg.to
      } else {
        // 円弧: seg.center を中心、seg.radius を半径として
        // seg.startAngle から seg.endAngle まで(ラジアン)描く。
        // seg.ccw == true なら角度が増える方向、false なら減る方向。
      }
    }
  }
}
```

動作確認用に単独でコンパイルする場合:

```sh
g++ -std=c++17 -Wall -Wextra -c chpath.cpp -o chpath.o
```

## API

### `struct chpath::Point`
`double x, y;` だけを持つ座標。

### `struct chpath::Segment`
直線または円弧1個分のコマンド。

| フィールド | 直線(`type == Line`)での意味 | 円弧(`type == Arc`)での意味 |
|---|---|---|
| `from` / `to` | 開始点・終了点 | (未使用) |
| `center` | (未使用) | 円の中心 |
| `radius` | (未使用) | 半径 |
| `startAngle` / `endAngle` | (未使用) | 開始・終了角度(ラジアン) |
| `ccw` | (未使用) | `true`なら`startAngle`から`endAngle`に向かって角度が増える方向に描く、`false`なら減る方向 |

### `using chpath::Stroke = std::vector<Segment>;`
ペンを下ろしたまま描き続ける一続きの経路。

### `std::vector<Stroke> chpath::textToStrokes(const std::string& utf8Text, double fontSize = 48.0)`
UTF-8の文字列を受け取り、ストロークの配列を返します。

- `fontSize`はおおよそ1文字の高さに相当する値(座標の単位はこれに準じる。
  ペンプロッタのmm等、任意の単位として読み替えて構いません)。
- 改行文字(`\n`)で複数行のレイアウトになります。
- 返り値のストロークは、**ペンアップ移動(ストローク間の移動距離)が短くなるように
  既に順序が最適化済み**です。描画順そのまま使ってください。
- 埋め込みフォントに存在しない文字は無視され(描画されず)、その分の送り幅だけ
  進めて次の文字に移ります。空白は通常フォントテーブル内に実データがあります。
- 空文字列や、全て未対応文字の場合は空の配列を返します(例外は投げません)。

## フォントデータについて

- 英数字・記号: [Hershey Fonts](https://github.com/techninja/hersheytextjs)(Public Domain)
- 漢字・かな: [KanjiVG](http://kanjivg.tagaini.net/)(© 2009-2011 Ulrich Apel, CC BY-SA 3.0) —
  このデータ(を変換したもの)を配布・再配布する場合は、KanjiVGへの帰属表示と
  同一ライセンス(CC BY-SA)での公開が必要です。
- どちらも、直線・円弧への変換はTypeScript版(`src/core/fitPath.ts`)と同じ
  アルゴリズムを使い、誤差許容値は`6`に固定して事前計算した結果を埋め込んで
  います(Webデモのスライダーのように実行時に変えることはできません)。

## フォントデータの再生成

`public/glyphs.json`(元データ)やフィッティングアルゴリズムを変更した場合は、
リポジトリのルートで以下を実行すると`chpath.cpp`が再生成されます。

```sh
npm run export-cpp
```

## 制限・注意点

- 誤差許容値は固定(`6`)で、実行時には変更できません。
- 文字ごとの描画順序(ストロークの並べ替え)は同一文字内・文字間で行われますが、
  文字列全体を見渡した大域的な移動距離の最適化(文字の並び替えなど)は行っていません。
- 常用漢字・ひらがな・カタカナ・基本的な英数字/記号以外の文字(難読漢字や
  絵文字など)は非対応です。
