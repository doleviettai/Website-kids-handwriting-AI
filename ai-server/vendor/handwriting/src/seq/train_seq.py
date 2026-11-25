"""Train CNN + BiGRU + CTC đầy đủ, lưu checkpoint model và optimizer mỗi epoch.

python -m src.seq.train_seq --data-name word_v2 --run-name word_stable --init-from thu --lr 0.0005
python -m src.seq.train_seq --run-name word_stable --resume --epochs 160
"""
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import keras
import matplotlib
import numpy as np
import pandas as pd
import tensorflow as tf

from src.seq import config_seq as cfg
from src.seq.artifacts_seq import best_model_path, dataset_signature, write_json
from src.seq.data_seq import SeqData, make_dataset
from src.seq.features_seq import N_FEATURES
from src.seq.language_seq import CharacterLanguageModel
from src.seq.metrics_seq import cer_wer, greedy_decode, ids_to_text
from src.seq.model_seq import build_seq_model, ctc_loss, output_lengths

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def feature_stats(data: SeqData, idx: np.ndarray, batch_size: int, max_samples: int = 20000):
    """Lấy mẫu ngẫu nhiên từ train, không chỉ lấy các chuỗi ngắn nhất."""
    selected = np.random.default_rng(cfg.SEED + 10).permutation(idx)[:max_samples]
    total, squared, n = np.zeros(N_FEATURES), np.zeros(N_FEATURES), 0
    for feats, lens, *_ in make_dataset(data, selected, batch_size, training=False, augment=False):
        f, ln = feats.numpy().astype(np.float64), lens.numpy()
        valid = np.arange(f.shape[1])[None, :] < ln[:, None]
        values = f[valid]
        total += values.sum(0)
        squared += (values ** 2).sum(0)
        n += len(values)
    if n == 0:
        raise ValueError("Không có frame train để chuẩn hóa")
    mean = total / n
    return mean.astype(np.float32), np.maximum(squared / n - mean ** 2, 1e-8).astype(np.float32)


def evaluate(model, ds):
    total_loss, refs, hyps = 0.0, [], []
    for feats, lens, labels, label_lengths, _ in ds:
        logits = model([feats, lens], training=False)
        loss = tf.reduce_sum(ctc_loss(logits, lens, labels, label_lengths))
        tf.debugging.check_numerics(loss, "Validation CTC loss không hữu hạn")
        total_loss += float(loss)
        hyps.extend(greedy_decode(logits.numpy(), output_lengths(lens).numpy()))
        lab, ll = labels.numpy(), label_lengths.numpy()
        refs.extend(ids_to_text(lab[b, :ll[b]]) for b in range(len(ll)))
    if not refs:
        raise ValueError("Tập đánh giá rỗng")
    cer, wer = cer_wer(refs, hyps)
    return total_loss / len(refs), cer, wer, list(zip(refs, hyps))


def validate_splits(data: SeqData):
    for field in ("writer_id", "page"):
        groups = {s: set(data.df.loc[data.df["split"] == s, field]) for s in cfg.SPLITS}
        for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")):
            if groups[a] & groups[b]:
                raise ValueError(f"Trùng {field} giữa {a} và {b}; sửa chia tập trước khi train")


def plot_history(history, path: Path):
    hist = pd.DataFrame(history)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].plot(hist["epoch"], hist["loss"], label="train (augmented)")
    axes[0].plot(hist["epoch"], hist["val_loss"], label="validation")
    axes[0].set_title("CTC loss")
    axes[1].plot(hist["epoch"], hist["train_cer"], label="train CER (no augmentation)")
    axes[1].plot(hist["epoch"], hist["val_cer"], label="validation CER")
    axes[1].set_title("Generalization: smaller CER is better")
    for ax in axes:
        ax.set_xlabel("epoch")
        ax.grid(alpha=0.3)
        ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--level", default="word", choices=list(cfg.LEVELS))
    ap.add_argument("--data-name", default=None)
    ap.add_argument("--run-name", default="word_stable")
    ap.add_argument("--epochs", type=int, default=None, help="tổng epoch, kể cả trước --resume")
    ap.add_argument("--batch-size", type=int, default=0)
    ap.add_argument("--lr", type=float, default=cfg.LEARNING_RATE)
    ap.add_argument("--units", type=int, default=128)
    ap.add_argument("--dropout", type=float, default=0.3)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--patience", type=int, default=cfg.EARLY_STOP_PATIENCE)
    ap.add_argument("--lr-patience", type=int, default=cfg.LR_PLATEAU_PATIENCE)
    ap.add_argument("--min-delta", type=float, default=1e-4)
    ap.add_argument("--no-augment", action="store_true")
    ap.add_argument("--max-train", type=int, default=0)
    ap.add_argument("--max-val", type=int, default=0)
    ap.add_argument("--train-eval-samples", type=int, default=1000)
    ap.add_argument("--init-from", default=None, help="run nguồn hoặc đường dẫn tệp .keras")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--threads", type=int, default=6)
    args = ap.parse_args()
    run_dir = cfg.MODELS_DIR / args.run_name
    model_path = best_model_path(run_dir, for_save=True)
    config_path = run_dir / "train_config.json"
    requested_epochs = args.epochs
    if args.resume:
        if not config_path.exists():
            raise SystemExit("Không có cấu hình để resume")
        saved_config = json.loads(config_path.read_text(encoding="utf-8"))
        args = argparse.Namespace(**saved_config["args"])
        args.resume = True
        args.epochs = requested_epochs if requested_epochs is not None else args.epochs
    else:
        args.epochs = args.epochs if args.epochs is not None else cfg.EPOCHS
        if config_path.exists() or best_model_path(run_dir).exists():
            raise SystemExit(f"Run {args.run_name} đã tồn tại. Dùng --resume hoặc chọn tên mới.")
    if args.epochs < 1 or args.patience < 1 or args.lr_patience < 1 or args.lr <= 0:
        raise SystemExit("epochs, patience và lr phải dương")
    if args.max_train < 0 or args.max_val < 0 or args.train_eval_samples < 1 or args.batch_size < 0:
        raise SystemExit("Giới hạn mẫu / batch không hợp lệ")
    if not 0 <= args.dropout < 1 or args.weight_decay < 0 or args.min_delta < 0:
        raise SystemExit("dropout / weight-decay / min-delta không hợp lệ")
    if args.threads > 0:
        tf.config.threading.set_intra_op_parallelism_threads(args.threads)
        tf.config.threading.set_inter_op_parallelism_threads(2)
    keras.utils.set_random_seed(cfg.SEED)
    batch_size = args.batch_size or cfg.LEVELS[args.level]["batch"]
    data = SeqData(args.level, args.data_name)
    validate_splits(data)
    signature = dataset_signature(data.folder)
    run_dir.mkdir(parents=True, exist_ok=True)
    if args.resume:
        if signature != saved_config["dataset_signature"]:
            raise SystemExit("Dữ liệu đã thay đổi; tạo run mới để tránh lệch nhãn/tập chia")
        split_file = np.load(run_dir / "split_indices.npz")
        train_idx, val_idx, monitor_idx = (split_file[k] for k in ("train", "validation", "train_monitor"))
        stats = np.load(run_dir / "feature_stats.npz")
        mean, var = stats["mean"], stats["variance"]
    else:
        train_idx, val_idx = data.indices("train"), data.indices("validation")
        if args.max_train:
            train_idx = np.random.default_rng(cfg.SEED).permutation(train_idx)[:args.max_train]
        if args.max_val:
            val_idx = np.random.default_rng(cfg.SEED + 1).permutation(val_idx)[:args.max_val]
        if not len(train_idx) or not len(val_idx):
            raise SystemExit("Train hoặc validation rỗng")
        monitor_idx = np.random.default_rng(cfg.SEED + 2).permutation(train_idx)[:args.train_eval_samples]
        np.savez(run_dir / "split_indices.npz", train=train_idx, validation=val_idx, train_monitor=monitor_idx)
        write_json(run_dir / "preprocessing.json", data.meta)
        write_json(run_dir / "charset.json", cfg.CHARSET)
        write_json(run_dir / "training_state.json", {"status": "initializing", "completed_epochs": 0})
        print("Đang tính thống kê train và học mô hình ngôn ngữ thống kê...", flush=True)
        mean, var = feature_stats(data, train_idx, batch_size)
        np.savez(run_dir / "feature_stats.npz", mean=mean, variance=var)
        CharacterLanguageModel.fit(data.df.iloc[train_idx]["text"]).save(run_dir / "language_model.json")
        saved_config = {"args": vars(args), "n_train": len(train_idx), "n_val": len(val_idx),
                        "batch_size": batch_size, "dataset_signature": signature,
                        "architecture": "masked_cnn_bigru_ctc_v2", "tensorflow": tf.__version__}
    saved_config["args"] = vars(args)
    write_json(config_path, saved_config)
    model = build_seq_model(mean, var, units=args.units, dropout=args.dropout)
    if args.init_from and not args.resume:
        source = Path(args.init_from)
        if not source.is_file():
            source = best_model_path(cfg.MODELS_DIR / args.init_from)
        pretrained = keras.models.load_model(source)
        charset = source.parent / "charset.json"
        if charset.exists() and json.loads(charset.read_text(encoding="utf-8")) != cfg.CHARSET:
            raise SystemExit("Charset model nguồn khác model đích")
        try:
            model.set_weights(pretrained.get_weights())
        except ValueError as exc:
            raise SystemExit("Trọng số không khớp; dùng cùng --units hoặc bỏ --init-from") from exc
        del pretrained
        print(f"Khởi tạo từ {source}; chuẩn hóa theo bộ train mới.", flush=True)
    optimizer = keras.optimizers.AdamW(args.lr, weight_decay=args.weight_decay, global_clipnorm=cfg.GRAD_CLIP)
    optimizer.exclude_from_weight_decay(var_names=["bias", "beta", "gamma"])
    optimizer.build(model.trainable_variables)
    epoch_var = tf.Variable(0, dtype=tf.int64, trainable=False)
    best_var = tf.Variable(np.inf, dtype=tf.float64, trainable=False)
    bad_var = tf.Variable(0, dtype=tf.int64, trainable=False)
    plateau_var = tf.Variable(0, dtype=tf.int64, trainable=False)
    checkpoint = tf.train.Checkpoint(model=model, optimizer=optimizer, epoch=epoch_var,
                                    best_cer=best_var, bad_epochs=bad_var, plateau=plateau_var)
    manager = tf.train.CheckpointManager(checkpoint, str(run_dir / "checkpoints"), max_to_keep=2)
    history = []
    if args.resume:
        if not manager.latest_checkpoint:
            raise SystemExit("Chưa có checkpoint hoàn thành epoch để resume")
        checkpoint.restore(manager.latest_checkpoint).assert_existing_objects_matched()
        hist = pd.read_csv(run_dir / "history.csv")
        history = hist.loc[hist["epoch"] <= int(epoch_var.numpy())].to_dict("records")

    @tf.function(input_signature=[tf.TensorSpec([None, None, N_FEATURES], tf.float32),
                                 tf.TensorSpec([None], tf.int32), tf.TensorSpec([None, None], tf.int32),
                                 tf.TensorSpec([None], tf.int32)])
    def train_step(feats, lens, labels, label_lengths):
        with tf.GradientTape() as tape:
            logits = model([feats, lens], training=True)
            loss = tf.reduce_mean(ctc_loss(logits, lens, labels, label_lengths))
            tf.debugging.check_numerics(loss, "Train CTC loss không hữu hạn")
        optimizer.apply_gradients(zip(tape.gradient(loss, model.trainable_variables), model.trainable_variables))
        return loss

    val_ds = make_dataset(data, val_idx, batch_size, training=False, augment=False)
    monitor_ds = make_dataset(data, monitor_idx, batch_size, training=False, augment=False)
    n_batches = (len(train_idx) + batch_size - 1) // batch_size
    print(f"train={len(train_idx)} val={len(val_idx)} test={len(data.indices('test'))} "
          f"batch={batch_size} params={model.count_params():,} GPU={tf.config.list_physical_devices('GPU')}", flush=True)
    state = {"status": "running", "completed_epochs": int(epoch_var.numpy()), "total_epochs": args.epochs,
             "n_train": len(train_idx), "n_val": len(val_idx), "pid": os.getpid()}
    stop_path = run_dir / "STOP"
    if args.resume:
        stop_path.unlink(missing_ok=True)
    try:
        for epoch in range(int(epoch_var.numpy()) + 1, args.epochs + 1):
            t0, loss_sum, sample_count = time.monotonic(), 0.0, 0
            state.update(status="running", current_epoch=epoch, stage="train")
            write_json(run_dir / "training_state.json", state)
            train_ds = make_dataset(data, train_idx, batch_size, training=True,
                                    augment=not args.no_augment, seed=cfg.SEED + epoch)
            for step, (f, ln, lab, ll, _) in enumerate(train_ds, 1):
                if stop_path.exists():
                    raise KeyboardInterrupt
                loss = float(train_step(f, ln, lab, ll))
                loss_sum += loss * len(ln)
                sample_count += len(ln)
                if step == 1 or step % 50 == 0 or step == n_batches:
                    elapsed = time.monotonic() - t0
                    progress = {"epoch": epoch, "step": step, "steps": n_batches,
                                "loss": loss_sum / sample_count, "elapsed_sec": round(elapsed),
                                "eta_train_sec": round(elapsed / step * (n_batches - step))}
                    write_json(run_dir / "progress.json", progress)
                    print(f"epoch {epoch} step {step}/{n_batches} loss={progress['loss']:.3f} "
                          f"elapsed={elapsed:.0f}s", flush=True)
            state.update(stage="validation")
            write_json(run_dir / "training_state.json", state)
            val_loss, cer, wer, pairs = evaluate(model, val_ds)
            _, train_cer, _, _ = evaluate(model, monitor_ds)
            lr = float(optimizer.learning_rate.numpy())
            row = {"epoch": epoch, "loss": loss_sum / sample_count, "train_cer": train_cer,
                   "val_loss": val_loss, "val_cer": cer, "val_wer": wer, "lr": lr,
                   "sec": round(time.monotonic() - t0)}
            if cer < float(best_var.numpy()):
                temp_model = model_path.with_suffix(".tmp.keras")
                model.save(temp_model)
                temp_model.replace(model_path)
                best_var.assign(cer)
            reference = min((r["val_cer"] for r in history), default=np.inf)
            if cer < reference - args.min_delta:
                bad_var.assign(0)
                plateau_var.assign(0)
            else:
                bad_var.assign_add(1)
                plateau_var.assign_add(1)
                if int(plateau_var.numpy()) >= args.lr_patience:
                    optimizer.learning_rate.assign(max(lr * 0.5, 1e-5))
                    plateau_var.assign(0)
            epoch_var.assign(epoch)
            manager.save(checkpoint_number=epoch)
            history.append(row)
            pd.DataFrame(history).to_csv(run_dir / "history.csv.tmp", index=False)
            (run_dir / "history.csv.tmp").replace(run_dir / "history.csv")
            saved_config.update(best_val_cer=float(best_var.numpy()), completed_epochs=epoch)
            write_json(config_path, saved_config)
            state.update(completed_epochs=epoch, best_val_cer=float(best_var.numpy()), last_metrics=row,
                         updated_at=datetime.now(timezone.utc).isoformat(), stage="epoch_complete")
            write_json(run_dir / "training_state.json", state)
            print(f"epoch {epoch:3d} | loss {row['loss']:.3f} | train CER {train_cer:.4f} | "
                  f"val CER {cer:.4f} | WER {wer:.4f} | lr {lr:.1e} | {row['sec']}s | "
                  f"{pairs[0][0]!r}->{pairs[0][1]!r}", flush=True)
            if epoch == 1 or epoch % 5 == 0:
                plot_history(history, run_dir / "curves.png")
            if int(bad_var.numpy()) >= args.patience:
                state["status"] = "early_stopped"
                print("Dừng sớm theo validation CER. Giữ model tốt nhất.", flush=True)
                break
        else:
            state["status"] = "completed"
    except KeyboardInterrupt:
        state["status"] = "interrupted"
        print(f"Tiếp tục: python -m src.seq.train_seq --run-name {args.run_name} --resume", flush=True)
    except Exception as exc:
        state.update(status="failed", error=str(exc))
        raise
    finally:
        write_json(run_dir / "training_state.json", state)
        if history:
            plot_history(history, run_dir / "curves.png")
    print(f"Trạng thái: {state['status']}; best: {model_path}", flush=True)


if __name__ == "__main__":
    main()
