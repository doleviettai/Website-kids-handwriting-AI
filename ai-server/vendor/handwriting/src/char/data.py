"""Đọc lại nét thô ở 128 điểm, giữ split cũ để so sánh công bằng."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf

from src import config
from src.augment import augment_points
from src.char.common import signature, write_json
from src.char.features import deep_features
from src.inkml_parser import check_sample, parse_inkml
from src.labels import BASES, MODIFIERS, TONES, decompose_char
from src.stroke_utils import normalize_to_canvas, strokes_to_points


def prepare(run_dir, processed_dir, seq_len=128):
    processed_dir = Path(processed_dir)
    old_meta = pd.read_csv(processed_dir / "samples_meta.csv", keep_default_na=False, dtype=str)
    splits = pd.read_csv(processed_dir / "splits.csv", keep_default_na=False, dtype=str)
    if len(old_meta) != len(splits) or not old_meta["sample_id"].equals(splits["sample_id"]):
        raise ValueError("Metadata và splits không khớp")
    if not old_meta["path"].equals(splits["path"]) or not old_meta["truth"].equals(splits["truth"]):
        raise ValueError("Nhãn/đường dẫn giữa metadata và splits không khớp")
    points, starts, rows, labels = [], [], [], []
    digest = hashlib.sha256()
    for i, row in old_meta.iterrows():
        path = Path(row["path"])
        if not path.exists():
            raise FileNotFoundError(f"Cần nét thô để lấy mẫu lại: {path}")
        digest.update(path.read_bytes())
        sample = parse_inkml(path)
        hard, _ = check_sample(sample)
        if hard or sample.truth != row["truth"] or sample.writer_id != row["writer_id"]:
            raise ValueError(f"Nét thô đã thay đổi / không hợp lệ: {path}, {hard}")
        P, S = strokes_to_points(normalize_to_canvas(sample.strokes, sample.canvas_w, sample.canvas_h),
                                  seq_len=seq_len, min_pts=4, equal_mix=0.3)
        points.append(P)
        starts.append(S)
        b, m, t = decompose_char(sample.truth)
        labels.append([BASES.index(b), MODIFIERS.index(m), TONES.index(t)])
        rows.append(dict(row))
    meta = pd.DataFrame(rows)
    meta["split"] = splits["split"]
    writer_splits = meta.groupby("writer_id")["split"].nunique()
    overlap = int((writer_splits > 1).sum())
    split_info = {s: {"n": int((meta["split"] == s).sum()),
                       "writers": int(meta.loc[meta["split"] == s, "writer_id"].nunique())}
                  for s in ("train", "val", "test")}
    settings = {"version": 2, "seq_len": seq_len, "min_pts_per_stroke": 4, "stroke_equal_mix": 0.3,
                "bases": BASES, "modifiers": MODIFIERS, "tones": TONES, "features": "penup_masked_v2",
                "writer_overlap": overlap, "split_summary": split_info, "raw_sha256": digest.hexdigest(),
                "source_split_sha256": signature(processed_dir / "splits.csv")}
    np.savez_compressed(run_dir / "data.npz", P=points, S=starts, y=np.asarray(labels, np.int32),
                        split=meta["split"].to_numpy(dtype=str))
    meta.to_csv(run_dir / "samples_meta.csv", index=False, encoding="utf-8-sig")
    write_json(run_dir / "label_maps.json", settings)
    if overlap:
        print(f"Lưu ý: {overlap} người viết xuất hiện ở nhiều tập. Chưa đo được khả năng tổng quát với người mới.", flush=True)
    print(f"Dữ liệu: {len(meta)} mẫu, {meta['writer_id'].nunique()} người; {split_info}", flush=True)
    return load(run_dir)


def load(run_dir):
    with np.load(run_dir / "data.npz") as z:
        data = {key: z[key] for key in z.files}
    data["meta"] = pd.read_csv(run_dir / "samples_meta.csv", keep_default_na=False)
    data["settings"] = json.loads((run_dir / "label_maps.json").read_text(encoding="utf-8"))
    return data


def make_dataset(data, split, batch_size, training=False, seed=42):
    mask = data["split"] == split
    P, S, y = data["P"][mask], data["S"][mask], data["y"][mask]
    if not len(P):
        raise ValueError(f"Tập {split} rỗng")
    ds = tf.data.Dataset.from_tensor_slices((P, S, y))
    weights = {}
    if training:
        for i, (head, classes) in enumerate((("base", BASES), ("modifier", MODIFIERS), ("tone", TONES))):
            counts = np.bincount(y[:, i], minlength=len(classes))
            present = counts > 0
            values = np.ones(len(classes), dtype=np.float32)
            values[present] = np.clip(np.sqrt(len(y) / (present.sum() * counts[present])), 0.5, 3.0)
            weights[head] = tf.constant(values)
    if training:
        ds = ds.shuffle(len(P), seed=seed, reshuffle_each_iteration=True)

    def convert(p, s, labels):
        if training:
            # Biến dạng vừa phải, không lật và không xóa nét vươn cao để ép a thành d.
            p = augment_points(p)
        targets = {h: labels[:, i] for i, h in enumerate(("base", "modifier", "tone"))}
        features = deep_features(p, s)
        if training:
            return features, targets, {h: tf.gather(w, targets[h]) for h, w in weights.items()}
        return features, targets

    return ds.batch(batch_size).map(convert, num_parallel_calls=2).prefetch(2)
