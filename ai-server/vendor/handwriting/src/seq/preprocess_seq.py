"""Chuyển VNOnDB (mức từ hoặc dòng) thành dữ liệu để train CTC:

    python -m src.seq.preprocess_seq --level word
    python -m src.seq.preprocess_seq --level word --max-pages 10     # chạy thử nhanh

Kết quả trong dataset/processed_seq/<level>/ :
    data.npz     tọa độ đã chuẩn hóa + cờ đầu nét + nhãn (dạng nối dài, có offsets)
    samples.csv  mỗi mẫu 1 dòng: tập chia, người viết, trang, nhãn, số điểm...
    meta.json    tham số tiền xử lý + số mẫu bị loại và lý do
"""
from __future__ import annotations

import argparse
import json
from collections import Counter

import numpy as np
import pandas as pd

from src.seq import config_seq as cfg
from src.seq.parser_vnondb import parse_page, read_split


def dedupe(xy: np.ndarray) -> np.ndarray:
    """Bỏ các điểm trùng liên tiếp (VNOnDB lấy mẫu cố định 120 Hz nên có rất nhiều điểm lặp khi bút đứng yên)."""
    if len(xy) < 2:
        return xy
    keep = np.concatenate([[True], np.abs(np.diff(xy, axis=0)).sum(axis=1) > 0])
    return xy[keep]


def path_length(xy: np.ndarray) -> float:

    return 0.0 if len(xy) < 2 else float(np.sqrt((np.diff(xy, axis=0) ** 2).sum(axis=1)).sum())


def resample_stroke(xy: np.ndarray, n: int) -> np.ndarray:
    d = np.sqrt((np.diff(xy, axis=0) ** 2).sum(axis=1))
    s = np.concatenate([[0.0], np.cumsum(d)])
    t = np.linspace(0.0, s[-1], n)
    return np.stack([np.interp(t, s, xy[:, 0]), np.interp(t, s, xy[:, 1])], axis=1)


def process_unit(strokes, step: float, max_t: int, order: str = "time", w_floor: float = 0.2,
                 min_stroke_points: int = cfg.MIN_STROKE_POINTS):
    """Nét thô -> (xy, start) đã chuẩn hóa. Trả về None nếu mẫu không dùng được.

    Chuẩn hóa: dời góc trên-trái về (0,0), chia cho S = max(chiều cao, w_floor * chiều rộng) để mọi từ/dòng
    có cùng kích thước tương đối. Sau đó resample đều theo độ dài cung với khoảng cách `step`.
    """
    if step <= 0 or max_t < 1 or min_stroke_points < 2:
        raise ValueError("step/max_t phải dương, min-stroke-points phải >= 2")
    strokes = [dedupe(np.asarray(s, dtype=np.float64)) for s in strokes]
    strokes = [s for s in strokes if len(s)]
    if not strokes:
        return None
    if any(s.ndim != 2 or s.shape[1] != 2 or not np.isfinite(s).all() for s in strokes):
        raise ValueError("Tọa độ nét phải hữu hạn và có dạng (N, 2)")
    if order == "x":                                   # sắp nét theo vị trí ngang (thử nghiệm cho nét dấu viết sau)
        strokes.sort(key=lambda s: float(s[:, 0].mean()))
    allp = np.concatenate(strokes)
    mn, mx = allp.min(axis=0), allp.max(axis=0)
    S = max(mx[1] - mn[1], w_floor * (mx[0] - mn[0]))
    if S <= 0:
        return None
    strokes = [(s - mn) / S for s in strokes]
    lengths = [path_length(s) for s in strokes]

    cur = step
    for _ in range(30):

        counts = [1 if len(s) == 1 else max(min_stroke_points, int(np.ceil(L / cur)) + 1)
                  for s, L in zip(strokes, lengths)]
        if sum(counts) <= max_t:
            break
        cur *= 1.15
    else:
        return None

    pts, start = [], []
    for s, k in zip(strokes, counts):
        r = s if len(s) == 1 else resample_stroke(s, k)
        flag = np.zeros(len(r), dtype=np.float32)
        flag[0] = 1.0
        pts.append(r)
        start.append(flag)
    return np.concatenate(pts).astype(np.float32), np.concatenate(start)


def encode_text(text: str):
    """Nhãn -> danh sách id. Trả về (ids, ký tự lạ nếu có)."""
    ids, unknown = [], []
    for c in text:
        if c in cfg.CHAR_TO_ID:
            ids.append(cfg.CHAR_TO_ID[c])
        else:
            unknown.append(c)
    return ids, unknown


def ctc_min_frames(ids: list[int]) -> int:
    """Số frame tối thiểu để CTC có thể phát ra chuỗi nhãn (ký tự lặp liền nhau cần thêm 1 frame blank giữa)."""
    return len(ids) + sum(1 for a, b in zip(ids, ids[1:]) if a == b)



def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", default="word", choices=list(cfg.LEVELS))
    ap.add_argument("--stroke-order", default="time", choices=["time", "x"])
    ap.add_argument("--max-pages", type=int, default=0, help="chỉ lấy N trang mỗi tập (để chạy thử), 0 = lấy hết")
    ap.add_argument("--step", type=float, default=0)
    ap.add_argument("--max-t", type=int, default=0)
    ap.add_argument("--min-stroke-points", type=int, default=cfg.MIN_STROKE_POINTS)
    ap.add_argument("--data-name", default=None, help="lưu bộ dữ liệu riêng, ví dụ word_v2")
    args = ap.parse_args()
    out = cfg.processed_dir(args.level, args.data_name)
    if (out / "data.npz").exists():
        raise SystemExit(f"Đã có dữ liệu ở {out}. Chọn --data-name khác để giữ các run cũ tái lập được.")

    lv = cfg.LEVELS[args.level]
    step = args.step or lv["step"]
    max_t = args.max_t or lv["max_t"]
    folder = cfg.level_dir(args.level)
    if not folder.exists():
        raise SystemExit(f"Không thấy thư mục {folder}\nKiểm tra lại VNONDB_DIR trong src/seq/config_seq.py")

    XY, START, LAB, rows = [], [], [], []
    offsets, label_offsets = [0], [0]
    dropped: Counter = Counter()
    unknown_chars: Counter = Counter()
    split_code = {name: i for i, name in enumerate(cfg.SPLITS)}
    codes = []

    for split in cfg.SPLITS:
        names = read_split(split)
        if args.max_pages:
            names = names[: args.max_pages]
        n_before = len(rows)
        for page_i, name in enumerate(names, 1):
            path = folder / name
            if not path.exists():

                dropped["thiếu file trang"] += 1
                continue
            meta, units = parse_page(path)
            writer = meta.get("Writer_ID", "unknown")
            for u in units:
                text = u.text.strip()
                if not text:
                    dropped["nhãn rỗng"] += 1
                    continue
                ids, unk = encode_text(text)
                if unk:
                    unknown_chars.update(unk)
                    dropped["có ký tự ngoài bộ ký tự"] += 1
                    continue
                if len(ids) > lv["max_label"]:
                    dropped["nhãn quá dài"] += 1
                    continue
                res = process_unit(u.strokes, step, max_t, args.stroke_order, lv["w_floor"], args.min_stroke_points)
                if res is None:
                    dropped["không có nét / quá dài"] += 1
                    continue
                xy, st = res
                if -(-len(xy) // cfg.DOWNSAMPLE) < ctc_min_frames(ids):
                    dropped["chuỗi điểm quá ngắn so với nhãn (CTC không khả thi)"] += 1
                    continue
                XY.append(xy)
                START.append(st)
                LAB.append(np.asarray(ids, dtype=np.int16))
                offsets.append(offsets[-1] + len(xy))
                label_offsets.append(label_offsets[-1] + len(ids))
                codes.append(split_code[split])
                rows.append({"split": split, "writer_id": writer, "page": name, "group_id": u.group_id,

                             "text": text, "n_points": len(xy), "n_strokes": len(u.strokes)})
            if page_i % 25 == 0:
                print(f"  [{split}] {page_i}/{len(names)} trang, {len(rows)} mẫu", flush=True)
        print(f"{split:10s}: {len(rows) - n_before} mẫu")

    if not rows:
        raise SystemExit("Không có mẫu nào. Kiểm tra đường dẫn dữ liệu.")

    out.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out / "data.npz",
        xy=np.concatenate(XY), start=np.concatenate(START).astype(np.uint8),
        offsets=np.asarray(offsets, dtype=np.int64),
        labels=np.concatenate(LAB), label_offsets=np.asarray(label_offsets, dtype=np.int64),
        split=np.asarray(codes, dtype=np.uint8),
    )
    pd.DataFrame(rows).to_csv(out / "samples.csv", index=False, encoding="utf-8-sig")
    (out / "meta.json").write_text(json.dumps({
        "level": args.level, "step": step, "max_t": max_t, "stroke_order": args.stroke_order,
        "w_floor": lv["w_floor"], "min_stroke_points": args.min_stroke_points,
        "charset": cfg.CHARSET, "downsample": cfg.DOWNSAMPLE,
        "n_samples": len(rows), "splits": Counter(r["split"] for r in rows),
        "writers": {s: len({r["writer_id"] for r in rows if r["split"] == s}) for s in cfg.SPLITS},
        "dropped": dropped, "unknown_chars": unknown_chars.most_common(20),
        "n_points_median": int(np.median([r["n_points"] for r in rows])),
        "n_points_max": int(max(r["n_points"] for r in rows)),
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nTổng {len(rows)} mẫu  |  số điểm trung vị {int(np.median([r['n_points'] for r in rows]))}, "
          f"lớn nhất {max(r['n_points'] for r in rows)}")
    if dropped:
        print("Bị loại:", dict(dropped))
    if unknown_chars:

        print("Ký tự ngoài bộ ký tự:", unknown_chars.most_common(10))
    print(f"Đã lưu vào {out}")


if __name__ == "__main__":
    main()
