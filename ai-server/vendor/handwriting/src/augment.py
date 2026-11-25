"""Augmentation hình học trên tọa độ (chỉ áp dụng cho tập train). Không lật ngang/dọc vì sẽ làm nhầm b/d, p/q, 6/9."""
import math

import tensorflow as tf

from src import config


def augment_points(P):
    """P: (B,T,2). Mỗi mẫu trong batch nhận 1 bộ tham số ngẫu nhiên riêng."""
    P = tf.cast(P, tf.float32)
    B = tf.shape(P)[0]
    center = tf.reduce_mean(P, axis=1, keepdims=True)
    X = P - center

    rot = tf.random.uniform([B], -config.AUG_ROTATION_DEG, config.AUG_ROTATION_DEG) * math.pi / 180.0
    sx = tf.random.uniform([B], 1.0 - config.AUG_SCALE, 1.0 + config.AUG_SCALE)
    sy = tf.random.uniform([B], 1.0 - config.AUG_SCALE, 1.0 + config.AUG_SCALE)
    shear = tf.random.uniform([B], -config.AUG_SHEAR, config.AUG_SHEAR)

    c, s = tf.cos(rot), tf.sin(rot)
    one, zero = tf.ones_like(c), tf.zeros_like(c)
    R = tf.stack([tf.stack([c, -s], -1), tf.stack([s, c], -1)], -2)           # (B,2,2) xoay
    Sh = tf.stack([tf.stack([one, shear], -1), tf.stack([zero, one], -1)], -2)  # (B,2,2) nghiêng
    Sc = tf.linalg.diag(tf.stack([sx, sy], -1))                                # (B,2,2) co giãn
    A = tf.matmul(tf.matmul(R, Sh), Sc)

    X = tf.einsum("bij,btj->bti", A, X)
    shift = tf.random.uniform([B, 1, 2], -config.AUG_SHIFT, config.AUG_SHIFT)
    noise = tf.random.normal(tf.shape(X), stddev=config.AUG_JITTER)
    return X + center + shift + noise