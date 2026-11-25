"""Thử dự đoán 1 file .inkml bằng model đã train:
    python -m src.predict duong/dan/file.inkml --run-name baseline

Đoạn xử lý ở đây (parse -> chuẩn hóa -> resample -> đặc trưng) chính là phần sau này đưa vào FastAPI.
"""
from __future__ import annotations

import argparse

from src.inkml_parser import parse_inkml
from src.stroke_utils import normalize_to_canvas
from src.serve import Recognizer


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("inkml")
    ap.add_argument("--run-name", default="baseline")
    args = ap.parse_args()

    s = parse_inkml(args.inkml)
    xy = normalize_to_canvas(s.strokes, s.canvas_w, s.canvas_h)
    result = Recognizer(args.run_name).predict([stroke.tolist() for stroke in xy])

    def top(items):
        return ", ".join(f"{item['label']} ({item['prob']:.0%})" for item in items)

    print(f"File      : {args.inkml}")
    print(f"Nhãn thật : {s.truth}")
    print(f"Model đoán: {result['best']}")
    print(f"  base    : {top(result['base'])}")
    print(f"  modifier: {top(result['modifier'])}")
    print(f"  tone    : {top(result['tone'])}")


if __name__ == "__main__":
    main()
