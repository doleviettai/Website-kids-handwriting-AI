"""python -m src.char.evaluate --run-name baseline_stable --split test"""
from __future__ import annotations

import argparse
import hashlib

import numpy as np
import pandas as pd
import tensorflow as tf

from src import config
from src.char.common import folder, signature, write_json
from src.char.data import load
from src.char.hybrid import CHARS
from src.char.inference import Predictor


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="baseline_stable")
    ap.add_argument("--split", default="test", choices=["train", "val", "test"])
    ap.add_argument("--threads", type=int, default=6)
    args = ap.parse_args()
    tf.config.threading.set_intra_op_parallelism_threads(max(args.threads, 1))
    tf.config.threading.set_inter_op_parallelism_threads(2)
    run_dir = folder(args.run_name)
    data = load(run_dir)
    mask = data["split"] == args.split
    if not mask.any():
        raise SystemExit("Tập đánh giá rỗng")
    predictor = Predictor(run_dir)
    # Đánh giá snapshot đã nạp, không refresh trong lúc tính kết quả.
    model_hash = signature(predictor.path)
    P, S = data["P"][mask], data["S"][mask]
    truth = data["meta"].loc[mask, "truth"].to_numpy()
    y = data["y"][mask]
    meta = data["meta"].loc[mask].copy()
    out = config.REPORTS_DIR / args.run_name
    out.mkdir(parents=True, exist_ok=True)
    modes = ("deep", "svm", "hybrid") if predictor.hybrid is not None else ("deep",)
    for mode in modes:
        probs, heads = predictor.probabilities(P, S, mode)
        predicted = np.asarray(CHARS)[probs.argmax(1)]
        correct = predicted == truth
        pair = np.isin(truth, ["a", "d"])
        metrics = {"split": args.split, "mode": mode, "n_samples": len(truth), "acc_full_char": float(correct.mean()),
                   "acc_base": float((heads[0].argmax(1) == y[:, 0]).mean()),
                   "acc_modifier": float((heads[1].argmax(1) == y[:, 1]).mean()),
                   "acc_tone": float((heads[2].argmax(1) == y[:, 2]).mean()),
                   "ad_n": int(pair.sum()), "ad_correct": int(correct[pair].sum()),
                   "writer_overlap": data["settings"]["writer_overlap"], "model_sha256": model_hash,
                   "data_sha256": signature(run_dir / "data.npz"),
                   "sample_sha256": hashlib.sha256(meta["sample_id"].to_numpy(np.int64).tobytes()).hexdigest(),
                   "svm_alpha": predictor.hybrid["alpha"] if predictor.hybrid is not None else 0.0,
                   "svm_applies_to": "base only; modifier/tone always from deep model"}
        write_json(out / f"metrics_{args.split}_{mode}.json", metrics)
        frame = meta.copy()
        frame["pred"], frame["correct"] = predicted, correct
        frame.to_csv(out / f"predictions_{args.split}_{mode}.csv", index=False, encoding="utf-8-sig")
        frame.loc[~correct].to_csv(out / f"errors_{args.split}_{mode}.csv", index=False, encoding="utf-8-sig")
        frame.groupby("truth")["correct"].agg(["mean", "count"]).to_csv(
            out / f"per_char_{args.split}_{mode}.csv", encoding="utf-8-sig")
        frame.groupby("writer_id")["correct"].agg(["mean", "count"]).to_csv(
            out / f"per_writer_{args.split}_{mode}.csv", encoding="utf-8-sig")
        frame.loc[~correct].groupby(["truth", "pred"]).size().sort_values(ascending=False).to_csv(
            out / f"confusions_{args.split}_{mode}.csv", encoding="utf-8-sig")
        frame.loc[pair].to_csv(out / f"a_d_{args.split}_{mode}.csv", index=False, encoding="utf-8-sig")
        print(f"{mode:6s}: full-char={correct.mean():.2%} n={len(truth)}; a/d={correct[pair].sum()}/{pair.sum()}", flush=True)
    print(f"Báo cáo: {out}", flush=True)


if __name__ == "__main__":
    main()
