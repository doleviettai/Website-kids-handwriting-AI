"""Train chữ đơn, ví dụ python -m src.char.train --run-name baseline_stable --epochs 300."""
from __future__ import annotations

import argparse
import json
import os
import time
import zipfile
from pathlib import Path

import keras
import matplotlib
import numpy as np
import pandas as pd
import tensorflow as tf

from src import config
from src.char.common import atomic_file, folder, signature, write_json
from src.char.data import load, make_dataset, prepare
from src.char.features import deep_features
from src.char.hybrid import fit_and_select, prediction_labels
from src.char.model import build_model, initialize_encoder
from src.model import unpack_predictions

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def predict_heads(model, data, split):
    mask = data["split"] == split
    X = deep_features(data["P"][mask], data["S"][mask])
    return tuple(np.asarray(p) for p in unpack_predictions(model.predict(X, batch_size=128, verbose=0)))


def plot(history, path):
    frame = pd.DataFrame(history)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    for key in ("loss", "val_loss"):
        axes[0].plot(frame["epoch"], frame[key], label=key)
    for key in ("train_full_acc", "val_full_acc"):
        axes[1].plot(frame["epoch"], frame[key], label=key)
    for ax in axes:
        ax.set_xlabel("epoch")
        ax.grid(alpha=0.3)
        ax.legend()
    fig.tight_layout()
    try:
        with atomic_file(path) as temp:
            fig.savefig(temp, dpi=120)
    finally:
        plt.close(fig)


def save_model(model, path, resume=None):
    with atomic_file(path) as temp:
        model.save(temp)
        if resume is not None:
            with zipfile.ZipFile(temp, "a") as archive:
                archive.writestr("char_resume.json", json.dumps(resume, ensure_ascii=False, allow_nan=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="baseline_stable")
    ap.add_argument("--processed-dir", default=str(config.PROCESSED_DIR))
    ap.add_argument("--epochs", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--seq-len", type=int, default=128)
    ap.add_argument("--lr", type=float, default=0.0003)
    ap.add_argument("--dropout", type=float, default=0.35)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--patience", type=int, default=40)
    ap.add_argument("--lr-patience", type=int, default=10)
    ap.add_argument("--threads", type=int, default=6)
    ap.add_argument("--init-from", default="baseline")
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    run_dir = folder(args.run_name)
    run_dir.mkdir(parents=True, exist_ok=True)
    requested_epochs = args.epochs
    if args.resume:
        cfg_path = run_dir / "train_config.json"
        if not cfg_path.exists() or not (run_dir / "last.keras").exists():
            raise SystemExit("Chưa có epoch hoàn thành để resume")
        saved = json.loads(cfg_path.read_text(encoding="utf-8"))
        args = argparse.Namespace(**saved["args"])
        args.resume = True
        args.epochs = requested_epochs if requested_epochs is not None else args.epochs
    else:
        args.epochs = requested_epochs if requested_epochs is not None else 300
        if (run_dir / "train_config.json").exists() or (run_dir / "best.keras").exists():
            raise SystemExit("Run đã tồn tại. Chọn tên mới hoặc --resume.")
    if min(args.epochs, args.batch_size, args.patience, args.lr_patience) < 1 or args.seq_len < 40:
        raise SystemExit("epochs/batch/patience phải dương; seq-len >= 40")
    if args.lr <= 0 or not 0 <= args.dropout < 1 or args.weight_decay < 0:
        raise SystemExit("lr/dropout/weight-decay không hợp lệ")
    tf.config.threading.set_intra_op_parallelism_threads(max(args.threads, 1))
    tf.config.threading.set_inter_op_parallelism_threads(2)
    keras.utils.set_random_seed(config.SEED)
    if args.resume:
        data = load(run_dir)
        if signature(run_dir / "data.npz") != saved["data_sha256"]:
            raise SystemExit("Dữ liệu run đã thay đổi")
        with zipfile.ZipFile(run_dir / "last.keras") as archive:
            if "char_resume.json" in archive.namelist():
                bundle = json.loads(archive.read("char_resume.json"))
            else:
                bundle = {"state": json.loads((run_dir / "resume_state.json").read_text(encoding="utf-8")),
                          "history": pd.read_csv(run_dir / "history.csv").to_dict("records")}
        state, history = bundle["state"], bundle["history"]
        model = keras.models.load_model(run_dir / "last.keras")
        print(f"Khôi phục checkpoint epoch {state['completed_epochs']}; "
              f"tiếp tục từ epoch {state['completed_epochs'] + 1}, giữ optimizer và learning rate.", flush=True)
        (run_dir / "STOP").unlink(missing_ok=True)
    else:
        write_json(run_dir / "training_state.json", {"status": "preparing", "completed_epochs": 0})
        data = prepare(run_dir, args.processed_dir, args.seq_len)
        X = deep_features(data["P"][data["split"] == "train"], data["S"][data["split"] == "train"]).numpy()
        mean, variance = X.mean(axis=(0, 1)), np.maximum(X.var(axis=(0, 1)), 1e-6)
        model = build_model(args.seq_len, mean, variance, args.dropout)
        if args.init_from:
            source = Path(args.init_from)
            if not source.is_file():
                source = folder(args.init_from) / "best.keras"
            initialize_encoder(model, keras.models.load_model(source, compile=False))
            print(f"Chuyển trọng số tương thích từ {source}; học thêm nhánh hình dạng.", flush=True)
        optimizer = keras.optimizers.AdamW(args.lr, weight_decay=args.weight_decay, global_clipnorm=5.0)
        optimizer.exclude_from_weight_decay(var_names=["bias", "beta", "gamma"])
        model.compile(optimizer=optimizer,
                      loss={h: "sparse_categorical_crossentropy" for h in ("base", "modifier", "tone")},
                      loss_weights=config.LOSS_WEIGHTS)
        state = {"completed_epochs": 0, "best_acc": -1.0, "best_loss": 1e30, "bad_epochs": 0, "plateau": 0}
        saved = {"args": vars(args), "architecture": "char_cnn_bigru_shape_v2", "tensorflow": tf.__version__,
                 "data_sha256": signature(run_dir / "data.npz"), "writer_overlap": data["settings"]["writer_overlap"]}
        history = []
    saved["args"] = vars(args)
    write_json(run_dir / "train_config.json", saved)
    val_ds = make_dataset(data, "val", args.batch_size)
    status = {**state, "status": "running", "pid": os.getpid(), "total_epochs": args.epochs}

    class Progress(keras.callbacks.Callback):
        def on_train_batch_end(self, batch, logs=None):
            if batch % 10 == 0:
                write_json(run_dir / "progress.json", {"epoch": status["current_epoch"],
                           "step": batch + 1, "steps": int(np.ceil((data["split"] == "train").sum() / args.batch_size)),
                           "loss": float(logs["loss"])}, required=False)
            if (run_dir / "STOP").exists():
                self.model.stop_training = True

    print(f"Python {__import__('sys').version.split()[0]}; GPU={tf.config.list_physical_devices('GPU')}; "
          f"model={model.count_params():,} tham số", flush=True)
    try:
        for epoch in range(state["completed_epochs"] + 1, args.epochs + 1):
            started = time.monotonic()
            status.update(current_epoch=epoch, stage="deep_train")
            write_json(run_dir / "training_state.json", status)
            train_ds = make_dataset(data, "train", args.batch_size, training=True, seed=config.SEED + epoch)
            result = model.fit(train_ds, validation_data=val_ds, epochs=1, verbose=0, shuffle=False, callbacks=[Progress()])
            if (run_dir / "STOP").exists():
                raise KeyboardInterrupt
            train_heads, val_heads = predict_heads(model, data, "train"), predict_heads(model, data, "val")
            train_acc = float((prediction_labels(train_heads) == data["meta"].loc[data["split"] == "train", "truth"]).mean())
            val_acc = float((prediction_labels(val_heads) == data["meta"].loc[data["split"] == "val", "truth"]).mean())
            loss, val_loss = float(result.history["loss"][0]), float(result.history["val_loss"][0])
            if not np.isfinite([loss, val_loss]).all():
                raise ValueError("Loss không hữu hạn")
            lr = float(model.optimizer.learning_rate.numpy())
            row = {"epoch": epoch, "loss": loss, "val_loss": val_loss, "train_full_acc": train_acc,
                   "val_full_acc": val_acc, "lr": lr, "sec": round(time.monotonic() - started, 1)}
            improved = val_acc > state["best_acc"] + 1e-8 or (
                abs(val_acc - state["best_acc"]) < 1e-8 and val_loss < state["best_loss"] - 1e-4)
            if improved:
                save_model(model, run_dir / "best.keras")
                state.update(best_acc=val_acc, best_loss=val_loss, best_epoch=epoch, bad_epochs=0, plateau=0)
            else:
                state["bad_epochs"] += 1
                state["plateau"] += 1
                if state["plateau"] >= args.lr_patience:
                    model.optimizer.learning_rate.assign(max(lr * 0.5, 1e-6))
                    state["plateau"] = 0
            state["completed_epochs"] = epoch
            # Optimizer và model mới nhất ở last.keras, best.keras dành nhận dạng.
            save_model(model, run_dir / "last.keras", resume={"state": state, "history": [*history, row]})
            write_json(run_dir / "resume_state.json", state)
            history.append(row)
            with atomic_file(run_dir / "history.csv") as temp:
                pd.DataFrame(history).to_csv(temp, index=False)
            status.update(state, last_metrics=row)
            write_json(run_dir / "training_state.json", status)
            print(f"epoch {epoch:3d}/{args.epochs} loss={loss:.4f} val_loss={val_loss:.4f} "
                  f"train={train_acc:.2%} val={val_acc:.2%} lr={lr:.1e} {row['sec']}s", flush=True)
            if epoch == 1 or epoch % 5 == 0:
                plot(history, run_dir / "curves.png")
            if state["bad_epochs"] >= args.patience:
                status["status"] = "early_stopped"
                break
        else:
            status["status"] = "completed"
        if status["status"] in ("completed", "early_stopped"):
            status["stage"] = "fit_svm"
            write_json(run_dir / "training_state.json", status)
            best_model = keras.models.load_model(run_dir / "best.keras", compile=False)
            fit_and_select(data, predict_heads(best_model, data, "val"), run_dir)
            status["stage"] = "finished"
    except KeyboardInterrupt:
        status.update(status="interrupted", stage="stopped")
        print("Đã dừng; --resume tiếp tục từ epoch hoàn thành gần nhất.", flush=True)
    except Exception as exc:
        status.update(status="failed", error=str(exc))
        raise
    finally:
        write_json(run_dir / "training_state.json", status)
        if history:
            plot(history, run_dir / "curves.png")
    print(f"{run_dir}: {status['status']}", flush=True)


if __name__ == "__main__":
    main()
