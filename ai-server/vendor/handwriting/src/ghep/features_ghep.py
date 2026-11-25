"""Hướng nét theo vị trí + chấm/nét ngắn bên trái giúp phân biệt iê với uê."""
import numpy as np

N_GEOMETRY = 275


def geometry(strokes):
    from .data_ghep import normalize
    from src.stroke_utils import resample_stroke, stroke_length

    strokes = normalize(strokes)
    # Mật độ theo chiều dài cung, tránh phụ thuộc tần số ghi sự kiện chuột/thiết bị.
    sampled = [resample_stroke(s, min(256, max(4, int(stroke_length(s) / 0.01) + 1))) for s in strokes]
    points = np.concatenate(sampled)
    mn, mx = points.min(0), points.max(0)
    extent = np.maximum(mx - mn, 1e-5)
    # Chia theo bbox mỗi trục chỉ để đặt vào ô; giữ aspect ratio trong feature riêng.
    grid_points = (points - mn) / extent
    density, directions = np.zeros((6, 12)), np.zeros((4, 6, 8))
    g = np.clip((grid_points * [12, 6]).astype(int), 0, [11, 5])
    np.add.at(density, (g[:, 1], g[:, 0]), 1)
    density /= len(points)
    total_length = 0.0
    short_features = np.zeros(4)
    for original, s in zip(strokes, sampled):
        delta = np.diff(s, axis=0)
        lengths = np.linalg.norm(delta, axis=1)
        total_length += lengths.sum()
        mids = ((s[1:] + s[:-1]) / 2 - mn) / extent
        cells = np.clip((mids * [6, 4]).astype(int), 0, [5, 3])
        angles = ((np.arctan2(delta[:, 1], delta[:, 0]) + np.pi) * 8 / (2 * np.pi)).astype(int) % 8
        np.add.at(directions, (cells[:, 1], cells[:, 0], angles), lengths)
        if stroke_length(original) < 0.12:
            center = (original.mean(0) - mn) / extent
            short_features[0] += 1
            short_features[1] += center[0] < 0.5
            short_features[2] += center[1] < 0.5
            short_features[3] += (center[0] < 0.5) and (center[1] < 0.5)
    directions /= max(float(directions.sum()), 1e-6)
    extra = np.r_[extent[0] / extent[1], len(strokes) / 10, total_length / 10,
                  (sampled[0][0] - mn) / extent, (sampled[-1][-1] - mn) / extent,
                  short_features / 10]
    # 72 density + 192 directions + 11 geometry = 275.
    return np.r_[density.ravel(), directions.ravel(), extra].astype(np.float32)


def geometry_batch(strokes_list):
    return np.stack([geometry(s) for s in strokes_list])
