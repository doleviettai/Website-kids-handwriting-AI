"""Các hàm đánh giá thuần numpy."""
import numpy as np


def topk_accuracy(probs, y, k=3):
    topk = np.argsort(-probs, axis=1)[:, :k]
    return float(np.mean([y[i] in topk[i] for i in range(len(y))]))


def confusion_matrix(y, pred, n):
    cm = np.zeros((n, n), dtype=np.int32)
    for t, p in zip(y, pred):
        cm[t, p] += 1
    return cm


def per_class_accuracy(cm):
    tot = cm.sum(1)
    return np.where(tot > 0, np.diag(cm) / np.maximum(tot, 1), np.nan)


def top_confusions(cm, classes, k=20):
    pairs = []
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            if i != j and cm[i, j] > 0:
                pairs.append((int(cm[i, j]), classes[i], classes[j]))
    pairs.sort(reverse=True)
    return [{"true": a, "pred": b, "count": c} for c, a, b in pairs[:k]]


def group_accuracy(y, pred, groups):
    out = {}
    for g in sorted(set(groups)):
        idx = [i for i, x in enumerate(groups) if x == g]
        out[g] = {
            "n": len(idx),
            "accuracy": float(np.mean([y[i] == pred[i] for i in idx])),
        }
    return out