"""Đường nhận dạng chung cho web, Tkinter và đánh giá; nhãn riêng từng run."""
import json
import hashlib
import tempfile
from pathlib import Path
import joblib
import numpy as np
from tensorflow import keras

from src.char.common import signature
from .data_ghep import load_label_map, model_inputs, normalize


class Predictor:
    def __init__(self, run_dir, which="best"):
        self.run_dir = run_dir
        self.path = run_dir / f"ghep_{which}.keras"
        if not self.path.exists():
            raise FileNotFoundError(f"Không thấy model: {self.path}")
        label_path = run_dir / "label_map.json"
        snapshot = run_dir / "data"
        if snapshot.exists():
            if not label_path.exists():
                raise ValueError("Run mới thiếu bảng nhãn riêng; không được dùng cache chung")
            manifest = json.loads((snapshot / "manifest.json").read_text(encoding="utf-8"))
            if signature(snapshot / "label_map.json") != manifest["files"]["label_map.json"]:
                raise ValueError("Bảng nhãn snapshot bị thay đổi")
            if load_label_map(run_dir)["classes"] != load_label_map(snapshot)["classes"]:
                raise ValueError("Bảng nhãn run và snapshot không khớp")
        self.classes = load_label_map(run_dir if label_path.exists() else None)["classes"]
        self.mtime = self.path.stat().st_mtime_ns
        self.model = self._load_model()
        self.hybrid, self.svm_mtime = None, None
        self._check_model()
        settings = run_dir / "preprocessing.json"
        if settings.exists():
            config = json.loads(settings.read_text(encoding="utf-8"))
            if config["image_shape"] != [64, 192, 1] or config["geometry_version"] != 1:
                raise ValueError("Tiền xử lý của run không khớp mã nguồn")
        self.refresh()

    def _load_model(self):
        # Snapshot bytes: train có thể thay checkpoint trong lúc đang load/hash.
        data = self.path.read_bytes()
        self.model_hash = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.keras"
            path.write_bytes(data)
            return keras.models.load_model(path, compile=False)

    def _check_model(self):
        if self.model.output_shape[-1] != len(self.classes):
            raise ValueError("Số lớp model và label_map không khớp")
        self.combined = len(self.model.inputs) == 2

    def refresh(self):
        mtime = self.path.stat().st_mtime_ns
        if mtime != self.mtime:
            self.model = self._load_model()
            self._check_model()
            self.mtime = mtime
            self.hybrid, self.svm_mtime = None, None
        svm_path = self.run_dir / "shape_svm.joblib"
        if svm_path.exists() and self.svm_mtime != svm_path.stat().st_mtime_ns:
            artifact = joblib.load(svm_path)
            self.hybrid = artifact if artifact["classes"] == self.classes and artifact["model_sha256"] == self.model_hash else None
            self.svm_mtime = svm_path.stat().st_mtime_ns

    def probabilities(self, strokes_list, mode="hybrid"):
        from .hybrid_ghep import shallow_probabilities
        strokes = [normalize(s) for s in strokes_list]
        deep = np.asarray(self.model(model_inputs(strokes, self.combined), training=False))
        alpha = self.hybrid["alpha"] if self.hybrid and mode == "hybrid" else 0.0
        if mode == "svm":
            if not self.hybrid:
                raise ValueError("Chưa fit SVM")
            alpha = 1.0
        if alpha:
            return (1 - alpha) * deep + alpha * shallow_probabilities(self.hybrid, strokes)
        return deep
