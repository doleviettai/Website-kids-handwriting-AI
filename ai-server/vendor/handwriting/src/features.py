"""Từ điểm đã resample -> đặc trưng đưa vào model (cài bằng TensorFlow để dùng được trong tf.data)."""
import tensorflow as tf


def points_to_features(P, S):
    """P: (B,T,2) tọa độ theo canvas [0,1];  S: (B,T) cờ đầu nét  ->  (B,T,7)

    7 đặc trưng mỗi điểm:
      x_abs, y_abs   vị trí tuyệt đối trên canvas (giữ kích thước/vị trí -> phân biệt chữ hoa/thường)
      x_loc, y_loc   hình dạng đã căn giữa + co về cùng cỡ, giữ tỉ lệ ngang/dọc (không phụ thuộc kích thước)
      dx, dy         bước di chuyển giữa 2 điểm liên tiếp (hướng viết)
      stroke_start   =1 tại điểm đầu của mỗi nét (cờ nhấc bút)
    """
    P = tf.cast(P, tf.float32)
    S = tf.cast(S, tf.float32)
    mn = tf.reduce_min(P, axis=1, keepdims=True)
    mx = tf.reduce_max(P, axis=1, keepdims=True)
    center = (mn + mx) / 2.0
    extent = tf.maximum(tf.reduce_max(mx - mn, axis=-1, keepdims=True), 1e-3)
    loc = (P - center) / extent
    d = loc[:, 1:, :] - loc[:, :-1, :]
    d = tf.concat([tf.zeros_like(loc[:, :1, :]), d], axis=1)
    return tf.concat([P, loc, d, S[..., tf.newaxis]], axis=-1)