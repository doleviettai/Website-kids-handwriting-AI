"""Train CNN + hướng nét, tiếp tục đủ optimizer/state và fit SVM trên train."""
from __future__ import annotations

import argparse
import json
import os
import time
import zipfile
from pathlib import Path

import numpy as np

from src.char.common import atomic_file, signature, write_json
from .config_ghep import run_dirs
from .data_ghep import build_processed, load_label_map, load_split, make_dataset, model_inputs, verify_snapshot


def _atomic_save(model, path, bundle=None):
    with atomic_file(path) as temp:
        model.save(temp)
        if bundle is not None:
            with zipfile.ZipFile(temp, "a") as archive:
                archive.writestr("ghep_resume.json", json.dumps(bundle, ensure_ascii=False, allow_nan=False))


def clean_metrics(model, samples, batch_size=32):
    correct, losses = [], []
    for start in range(0, len(samples), batch_size):
        batch = samples[start:start + batch_size]
        probs = np.asarray(model(model_inputs([s["strokes"] for s in batch]), training=False))
        targets = np.array([s["y"] for s in batch])
        correct.extend(probs.argmax(1) == targets)
        losses.extend(-np.log(np.maximum(probs[np.arange(len(batch)), targets], 1e-12)))
    correct = np.asarray(correct)
    sources = np.array([s["source"] for s in samples])
    by_source = {source: float(correct[sources == source].mean()) for source in sorted(set(sources))}
    pair = np.array([s["truth"] in ("uê", "iê") for s in samples])
    return {"loss": float(np.mean(losses)), "accuracy": float(correct.mean()),
            "score": float(np.mean(list(by_source.values()))), "by_source": by_source,
            "pair_correct": int(correct[pair].sum()), "pair_n": int(pair.sum())}


def plot_history(history, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    epochs = [r["epoch"] for r in history]
    for key in ("loss", "val_loss"):
        axes[0].plot(epochs, [r[key] for r in history], label=key)
    for key in ("train_accuracy", "val_accuracy", "val_source_score"):
        axes[1].plot(epochs, [r[key] for r in history], label=key)
    for ax in axes:
        ax.set_xlabel("epoch")
        ax.legend()
        ax.grid(alpha=0.3)
    fig.tight_layout()
    try:
        with atomic_file(path) as temp:
            fig.savefig(temp, dpi=120)
    finally:
        plt.close(fig)


def train(run_name="ghep_stable", epochs=None, batch_size=32, lr=0.0001, resume=False, seed=42,
          patience=50, lr_patience=12, init_from="ghep", include_vnondb=True, dropout=0.35,
          weight_decay=1e-4, threads=6, composed_per_class=0, samples_per_class=0, robust_geometry=False,
          glyph_validation_per_class=0, init_weights="best"):
    import tensorflow as tf
    from tensorflow import keras
    from .features_ghep import geometry_batch
    from .hybrid_ghep import fit_and_select
    from .model_ghep import build_model, initialize
    model_dir, _ = run_dirs(run_name)
    model_dir.mkdir(parents=True, exist_ok=True)
    config_path = model_dir / "train_config.json"
    requested_epochs = epochs
    options = {"epochs": epochs or 400, "batch_size": batch_size, "lr": lr, "seed": seed,
               "patience": patience, "lr_patience": lr_patience, "init_from": init_from,
               "include_vnondb": include_vnondb, "dropout": dropout, "weight_decay": weight_decay, "threads": threads,
               "composed_per_class": composed_per_class, "samples_per_class": samples_per_class,
               "robust_geometry": robust_geometry, "glyph_validation_per_class": glyph_validation_per_class,
               "init_weights": init_weights}
    if resume:
        if not config_path.exists():
            raise ValueError("Run cũ chưa có snapshot v2. Tạo run mới với --init-from ghep.")
        config = json.loads(config_path.read_text(encoding="utf-8"))
        options = config["options"]
        for key, default in (("composed_per_class", 0), ("samples_per_class", 0), ("robust_geometry", False)):
            options.setdefault(key, default)
        options.setdefault("glyph_validation_per_class", 0)
        options.setdefault("init_weights", "best")
        if requested_epochs is not None:
            options["epochs"] = requested_epochs
    elif config_path.exists() or (model_dir / "ghep_best.keras").exists():
        raise FileExistsError("Run đã tồn tại. Dùng --resume hoặc chọn tên mới.")
    if min(options[k] for k in ("epochs", "batch_size", "patience", "lr_patience", "threads")) < 1:
        raise ValueError("epochs/batch/patience/threads phải dương")
    if options["lr"] <= 0 or not 0 <= options["dropout"] < 1 or options["weight_decay"] < 0:
        raise ValueError("lr/dropout/weight-decay không hợp lệ")
    if min(options["composed_per_class"], options["samples_per_class"], options["glyph_validation_per_class"]) < 0:
        raise ValueError("Số mẫu ghép và số mẫu mỗi lớp không được âm")
    tf.config.threading.set_intra_op_parallelism_threads(options["threads"])
    tf.config.threading.set_inter_op_parallelism_threads(2)
    keras.utils.set_random_seed(options["seed"])
    data_dir = model_dir / "data"
    if resume:
        manifest = verify_snapshot(data_dir)
        if manifest != config["dataset_manifest"]:
            raise ValueError("Snapshot dữ liệu không khớp cấu hình run")
    else:
        write_json(model_dir / "state.json", {"status": "preparing", "epoch": 0})
        manifest = build_processed(folder=data_dir, include_vnondb=options["include_vnondb"],
                                   composed_per_class=options["composed_per_class"],
                                   glyph_validation_per_class=options["glyph_validation_per_class"])
    classes = load_label_map(data_dir)["classes"]
    train_s, val_s = load_split("train", data_dir), load_split("validation", data_dir)
    if resume:
        if load_label_map(model_dir)["classes"] != classes:
            raise ValueError("Bảng nhãn bị thay đổi")
        with zipfile.ZipFile(model_dir / "ghep_last.keras") as archive:
            bundle = json.loads(archive.read("ghep_resume.json"))
        state, history = bundle["state"], bundle["history"]
        model = keras.models.load_model(model_dir / "ghep_last.keras")
        (model_dir / "STOP").unlink(missing_ok=True)
        print(f"Khôi phục epoch {state['epoch']}; tiếp tục epoch {state['epoch'] + 1}; giữ optimizer/lr/patience.", flush=True)
    else:
        write_json(model_dir / "label_map.json", {"classes": classes, "version": 2})
        write_json(model_dir / "preprocessing.json", {"image_shape": [64, 192, 1], "render_version": 1, "geometry_version": 1})
        geometry = geometry_batch([s["strokes"] for s in train_s])
        model = build_model(len(classes), options["lr"], geometry.mean(0), np.maximum(geometry.var(0), 1e-6),
                            options["dropout"], options["weight_decay"], options["robust_geometry"])
        if options["init_from"]:
            source_dir, _ = run_dirs(options["init_from"])
            source_labels = load_label_map(source_dir if (source_dir / "label_map.json").exists() else None)["classes"]
            if source_labels != classes:
                raise ValueError("Nhãn nguồn khác nhãn run mới; bỏ --init-from để train mới")
            source_path = source_dir / f"ghep_{options['init_weights']}.keras"
            initialize(model, keras.models.load_model(source_path, compile=False))
            print(f"Khởi tạo từ {source_path}; học thêm nhánh hướng nét.", flush=True)
        state = {"epoch": 0, "best_score": -1.0, "best_val_loss": 1e30, "best_val_acc": 0.0,
                 "best_epoch": 0, "bad_epochs": 0, "plateau": 0}
        config = {"architecture": "image_geometry_v2", "options": options, "dataset_manifest": manifest,
                  "tensorflow": tf.__version__}
        history = []
    config["options"] = options
    write_json(config_path, config)
    counts = np.bincount([s["y"] for s in train_s], minlength=len(classes))
    weights = np.clip(np.sqrt(len(train_s) / (len(classes) * np.maximum(counts, 1))), 0.5, 3).astype(np.float32)
    if options["samples_per_class"]:
        weights = None  # lấy mẫu cân bằng rồi thì không bù lớp lần thứ hai
    monitor = np.random.default_rng(44).permutation(len(train_s))[:min(500, len(train_s))]
    monitor_samples = [train_s[i] for i in monitor]
    status = {**state, "status": "running", "pid": os.getpid(), "total_epochs": options["epochs"]}

    class Progress(keras.callbacks.Callback):
        def on_train_batch_end(self, batch, logs=None):
            if batch % 10 == 0:
                write_json(model_dir / "progress.json", {"epoch": status["current_epoch"], "step": batch + 1,
                           "steps": int(np.ceil((len(classes) * options["samples_per_class"] if options["samples_per_class"] else len(train_s)) / options["batch_size"])), "loss": float(logs["loss"])}, required=False)
            if (model_dir / "STOP").exists():
                self.model.stop_training = True

    print(f"Python {__import__('sys').version.split()[0]}; GPU={tf.config.list_physical_devices('GPU')}; "
          f"train={len(train_s)} val={len(val_s)} classes={len(classes)}", flush=True)
    try:
        for epoch in range(state["epoch"] + 1, options["epochs"] + 1):
            started = time.monotonic()
            status.update(current_epoch=epoch, stage="deep_train")
            write_json(model_dir / "state.json", status)
            ds = make_dataset(train_s, options["batch_size"], True,
                              np.random.default_rng(options["seed"] + epoch), combined=True, weights=weights,
                              samples_per_class=options["samples_per_class"])
            result = model.fit(ds, epochs=1, verbose=0, shuffle=False, callbacks=[Progress()])
            if (model_dir / "STOP").exists():
                raise KeyboardInterrupt
            val, clean = clean_metrics(model, val_s), clean_metrics(model, monitor_samples)
            loss = float(result.history["loss"][0])
            if not np.isfinite([loss, val["loss"]]).all():
                raise ValueError("Loss không hữu hạn")
            lr_now = float(model.optimizer.learning_rate.numpy())
            row = {"epoch": epoch, "loss": loss, "val_loss": val["loss"], "train_accuracy": clean["accuracy"],
                   "val_accuracy": val["accuracy"], "val_source_score": val["score"], "by_source": val["by_source"],
                   "pair_correct": val["pair_correct"], "pair_n": val["pair_n"], "lr": lr_now,
                   "sec": round(time.monotonic() - started, 1)}
            improved = val["score"] > state["best_score"] + 1e-8 or (
                abs(val["score"] - state["best_score"]) <= 1e-8 and val["loss"] < state["best_val_loss"] - 1e-4)
            if improved:
                _atomic_save(model, model_dir / "ghep_best.keras")
                state.update(best_score=val["score"], best_val_loss=val["loss"], best_val_acc=val["accuracy"],
                             best_epoch=epoch, bad_epochs=0, plateau=0)
            else:
                state["bad_epochs"] += 1
                state["plateau"] += 1
                if state["plateau"] >= options["lr_patience"]:
                    model.optimizer.learning_rate.assign(max(lr_now * 0.5, 1e-6))
                    state["plateau"] = 0
            state["epoch"] = epoch
            history.append(row)
            _atomic_save(model, model_dir / "ghep_last.keras", {"state": state, "history": history})
            import pandas as pd
            with atomic_file(model_dir / "history.csv") as temp:
                pd.DataFrame(history).to_csv(temp, index=False)
            status.update(state, last_metrics=row)
            write_json(model_dir / "state.json", status)
            print(f"epoch {epoch}/{options['epochs']} loss={loss:.4f} train={clean['accuracy']:.2%} "
                  f"val={val['accuracy']:.2%} sources={val['by_source']} uê/iê={val['pair_correct']}/{val['pair_n']} "
                  f"lr={lr_now:.1e} {row['sec']}s", flush=True)
            if epoch == 1 or epoch % 5 == 0:
                plot_history(history, model_dir / "curves.png")
            if state["bad_epochs"] >= options["patience"]:
                status["status"] = "early_stopped"
                print(f"Dừng sớm: {state['bad_epochs']} epoch không cải thiện validation đủ mức; "
                      f"giữ model tốt nhất ở epoch {state['best_epoch']}.", flush=True)
                break
        else:
            status["status"] = "completed"
        status["stage"] = "fit_svm"
        write_json(model_dir / "state.json", status)
        best = keras.models.load_model(model_dir / "ghep_best.keras", compile=False)
        probabilities = np.concatenate([np.asarray(best(model_inputs([s["strokes"] for s in val_s[i:i+32]]), training=False))
                                        for i in range(0, len(val_s), 32)])
        fit_and_select(train_s, val_s, probabilities, classes, model_dir)
        status["stage"] = "finished"
        print(f"Hoàn tất train và SVM: {status['status']}; best epoch {state['best_epoch']}; "
              f"model {model_dir / 'ghep_best.keras'}", flush=True)
    except KeyboardInterrupt:
        status.update(status="interrupted", stage="stopped")
        print("Đã dừng; --resume tiếp tục từ epoch hoàn thành gần nhất.", flush=True)
    except Exception as exc:
        status.update(status="failed", error=str(exc))
        raise
    finally:
        write_json(model_dir / "state.json", status)
        if history:
            plot_history(history, model_dir / "curves.png")
    return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-name", default="ghep_stable")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.0001)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--patience", type=int, default=50)
    parser.add_argument("--lr-patience", type=int, default=12)
    parser.add_argument("--init-from", default="ghep")
    parser.add_argument("--no-vnondb", action="store_true")
    parser.add_argument("--threads", type=int, default=6)
    parser.add_argument("--dropout", type=float, default=0.35)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--composed-per-class", type=int, default=0)
    parser.add_argument("--samples-per-class", type=int, default=0)
    parser.add_argument("--robust-geometry", action="store_true")
    parser.add_argument("--glyph-validation-per-class", type=int, default=0)
    parser.add_argument("--init-weights", choices=["best", "last"], default="best")
    args = vars(parser.parse_args())
    args["include_vnondb"] = not args.pop("no_vnondb")
    train(**args)


if __name__ == "__main__":
    main()
