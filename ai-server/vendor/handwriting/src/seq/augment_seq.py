"""Augmentation hình học cho chuỗi nét (chỉ dùng cho tập train)."""
import math

import tensorflow as tf

from src.seq import config_seq as cfg


def augment_xy(xy, lengths):
    """xy: (B,T,2) đã đệm; xoay nhẹ, nghiêng, co giãn ngang/dọc, thêm nhiễu. Mỗi mẫu một bộ tham số riêng."""
    xy = tf.cast(xy, tf.float32)
    B = tf.shape(xy)[0]
    mask = tf.cast(tf.sequence_mask(lengths, maxlen=tf.shape(xy)[1]), tf.float32)[..., tf.newaxis]
    n = tf.maximum(tf.reduce_sum(mask, axis=1, keepdims=True), 1.0)
    center = tf.reduce_sum(xy * mask, axis=1, keepdims=True) / n
    X = (xy - center) * mask

    rot = tf.random.uniform([B], -cfg.AUG_ROTATION_DEG, cfg.AUG_ROTATION_DEG) * math.pi / 180.0
    sx = tf.random.uniform([B], 1.0 - cfg.AUG_SCALE_X, 1.0 + cfg.AUG_SCALE_X)
    sy = tf.random.uniform([B], 1.0 - cfg.AUG_SCALE_Y, 1.0 + cfg.AUG_SCALE_Y)
    shear = tf.random.uniform([B], -cfg.AUG_SHEAR, cfg.AUG_SHEAR)

    c, s = tf.cos(rot), tf.sin(rot)
    one, zero = tf.ones_like(c), tf.zeros_like(c)
    R = tf.stack([tf.stack([c, -s], -1), tf.stack([s, c], -1)], -2)
    Sh = tf.stack([tf.stack([one, shear], -1), tf.stack([zero, one], -1)], -2)
    Sc = tf.linalg.diag(tf.stack([sx, sy], -1))
    A = tf.matmul(tf.matmul(R, Sh), Sc)

    X = tf.einsum("bij,btj->bti", A, X)
    noise = tf.random.normal(tf.shape(X), stddev=cfg.AUG_JITTER)
    return (X + center + noise) * mask