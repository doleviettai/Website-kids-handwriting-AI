"""Run the original demo recognizers, with fixed local artifacts and no training imports executed."""

import hashlib
import json
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATHS = {
    "SINGLE_CHAR": "model/don/best.keras",
    "COMPOUND": "model/ghep/ghep_best.keras",
    "PARAGRAPH": "model/word/word_best.keras",
}


class Recognizers:
    def __init__(self):
        self.models = {}
        self.problems = {}
        self.fingerprints = {}
        self.lock = threading.Lock()

    def load(self):
        from src import config
        from src.ghep import config_ghep
        from src.seq import config_seq
        from src.serve import Recognizer as CharacterRecognizer
        from src.ghep.serve_ghep import Recognizer as CompoundRecognizer
        from src.seq.serve_seq import Recognizer as WordRecognizer

        # Constructors read their own labels/preprocessing exactly as the test demos do.
        config.MODELS_DIR = ROOT / "model"
        config_ghep.MODELS_DIR = ROOT / "model"
        config_seq.MODELS_DIR = ROOT / "model"
        constructors = {
            "SINGLE_CHAR": lambda: CharacterRecognizer("don"),
            "COMPOUND": lambda: CompoundRecognizer("ghep", "best"),
            "PARAGRAPH": lambda: WordRecognizer("word", "word"),
        }
        manifest = json.loads(
            (ROOT / "vendor/provenance.json").read_text(encoding="utf8")
        )
        self.models.clear()
        self.problems.clear()
        for task, path in PATHS.items():
            try:
                digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
                if digest != manifest.get("checkpoints", {}).get(path):
                    raise ValueError(
                        "Checkpoint không khớp bộ nhãn/preprocessing đã xác nhận."
                    )
                parent = Path(path).parent.as_posix() + "/"
                for artifact, signature in manifest["files"].items():
                    artifact = artifact.replace("\\", "/")
                    if (
                        artifact.startswith(parent)
                        and hashlib.sha256((ROOT / artifact).read_bytes()).hexdigest()
                        != signature
                    ):
                        raise ValueError("Artifact model không khớp snapshot.")
                self.models[task] = constructors[task]()
                self.fingerprints[task] = digest
            except Exception as exc:
                self.problems[task] = f"{type(exc).__name__}: {exc}"

    def status(self):
        return {
            task: {
                "ready": task in self.models,
                "modelPath": path,
                "version": "v1",
                "input": "online strokes",
                "message": self.problems.get(task, "Sẵn sàng"),
                "sha256": self.fingerprints.get(task),
                "canvasAspect": "1:1" if task == "SINGLE_CHAR" else "5:2",
            }
            for task, path in PATHS.items()
        }

    def recognize(self, task, strokes, width, height):
        with self.lock:
            recognizer = self.models[task]
            if task == "SINGLE_CHAR":
                # Exactly the normalized coordinates rounded by serve.py's JS.
                source = [
                    [
                        [round(float(x) / width, 4), round(float(y) / height, 4)]
                        for x, y in stroke
                    ]
                    for stroke in strokes
                ]
                result = recognizer.predict(source)
                candidates = [
                    {"text": c["char"], "confidence": c["prob"]}
                    for c in result["candidates"]
                ]
                return {
                    "text": result["best"],
                    "confidence": result["confidence"],
                    "uncertain": result["uncertain"],
                    "candidates": candidates,
                    "chars": [],
                    "suggestedText": "",
                    "preview": None,
                }
            # Preserve isotropic geometry; caller uses a 5:2 coordinate space.
            source = [[[float(x), float(y)] for x, y in stroke] for stroke in strokes]
            result = recognizer.predict(source)
            if task == "COMPOUND":
                candidates = [
                    {"text": c["text"], "confidence": c["p"]}
                    for c in result["candidates"]
                ]
                return {
                    "text": result["text"],
                    "confidence": result["confidence"],
                    "uncertain": result["uncertain"],
                    "candidates": candidates,
                    "chars": [],
                    "suggestedText": "",
                    "preview": result["preview"],
                }
            # The original decoder keeps visual text and language suggestions separate.
            return {
                "text": result["text"],
                "confidence": result["confidence"],
                "uncertain": result["confidence"] < 0.65,
                "candidates": [
                    {"text": c, "confidence": None} for c in result["candidates"]
                ],
                "chars": [
                    {"text": c["c"], "confidence": c["p"]} for c in result["chars"]
                ],
                "suggestedText": result.get("suggested_text", ""),
                "preview": None,
            }

    def predict(self, task, strokes, width, height):
        result = self.recognize(task, strokes, width, height)
        return result["text"], result["confidence"]
