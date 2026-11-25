"""CNN ảnh + nhánh hình học hướng nét; chuyển trọng số tương thích từ model cũ."""
import numpy as np
from .config_ghep import IMG_H, IMG_W


def build_model(num_classes, lr=0.0001, mean=None, variance=None, dropout=0.35, weight_decay=1e-4,
                robust_geometry=False):
    from tensorflow import keras
    from tensorflow.keras import layers
    from .features_ghep import N_GEOMETRY
    image = keras.Input((IMG_H, IMG_W, 1), name="image")
    x = image
    for block, filters in enumerate((16, 32, 64, 96)):
        for index in range(2):
            x = layers.Conv2D(filters, 3, padding="same", use_bias=False, name=f"conv_{block}_{index}")(x)
            x = layers.GroupNormalization(groups=4, name=f"norm_{block}_{index}")(x)
            x = layers.ReLU()(x)
        x = layers.MaxPooling2D()(x)
    x = layers.Flatten()(x)
    x = layers.Dropout(dropout)(x)
    inputs = image
    if mean is not None:
        geometry = keras.Input((N_GEOMETRY,), name="geometry")
        g = layers.Normalization(mean=mean, variance=variance, name="geometry_norm")(geometry)
        if robust_geometry:
            g = layers.Activation("tanh", name="geometry_bound")(g)
        g = layers.Dense(32, activation="relu", name="geometry_dense")(g)
        g = layers.Dropout(dropout)(g)
        x = layers.Concatenate()([x, g])
        inputs = {"image": image, "geometry": geometry}
    x = layers.Dense(256, activation="relu", name="classifier_dense")(x)
    x = layers.Dropout(dropout)(x)
    output = layers.Dense(num_classes, activation="softmax", name="classes")(x)
    model = keras.Model(inputs, output, name="ghep_image_geometry_v2")
    compile_model(model, lr, weight_decay)
    return model


def compile_model(model, lr, weight_decay=1e-4):
    from tensorflow import keras
    optimizer = keras.optimizers.AdamW(lr, weight_decay=weight_decay, global_clipnorm=5)
    optimizer.exclude_from_weight_decay(var_names=["bias", "beta", "gamma"])
    model.compile(optimizer=optimizer, loss="sparse_categorical_crossentropy",
                  metrics=["accuracy", keras.metrics.SparseTopKCategoricalAccuracy(min(3, model.output_shape[-1]), name="top3")])


def initialize(model, source):
    from tensorflow.keras import layers
    image_types = (layers.Conv2D, layers.GroupNormalization)
    old = [l for l in source.layers if isinstance(l, image_types)]
    new = [l for l in model.layers if isinstance(l, image_types)]
    if len(old) != len(new):
        raise ValueError("CNN nguồn không tương thích")
    for a, b in zip(old, new):
        b.set_weights(a.get_weights())
    dense = [l for l in source.layers if isinstance(l, layers.Dense)]
    kernel, bias = dense[-2].get_weights()
    target = model.get_layer("classifier_dense")
    expanded, _ = target.get_weights()
    image_width = model.get_layer("classifier_dense").input.shape[-1] - (32 if len(model.inputs) == 2 else 0)
    if kernel.shape[0] not in (image_width, image_width + 32):
        raise ValueError("Nhánh phân loại nguồn không tương thích")
    expanded = np.zeros_like(expanded)
    expanded[:image_width] = kernel[:image_width]
    names = {l.name for l in source.layers}
    if 'geometry_bound' in names and 'geometry_bound' in {l.name for l in model.layers}:
        old_norm, new_norm = source.get_layer('geometry_norm'), model.get_layer('geometry_norm')
        if np.allclose(np.asarray(old_norm.mean), np.asarray(new_norm.mean)) and np.allclose(np.asarray(old_norm.variance), np.asarray(new_norm.variance)):
            model.get_layer('geometry_dense').set_weights(source.get_layer('geometry_dense').get_weights())
            expanded[:] = kernel
    target.set_weights([expanded, bias])
    model.get_layer("classes").set_weights(dense[-1].get_weights())
