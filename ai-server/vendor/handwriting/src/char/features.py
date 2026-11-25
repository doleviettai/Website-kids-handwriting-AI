"""Giữ hướng trong nét; đặc trưng hình học phân biệt thân cao, vòng và hướng nét."""
import numpy as np
import tensorflow as tf


def deep_features(P, S):
    P, S = tf.cast(P, tf.float32), tf.cast(S, tf.float32)
    mn, mx = tf.reduce_min(P, 1, keepdims=True), tf.reduce_max(P, 1, keepdims=True)
    size = tf.maximum(tf.reduce_max(mx - mn, -1, keepdims=True), 1e-3)
    local = (P - (mn + mx) / 2) / size
    d = tf.concat([tf.zeros_like(local[:, :1]), local[:, 1:] - local[:, :-1]], axis=1)
    d *= (1 - S[..., None])  # nhấc bút không phải nét nối giữa a và thân chữ d
    return tf.concat([P, local, d, S[..., None]], axis=-1)


def geometry_features(P, S):
    """Histogram hướng theo ô và phân bố nét; không vẽ đường nối qua chỗ nhấc bút."""
    results = []
    for points, starts in zip(np.asarray(P), np.asarray(S)):
        mn, mx = points.min(0), points.max(0)
        extent = np.maximum(mx - mn, 1e-4)
        scale = max(float(extent.max()), 1e-3)
        loc = (points - (mn + mx) / 2) / scale + 0.5
        delta = np.diff(loc, axis=0)
        valid = starts[1:] < 0.5
        delta, mids = delta[valid], ((loc[:-1] + loc[1:]) / 2)[valid]
        lengths = np.linalg.norm(delta, axis=1)
        hist = np.zeros((4, 4, 8), dtype=np.float32)
        if len(delta):
            grid = np.clip((mids * 4).astype(int), 0, 3)
            angle = ((np.arctan2(delta[:, 1], delta[:, 0]) + np.pi) / (2 * np.pi) * 8).astype(int) % 8
            np.add.at(hist, (grid[:, 1], grid[:, 0], angle), lengths)
        hist /= max(float(hist.sum()), 1e-6)
        grid = np.clip((loc * 8).astype(int), 0, 7)
        density = np.zeros((8, 8), np.float32)
        np.add.at(density, (grid[:, 1], grid[:, 0]), 1)
        density /= len(points)
        # Baseline / kích thước trên canvas cũng hữu ích cho chữ hoa và thân vươn cao.
        extra = np.r_[mn, mx, extent, extent[0] / extent[1], starts.sum() / 10,
                      loc[0], loc[-1], loc[starts > 0.5].mean(0), lengths.sum()]
        results.append(np.r_[hist.ravel(), density.ravel(), extra])
    return np.asarray(results, dtype=np.float32)
