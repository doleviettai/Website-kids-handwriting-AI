"""Ghép nét chữ đơn đã gán nhãn; dữ liệu phái sinh chỉ dùng train, không giả là chữ ghép người thật."""
from pathlib import Path
import hashlib
import numpy as np
import pandas as pd

from src import config
from src.inkml_parser import parse_inkml
from src.stroke_utils import normalize_to_canvas


def source_files(split="train"):
    folder = config.PROCESSED_DIR
    meta = pd.read_csv(folder / "samples_meta.csv", keep_default_na=False)
    splits = pd.read_csv(folder / "splits.csv", keep_default_na=False)
    if not meta["sample_id"].equals(splits["sample_id"]) or not meta["path"].equals(splits["path"]):
        raise ValueError("Metadata/split chữ đơn không khớp")
    if split not in ("train", "val", "test"):
        raise ValueError("Split glyph không hợp lệ")
    # build_processed chỉ gọi train; val/test dành kiểm chứng phái sinh riêng.
    return meta.loc[splits["split"] == split]


def compose_samples(classes, per_class=24, seed=112, split="train"):
    rows = source_files(split) if split != "train" else source_files()
    glyphs = {}
    for _, row in rows.iterrows():
        sample = parse_inkml(row["path"])
        if sample.truth != row["truth"]:
            raise ValueError("Nhãn chữ đơn nguồn đã thay đổi")
        strokes = normalize_to_canvas(sample.strokes, sample.canvas_w, sample.canvas_h)
        glyphs.setdefault(sample.truth, []).append((strokes, str(row["path"])))
    rng = np.random.default_rng(seed)
    items = []
    for label in classes:
        if any(c not in glyphs for c in label):
            raise ValueError(f"Thiếu glyph train cho chữ ghép {label}")
        for index in range(per_class):
            strokes, paths, x = [], [], 0.0
            for char in label:
                options = glyphs[char]
                gs, path = options[int(rng.integers(len(options)))]
                points = np.concatenate(gs)
                left, right = points[:, 0].min(), points[:, 0].max()
                sx, sy = rng.uniform(0.8, 1.2, 2)
                shear = rng.uniform(-0.12, 0.12)
                baseline = 0.8 + rng.uniform(-0.015, 0.015)
                transformed = []
                for stroke in gs:
                    p = stroke.copy()
                    p[:, 0] = (p[:, 0] - left) * sx + x + shear * (p[:, 1] - 0.8)
                    p[:, 1] = (p[:, 1] - 0.8) * sy + baseline
                    transformed.append(p)
                # Chữ đã có nét vào/ra của người viết; không tự gán nét ngẫu nhiên là nét nối.
                strokes.extend(transformed)
                paths.append(path)
                x += float(right - left) * sx + rng.uniform(0.005, 0.04)
            digest = hashlib.sha256((label + str(index) + "|".join(paths)).encode()).hexdigest()[:16]
            items.append({"strokes": strokes, "truth": label, "split": split, "source": "composed",
                          "writer": f"derived_from_custom_{split}_only", "style": f"composed_{split}",
                          "family": "composed_isolated_glyphs", "file": f"composed:{label}:{digest}",
                          "provenance": paths})
    return items
