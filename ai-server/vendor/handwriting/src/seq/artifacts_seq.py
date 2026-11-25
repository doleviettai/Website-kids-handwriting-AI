"""Các tệp cấu hình của một run; ghi nguyên tử để chịu được việc dừng train."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from src.seq import config_seq as cfg


def best_model_path(run_dir: Path, *, for_save: bool = False) -> Path:
    """Tên model riêng cho seq; vẫn đọc được các run cũ lưu best.keras."""
    path = Path(run_dir) / "word_best.keras"
    legacy = Path(run_dir) / "best.keras"
    if for_save or path.exists() or not legacy.exists():
        return path
    return legacy


def write_json(path: Path, value) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    temp.replace(path)


def dataset_signature(folder: Path) -> dict:
    # Hash cả nhãn/chia tập và metadata; kích thước + mtime phát hiện thay data.npz.
    result = {}
    for name in ("samples.csv", "meta.json"):
        result[name] = hashlib.sha256((folder / name).read_bytes()).hexdigest()
    stat = (folder / "data.npz").stat()
    result["data.npz"] = {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}
    return result


def run_settings(run_dir: Path, level: str | None = None, data_name: str | None = None):
    config_path = run_dir / "train_config.json"
    saved = json.loads(config_path.read_text(encoding="utf-8")) if config_path.exists() else {}
    stored = saved.get("args", {})
    saved_level = stored.get("level", "word")
    if level is not None and level != saved_level:
        raise ValueError(f"Run được train ở mức {saved_level}, không phải {level}")
    saved_name = stored.get("data_name")
    if data_name is not None and saved_name is not None and data_name != saved_name:
        raise ValueError("data-name không khớp bộ dữ liệu đã dùng train")
    return saved_level, data_name or saved_name


def preprocessing_settings(run_dir: Path, level: str, data_name: str | None = None) -> dict:
    snapshot = run_dir / "preprocessing.json"
    path = snapshot if snapshot.exists() else cfg.processed_dir(level, data_name) / "meta.json"
    meta = json.loads(path.read_text(encoding="utf-8"))
    if meta.get("charset", cfg.CHARSET) != cfg.CHARSET:
        raise ValueError("Charset của run không khớp mã nguồn hiện tại")
    lv = cfg.LEVELS[level]
    return {
        "step": meta["step"], "max_t": meta["max_t"],
        "order": meta.get("stroke_order", "time"),
        "w_floor": meta.get("w_floor", lv["w_floor"]),
        # Metadata cũ dùng tối thiểu 2 điểm. Không âm thầm đổi đầu vào của model cũ.
        "min_stroke_points": meta.get("min_stroke_points", 2),
    }
