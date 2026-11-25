"""Đánh giá model:   python -m src.evaluate --run-name baseline --split test

Xuất ra reports/<run-name>/ :  metrics.json, per_char_accuracy.csv, errors.csv, top_confusions.csv,
                              confusion_base.png, confusion_modifier.png, confusion_tone.png
"""
from __future__ import annotations

import argparse
import json

import matplotlib
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix
from tensorflow import keras

from src import config
from src.dataset import load_processed, make_dataset, subset
from src.labels import BASES, MODIFIERS, TONES, compose_char
from src.model import unpack_predictions

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


def plot_confusion(y_true, y_pred, names, title, out_path) -> None:
    present = sorted(set(y_true) | set(y_pred))
    cm = confusion_matrix(y_true, y_pred, labels=present).astype(float)
    cm_norm = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)
    n = len(present)
    size = max(5, min(22, 0.32 * n + 3))
    fig, ax = plt.subplots(figsize=(size, size))
    ax.imshow(cm_norm, cmap="Blues", vmin=0, vmax=1)
    labels = [names[i] for i in present]
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(labels, fontsize=8 if n > 20 else 11)
    ax.set_yticklabels(labels, fontsize=8 if n > 20 else 11)
    ax.set_xlabel("Model đoán")
    ax.set_ylabel("Thực tế")
    ax.set_title(title)
    if n <= 12:
        for i in range(n):
            for j in range(n):
                if cm[i, j]:
                    ax.text(j, i, int(cm[i, j]), ha="center", va="center",
                            color="white" if cm_norm[i, j] > 0.5 else "black", fontsize=9)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def top_confusions(y_true, y_pred, names, k=20) -> pd.DataFrame:
    pairs = pd.Series(list(zip(y_true, y_pred)))
    pairs = pairs[[a != b for a, b in pairs]]
    counts = pairs.value_counts().head(k)
    return pd.DataFrame([{"thuc_te": names[a], "model_doan": names[b], "so_lan": int(c)} for (a, b), c in counts.items()])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="baseline")
    ap.add_argument("--split", default="test", choices=["train", "val", "test"])
    ap.add_argument("--processed-dir", default=str(config.PROCESSED_DIR))
    args = ap.parse_args()

    from pathlib import Path
    run_dir = config.MODELS_DIR / args.run_name
    out_dir = config.REPORTS_DIR / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    model = keras.models.load_model(run_dir / "best.keras")
    data = load_processed(Path(args.processed_dir))
    part = subset(data, args.split)
    if len(part["P"]) == 0:
        raise SystemExit(f"Tập '{args.split}' rỗng.")

    ds = make_dataset(part, 256, training=False)
    pb, pm, pt = unpack_predictions(model.predict(ds, verbose=0))
    yb, ym, yt = part["y_base"], part["y_modifier"], part["y_tone"]
    gb, gm, gt = pb.argmax(1), pm.argmax(1), pt.argmax(1)

    ok_b, ok_m, ok_t = gb == yb, gm == ym, gt == yt
    ok_full = ok_b & ok_m & ok_t
    top3_b = np.mean([yb[i] in np.argsort(-pb[i])[:3] for i in range(len(yb))])

    metrics = {
        "split": args.split, "n_samples": int(len(yb)),
        "acc_base": float(ok_b.mean()), "acc_base_top3": float(top3_b),
        "acc_modifier": float(ok_m.mean()), "acc_tone": float(ok_t.mean()),
        "acc_full_char": float(ok_full.mean()),
    }
    (out_dir / f"metrics_{args.split}.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    meta = part["meta"].copy()
    meta["pred"] = [compose_char(BASES[b], MODIFIERS[m], TONES[t]) for b, m, t in zip(gb, gm, gt)]
    meta["ok_base"], meta["ok_modifier"], meta["ok_tone"], meta["ok_full"] = ok_b, ok_m, ok_t, ok_full
    meta[~ok_full][["path", "writer_id", "truth", "pred"]].to_csv(out_dir / f"errors_{args.split}.csv", index=False, encoding="utf-8-sig")

    per_char = (meta.groupby("truth")["ok_full"].agg(["mean", "count"]).rename(columns={"mean": "acc_full", "count": "n"})
                .sort_values(["acc_full", "n"]))
    per_char.to_csv(out_dir / f"per_char_accuracy_{args.split}.csv", encoding="utf-8-sig")
    per_writer = meta.groupby("writer_id")["ok_full"].agg(["mean", "count"]).rename(columns={"mean": "acc_full", "count": "n"})

    plot_confusion(yb, gb, BASES, f"Base ({args.split})", out_dir / f"confusion_base_{args.split}.png")
    plot_confusion(ym, gm, MODIFIERS, f"Modifier ({args.split})", out_dir / f"confusion_modifier_{args.split}.png")
    plot_confusion(yt, gt, TONES, f"Tone ({args.split})", out_dir / f"confusion_tone_{args.split}.png")
    tc = top_confusions(yb, gb, BASES)
    tc.to_csv(out_dir / f"top_confusions_base_{args.split}.csv", index=False, encoding="utf-8-sig")

    print(f"\n=== {args.split.upper()}  ({len(yb)} mẫu) ===")
    print(f"Base        : {metrics['acc_base']:.3f}   (top-3: {metrics['acc_base_top3']:.3f})")
    print(f"Modifier    : {metrics['acc_modifier']:.3f}")
    print(f"Tone        : {metrics['acc_tone']:.3f}")
    print(f"CẢ KÝ TỰ    : {metrics['acc_full_char']:.3f}   <- đúng cả 3 nhãn")
    print("\nCác cặp base bị nhầm nhiều nhất:")
    print(tc.head(10).to_string(index=False) if len(tc) else "  (không có lỗi)")
    print("\n10 ký tự đoán kém nhất:")
    print(per_char.head(10).to_string())
    if len(per_writer) > 1:
        print("\nAccuracy theo người viết:")
        print(per_writer.sort_values("acc_full").to_string())
    print(f"\nĐã lưu báo cáo vào {out_dir}")


if __name__ == "__main__":
    main()