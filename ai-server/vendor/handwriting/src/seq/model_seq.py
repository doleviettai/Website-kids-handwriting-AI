"""CNN + BiGRU + CTC cho chuỗi nét (từ / dòng)."""
from __future__ import annotations

import keras
import tensorflow as tf
from keras import layers, ops

from src.seq import config_seq as cfg
from src.seq.features_seq import N_FEATURES


@keras.saving.register_keras_serializable(package="hw_seq")
class DownsampledMask(layers.Layer):
    """Tạo mask (B, T') cho các frame thật sau khi CNN đã giảm độ dài chuỗi `factor` lần."""

    def __init__(self, factor: int = 2, **kwargs):
        super().__init__(**kwargs)
        self.factor = factor

    def call(self, inputs):
        lengths, x = inputs
        t = ops.shape(x)[1]
        out_len = (ops.cast(lengths, "int32") + (self.factor - 1)) // self.factor
        return ops.arange(t, dtype="int32")[None, :] < out_len[:, None]

    def compute_output_shape(self, input_shape):
        return (input_shape[1][0], input_shape[1][1])

    def get_config(self):
        config = super().get_config()
        config["factor"] = self.factor
        return config


@keras.saving.register_keras_serializable(package="hw_seq")
class ApplySequenceMask(layers.Layer):
    """Đưa padding về 0 sau normalization và mỗi CNN, trước khi nó lan vào frame thật."""

    def __init__(self, factor: int = 1, **kwargs):
        super().__init__(**kwargs)
        self.factor = factor

    def call(self, inputs):
        x, lengths = inputs
        valid_lengths = (ops.cast(lengths, "int32") + self.factor - 1) // self.factor
        mask = ops.arange(ops.shape(x)[1])[None, :] < valid_lengths[:, None]
        return ops.where(mask[..., None], x, ops.zeros_like(x))

    def compute_output_shape(self, input_shape):
        return input_shape[0]

    def get_config(self):
        return {**super().get_config(), "factor": self.factor}



def build_seq_model(feat_mean, feat_var, units: int = 128, dropout: float = 0.25) -> keras.Model:
    feats = keras.Input((None, N_FEATURES), name="features")
    lens = keras.Input((), dtype="int32", name="lengths")

    x = layers.Normalization(axis=-1, mean=feat_mean, variance=feat_var, name="feature_norm")(feats)
    x = ApplySequenceMask(name="mask_normalized")([x, lens])
    x = layers.Conv1D(64, 5, padding="same", activation="relu")(x)
    x = layers.LayerNormalization()(x)
    x = ApplySequenceMask(name="mask_conv1")([x, lens])
    # Padding cố định: SAME + stride=2 đổi căn chỉnh khi độ dài batch chẵn/lẻ khác nhau.
    x = layers.ZeroPadding1D(2)(x)
    x = layers.Conv1D(96, 5, strides=cfg.DOWNSAMPLE, padding="valid", activation="relu")(x)
    x = layers.LayerNormalization()(x)
    x = ApplySequenceMask(cfg.DOWNSAMPLE, name="mask_conv2")([x, lens])
    mask = DownsampledMask(cfg.DOWNSAMPLE)([lens, x])

    for _ in range(2):
        x = layers.Bidirectional(layers.GRU(units, return_sequences=True))(x, mask=mask)
        x = layers.Dropout(dropout)(x)
    logits = layers.Dense(cfg.N_CLASSES, name="logits")(x)          # (B, T', số ký tự + blank)
    return keras.Model([feats, lens], logits, name="seq_ctc")


def output_lengths(lengths):
    return (tf.cast(lengths, tf.int32) + cfg.DOWNSAMPLE - 1) // cfg.DOWNSAMPLE


def ctc_loss(logits, lengths, labels, label_lengths):
    """Loss CTC từng mẫu (blank = 0)."""
    return tf.nn.ctc_loss(
        labels=labels, logits=tf.cast(logits, tf.float32),
        label_length=label_lengths, logit_length=output_lengths(lengths),
        logits_time_major=False, blank_index=0,
    )
