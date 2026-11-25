"""Tạo dữ liệu thí nghiệm riêng từ snapshot đã train; không đổi dữ liệu/model cũ."""
from __future__ import annotations

import argparse
import hashlib
import json
import pickle
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

from src import config
from src.char.common import atomic_file, signature, write_json
from .splitting import NAMES, describe, grouped_split, quotas, stratified_split

ROOT = config.ROOT
EXPERIMENT = ROOT / "reports" / "split_701515"


def protected_files():
    paths = []
    for folder in (ROOT / "models/baseline_stable", ROOT / "models/seq/word_stable", ROOT / "models/ghep_handwriting_v4"):
        paths += [p for p in folder.rglob("*") if p.is_file()]
    for name in ("test", "test1", "test2", "test3"):
        paths.append(ROOT / name)
    for folder in (ROOT / "src/char", ROOT / "src/seq", ROOT / "src/ghep"):
        paths += list(folder.glob("*.py"))
    return {str(p.relative_to(ROOT)): signature(p) for p in paths}


def assert_originals():
    manifest = json.loads((EXPERIMENT / "original_files.json").read_text(encoding="utf-8"))
    changed = [name for name, digest in manifest.items() if not (ROOT / name).exists() or signature(ROOT / name) != digest]
    if changed:
        raise ValueError(f"Các tệp bản gốc đã thay đổi: {changed[:10]}")
    return len(manifest)


def _prepare_char(destination):
    source = ROOT / "models/baseline_stable"
    with np.load(source / "data.npz") as z:
        old = {key: z[key] for key in z.files}
    meta = pd.read_csv(source / "samples_meta.csv", dtype=str, keep_default_na=False)
    hashes = [hashlib.sha256(p.tobytes() + s.tobytes()).hexdigest() for p, s in zip(old["P"], old["S"])]
    split = stratified_split(meta["truth"].to_numpy(), hashes)
    destination.mkdir(parents=True)
    meta.drop(columns=["split"], errors="ignore").to_csv(destination / "samples_meta.csv", index=False, encoding="utf-8-sig")
    frame = meta[["sample_id", "path", "writer_id", "truth"]].copy()
    frame["split"] = np.where(split == "validation", "val", split)
    frame.to_csv(destination / "splits.csv", index=False, encoding="utf-8-sig")
    frame.assign(old_split=old["split"]).to_csv(destination / "assignment.csv", index=False, encoding="utf-8-sig")
    report = {"actual": describe(split), "total": len(split), "mode": "label_stratified_one_writer",
              "writer_independent": False, "duplicate_policy": "exact duplicate glyphs kept in train",
              "common_test_samples": int(np.sum((old["split"] == "test") & (split == "test")))}
    write_json(destination / "split_report.json", report)
    return report, frame


def _prepare_seq():
    source = ROOT / "dataset/processed_seq/word_v2"
    destination = ROOT / "dataset/processed_seq/word_701515"
    if destination.exists():
        raise FileExistsError(destination)
    frame = pd.read_csv(source / "samples.csv", dtype=str, keep_default_na=False)
    print("Seq: tìm split 70/15/15 giữ nguyên người viết...", flush=True)
    split = grouped_split(frame["writer_id"].to_numpy())
    # Giữ cả trang trong cùng tập, không chỉ kiểm tra writer.
    for field in ("writer_id", "page"):
        if frame.assign(new_split=split).groupby(field)["new_split"].nunique().max() > 1:
            raise ValueError(f"Seq: {field} bị chia giữa nhiều tập")
    with np.load(source / "data.npz") as z:
        arrays = {key: z[key] for key in z.files}
    old_split = arrays["split"].copy()
    arrays["split"] = np.array([NAMES.index(s) for s in split], np.uint8)
    destination.mkdir(parents=True)
    np.savez_compressed(destination / "data.npz", **arrays)
    frame["old_split"] = frame["split"]
    frame["split"] = split
    frame.to_csv(destination / "samples.csv", index=False, encoding="utf-8-sig")
    meta = json.loads((source / "meta.json").read_text(encoding="utf-8"))
    meta["splits"] = {s: int((split == s).sum()) for s in NAMES}
    meta["writers"] = {s: int(frame.loc[split == s, "writer_id"].nunique()) for s in NAMES}
    meta["experiment"] = {"target_ratio": [0.7, 0.15, 0.15], "grouping": "writer", "seed": 42,
                          "uses_official_split": False}
    write_json(destination / "meta.json", meta)
    report = {"actual": describe(split), "total": len(split), "mode": "writer_grouped_exact_integer_quotas",
              "writer_counts": meta["writers"], "common_test_samples": int(np.sum((old_split == 2) & (split == "test")))}
    write_json(destination / "split_report.json", report)
    return report


def _prepare_ghep(destination, glyph_frame):
    from src.ghep.data_ghep import _validate, load_split, normalize
    source = ROOT / "models/ghep_handwriting_v4/data"
    originals = [s for name in NAMES for s in load_split(name, source)]
    items = [dict(s) for s in originals if s["source"] != "composed"]
    groups = [s["source"] + ":" + (s.get("writer") or s["style"]) for s in items]
    print("Ghép: chia lại raw theo người/style, trước khi sinh mẫu phái sinh...", flush=True)
    split = grouped_split(groups, categories=[s["source"] for s in items])
    for sample, name in zip(items, split):
        sample["old_split"] = sample["split"]
        sample["split"] = str(name)
    classes = json.loads((source / "label_map.json").read_text(encoding="utf-8"))["classes"]
    total = len(originals)
    target = quotas(total)
    raw_counts = np.array([(split == name).sum() for name in NAMES])
    derived_counts = target - raw_counts
    if np.any(derived_counts < len(classes)):
        raise ValueError("Không đủ số mẫu phái sinh mỗi lớp")
    # Lấy glyph ở split thử nghiệm mới, không theo split cũ.
    for index, name in enumerate(NAMES):
        generated = _compose_from_partition(classes, glyph_frame, name, int(derived_counts[index]))
        for sample in generated:
            sample["strokes"] = normalize(sample["strokes"])
            sample["y"] = classes.index(sample["truth"])
        items.extend(generated)
    _validate(items, classes)
    destination.mkdir(parents=True)
    hashes = {}
    for name in NAMES:
        path = destination / f"{name}.pkl"
        with atomic_file(path) as temp:
            temp.write_bytes(pickle.dumps([s for s in items if s["split"] == name]))
        hashes[path.name] = signature(path)
    write_json(destination / "label_map.json", {"classes": classes, "version": 2})
    hashes["label_map.json"] = signature(destination / "label_map.json")
    all_split = np.array([s["split"] for s in items])
    report = {"actual": describe(all_split), "total": total, "mode": "raw_grouped_then_derived_from_disjoint_glyph_partitions",
              "raw_counts": dict(zip(NAMES, map(int, raw_counts))),
              "composed_counts": dict(zip(NAMES, map(int, derived_counts))),
              "by_source": {s: {source: sum(i["split"] == s and i["source"] == source for i in items)
                                 for source in sorted({i["source"] for i in items})} for s in NAMES},
              "common_test_samples": sum(s["source"] != "composed" and s["split"] == "test" and s["old_split"] == "test" for s in items),
              "note": "Composed: cùng một người viết nhưng khác glyph; không phải độc lập người viết. Không có glyph gốc dùng chung giữa các split."}
    write_json(destination / "data_report.json", report)
    hashes["data_report.json"] = signature(destination / "data_report.json")
    write_json(destination / "manifest.json", {"version": 2, "source_sha256": hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest(), "files": hashes})
    return report


def _compose_from_partition(classes, frame, split, count):
    # Cùng công thức ghép cũ nhưng nguồn glyph cố định bởi assignment mới.
    from unittest.mock import patch
    from src.ghep.compose_ghep import compose_samples
    glyph_name = "val" if split == "validation" else split
    rows = frame.loc[frame["split"] == glyph_name]
    per_class = int(np.ceil(count / len(classes)))
    with patch("src.ghep.compose_ghep.source_files", return_value=rows):
        candidates = compose_samples(classes, per_class=per_class, seed=112 + NAMES.index(split), split=glyph_name)
    sizes = np.full(len(classes), count // len(classes))
    sizes[np.random.default_rng(42).permutation(len(classes))[:count % len(classes)]] += 1
    generated = []
    for label, n in zip(classes, sizes):
        selected = [s for s in candidates if s["truth"] == label][:int(n)]
        for sample in selected:
            sample["split"] = split
        generated.extend(selected)
    return generated


def freeze_training_code():
    workspace = EXPERIMENT / "workspace"
    shutil.copytree(ROOT / "src", workspace / "src", ignore=shutil.ignore_patterns("__pycache__"))
    # Cấu hình bản đóng băng vẫn ghi về models/<tên thử nghiệm>, không vào model cũ.
    for name, original in (("src/config.py", "ROOT = Path(__file__).resolve().parents[1]"),
                           ("src/ghep/config_ghep.py", "ROOT = Path(__file__).resolve().parents[2]")):
        path = workspace / name
        code = path.read_text(encoding="utf-8")
        if code.count(original) != 1:
            raise ValueError(f"Không nhận ra ROOT trong {name}")
        path.write_text(code.replace(original, f"ROOT = Path({str(ROOT)!r})"), encoding="utf-8")
    path = workspace / "src/ghep/train_ghep.py"
    code = path.read_text(encoding="utf-8")
    old = '''manifest = build_processed(folder=data_dir, include_vnondb=options["include_vnondb"],
                                   composed_per_class=options["composed_per_class"],
                                   glyph_validation_per_class=options["glyph_validation_per_class"])'''
    replacement = f'''import shutil
        prepared = Path({str(EXPERIMENT / 'prepared/ghep')!r})
        verify_snapshot(prepared)
        if not data_dir.exists():
            shutil.copytree(prepared, data_dir)
        manifest = verify_snapshot(data_dir)'''
    if code.count(old) != 1:
        raise ValueError("Không nhận ra bước prepare của ghep trainer; không sửa trainer gốc")
    path.write_text(code.replace(old, replacement), encoding="utf-8")
    for name, token in (("char", "cwd=config.ROOT"), ("seq", "cwd=config.ROOT"), ("ghep", "cwd=ROOT")):
        path = workspace / f"src/{name}/run_full.py"
        code = path.read_text(encoding="utf-8")
        if token not in code:
            raise ValueError(f"Không nhận ra working directory của {name} pipeline")
        path.write_text(code.replace(token, f"cwd={str(workspace)!r}"), encoding="utf-8")
    patch_frozen_seq_io(workspace)
    return workspace


def patch_frozen_seq_io(workspace):
    """Chỉ bản đóng băng dùng retry Windows đã kiểm tra, trainer gốc không đổi."""
    path = workspace / "src/seq/artifacts_seq.py"
    code = path.read_text(encoding="utf-8")
    old = '''    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    temp.replace(path)'''
    new = '''    from src.char.common import write_json as safe_write_json
    safe_write_json(path, value)'''
    if old in code:
        path.write_text(code.replace(old, new), encoding="utf-8")
    path = workspace / "src/seq/train_seq.py"
    code = path.read_text(encoding="utf-8")
    if "from src.char.common import replace_file" not in code:
        code = code.replace("from src import config\n", "from src import config\nfrom src.char.common import replace_file\n") if "from src import config\n" in code else code.replace("from src.seq import config_seq as cfg", "from src.char.common import replace_file\nfrom src.seq import config_seq as cfg")
    code = code.replace("temp_model.replace(model_path)", "replace_file(temp_model, model_path)")
    code = code.replace('(run_dir / "history.csv.tmp").replace(run_dir / "history.csv")', 'replace_file(run_dir / "history.csv.tmp", run_dir / "history.csv")')
    path.write_text(code, encoding="utf-8")


def prepare():
    final = EXPERIMENT / "split_summary.json"
    if final.exists():
        assert_originals()
        return json.loads(final.read_text(encoding="utf-8"))
    if EXPERIMENT.exists():
        raise FileExistsError("Thư mục thí nghiệm chuẩn bị dở; giữ lại để kiểm tra, không tự ghi đè")
    EXPERIMENT.mkdir(parents=True)
    original = protected_files()
    write_json(EXPERIMENT / "original_files.json", original)
    freeze_training_code()
    char_report, glyphs = _prepare_char(EXPERIMENT / "prepared/char")
    seq_report = _prepare_seq()
    ghep_report = _prepare_ghep(EXPERIMENT / "prepared/ghep", glyphs)
    summary = {"target_ratio": [70, 15, 15], "seed": 42,
               "models": {"baseline_701515": char_report, "word_701515": seq_report, "ghep_701515": ghep_report},
               "initialization": "random; không dùng model cũ đã thấy test mới",
               "comparison_limit": "Test mới khác test cũ; không so trực tiếp hai accuracy để kết luận do ratio. Dùng giao test cũ/mới cho cùng tập chưa học.",
               "rollback": "Không đổi model/test file/trainer gốc; mở demo bằng tên cũ để quay lại."}
    assert_originals()
    write_json(final, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-originals", action="store_true")
    args = parser.parse_args()
    if args.verify_originals:
        print(f"Bản gốc giữ nguyên: {assert_originals()} tệp")
    else:
        prepare()
