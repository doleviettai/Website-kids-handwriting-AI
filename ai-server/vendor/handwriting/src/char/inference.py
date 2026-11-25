"""Một đường nhận dạng dùng chung cho demo, đánh giá và file InkML."""
from __future__ import annotations

import json

import joblib
import keras
import numpy as np

from src.char import model as model_registration
from src.char.common import signature
from src.char.features import deep_features
from src.char.hybrid import base_probabilities, blend, valid_probabilities
from src.features import points_to_features
from src.model import unpack_predictions


class Predictor:
    def __init__(self, run_dir):
        self.run_dir = run_dir
        self.path = run_dir / "best.keras"
        self.settings = json.loads((run_dir / "label_maps.json").read_text(encoding="utf-8"))
        self.v2 = self.settings.get("features") == "penup_masked_v2"
        self.model = keras.models.load_model(self.path, compile=False)
        self.seq_len = int(self.model.input_shape[1])
        self.mtime = self.path.stat().st_mtime_ns
        self.hybrid = None
        self.svm_mtime = None
        self.refresh()

    def refresh(self):
        mtime = self.path.stat().st_mtime_ns
        if mtime != self.mtime:
            self.model = keras.models.load_model(self.path, compile=False)
            self.mtime = mtime
            self.hybrid, self.svm_mtime = None, None
        svm_path = self.run_dir / "shape_svm.joblib"
        if svm_path.exists() and self.svm_mtime != svm_path.stat().st_mtime_ns:
            artifact = joblib.load(svm_path)
            self.hybrid = artifact if artifact.get("model_sha256") == signature(self.path) else None
            self.svm_mtime = svm_path.stat().st_mtime_ns

    def heads(self, P, S, mode="hybrid"):
        features = deep_features(P, S) if self.v2 else points_to_features(P, S)
        heads = tuple(np.asarray(p) for p in unpack_predictions(self.model.predict(features, batch_size=128, verbose=0)))
        if mode == "deep" or self.hybrid is None:
            return heads
        if mode not in ("hybrid", "svm"):
            raise ValueError("Chế độ không hợp lệ")
        alpha = self.hybrid["alpha"] if mode == "hybrid" else 1.0
        if alpha:
            shallow = base_probabilities(self.hybrid["estimator"], P, S)
            heads = blend(heads, shallow, alpha)
        return heads

    def probabilities(self, P, S, mode="hybrid"):
        heads = self.heads(P, S, mode)
        return valid_probabilities(heads), heads
