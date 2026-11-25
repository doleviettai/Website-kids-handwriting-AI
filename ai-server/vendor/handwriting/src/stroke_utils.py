"""Chuẩn hóa nét + resample về độ dài cố định.

Các hàm này dùng chung cho lúc tiền xử lý dữ liệu train VÀ lúc suy luận (FastAPI / app),
để dữ liệu vào model luôn được xử lý đúng một cách.
"""
from __future__ import annotations

import numpy as np

from src import config


def normalize_to_canvas(strokes: list[np.ndarray], canvas_w: float | None, canvas_h: float | None) -> list[np.ndarray]:
    """Chia tọa độ cho kích thước canvas -> [0, 1].

    Cố ý KHÔNG co mỗi mẫu về khung riêng: giữ nguyên kích thước và vị trí để phân biệt các cặp
    như c/C, o/O, s/S, u/U, v/V, x/X, 0/O.
    """
    xy = [s[:, :2].astype(np.float64) for s in strokes if len(s)]
    if canvas_w and canvas_h:
        scale = np.array([canvas_w, canvas_h], dtype=np.float64)
    else:  # file không ghi kích thước canvas: ước lượng từ tọa độ lớn nhất
        allp = np.concatenate(xy)
        m = max(float(allp[:, 0].max()), float(allp[:, 1].max()), 1e-6)
        scale = np.array([m, m], dtype=np.float64)
    return [p / scale for p in xy]


def _dedupe(xy: np.ndarray) -> np.ndarray:
    if len(xy) < 2:
        return xy
    keep = np.concatenate([[True], np.sqrt(((xy[1:] - xy[:-1]) ** 2).sum(axis=1)) > 1e-9])
    return xy[keep]


def stroke_length(xy: np.ndarray) -> float:
    if len(xy) < 2:
        return 0.0
    return float(np.sqrt(((xy[1:] - xy[:-1]) ** 2).sum(axis=1)).sum())


def resample_stroke(xy: np.ndarray, n: int) -> np.ndarray:
    """Lấy lại n điểm cách đều theo độ dài cung dọc theo 1 nét."""
    xy = _dedupe(xy)
    if len(xy) == 1:                       # nét chỉ là 1 chấm
        return np.repeat(xy, n, axis=0)
    d = np.sqrt(((xy[1:] - xy[:-1]) ** 2).sum(axis=1))
    s = np.concatenate([[0.0], np.cumsum(d)])
    t = np.linspace(0.0, s[-1], n)
    return np.stack([np.interp(t, s, xy[:, 0]), np.interp(t, s, xy[:, 1])], axis=1)


def allocate_points(lengths, total: int, min_pts: int, equal_mix: float) -> np.ndarray:
    """Chia `total` điểm cho các nét: phần theo độ dài, phần chia đều (để nét dấu nhỏ không bị bỏ đói)."""
    k = len(lengths)
    if k * min_pts > total:
        raise ValueError(f"{k} nét x {min_pts} điểm > {total}")
    lengths = np.asarray(lengths, dtype=np.float64)
    share = lengths / lengths.sum() if lengths.sum() > 0 else np.full(k, 1.0 / k)
    weights = (1.0 - equal_mix) * share + equal_mix / k
    n = np.maximum(min_pts, np.round(weights * total).astype(int))
    while n.sum() > total:                 # bớt ở nét đang nhiều điểm nhất
        n[np.argmax(np.where(n > min_pts, n, -1))] -= 1
    while n.sum() < total:                 # thêm vào nét đang bị thiếu nhiều nhất
        n[np.argmax(weights * total - n)] += 1
    return n


def strokes_to_points(
    strokes_xy: list[np.ndarray],
    seq_len: int = config.SEQ_LEN,
    min_pts: int = config.MIN_PTS_PER_STROKE,
    equal_mix: float = config.STROKE_EQUAL_MIX,
) -> tuple[np.ndarray, np.ndarray]:
    """Danh sách nét (đã chuẩn hóa theo canvas) -> (P, S).

    P: (seq_len, 2) tọa độ, các nét nối tiếp nhau theo ĐÚNG thứ tự và hướng viết.
    S: (seq_len,)   =1 tại điểm đầu của mỗi nét (cờ nhấc bút), còn lại =0.
    """
    strokes_xy = [s for s in strokes_xy if len(s)]
    lengths = [stroke_length(s) for s in strokes_xy]
    counts = allocate_points(lengths, seq_len, min_pts, equal_mix)
    pts, flags = [], []
    for s, k in zip(strokes_xy, counts):
        pts.append(resample_stroke(s, int(k)))
        f = np.zeros(int(k), dtype=np.float32)
        f[0] = 1.0
        flags.append(f)
    return np.concatenate(pts).astype(np.float32), np.concatenate(flags)