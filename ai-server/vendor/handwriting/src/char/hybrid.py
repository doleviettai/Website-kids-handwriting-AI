"""SVM hình dạng + mạng sâu; hệ số kết hợp được chọn trên validation, không dùng test."""
import joblib
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedGroupKFold

from src.char.features import geometry_features
from src.char.common import atomic_file, signature, write_json
from src.labels import BASES, BASE_TO_IDX, MODIFIERS, MOD_TO_IDX, TONES, TONE_TO_IDX, decompose_char, expected_truths

CHARS = expected_truths()
PARTS = np.array([[BASE_TO_IDX[b], MOD_TO_IDX[m], TONE_TO_IDX[t]]
                  for ch in CHARS for b, m, t in [decompose_char(ch)]])


def valid_probabilities(heads):
    pb, pm, pt = heads
    scores = pb[:, PARTS[:, 0]] * pm[:, PARTS[:, 1]] * pt[:, PARTS[:, 2]]
    return scores / np.maximum(scores.sum(1, keepdims=True), 1e-30)


def base_probabilities(estimator, P, S):
    output = np.zeros((len(P), len(BASES)), np.float64)
    output[:, estimator.classes_.astype(int)] = estimator.predict_proba(geometry_features(P, S))
    return output


def blend(heads, shallow, alpha):
    return ((1 - alpha) * heads[0] + alpha * shallow, heads[1], heads[2])


def prediction_labels(heads):
    return np.asarray(CHARS)[valid_probabilities(heads).argmax(1)]


def fit_and_select(data, heads_val, run_dir):
    train, val = data["split"] == "train", data["split"] == "val"
    P, S = data["P"][train], data["S"][train]
    from src.augment import augment_points
    # Mẫu biến dạng sinh CHỈ từ train, không chạm validation/test.
    augmented = augment_points(P).numpy()
    features = np.concatenate([geometry_features(P, S), geometry_features(augmented, S)])
    targets = np.tile(data["y"][train, 0], 2)
    # Scale được fit riêng trong mỗi fold hiệu chỉnh; toàn bộ CV chỉ dùng train.
    folds = list(StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42).split(
        features, targets, groups=np.tile(np.arange(len(P)), 2)))
    estimator = CalibratedClassifierCV(
        make_pipeline(StandardScaler(), SVC(C=5, gamma="scale", class_weight="balanced", random_state=42)),
        method="sigmoid", cv=folds, ensemble=False, n_jobs=1)
    estimator.fit(features, targets)
    shallow = base_probabilities(estimator, data["P"][val], data["S"][val])
    truth = data["meta"].loc[val, "truth"].to_numpy()
    pair = np.isin(truth, ["a", "d"])
    rows = []
    for alpha in (0.0, 0.15, 0.3, 0.5):
        predicted = prediction_labels(blend(heads_val, shallow, alpha))
        rows.append({"alpha": alpha, "correct": int((predicted == truth).sum()), "n": len(truth),
                     "ad_correct": int((predicted[pair] == truth[pair]).sum()), "ad_n": int(pair.sum())})
    reference = rows[0]
    acceptable = [r for r in rows if r["correct"] > reference["correct"] and
                  r["ad_correct"] >= reference["ad_correct"]]
    best = max(acceptable, key=lambda r: (r["correct"], r["ad_correct"], -r["alpha"])) if acceptable else reference
    artifact = {"version": 1, "estimator": estimator, "alpha": best["alpha"], "feature_version": 1,
                "model_sha256": signature(run_dir / "best.keras")}
    with atomic_file(run_dir / "shape_svm.joblib") as temp:
        joblib.dump(artifact, temp)
    write_json(run_dir / "hybrid_selection.json", {"selected_alpha": best["alpha"], "candidates": rows,
               "policy": "improve val full-char accuracy without reducing a/d accuracy; else alpha=0",
               "trained_on": "train", "selected_on": "val", "test_used": False})
    print(f"SVM: alpha={best['alpha']}; validation đúng {best['correct']}/{best['n']}; "
          f"a/d={best['ad_correct']}/{best['ad_n']}", flush=True)
    return artifact
