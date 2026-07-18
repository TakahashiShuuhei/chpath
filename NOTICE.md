# サードパーティのフォントデータについて

本リポジトリには、以下2つのフォントから生成した「直線・円弧に変換済みの
ストロークデータ」が同梱されています(`public/glyphs.json`、および
`cpp/chpath.cpp`に埋め込まれたデータ部分)。

## Hershey Fonts(英数字・記号)

- 出典: https://github.com/techninja/hersheytextjs
- ライセンス: Public Domain
- 表示義務・継承義務はありません。

## KanjiVG(漢字・ひらがな・カタカナ)

- 出典: http://kanjivg.tagaini.net/
- Copyright (c) 2009/2010/2011 Ulrich Apel.
- ライセンス: [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/)

CC BY-SAの条件により、KanjiVGおよびそこから生成した派生データを配布する
場合は以下が必要です。

1. **表示(Attribution)**: KanjiVGを使用している旨と、上記URL
   (http://kanjivg.tagaini.net/)を明示すること。
2. **継承(ShareAlike)**: 派生データ(本リポジトリの`public/glyphs.json`と、
   `cpp/chpath.cpp`内のKanjiVG由来のフォントデータ部分)も、同じ
   CC BY-SA 3.0ライセンスで公開すること。

したがって、本リポジトリの**ソースコード(アルゴリズム・スクリプト・UI等)
とは別に**、上記のフォントデータファイルそのものは CC BY-SA 3.0 の下に
あります。これらのデータを再配布・改変する場合は、この表示を保持し、
同じライセンスで公開してください。
