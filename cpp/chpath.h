#pragma once

#include <string>
#include <vector>

// 入力した文字列を、ペンプロッタ等で描画するための「直線」と「円弧」の
// 組み合わせ(ストローク列)に変換するライブラリ。
//
// フォント(英数字はHershey Fonts、漢字・かなはKanjiVG)から生成した
// ストロークデータをchpath.cppに埋め込んでおり、実行時に外部ファイルは
// 必要ない。
namespace chpath {

struct Point {
  double x = 0.0;
  double y = 0.0;
};

// 直線または円弧の1コマンド。typeによってどちらの意味を持つかが決まる。
struct Segment {
  enum class Type { Line, Arc };

  Type type = Type::Line;

  // type == Line のとき使う: fromからtoまでの直線
  Point from;
  Point to;

  // type == Arc のとき使う: centerを中心、radiusを半径とし、
  // startAngleからendAngleまで(ラジアン)、ccw=trueなら角度が増える方向
  // (数学的な反時計回り)、ccw=falseなら角度が減る方向に描く円弧
  Point center;
  double radius = 0.0;
  double startAngle = 0.0;
  double endAngle = 0.0;
  bool ccw = false;
};

// ペンを下ろしたまま描き続ける一続きの経路(直線・円弧の並び)
using Stroke = std::vector<Segment>;

// UTF-8の文字列を、直線・円弧のストローク列に変換する。
// - 改行(\n)で複数行のレイアウトになる
// - fontSizeは1文字あたりの概ねの高さ(px相当)
// - 返り値のストロークは、ペンアップ移動が短くなるように既に順序が
//   最適化されている(描画順そのまま使ってよい)
// - 埋め込みフォントに存在しない文字は無視され、その分の送り幅だけ進めて
//   次の文字に移る(空白は通常フォントテーブル内に実データがある)
std::vector<Stroke> textToStrokes(const std::string& utf8Text, double fontSize = 48.0);

}  // namespace chpath
