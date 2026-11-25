"""So sánh cùng mẫu nằm trong giao test cũ và test mới; không chọn checkpoint bằng test."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.char.common import write_json
from .prepare_701515 import EXPERIMENT, ROOT, assert_originals


def _classification(truth, outputs):
    truth = np.asarray(truth)
    return {name: {"n": len(truth), "correct": int(np.sum(pred == truth)),
                   "accuracy": float(np.mean(pred == truth))} for name, pred in outputs.items()}


def char_comparison():
    from src.char.inference import Predictor
    from src.char.data import load
    from src.char.hybrid import CHARS
    old_run, new_run = ROOT / "models/baseline_stable", ROOT / "models/baseline_701515"
    old, new = load(old_run), load(new_run)
    if not np.array_equal(old["meta"]["sample_id"], new["meta"]["sample_id"]):
        raise ValueError("Thứ tự mẫu chữ đơn không khớp")
    mask = (old["split"] == "test") & (new["split"] == "test")
    outputs = {}
    hashes = {}
    for name, run in (("original", old_run), ("split_701515", new_run)):
        model = Predictor(run)
        probs, _ = model.probabilities(new["P"][mask], new["S"][mask])
        outputs[name] = np.asarray(CHARS)[probs.argmax(1)]
        hashes[name] = __import__("hashlib").sha256(model.path.read_bytes()).hexdigest()
    return {"same_unseen_samples": _classification(new["meta"].loc[mask, "truth"], outputs), "model_sha256": hashes,
            "limit": "Dữ liệu chỉ một người viết, không phải kiểm chứng người mới."}


def ghep_comparison():
    from src.ghep.data_ghep import load_split
    from src.ghep.inference_ghep import Predictor
    samples = [s for s in load_split("test", ROOT / "models/ghep_701515/data")
               if s["source"] != "composed" and s.get("old_split") == "test"]
    outputs, hashes = {}, {}
    for name, run in (("original", ROOT / "models/ghep_handwriting_v4"), ("split_701515", ROOT / "models/ghep_701515")):
        model = Predictor(run)
        predictions = []
        for start in range(0, len(samples), 32):
            probs = model.probabilities([s["strokes"] for s in samples[start:start + 32]])
            predictions.extend(model.classes[int(i)] for i in probs.argmax(1))
        outputs[name] = np.asarray(predictions)
        hashes[name] = model.model_hash
    by_source = {}
    truth = np.asarray([s["truth"] for s in samples])
    for source in sorted({s["source"] for s in samples}):
        mask = np.array([s["source"] == source for s in samples])
        by_source[source] = _classification(truth[mask], {name: p[mask] for name, p in outputs.items()})
    return {"same_unseen_samples": _classification(truth, outputs), "by_source": by_source,
            "model_sha256": hashes, "limit": "Chỉ dùng raw test chung; không dùng composed có glyph nguồn model cũ từng học."}


def seq_comparison():
    import keras
    from src.seq import model_seq  # register layers
    from src.seq.data_seq import SeqData, make_dataset
    from src.seq.metrics_seq import cer_wer, greedy_decode, ids_to_text
    from src.seq.model_seq import output_lengths
    from src.seq.artifacts_seq import best_model_path
    data = SeqData("word", "word_701515")
    frame = data.df
    idx = np.flatnonzero((frame["old_split"] == "test").to_numpy() & (frame["split"] == "test").to_numpy())
    outputs = {}
    refs = None
    for name, run in (("original", ROOT / "models/seq/word_stable"), ("split_701515", ROOT / "models/seq/word_701515")):
        path = best_model_path(run)
        model = keras.models.load_model(path, compile=False)
        reference, predictions = [], []
        for features, lengths, labels, label_lengths, _ in make_dataset(data, idx, 64, False, False):
            logits = model([features, lengths], training=False).numpy()
            predictions.extend(greedy_decode(logits, output_lengths(lengths).numpy()))
            lab, ll = labels.numpy(), label_lengths.numpy()
            reference.extend(ids_to_text(lab[b, :ll[b]]) for b in range(len(ll)))
        if refs is not None and reference != refs:
            raise ValueError("Thứ tự mẫu seq thay đổi")
        refs = reference
        cer, wer = cer_wer(reference, predictions)
        outputs[name] = {"n": len(refs), "cer": cer, "wer": wer,
                         "exact_match": float(np.mean(np.array(refs) == np.array(predictions)))}
    return {"same_unseen_samples": outputs, "decoder": "greedy", "limit": "Giao test cũ/mới; split mới không còn chuẩn chính thức VNOnDB."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["all", "char", "ghep", "seq"], default="all")
    args = parser.parse_args()
    import tensorflow as tf
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    assert_originals()
    result = {"policy": "Chỉ mẫu test chưa từng dùng train ở cả hai phía; không điều chỉnh model bằng kết quả này.",
              "limit": "Hai bên khác cả khởi tạo và test split. Không kết luận quan hệ nhân quả chỉ do tỷ lệ; cần control from-scratch và nhiều seed để nghiên cứu tỷ lệ."}
    for name, function in (("char", char_comparison), ("ghep", ghep_comparison), ("seq", seq_comparison)):
        if args.only in ("all", name):
            result[name] = function()
    write_json(EXPERIMENT / f"comparison_{args.only}.json", result)
    lines = ["# So sánh thử nghiệm 70/15/15", "", result["policy"], "", result["limit"], "",
             "| Model | Cùng số mẫu test chưa học | Bản cũ | Bản 70/15/15 |", "|---|---:|---:|---:|"]
    for name in ("char", "ghep", "seq"):
        if name not in result:
            continue
        metrics = result[name]["same_unseen_samples"]
        old, new = metrics["original"], metrics["split_701515"]
        key = "exact_match" if name == "seq" else "accuracy"
        lines.append(f"| {name} | {old['n']} | {old[key]:.2%} | {new[key]:.2%} |")
    lines += ["", "Seq dùng greedy decoding. Chữ đơn/ghép dùng chế độ mặc định đã chọn trên validation.",
              "Không tự động thay model chính. Để quay lại, mở demo với baseline_stable, word_stable và ghep_handwriting_v4."]
    (EXPERIMENT / f"comparison_{args.only}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
