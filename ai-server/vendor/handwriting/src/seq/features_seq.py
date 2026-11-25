"""Từ tọa độ đã chuẩn hóa -> đặc trưng cho model (viết bằng TensorFlow để dùng được trong tf.data)."""
import tensorflow as tf

N_FEATURES = 5


def features_from_xy(xy, start, lengths):
    """xy: (B,T,2)  start: (B,T)  lengths: (B,)  ->  (B,T,5)

    5 đặc trưng mỗi điểm: x, y, dx, dy, start (=1 tại điểm đầu của mỗi nét).
    Các vị trí đệm (padding) được đưa về 0.
    """
    xy = tf.cast(xy, tf.float32)
    start = tf.cast(start, tf.float32)
    mask = tf.cast(tf.sequence_mask(lengths, maxlen=tf.shape(xy)[1]), tf.float32)[..., tf.newaxis]
    d = xy[:, 1:, :] - xy[:, :-1, :]
    d = tf.concat([tf.zeros_like(xy[:, :1, :]), d], axis=1)
    return tf.concat([xy * mask, d * mask, start[..., tf.newaxis] * mask], axis=-1)