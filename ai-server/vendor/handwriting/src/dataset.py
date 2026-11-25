"""Nạp dữ liệu đã tiền xử lý và tạo tf.data pipeline."""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
import tensorflow as tf

from src import config
from src.augment import augment_points
from src.features import points_to_features


def load_processed(processed_dir=config.PROCESSED_DIR) -> dict:
    z = np.load(processed_dir / "samples.npz")
    meta = pd.read_csv(processed_dir / "samples_meta.csv", dtype=str, keep_default_na=False)
    splits = pd.read_csv(processed_dir / "splits.csv", dtype=str, keep_default_na=False)
    assert len(meta) == len(z["P"]) == len(splits), "samples.npz / samples_meta.csv / splits.csv không khớp nhau, hãy chạy lại preprocess"
    labels = json.loads((processed_dir / "label_maps.json").read_text(encoding="utf-8"))
    return {
        "P": z["P"], "S": z["S"],
        "y_base": z["y_base"], "y_modifier": z["y_modifier"], "y_tone": z["y_tone"],
        "meta": meta, "split": splits["split"].to_numpy(), "labels": labels,
    }


def subset(data: dict, split_name: str) -> dict:
    m = data["split"] == split_name
    return {
        "P": data["P"][m], "S": data["S"][m],
        "y_base": data["y_base"][m], "y_modifier": data["y_modifier"][m], "y_tone": data["y_tone"][m],
        "meta": data["meta"][m].reset_index(drop=True),
    }


def class_weights(y: np.ndarray, n_classes: int, lo: float = 0.5, hi: float = 5.0) -> np.ndarray:
    """Trọng số nghịch với tần suất lớp (chỉ tính trên các lớp có mặt), cắt trong [lo, hi]."""
    counts = np.bincount(y, minlength=n_classes).astype(np.float64)
    present = counts > 0
    w = np.ones(n_classes, dtype=np.float64)
    w[present] = len(y) / (present.sum() * counts[present])
    return np.clip(w, lo, hi).astype(np.float32)


def make_dataset(part: dict, batch_size: int, training: bool, augment: bool = True, weights: dict | None = None):
    tensors = [part["P"], part["S"], part["y_base"], part["y_modifier"], part["y_tone"]]
    if weights is not None:
        tensors += [weights["base"], weights["modifier"], weights["tone"]]
    ds = tf.data.Dataset.from_tensor_slices(tuple(tensors))
    if training:
        ds = ds.shuffle(len(part["P"]), seed=config.SEED, reshuffle_each_iteration=True)
    ds = ds.batch(batch_size)

    def _map(P, S, yb, ym, yt, *w):
        if training and augment:
            P = augment_points(P)
        X = points_to_features(P, S)
        y = {"base": yb, "modifier": ym, "tone": yt}
        if w:
            return X, y, {"base": w[0], "modifier": w[1], "tone": w[2]}
        return X, y

    return ds.map(_map, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)