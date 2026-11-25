"""Giải mã CTC và các độ đo CER / WER."""
from __future__ import annotations

import numpy as np

from src.seq import config_seq as cfg


def greedy_decode(logits: np.ndarray, out_lengths: np.ndarray) -> list[str]:
    """Lấy lớp có điểm cao nhất ở từng frame, gộp ký tự lặp liên tiếp, bỏ blank."""
    best = logits.argmax(axis=-1)
    out = []
    for b in range(len(best)):
        seq, prev = [], -1
        for k in best[b, : int(out_lengths[b])]:
            if k != prev and k != 0:
                seq.append(cfg.ID_TO_CHAR[int(k)])
            prev = k
        out.append("".join(seq))
    return out


def ids_to_text(ids) -> str:
    return "".join(cfg.ID_TO_CHAR[int(i)] for i in ids if int(i) != 0)


def edit_distance(a, b) -> int:
    """Khoảng cách Levenshtein giữa 2 chuỗi (hoặc 2 danh sách từ)."""
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):

        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def cer_wer(refs: list[str], hyps: list[str]) -> tuple[float, float]:
    """CER = tổng lỗi ký tự / tổng số ký tự thật.  WER = tổng lỗi từ / tổng số từ thật (từ cách nhau bởi khoảng trắng)."""
    ce = sum(edit_distance(r, h) for r, h in zip(refs, hyps))
    cn = sum(len(r) for r in refs)
    we = sum(edit_distance(r.split(), h.split()) for r, h in zip(refs, hyps))
    wn = sum(len(r.split()) for r in refs)
    return ce / max(cn, 1), we / max(wn, 1)


def align_edits(ref: str, hyp: str) -> list[tuple[str, str]]:
    """Căn chỉnh Levenshtein tối ưu, gồm cả chèn/xóa để thống kê lỗi dấu."""
    cost = np.zeros((len(ref) + 1, len(hyp) + 1), dtype=np.int32)
    cost[:, 0], cost[0, :] = np.arange(len(ref) + 1), np.arange(len(hyp) + 1)
    for i, a in enumerate(ref, 1):
        for j, b in enumerate(hyp, 1):
            cost[i, j] = min(cost[i - 1, j] + 1, cost[i, j - 1] + 1,
                             cost[i - 1, j - 1] + (a != b))
    pairs, i, j = [], len(ref), len(hyp)
    while i or j:
        if i and j and cost[i, j] == cost[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]):
            pairs.append((ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i and cost[i, j] == cost[i - 1, j] + 1:
            pairs.append((ref[i - 1], ""))
            i -= 1
        else:
            pairs.append(("", hyp[j - 1]))
            j -= 1
    return pairs[::-1]
