"""Thống kê dataset trước khi train:  python -m src.audit [--raw-dir data/raw/inkml]

Trả lời các câu hỏi: có bao nhiêu mẫu / người viết? ký tự nào còn thiếu? mẫu nào bất thường?
Kết quả in ra màn hình, đồng thời lưu vào reports/audit_summary.txt và reports/audit_samples.csv.
"""
from __future__ import annotations

import argparse
import hashlib
from collections import Counter
from pathlib import Path

import pandas as pd

from src import config
from src.inkml_parser import InkParseError, check_sample, iter_inkml_files, parse_inkml
from src.labels import BASES, decompose_char, expected_truths


def _is_upper(base: str) -> bool:
    return base != base.lower()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default=str(config.RAW_DIR))
    args = ap.parse_args()

    files = list(iter_inkml_files(args.raw_dir))
    if not files:
        raise SystemExit(f"Không tìm thấy file .inkml nào trong {args.raw_dir}")

    rows, errors = [], []
    for p in files:
        try:
            s = parse_inkml(p)
        except InkParseError as e:
            errors.append((str(p), str(e)))
            continue
        hard, soft = check_sample(s)
        base, mod, tone = decompose_char(s.truth) if len(s.truth) == 1 else ("", "", "")
        digest = hashlib.md5(b"".join(st[:, :2].tobytes() for st in s.strokes)).hexdigest()
        rows.append({
            "path": str(p), "writer_id": s.writer_id, "truth": s.truth,
            "base": base, "modifier": mod, "tone": tone,
            "n_strokes": s.n_strokes, "n_points": s.n_points, "duration_ms": round(s.duration_ms),
            "device": s.meta.get("DevName") or s.meta.get("device", ""),
            "age": s.meta.get("Age") or s.meta.get("age", ""),
            "hard": "|".join(hard), "soft": "|".join(soft), "hash": digest,
        })
    df = pd.DataFrame(rows)
    ok = df[df["hard"] == ""]

    out: list[str] = []
    w = out.append
    w("=" * 70)
    w(f"AUDIT  -  {args.raw_dir}")
    w("=" * 70)
    w(f"Tổng số file .inkml        : {len(files)}")
    w(f"Đọc được                   : {len(df)}")
    w(f"Không đọc được             : {len(errors)}")
    w(f"Dùng được để train         : {len(ok)}  (loại {len(df) - len(ok)})")
    for path, msg in errors[:10]:
        w(f"   ! {Path(path).name}: {msg}")

    # ---- lý do loại / cảnh báo
    hard_c = Counter(r for v in df["hard"] for r in v.split("|") if r)
    soft_c = Counter(r for v in df["soft"] for r in v.split("|") if r)
    w("\n-- Lý do bị loại:  " + (", ".join(f"{k}={v}" for k, v in hard_c.items()) or "không có"))
    w("-- Cảnh báo      :  " + (", ".join(f"{k}={v}" for k, v in soft_c.items()) or "không có"))

    # ---- người viết
    w("\n-- NGƯỜI VIẾT (mẫu dùng được)")
    per_writer = ok["writer_id"].value_counts()
    w(f"Số Writer_ID khác nhau: {len(per_writer)}")
    w(per_writer.to_string())
    med = per_writer.median()
    heavy = per_writer[per_writer > 2.5 * med]
    if len(per_writer) >= 3 and len(heavy):
        w(f"  ! Writer_ID có số mẫu > 2.5 lần trung vị ({med:.0f}): {', '.join(heavy.index)}")
        w("    -> có thể nhiều người đã dùng chung 1 mã. Điều này làm sai việc chia train/test theo người viết.")
    if len(per_writer) < config.MIN_WRITERS_FOR_GROUP_SPLIT:
        w(f"  ! Chỉ có {len(per_writer)} người viết (< {config.MIN_WRITERS_FOR_GROUP_SPLIT}): chưa đủ để chia theo người viết.")

    # ---- phủ nhãn
    w("\n-- ĐỘ PHỦ KÝ TỰ (so với 196 ký tự collector có thể yêu cầu)")
    per_truth = ok["truth"].value_counts()
    missing = [c for c in expected_truths() if c not in per_truth.index]
    w(f"Số ký tự có ít nhất 1 mẫu : {len(per_truth)} / {len(expected_truths())}")
    w("Ký tự CHƯA có mẫu nào     : " + (" ".join(missing) if missing else "không (đủ hết)"))
    w("15 ký tự ít mẫu nhất      : " + ", ".join(f"{c}={n}" for c, n in per_truth.sort_values().head(15).items()))
    w(f"Mẫu/ký tự  min={per_truth.min()}  trung vị={per_truth.median():.0f}  max={per_truth.max()}")

    w("\n-- BASE (nhãn đầu ra 1)")
    per_base = ok["base"].value_counts()
    absent = [b for b in BASES if b not in per_base.index]
    w("Base chưa có mẫu          : " + (" ".join(absent) if absent else "không"))
    w("10 base ít mẫu nhất       : " + ", ".join(f"{c}={n}" for c, n in per_base.sort_values().head(10).items()))

    w("\n-- MODIFIER / TONE (đếm riêng chữ thường và chữ hoa)")
    sub = ok.copy()
    sub["case"] = sub["base"].map(lambda b: "hoa" if _is_upper(b) else "thuong")
    w(pd.crosstab(sub["modifier"], sub["case"]).to_string())
    w("")
    w(pd.crosstab(sub["tone"], sub["case"]).to_string())

    # ---- hình dạng mẫu
    w("\n-- HÌNH DẠNG MẪU")
    w("Số nét:   " + ", ".join(f"{k} nét={v}" for k, v in sorted(Counter(ok["n_strokes"]).items())))
    q = ok["n_points"].quantile([0.05, 0.5, 0.95])
    w(f"Số điểm:  5%={q.iloc[0]:.0f}  trung vị={q.iloc[1]:.0f}  95%={q.iloc[2]:.0f}")
    q = ok["duration_ms"].quantile([0.05, 0.5, 0.95])
    w(f"Thời gian viết (ms):  5%={q.iloc[0]:.0f}  trung vị={q.iloc[1]:.0f}  95%={q.iloc[2]:.0f}")

    # ---- trùng lặp
    dup = df[df.duplicated(["hash", "truth"], keep=False)]
    w(f"\n-- TRÙNG LẶP: {len(dup)} file có nét giống hệt file khác (cùng ký tự)")
    for _, grp in list(dup.groupby("hash"))[:5]:
        w("   " + " == ".join(Path(p).name for p in grp["path"]))

    text = "\n".join(out)
    print(text)
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORTS_DIR / "audit_summary.txt").write_text(text, encoding="utf-8")
    df.drop(columns=["hash"]).to_csv(config.REPORTS_DIR / "audit_samples.csv", index=False, encoding="utf-8-sig")
    print(f"\nĐã lưu: {config.REPORTS_DIR / 'audit_summary.txt'} và audit_samples.csv")


if __name__ == "__main__":
    main()