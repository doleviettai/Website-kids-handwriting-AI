"""Báo cáo riêng nguồn synthetic/human, CNN/SVM/hybrid và từng mẫu uê/iê."""
from __future__ import annotations

import argparse
import json
import hashlib
import numpy as np
import pandas as pd

from src.char.common import write_json
from .config_ghep import run_dirs
from .data_ghep import load_split, verify_snapshot
from .inference_ghep import Predictor
from .metrics_ghep import confusion_matrix, group_accuracy, per_class_accuracy, top_confusions, topk_accuracy


def evaluate(run_name, split="test", which="best"):
    model_dir, report_dir = run_dirs(run_name)
    report_dir.mkdir(parents=True, exist_ok=True)
    data_dir = model_dir / "data"
    if data_dir.exists():
        manifest = verify_snapshot(data_dir)
        config = json.loads((model_dir / "train_config.json").read_text(encoding="utf-8"))
        if manifest != config["dataset_manifest"]:
            raise ValueError("Dữ liệu không khớp cấu hình train")
    predictor = Predictor(model_dir, which)
    samples = load_split(split, data_dir if data_dir.exists() else None)
    targets = np.array([s["y"] for s in samples])
    modes = ("deep", "svm", "hybrid") if predictor.hybrid else ("deep",)
    reports = {}
    for mode in modes:
        probs = np.concatenate([predictor.probabilities([s["strokes"] for s in samples[i:i+32]], mode)
                                for i in range(0, len(samples), 32)])
        predictions = probs.argmax(1)
        cm = confusion_matrix(targets, predictions, len(predictor.classes))
        pca = per_class_accuracy(cm)
        sources = [s.get("source", "synthetic") for s in samples]
        pair = np.array([s["truth"] in ("uê", "iê") for s in samples])
        report = {"run_name": run_name, "split": split, "weights": which, "mode": mode,
                  "num_samples": len(samples), "accuracy": float((predictions == targets).mean()),
                  "top3_accuracy": topk_accuracy(probs, targets, 3),
                  "by_source": group_accuracy(targets, predictions, sources),
                  "classes_per_source": {source: len({s["truth"] for s in samples if s.get("source", "synthetic") == source}) for source in sorted(set(sources))},
                  "by_style": group_accuracy(targets, predictions, [s["style"] for s in samples]),
                  "by_template_family": group_accuracy(targets, predictions, [s["family"] for s in samples]),
                  "pair_correct": int((predictions[pair] == targets[pair]).sum()), "pair_n": int(pair.sum()),
                  "model_sha256": predictor.model_hash, "svm_alpha": predictor.hybrid["alpha"] if predictor.hybrid else 0,
                  "sample_sha256": hashlib.sha256("\n".join(s["file"] for s in samples).encode()).hexdigest(),
                  "worst_classes": [{"class": predictor.classes[i], "accuracy": float(pca[i])}
                                    for i in np.argsort(np.nan_to_num(pca, nan=2))[:15] if np.isfinite(pca[i])],
                  "top_confusions": top_confusions(cm, predictor.classes),
                  "note": "Kết quả synthetic không đại diện cho chữ thật; uê/iê cần thêm mẫu human."}
        write_json(report_dir / f"ghep_{split}_{which}_{mode}_metrics.json", report)
        frame = pd.DataFrame({"file": [s["file"] for s in samples], "source": sources,
                              "truth": [s["truth"] for s in samples], "pred": [predictor.classes[i] for i in predictions],
                              "correct": predictions == targets, "score": probs.max(1)})
        from src.char.common import atomic_file
        with atomic_file(report_dir / f"per_class_source_{split}_{which}_{mode}.csv") as temp:
            frame.groupby(["truth", "source"])["correct"].agg(["mean", "count"]).to_csv(temp, encoding="utf-8-sig")
        for name, selected in (("predictions", frame), ("errors", frame.loc[~frame["correct"]]), ("ue_ie", frame.loc[pair])):
            frame_path = report_dir / f"{name}_{split}_{which}_{mode}.csv"
            from src.char.common import atomic_file
            with atomic_file(frame_path) as temp:
                selected.to_csv(temp, index=False, encoding="utf-8-sig")
        reports[mode] = report
        print(f"[{split}/{mode}] accuracy={report['accuracy']:.2%}; source={report['by_source']}; "
              f"uê/iê={report['pair_correct']}/{report['pair_n']}", flush=True)
    best_report = reports.get("hybrid", reports["deep"])
    write_json(report_dir / f"ghep_{split}_{which}_metrics.json", best_report)
    return best_report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-name", default="ghep_stable")
    parser.add_argument("--split", default="test", choices=["train", "validation", "test"])
    parser.add_argument("--weights", default="best", choices=["best", "last"])
    parser.add_argument("--threads", type=int, default=6)
    args = parser.parse_args()
    import tensorflow as tf
    tf.config.threading.set_intra_op_parallelism_threads(max(1, args.threads))
    tf.config.threading.set_inter_op_parallelism_threads(2)
    evaluate(args.run_name, args.split, args.weights)


if __name__ == "__main__":
    main()
