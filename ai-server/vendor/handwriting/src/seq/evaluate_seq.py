"""Đánh giá độc lập người viết; tách kết quả greedy, beam và gợi ý thống kê.

python -m src.seq.evaluate_seq --run-name word_stable --split test
python -m src.seq.evaluate_seq --run-name word_stable --split validation --max-samples 500 --decoder all
"""
from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path

import keras
import numpy as np
import pandas as pd

from src.labels import compose_char, decompose_char
from src.seq import config_seq as cfg
from src.seq import model_seq  # register custom layers
from src.seq.artifacts_seq import best_model_path, dataset_signature, run_settings, write_json
from src.seq.data_seq import SeqData, make_dataset
from src.seq.decode_seq import decode_batch
from src.seq.language_seq import CharacterLanguageModel
from src.seq.metrics_seq import align_edits, cer_wer, edit_distance, greedy_decode, ids_to_text
from src.seq.model_seq import output_lengths


def vowel_shape(char):
    base, mod, _ = decompose_char(char.lower())
    return compose_char(base, mod, "none") if char else ""


def save_report(rows, decoder, args, out, provenance):
    df = pd.DataFrame(rows)
    refs, hyps = df["ref"].tolist(), df[f"hyp_{decoder}"].tolist()
    cer, wer = cer_wer(refs, hyps)
    prefix = f"{args.split}_{decoder}"
    metrics = {"level": args.level, "split": args.split, "decoder": decoder, "n_samples": len(df),
               "cer": cer, "wer": wer, "exact_match": float(np.mean([r == h for r, h in zip(refs, hyps)])),
               **provenance}
    write_json(out / f"metrics_{prefix}.json", metrics)
    if decoder == "greedy":
        write_json(out / f"metrics_{args.split}.json", metrics)
    df["hyp"] = hyps
    df.loc[df["ref"] != df["hyp"]].to_csv(out / f"errors_{prefix}.csv", index=False, encoding="utf-8-sig")
    confusions, shape_counts, shape_correct, exact_correct = Counter(), Counter(), Counter(), Counter()
    for ref, hyp in zip(refs, hyps):
        for a, b in align_edits(ref, hyp):
            if a != b:
                confusions[(a or "∅", b or "∅")] += 1
            shape = vowel_shape(a)
            if shape in "aăâeêoôơ" and shape:
                shape_counts[shape] += 1
                shape_correct[shape] += vowel_shape(b) == shape
                exact_correct[shape] += a == b
    pd.DataFrame([{"thuc_te": a, "model_doan": b, "so_lan": n}
                  for (a, b), n in confusions.most_common(50)],
                 columns=["thuc_te", "model_doan", "so_lan"]).to_csv(
                     out / f"confusions_{prefix}.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame([{"char": c, "n": shape_counts[c], "shape_accuracy": shape_correct[c] / shape_counts[c],
                   "exact_accuracy": exact_correct[c] / shape_counts[c]} for c in sorted(shape_counts)]).to_csv(
                       out / f"vowels_{prefix}.csv", index=False, encoding="utf-8-sig")
    df["err"] = [edit_distance(r, h) for r, h in zip(refs, hyps)]
    df["n"] = df["ref"].str.len()
    by_writer = df.groupby("writer_id").agg(errors=("err", "sum"), characters=("n", "sum"))
    by_writer["cer"] = by_writer["errors"] / by_writer["characters"].clip(lower=1)
    by_writer.to_csv(out / f"cer_by_writer_{prefix}.csv", encoding="utf-8-sig")
    print(f"{decoder:6s}: CER={cer:.4f} WER={wer:.4f} exact={metrics['exact_match']:.4f} n={len(df)}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="word_stable")
    ap.add_argument("--level", default=None, choices=list(cfg.LEVELS))
    ap.add_argument("--data-name", default=None)
    ap.add_argument("--split", default="test", choices=cfg.SPLITS)
    ap.add_argument("--max-samples", type=int, default=0)
    ap.add_argument("--batch-size", type=int, default=0)
    ap.add_argument("--decoder", default="greedy", choices=["greedy", "beam", "hybrid", "all"])
    ap.add_argument("--language-weight", type=float, default=0.5)
    ap.add_argument("--full-split", action="store_true", help="bỏ qua subset validation đã lưu của run")
    ap.add_argument("--words", nargs="+", help="đo riêng các từ đã chỉ định, không phân biệt hoa/thường")
    ap.add_argument("--threads", type=int, default=6)
    args = ap.parse_args()
    import tensorflow as tf
    if args.threads > 0:
        tf.config.threading.set_intra_op_parallelism_threads(args.threads)
        tf.config.threading.set_inter_op_parallelism_threads(2)
    if args.max_samples < 0 or args.batch_size < 0:
        raise SystemExit("max-samples/batch-size không được âm")
    run_dir = cfg.MODELS_DIR / args.run_name
    args.level, args.data_name = run_settings(run_dir, args.level, args.data_name)
    data = SeqData(args.level, args.data_name)
    signature = dataset_signature(data.folder)
    config_path = run_dir / "train_config.json"
    if config_path.exists():
        saved = json.loads(config_path.read_text(encoding="utf-8"))
        if saved.get("dataset_signature", signature) != signature:
            raise SystemExit("Dữ liệu không còn khớp run đã train; không thể so sánh metric an toàn")
    idx = data.indices(args.split)
    split_path = run_dir / "split_indices.npz"
    if args.split == "validation" and split_path.exists() and not args.full_split:
        idx = np.load(split_path)["validation"]
    words = sorted({unicodedata.normalize("NFC", w).casefold() for w in (args.words or [])})
    if words:
        idx = idx[data.df.iloc[idx]["text"].str.casefold().isin(words).to_numpy()]
    if args.max_samples:
        idx = np.random.default_rng(cfg.SEED).permutation(idx)[:args.max_samples]
    if not len(idx):
        raise SystemExit("Tập đánh giá rỗng")
    model_path = best_model_path(run_dir)
    # Snapshot một lần: background train có thể thay checkpoint trong khi đang đánh giá.
    model_bytes = model_path.read_bytes()
    model_hash = hashlib.sha256(model_bytes).hexdigest()
    with tempfile.TemporaryDirectory() as folder:
        snapshot = Path(folder) / "evaluation.keras"
        snapshot.write_bytes(model_bytes)
        model = keras.models.load_model(snapshot)
    language_model = None
    if args.decoder in ("hybrid", "all"):
        path = run_dir / "language_model.json"
        language_model = CharacterLanguageModel.load(path) if path.exists() else CharacterLanguageModel.fit(
            data.df.loc[data.df["split"] == "train", "text"])
    batch_size = args.batch_size or cfg.LEVELS[args.level]["batch"]
    ds = make_dataset(data, idx, batch_size, training=False, augment=False)
    rows = []
    for batch, (feats, lens, labels, label_lengths, sample_idx) in enumerate(ds, 1):
        logits = model([feats, lens], training=False).numpy()
        out_lens = output_lengths(lens).numpy()
        greedy = greedy_decode(logits, out_lens)
        decoded = decode_batch(logits, out_lens, language_model, args.language_weight) if args.decoder != "greedy" else None
        for b, (i, n) in enumerate(zip(sample_idx.numpy(), label_lengths.numpy())):
            meta = data.df.iloc[int(i)]
            row = {"sample_idx": int(i), "writer_id": meta["writer_id"], "page": meta["page"],
                   "ref": ids_to_text(labels[b, :int(n)].numpy()), "hyp_greedy": greedy[b]}
            if decoded is not None:
                d = decoded[b]
                row.update(hyp_beam=d["text"], hyp_hybrid=d["suggested_text"] or d["text"])
            rows.append(row)
        if batch % 20 == 0:
            print(f"Đã đánh giá {len(rows)}/{len(idx)} mẫu", flush=True)
    out = cfg.REPORTS_DIR / args.run_name
    if words:
        word_key = hashlib.sha256("\n".join(words).encode("utf-8")).hexdigest()[:10]
        out = out / f"words_{word_key}"
    out.mkdir(parents=True, exist_ok=True)
    provenance = {"model_sha256": model_hash,
                  "sample_indices_sha256": hashlib.sha256(np.sort(idx).astype(np.int64).tobytes()).hexdigest(),
                  "dataset_signature": signature, "language_weight": args.language_weight, "words": words}
    decoders = ["greedy", "beam", "hybrid"] if args.decoder == "all" else [args.decoder]
    for decoder in decoders:
        save_report(rows, decoder, args, out, provenance)
    pd.DataFrame(rows).to_csv(out / f"predictions_{args.split}_{args.decoder}.csv", index=False, encoding="utf-8-sig")
    print(f"Báo cáo: {out}", flush=True)


if __name__ == "__main__":
    main()
