import keras
from keras import layers, ops

from src.labels import BASES, MODIFIERS, TONES


@keras.saving.register_keras_serializable(package="hw_char")
class ShapeSummary(layers.Layer):
    def call(self, x):
        xy = x[..., :2]
        local = x[..., 2:4]
        mn, mx = ops.min(xy, axis=1), ops.max(xy, axis=1)
        upper = ops.cast(local[..., 1] < -0.2, x.dtype)
        return ops.concatenate([mn, mx, mx - mn, xy[:, 0], xy[:, -1],
                                ops.mean(upper, axis=1, keepdims=True),
                                ops.sum(x[..., 6:7], axis=1) / 10], axis=-1)

    def compute_output_shape(self, shape):
        return (shape[0], 12)


def build_model(seq_len, mean, variance, dropout=0.35):
    inp = keras.Input((seq_len, 7), name="strokes")
    x = layers.Normalization(mean=mean, variance=variance, name="feature_norm")(inp)
    x = layers.Conv1D(64, 5, padding="same", activation="relu", name="char_conv1")(x)
    x = layers.BatchNormalization(name="char_bn1")(x)
    x = layers.Conv1D(96, 3, padding="same", activation="relu", name="char_conv2")(x)
    x = layers.BatchNormalization(name="char_bn2")(x)
    x = layers.SpatialDropout1D(0.15)(x)
    x = layers.Bidirectional(layers.GRU(96, return_sequences=True), name="char_gru1")(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Bidirectional(layers.GRU(64, return_sequences=True), name="char_gru2")(x)
    pooled = layers.Concatenate()([layers.GlobalAveragePooling1D()(x), layers.GlobalMaxPooling1D()(x),
                                  ShapeSummary(name="shape_summary")(inp)])
    h = layers.Dense(128, activation="relu", name="char_dense")(pooled)
    h = layers.Dropout(dropout)(h)
    outputs = {name: layers.Dense(len(classes), activation="softmax", name=name)(h)
               for name, classes in (("base", BASES), ("modifier", MODIFIERS), ("tone", TONES))}
    return keras.Model(inp, outputs, name="char_stable_v2")


def initialize_encoder(model, source):
    """Chuyển phần tương thích, thêm 12 đặc trưng hình dạng với trọng số ban đầu bằng 0."""
    types = (layers.Conv1D, layers.BatchNormalization, layers.Bidirectional)
    old = [l for l in source.layers if isinstance(l, types)]
    new = [l for l in model.layers if isinstance(l, types)]
    if len(old) != len(new):
        raise ValueError("Encoder model nguồn không tương thích")
    for a, b in zip(old, new):
        b.set_weights(a.get_weights())
    old_dense = [layer for layer in source.layers if isinstance(layer, layers.Dense) and layer.units == 128]
    if len(old_dense) != 1:
        raise ValueError("Không tìm thấy dense encoder 128 chiều của baseline")
    kernel, bias = old_dense[0].get_weights()
    target = model.get_layer("char_dense")
    expanded, _ = target.get_weights()
    if expanded.shape[0] != kernel.shape[0] + 12:
        raise ValueError("Kích thước nhánh hình dạng không khớp")
    import numpy as np
    expanded = np.zeros_like(expanded)
    expanded[:kernel.shape[0]] = kernel
    target.set_weights([expanded, bias])
    for head in ("base", "modifier", "tone"):
        model.get_layer(head).set_weights(source.get_layer(head).get_weights())
