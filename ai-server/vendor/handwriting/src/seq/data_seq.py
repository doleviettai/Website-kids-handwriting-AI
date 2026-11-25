"""Nạp dữ liệu đã tiền xử lý và tạo tf.data pipeline (batch theo độ dài gần nhau để đỡ phải đệm)."""
from __future__ import annotations

import numpy as np
import pandas as pd
import tensorflow as tf
import json

from src.seq import config_seq as cfg
from src.seq.augment_seq import augment_xy
from src.seq.features_seq import features_from_xy


class SeqData:
    def __init__(self, level: str, data_name: str | None = None) -> None:
        folder = cfg.processed_dir(level, data_name)
        if not (folder / "data.npz").exists():
            raise SystemExit(f"Chưa có dữ liệu đã xử lý ở {folder}\nHãy chạy: python -m src.seq.preprocess_seq --level {level}")
        z = np.load(folder / "data.npz")
        self.xy, self.start = z["xy"], z["start"]
        self.offsets, self.labels, self.label_offsets = z["offsets"], z["labels"], z["label_offsets"]
        self.split = z["split"]
        self.df = pd.read_csv(folder / "samples.csv", dtype=str, keep_default_na=False)
        self.n = len(self.offsets) - 1
        self.level = level
        self.folder = folder
        self.meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
        if self.meta.get("level", level) != level or self.meta.get("charset", cfg.CHARSET) != cfg.CHARSET:
            raise ValueError("Bộ dữ liệu không khớp level / charset hiện tại; cần preprocess lại với tên mới")
        if self.meta.get("downsample", cfg.DOWNSAMPLE) != cfg.DOWNSAMPLE:
            raise ValueError("Downsample không khớp bộ dữ liệu đã preprocess")
        if len(self.df) != self.n or len(self.split) != self.n or len(self.label_offsets) != self.n + 1:
            raise ValueError("data.npz và samples.csv không khớp")
        if self.offsets[-1] != len(self.xy) or self.label_offsets[-1] != len(self.labels):
            raise ValueError("Offsets dữ liệu không hợp lệ")

    def indices(self, split_name: str) -> np.ndarray:
        return np.where(self.split == cfg.SPLITS.index(split_name))[0]

    def length(self, i: int) -> int:
        return int(self.offsets[i + 1] - self.offsets[i])

    def text_ids(self, i: int) -> np.ndarray:
        return self.labels[self.label_offsets[i]: self.label_offsets[i + 1]]


def make_batches(data: SeqData, idx: np.ndarray, batch_size: int, shuffle: bool, rng: np.random.Generator):
    idx = np.array(idx)
    lens = np.diff(data.offsets)[idx]
    if shuffle:
        order = rng.permutation(len(idx))
        idx, lens = idx[order], lens[order]
        chunk = batch_size * 50
        batches = []
        for s in range(0, len(idx), chunk):                      # trong mỗi nhóm lớn, xếp theo độ dài rồi cắt batch
            sub = np.argsort(lens[s:s + chunk], kind="stable") + s
            batches += [idx[sub[b:b + batch_size]] for b in range(0, len(sub), batch_size)]
        rng.shuffle(batches)
        return batches
    order = np.argsort(lens, kind="stable")
    idx = idx[order]
    return [idx[b:b + batch_size] for b in range(0, len(idx), batch_size)]


def collate(data: SeqData, batch_idx: np.ndarray):
    B = len(batch_idx)
    lengths = np.array([data.length(i) for i in batch_idx], dtype=np.int32)
    T = int(lengths.max())
    xy = np.zeros((B, T, 2), dtype=np.float32)
    st = np.zeros((B, T), dtype=np.float32)
    label_lengths = np.array([len(data.text_ids(i)) for i in batch_idx], dtype=np.int32)
    labels = np.zeros((B, int(label_lengths.max())), dtype=np.int32)
    for b, i in enumerate(batch_idx):
        a, e = data.offsets[i], data.offsets[i + 1]
        xy[b, : e - a] = data.xy[a:e]
        st[b, : e - a] = data.start[a:e]
        labels[b, : label_lengths[b]] = data.text_ids(i)
    return xy, st, lengths, labels, label_lengths, np.asarray(batch_idx, dtype=np.int32)


def make_dataset(data: SeqData, idx: np.ndarray, batch_size: int, training: bool, augment: bool, seed: int = cfg.SEED):
    rng = np.random.default_rng(seed)

    def gen():
        for b in make_batches(data, idx, batch_size, shuffle=training, rng=rng):
            yield collate(data, b)

    sig = (
        tf.TensorSpec((None, None, 2), tf.float32), tf.TensorSpec((None, None), tf.float32),
        tf.TensorSpec((None,), tf.int32), tf.TensorSpec((None, None), tf.int32),
        tf.TensorSpec((None,), tf.int32), tf.TensorSpec((None,), tf.int32),
    )

    def prep(xy, start, lengths, labels, label_lengths, sample_idx):
        if training and augment:
            xy = augment_xy(xy, lengths)
        return features_from_xy(xy, start, lengths), lengths, labels, label_lengths, sample_idx

    return tf.data.Dataset.from_generator(gen, output_signature=sig).map(prep, num_parallel_calls=tf.data.AUTOTUNE).prefetch(2)
