"""1D-CNN + BiGRU, 3 đầu ra: base / modifier / tone (dùng chung phần encoder)."""
from __future__ import annotations

import numpy as np
from tensorflow import keras
from tensorflow.keras import layers

from src.labels import BASES, MODIFIERS, TONES


def build_model(seq_len: int, n_features: int, norm_layer: layers.Normalization) -> keras.Model:
    inp = keras.Input((seq_len, n_features), name="strokes")
    x = norm_layer(inp)

    # CNN: bắt đặc trưng cục bộ (đoạn cong, góc, nét thẳng)
    x = layers.Conv1D(64, 5, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(96, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.SpatialDropout1D(0.1)(x)

    # BiGRU: bắt quan hệ theo thời gian / thứ tự nét
    x = layers.Bidirectional(layers.GRU(96, return_sequences=True))(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Bidirectional(layers.GRU(64, return_sequences=True))(x)

    h = layers.Concatenate()([layers.GlobalAveragePooling1D()(x), layers.GlobalMaxPooling1D()(x)])
    h = layers.Dense(128, activation="relu")(h)
    h = layers.Dropout(0.3)(h)

    outputs = {
        "base": layers.Dense(len(BASES), activation="softmax", name="base")(h),
        "modifier": layers.Dense(len(MODIFIERS), activation="softmax", name="modifier")(h),
        "tone": layers.Dense(len(TONES), activation="softmax", name="tone")(h),
    }
    return keras.Model(inp, outputs, name="handwriting_multihead")


def unpack_predictions(pred) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """model.predict có thể trả về dict hoặc list tùy phiên bản Keras -> luôn trả (base, modifier, tone)."""
    if isinstance(pred, dict):
        return pred["base"], pred["modifier"], pred["tone"]
    return pred[0], pred[1], pred[2]