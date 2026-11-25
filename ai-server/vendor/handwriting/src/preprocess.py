"""Biến toàn bộ file .inkml thành tensor để train:  python -m src.preprocess

Sinh ra trong data/processed/:
    samples.npz        P (N,T,2) tọa độ đã resample, S (N,T) cờ đầu nét, y_base / y_modifier / y_tone
    samples_meta.csv   thông tin từng mẫu (đường dẫn, người viết, nhãn, số nét...)
    splits.csv         mẫu nào thuộc train / val / test
    label_maps.json    danh sách nhãn + tham số tiền xử lý (dùng lại khi suy luận)
"""
from __future__ import annotations

import argparse
import json
from collections import Counter

import numpy as np
import pandas as pd

from src import config
from src.inkml_parser import InkParseError, check_sample, iter_inkml_files, parse_inkml
from src.labels import BASE_TO_IDX, BASES, MOD_TO_IDX, MODIFIERS, TONE_TO_IDX, TONES, decompose_char
from src.stroke_utils import normalize_to_canvas, strokes_to_points

FEATURE_NAMES = ["x_abs", "y_abs", "x_loc", "y_loc", "dx", "dy", "stroke_start"]


# ------------------------------------------------------------------ chia dữ liệu
def split_by_writer(meta: pd.DataFrame, val_frac: float, test_frac: float, seed: int) -> pd.Series:
    rng = np.random.default_rng(seed)
    writers = sorted(meta["writer_id"].unique())
    rng.shuffle(writers)
    n = len(writers)
    n_test = max(1, round(n * test_frac))
    n_val = max(1, round(n * val_frac))
    test_w = set(writers[:n_test])
    val_w = set(writers[n_test:n_test + n_val])
    return meta["writer_id"].map(lambda w: "test" if w in test_w else "val" if w in val_w else "train")


def split_random_stratified(meta: pd.DataFrame, val_frac: float, test_frac: float, seed: int) -> pd.Series:
    """Chia ngẫu nhiên nhưng giữ tỉ lệ từng ký tự. Chỉ dùng khi có quá ít người viết."""
    rng = np.random.default_rng(seed)
    split = pd.Series("train", index=meta.index)
    for _, idx in meta.groupby("truth").groups.items():
        idx = np.array(list(idx))
        rng.shuffle(idx)
        n = len(idx)
        if n < 3:
            continue                      # quá ít mẫu: để hết vào train
        n_test = max(1, round(n * test_frac))
        n_val = max(1, round(n * val_frac))
        split.loc[idx[:n_test]] = "test"
        split.loc[idx[n_test:n_test + n_val]] = "val"
    return split


def make_splits(meta: pd.DataFrame, mode: str, seed: int) -> tuple[pd.Series, str]:
    n_writers = meta["writer_id"].nunique()
    if mode == "auto":
        mode = "group" if n_writers >= config.MIN_WRITERS_FOR_GROUP_SPLIT else "random"
    if mode == "group":
        if n_writers < 3:
            raise SystemExit("Cần ít nhất 3 người viết để chia theo người viết. Dùng --split-mode random.")
        return split_by_writer(meta, config.VAL_FRAC, config.TEST_FRAC, seed), "group"
    return split_random_stratified(meta, config.VAL_FRAC, config.TEST_FRAC, seed), "random"


# ------------------------------------------------------------------------ main
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default=str(config.RAW_DIR))
    ap.add_argument("--split-mode", default=config.SPLIT_MODE, choices=["auto", "group", "random"])
    ap.add_argument("--seed", type=int, default=config.SEED)
    ap.add_argument("--seq-len", type=int, default=config.SEQ_LEN)
    args = ap.parse_args()

    files = list(iter_inkml_files(args.raw_dir))
    if not files:
        raise SystemExit(f"Không tìm thấy file .inkml nào trong {args.raw_dir}")

    P_list, S_list, yb, ym, yt, rows = [], [], [], [], [], []
    dropped: Counter = Counter()
    for path in files:
        try:
            s = parse_inkml(path)
        except InkParseError as e:
            dropped["parse_error"] += 1
            continue
        hard, _ = check_sample(s)
        if hard:
            for r in hard:
                dropped[r] += 1
            continue

        base, mod, tone = decompose_char(s.truth)        # tin Tg_Truth làm nguồn nhãn duy nhất
        xy = normalize_to_canvas(s.strokes, s.canvas_w, s.canvas_h)
        P, S = strokes_to_points(xy, seq_len=args.seq_len)

        P_list.append(P)
        S_list.append(S)
        yb.append(BASE_TO_IDX[base])
        ym.append(MOD_TO_IDX[mod])
        yt.append(TONE_TO_IDX[tone])
        rows.append({
            "sample_id": len(rows), "path": str(path), "writer_id": s.writer_id, "truth": s.truth,
            "base": base, "modifier": mod, "tone": tone,
            "n_strokes": s.n_strokes, "n_points": s.n_points, "duration_ms": round(s.duration_ms),
        })

    if not rows:
        raise SystemExit("Không còn mẫu nào sau khi lọc. Chạy `python -m src.audit` để xem lý do.")

    meta = pd.DataFrame(rows)
    split, used_mode = make_splits(meta, args.split_mode, args.seed)
    splits = meta[["sample_id", "path", "writer_id", "truth"]].copy()
    splits["split"] = split.values

    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        config.PROCESSED_DIR / "samples.npz",
        P=np.stack(P_list).astype(np.float32), S=np.stack(S_list).astype(np.float32),
        y_base=np.array(yb, dtype=np.int32), y_modifier=np.array(ym, dtype=np.int32), y_tone=np.array(yt, dtype=np.int32),
    )
    meta.to_csv(config.PROCESSED_DIR / "samples_meta.csv", index=False, encoding="utf-8-sig")
    splits.to_csv(config.PROCESSED_DIR / "splits.csv", index=False, encoding="utf-8-sig")
    (config.PROCESSED_DIR / "label_maps.json").write_text(json.dumps({
        "bases": BASES, "modifiers": MODIFIERS, "tones": TONES,
        "seq_len": args.seq_len, "feature_names": FEATURE_NAMES,
        "min_pts_per_stroke": config.MIN_PTS_PER_STROKE, "stroke_equal_mix": config.STROKE_EQUAL_MIX,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- báo cáo
    print(f"\nĐọc {len(files)} file  ->  giữ {len(meta)} mẫu")
    if dropped:
        print("Bị loại:", ", ".join(f"{k}={v}" for k, v in dropped.items()))
    print(f"Số người viết: {meta['writer_id'].nunique()}   |   kiểu chia: {used_mode}")
    if used_mode == "random":
        print("  !! CẢNH BÁO: chia NGẪU NHIÊN theo mẫu (ít người viết). Cùng 1 người có mẫu ở cả train và test,")
        print("     nên accuracy sẽ cao hơn thực tế. Hãy xem đây là số tham khảo, không phải kết quả cuối.")
    for name in ("train", "val", "test"):
        part = splits[splits["split"] == name]
        print(f"  {name:5s}: {len(part):5d} mẫu, {part['writer_id'].nunique():3d} người viết")
    train_truth = set(splits.loc[splits["split"] == "train", "truth"])
    lost = sorted(set(splits["truth"]) - train_truth)
    if lost:
        print(f"  !! Ký tự không có mẫu nào trong train: {' '.join(lost)}")
    print(f"\nĐã lưu vào {config.PROCESSED_DIR}")


if __name__ == "__main__":
    main()