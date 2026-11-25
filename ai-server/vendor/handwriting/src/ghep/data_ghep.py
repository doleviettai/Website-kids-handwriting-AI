"""Dữ liệu chữ ghép có fingerprint, chia theo người/style và snapshot riêng từng run."""
from __future__ import annotations

import argparse
import hashlib
import json
import pickle
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from src.char.common import atomic_file, signature, write_json
from .config_ghep import IMG_H, IMG_W, PROC_DIR, RAW_DIR, SPLITS


def validate_strokes(strokes):
    result = []
    for stroke in strokes:
        s = np.asarray(stroke, dtype=np.float32)
        if not s.size:
            continue
        if s.ndim != 2 or s.shape[1] != 2 or not np.isfinite(s).all():
            raise ValueError("Mỗi nét phải là mảng (N,2) với tọa độ hữu hạn")
        result.append(s)
    if not result:
        raise ValueError("Chưa có nét viết")
    if sum(len(s) for s in result) > 50000:
        raise ValueError("Nét viết quá dài")
    return result


def parse_inkml(path):
    path = Path(path)
    root = ET.parse(path).getroot()
    for node in root.iter():
        node.tag = node.tag.rsplit("}", 1)[-1]

    def text(xpath):
        element = root.find(xpath)
        return unicodedata.normalize("NFC", (element.text or "").strip()) if element is not None else ""

    if len(root.findall("./traceGroup")) != 1:
        raise ValueError(f"Cần một traceGroup cho một mẫu chữ ghép: {path}")
    strokes = []
    for trace in root.iter("trace"):
        points = [list(map(float, p.split()[:2])) for p in (trace.text or "").split(",") if len(p.split()) >= 2]
        if points:
            strokes.append(np.asarray(points, np.float32))
    source = text("./annotationXML/Data_Source")
    return {"strokes": validate_strokes(strokes), "truth": text(".//traceGroup/annotationXML/Tg_Truth"),
            "split": text("./annotationXML/Dataset_Split"), "style": text("./annotationXML/Style_ID"),
            "writer": text("./annotationXML/Writer_ID"), "family": text("./annotationXML/Template_Family"),
            "source": "synthetic" if source == "synthetic" else "human",
            "folder": path.parent.name, "file": str(path.resolve())}


def normalize(strokes):
    strokes = validate_strokes(strokes)
    points = np.concatenate(strokes)
    mn, mx = points.min(0), points.max(0)
    scale = max(float((mx - mn).max()), 1e-6)
    return [((s - (mn + mx) / 2) / scale).astype(np.float32) for s in strokes]


def _real_plan(classes):
    from src.seq.parser_vnondb import read_split
    from src.seq import config_seq as cfg
    if not cfg.SPLIT_DIR.exists() or not cfg.level_dir("word").exists():
        raise FileNotFoundError("Không có VNOnDB; thêm --no-vnondb nếu chỉ muốn dùng dữ liệu chữ ghép riêng")
    return [(split, cfg.level_dir("word") / name) for split in SPLITS for name in read_split(split)]


def _validate(items, classes):
    groups = {split: set() for split in SPLITS}
    duplicates = {}
    glyph_roots = {split: set() for split in SPLITS}
    for item in items:
        if item["split"] not in SPLITS or item["truth"] not in classes:
            raise ValueError(f"Nhãn hoặc split không hợp lệ: {item['file']}")
        group = item.get("writer") or item.get("style")
        if not group:
            raise ValueError(f"Thiếu Writer_ID/Style_ID để kiểm tra rò rỉ chia tập: {item['file']}")
        if item["source"] == "composed":
            # Glyph holdout is sample-independent, not writer-independent. Never call it human.
            glyph_roots[item["split"]].update(item.get("provenance", []))
        else:
            groups[item["split"]].add((item["source"], group))
        digest = hashlib.sha256(b"".join(s.tobytes() for s in item["strokes"])).hexdigest()
        previous = duplicates.setdefault(digest, (item["split"], item["truth"]))
        if previous != (item["split"], item["truth"]):
            raise ValueError("Nét trùng nhưng khác nhãn hoặc xuất hiện giữa nhiều tập")
    for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")):
        if groups[a] & groups[b]:
            raise ValueError(f"Người/style trùng giữa {a} và {b}")
        if glyph_roots[a] & glyph_roots[b]:
            raise ValueError(f"Glyph nguồn trùng giữa {a} và {b}")
    train_classes = {s["truth"] for s in items if s["split"] == "train"}
    if train_classes != set(classes):
        raise ValueError(f"Lớp không có mẫu train: {set(classes) - train_classes}")
    if any(not any(s["split"] == split for s in items) for split in SPLITS):
        raise ValueError("Train/validation/test không được rỗng")


def build_processed(force=False, folder=None, raw_dir=None, include_vnondb=False, composed_per_class=0,
                    glyph_validation_per_class=0):
    folder, raw_dir = Path(folder or PROC_DIR), Path(raw_dir or RAW_DIR)
    files = sorted(p for p in raw_dir.rglob("*.inkml") if not p.name.startswith('.'))
    if not files:
        raise FileNotFoundError(f"Không có InkML trong {raw_dir}")
    raw_items = [parse_inkml(p) for p in files]
    if any(not s["truth"] for s in raw_items):
        raise ValueError("Mẫu InkML thiếu Tg_Truth")
    classes = sorted({s["truth"] for s in raw_items})
    plan = _real_plan(classes) if include_vnondb else []
    fingerprint = hashlib.sha256(b"ghep_data_v2" + str((composed_per_class, glyph_validation_per_class)).encode())
    if composed_per_class:
        from .compose_ghep import source_files
        for _, glyph in source_files().iterrows():
            fingerprint.update(str(glyph["truth"]).encode("utf-8"))
            fingerprint.update(Path(glyph["path"]).read_bytes())
    if glyph_validation_per_class:
        from .compose_ghep import source_files
        for _, glyph in source_files("val").iterrows():
            fingerprint.update(str(glyph["truth"]).encode("utf-8"))
            fingerprint.update(Path(glyph["path"]).read_bytes())
    for path in [*files, *[p for _, p in plan]]:
        fingerprint.update(str(path.resolve()).encode("utf-8"))
        fingerprint.update(path.read_bytes())
    for split, path in plan:
        fingerprint.update((split + str(path)).encode("utf-8"))
    source_hash = fingerprint.hexdigest()
    manifest_path = folder / "manifest.json"
    if manifest_path.exists() and not force:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        intact = all((folder / name).exists() and signature(folder / name) == digest
                     for name, digest in manifest["files"].items())
        if manifest["source_sha256"] == source_hash and intact:
            return manifest
    items = raw_items
    if plan:
        from src.seq.parser_vnondb import parse_page
        for split, page in plan:
            metadata, units = parse_page(page)
            for unit in units:
                if unit.text in classes:
                    items.append({"strokes": unit.strokes, "truth": unit.text, "split": split,
                                  "writer": metadata.get("Writer_ID", ""), "style": "", "family": "vnondb",
                                  "source": "human", "file": str(page.resolve()) + "#" + unit.group_id})
    if composed_per_class:
        from .compose_ghep import compose_samples
        items.extend(compose_samples(classes, composed_per_class))
    if glyph_validation_per_class:
        from .compose_ghep import compose_samples
        generated = compose_samples(classes, glyph_validation_per_class, seed=908, split="val")
        for item in generated:
            item["split"] = "validation"
        items.extend(generated)
    for item in items:
        item["strokes"] = normalize(item["strokes"])
        item["y"] = classes.index(item["truth"])
    _validate(items, classes)
    folder.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for split in SPLITS:
        path = folder / f"{split}.pkl"
        with atomic_file(path) as temp:
            temp.write_bytes(pickle.dumps([s for s in items if s["split"] == split]))
        hashes[path.name] = signature(path)
    labels = {"classes": classes, "version": 2}
    write_json(folder / "label_map.json", labels)
    hashes["label_map.json"] = signature(folder / "label_map.json")
    report = {"num_files": len(items), "num_classes": len(classes),
              "per_split": {s: sum(i["split"] == s for i in items) for s in SPLITS},
              "by_source": {s: dict(Counter(i["source"] for i in items if i["split"] == s)) for s in SPLITS},
              "pair_counts": {s: dict(Counter(i["truth"] for i in items if i["split"] == s and i["truth"] in ("uê", "iê"))) for s in SPLITS},
              "per_class_source": {label: dict(Counter(i["source"] for i in items if i["split"] == "train" and i["truth"] == label)) for label in classes},
              "composed_note": "Composed train chỉ dùng glyph train chữ đơn; dữ liệu phái sinh, không phải mẫu chữ ghép người thật.",
              "glyph_validation_note": "Nếu có composed validation: glyph lấy từ val chữ đơn, không trùng glyph train; cùng người viết, không phải kiểm chứng người mới.",
              "note": "Synthetic và human được báo cáo riêng; chưa kiểm chứng trên chữ của bé."}
    write_json(folder / "data_report.json", report)
    hashes["data_report.json"] = signature(folder / "data_report.json")
    manifest = {"version": 2, "source_sha256": source_hash, "files": hashes}
    write_json(manifest_path, manifest)
    print(f"Đã dựng dữ liệu: {report['per_split']}; nguồn: {report['by_source']}", flush=True)
    return manifest


def verify_snapshot(folder):
    folder = Path(folder)
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    for name, digest in manifest["files"].items():
        if not (folder / name).is_file() or signature(folder / name) != digest:
            raise ValueError(f"Snapshot dữ liệu bị thay đổi/hỏng: {name}")
    return manifest


def load_label_map(folder=None):
    return json.loads((Path(folder or PROC_DIR) / "label_map.json").read_text(encoding="utf-8"))


def load_split(split, folder=None):
    if split not in SPLITS:
        raise ValueError("Split không hợp lệ")
    return pickle.loads((Path(folder or PROC_DIR) / f"{split}.pkl").read_bytes())


# ----------------------------------------------------------------------------
# Augment + render
# ----------------------------------------------------------------------------
def augment(strokes, rng):
    """Biến dạng nhẹ nhưng giữ nguyên hình dạng chữ: xoay, nghiêng, co giãn lệch trục, uốn sóng, nhiễu."""
    th = np.deg2rad(rng.uniform(-8, 8))
    sh = rng.uniform(-0.25, 0.25)
    sx, sy = rng.uniform(0.85, 1.15, 2)
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    S = np.array([[1.0, sh], [0.0, 1.0]])
    Z = np.diag([sx, sy])
    M = R @ S @ Z
    amp = rng.uniform(0.0, 0.03)
    freq = rng.uniform(0.5, 1.5)
    phase = rng.uniform(0, 2 * np.pi)
    out = []
    for st in strokes:
        p = st @ M.T
        p[:, 0] += amp * np.sin(2 * np.pi * freq * p[:, 1] + phase)
        p += rng.normal(0, 0.002, p.shape)
        out.append(p.astype(np.float32))
    return out


def render(strokes, rng=None, base_width: float = 2.2):
    """Vẽ các nét thành ảnh xám IMG_H x IMG_W, giá trị [0,1], nét trắng trên nền đen."""
    ss = 2  # supersample để nét mịn
    allp = np.concatenate(strokes)
    mn, mx = allp.min(0), allp.max(0)
    size = np.maximum(mx - mn, 1e-6)
    margin = 5
    scale = float(min((IMG_W - 2 * margin) / size[0], (IMG_H - 2 * margin) / size[1]))
    center = (mn + mx) / 2
    offset = np.array([IMG_W / 2, IMG_H / 2], dtype=np.float32)
    width = base_width
    if rng is not None:
        scale *= rng.uniform(0.88, 1.0)
        offset = offset + rng.uniform(-3, 3, 2)
        width *= rng.uniform(0.8, 1.5)

    img = Image.new("L", (IMG_W * ss, IMG_H * ss), 0)
    d = ImageDraw.Draw(img)
    wpx = max(1, int(round(width * ss)))
    for st in strokes:
        pts = ((st - center) * scale + offset) * ss
        xy = [(float(x), float(y)) for x, y in pts]
        if len(xy) == 1:
            x, y = xy[0]
            r = wpx / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        else:
            d.line(xy, fill=255, width=wpx, joint="curve")
    img = img.resize((IMG_W, IMG_H), Image.BILINEAR)
    return (np.asarray(img, dtype=np.float32) / 255.0)[..., None]


def model_inputs(strokes_list, combined=True):
    images = np.stack([render(s) for s in strokes_list])
    if not combined:
        return images
    from .features_ghep import geometry_batch
    return {"image": images, "geometry": geometry_batch(strokes_list)}


def make_dataset(samples, batch_size, train, rng=None, combined=False, weights=None, samples_per_class=0):
    import tensorflow as tf
    from .features_ghep import N_GEOMETRY, geometry
    rng = rng or np.random.default_rng(42)
    grouped = {y: [i for i, s in enumerate(samples) if s["y"] == y] for y in sorted({s["y"] for s in samples})}
    cardinality = len(grouped) * samples_per_class if train and samples_per_class else len(samples)

    def gen():
        if train and samples_per_class:
            order = np.concatenate([rng.choice(indices, samples_per_class, replace=len(indices) < samples_per_class)
                                    for indices in grouped.values()])
            rng.shuffle(order)
        else:
            order = rng.permutation(len(samples)) if train else np.arange(len(samples))
        for index in order:
            item = samples[index]
            strokes = augment(item["strokes"], rng) if train else item["strokes"]
            image = render(strokes, rng if train else None)
            features = {"image": image, "geometry": geometry(strokes)} if combined else image
            entry = (features, np.int32(item["y"]))
            yield (*entry, np.float32(weights[item["y"]])) if weights is not None else entry

    x_sig = tf.TensorSpec((IMG_H, IMG_W, 1), tf.float32)
    if combined:
        x_sig = {"image": x_sig, "geometry": tf.TensorSpec((N_GEOMETRY,), tf.float32)}
    spec = (x_sig, tf.TensorSpec((), tf.int32))
    if weights is not None:
        spec = (*spec, tf.TensorSpec((), tf.float32))
    ds = tf.data.Dataset.from_generator(gen, output_signature=spec)
    ds = ds.apply(tf.data.experimental.assert_cardinality(cardinality))
    return ds.batch(batch_size).prefetch(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.build:
        build_processed(force=args.force)


