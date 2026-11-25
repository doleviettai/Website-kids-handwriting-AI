"""SVM hình học chỉ fit train; chọn alpha trên validation, không dùng đáp án/test."""
import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from src.char.common import atomic_file, signature, write_json
from .data_ghep import augment
from .features_ghep import geometry_batch


def shallow_probabilities(artifact, strokes):
    output = np.zeros((len(strokes), artifact["num_classes"]))
    estimator = artifact["estimator"]
    output[:, estimator.classes_.astype(int)] = estimator.predict_proba(geometry_batch(strokes))
    if "class_priors" in artifact:
        output /= np.maximum(np.asarray(artifact["class_priors"]), 1e-8) ** 0.5
        output /= output.sum(1, keepdims=True)
    return output


def select_weight(rows):
    baseline = rows[0]
    eligible = [r for r in rows if r["score"] > baseline["score"] + 1e-8 and
                r["pair_correct"] >= baseline["pair_correct"] and
                all(r["source_accuracy"][source] >= accuracy for source, accuracy in baseline["source_accuracy"].items())]
    return max(eligible, key=lambda r: (r["score"], -r["alpha"])) if eligible else baseline


def fit_and_select(samples, validation, deep_probs, classes, run_dir):
    rng = np.random.default_rng(42)
    original = [s["strokes"] for s in samples]
    extra = [augment(s, rng) for s in original]
    features = geometry_batch([*original, *extra])
    targets = np.tile([s["y"] for s in samples], 2)
    groups = np.tile([s["source"] + ":" + (s.get("writer") or s["style"]) for s in samples], 2)
    folds = list(StratifiedGroupKFold(3, shuffle=True, random_state=42).split(features, targets, groups))
    required = set(targets)
    if any(set(targets[train]) != required for train, _ in folds):
        raise ValueError("Cần thêm người/style train mỗi lớp để hiệu chỉnh SVM bằng 3 fold")
    estimator = CalibratedClassifierCV(
        make_pipeline(StandardScaler(), SVC(C=5, gamma="scale", class_weight="balanced")),
        cv=folds, method="sigmoid", ensemble=False, n_jobs=1)
    estimator.fit(features, targets)
    artifact = {"estimator": estimator, "num_classes": len(classes), "classes": classes,
                "model_sha256": signature(run_dir / "ghep_best.keras"), "alpha": 0.0, "feature_version": 1}
    if any(s["source"] == "composed" for s in samples):
        artifact["class_priors"] = (np.bincount(targets, minlength=len(classes)) / len(targets)).tolist()
    shallow = shallow_probabilities(artifact, [s["strokes"] for s in validation])
    truth = np.array([s["y"] for s in validation])
    pair = np.array([s["truth"] in ("uê", "iê") for s in validation])
    sources = np.array([s["source"] for s in validation])
    rows = []
    for alpha in (0.0, 0.15, 0.3, 0.5):
        correct = ((1 - alpha) * deep_probs + alpha * shallow).argmax(1) == truth
        by_source = {source: float(correct[sources == source].mean()) for source in sorted(set(sources))}
        rows.append({"alpha": alpha, "accuracy": float(correct.mean()), "source_accuracy": by_source,
                     "score": float(np.mean(list(by_source.values()))), "pair_correct": int(correct[pair].sum()),
                     "pair_n": int(pair.sum())})
    best = select_weight(rows)
    artifact["alpha"] = best["alpha"]
    with atomic_file(run_dir / "shape_svm.joblib") as temp:
        joblib.dump(artifact, temp)
    write_json(run_dir / "hybrid_selection.json", {"selected_alpha": best["alpha"], "candidates": rows,
               "trained_on": "train", "selected_on": "validation", "test_used": False,
               "policy": "improve mean accuracy by source; do not reduce source accuracies or uê/iê correct count"})
    print(f"SVM: alpha={best['alpha']}; validation theo nguồn {best['source_accuracy']}; uê/iê={best['pair_correct']}/{best['pair_n']}", flush=True)
    return artifact
