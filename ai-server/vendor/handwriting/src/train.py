"""Huấn luyện model:   python -m src.train --run-name baseline

Kết quả lưu ở models/<run-name>/ :  best.keras, history.csv, curves.png, label_maps.json, train_config.json
"""
from __future__ import annotations

import argparse
import json
import shutil

import matplotlib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

from src import config
from src.dataset import class_weights, load_processed, make_dataset, subset
from src.features import points_to_features
from src.labels import BASES, MODIFIERS, TONES
from src.model import build_model, unpack_predictions

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


class FullCharAccuracy(keras.callbacks.Callback):
    """Mỗi epoch tính độ chính xác 'cả ký tự' trên tập val: đúng cả base, modifier và tone mới tính là đúng."""

    def __init__(self, X, yb, ym, yt):
        super().__init__()
        self.X, self.yb, self.ym, self.yt = X, yb, ym, yt

    def on_epoch_end(self, epoch, logs=None):
        pb, pm, pt = unpack_predictions(self.model.predict(self.X, batch_size=256, verbose=0))
        ok = (pb.argmax(1) == self.yb) & (pm.argmax(1) == self.ym) & (pt.argmax(1) == self.yt)
        if logs is not None:
            logs["val_full_acc"] = float(ok.mean())


def plot_history(hist: pd.DataFrame, out_path) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(16, 4))
    axes[0].plot(hist["loss"], label="train")
    axes[0].plot(hist["val_loss"], label="val")
    axes[0].set_title("Loss (tổng có trọng số)")
    for head in ("base", "modifier", "tone"):
        col = f"val_{head}_acc"
        if col in hist:
            axes[1].plot(hist[col], label=head)
    axes[1].set_title("Val accuracy theo từng đầu ra")
    if "val_full_acc" in hist:
        axes[2].plot(hist["val_full_acc"], color="C3")
    axes[2].set_title("Val accuracy cả ký tự (đúng cả 3 nhãn)")
    for ax in axes:
        ax.set_xlabel("epoch")
        ax.grid(alpha=0.3)
        if ax.get_legend_handles_labels()[0]:
            ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="baseline")
    ap.add_argument("--epochs", type=int, default=config.EPOCHS)
    ap.add_argument("--batch-size", type=int, default=config.BATCH_SIZE)
    ap.add_argument("--lr", type=float, default=config.LEARNING_RATE)
    ap.add_argument("--no-augment", action="store_true", help="tắt augmentation (để lấy mốc so sánh)")
    ap.add_argument("--no-class-weights", action="store_true")
    ap.add_argument("--processed-dir", default=str(config.PROCESSED_DIR))
    args = ap.parse_args()

    keras.utils.set_random_seed(config.SEED)
    run_dir = config.MODELS_DIR / args.run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    from pathlib import Path
    data = load_processed(Path(args.processed_dir))
    train, val = subset(data, "train"), subset(data, "val")
    if len(train["P"]) == 0 or len(val["P"]) == 0:
        raise SystemExit("Tập train hoặc val rỗng. Kiểm tra lại bước preprocess / splits.csv")
    print(f"train={len(train['P'])}  val={len(val['P'])}  test={int((data['split'] == 'test').sum())}")

    seq_len = data["P"].shape[1]
    X_train = points_to_features(train["P"], train["S"]).numpy()
    X_val = points_to_features(val["P"], val["S"]).numpy()
    n_features = X_train.shape[-1]

    norm = keras.layers.Normalization(axis=-1, name="feature_norm")
    norm.adapt(X_train)
    model = build_model(seq_len, n_features, norm)
    model.summary()

    weights = None
    if config.USE_CLASS_WEIGHTS and not args.no_class_weights:
        cw = {
            "base": class_weights(train["y_base"], len(BASES)),
            "modifier": class_weights(train["y_modifier"], len(MODIFIERS)),
            "tone": class_weights(train["y_tone"], len(TONES)),
        }
        weights = {
            "base": cw["base"][train["y_base"]],
            "modifier": cw["modifier"][train["y_modifier"]],
            "tone": cw["tone"][train["y_tone"]],
        }

    train_ds = make_dataset(train, args.batch_size, training=True, augment=not args.no_augment, weights=weights)
    val_ds = make_dataset(val, args.batch_size, training=False)

    model.compile(
        optimizer=keras.optimizers.Adam(args.lr),
        loss={h: "sparse_categorical_crossentropy" for h in ("base", "modifier", "tone")},
        loss_weights=config.LOSS_WEIGHTS,
        metrics={h: [keras.metrics.SparseCategoricalAccuracy(name="acc")] for h in ("base", "modifier", "tone")},
    )

    callbacks = [
        FullCharAccuracy(X_val, val["y_base"], val["y_modifier"], val["y_tone"]),   # phải đứng đầu để các callback sau thấy log
        keras.callbacks.ModelCheckpoint(run_dir / "best.keras", monitor="val_loss", save_best_only=True),
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=config.EARLY_STOP_PATIENCE, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=config.LR_PLATEAU_PATIENCE, min_lr=1e-5),
        keras.callbacks.CSVLogger(run_dir / "history.csv"),
    ]
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks, shuffle=False, verbose=2)

    hist = pd.read_csv(run_dir / "history.csv")
    plot_history(hist, run_dir / "curves.png")
    shutil.copy(Path(args.processed_dir) / "label_maps.json", run_dir / "label_maps.json")
    (run_dir / "train_config.json").write_text(json.dumps({
        "args": vars(args),
        "n_train": int(len(train["P"])), "n_val": int(len(val["P"])),
        "augment": not args.no_augment, "class_weights": weights is not None,
        "loss_weights": config.LOSS_WEIGHTS,
        "best_val_loss": float(hist["val_loss"].min()),
        "best_val_full_acc": float(hist["val_full_acc"].max()) if "val_full_acc" in hist else None,
        "tensorflow": tf.__version__,
    }, indent=2), encoding="utf-8")
    print(f"\nXong. Model tốt nhất: {run_dir / 'best.keras'}")
    print(f"Val full-char accuracy cao nhất: {hist['val_full_acc'].max():.3f}")
    print(f"Tiếp theo: python -m src.evaluate --run-name {args.run_name} --split test")


if __name__ == "__main__":
    main()