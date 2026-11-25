"""70/15/15 làm tròn theo tổng mẫu; không cắt người/style để đạt tỷ lệ."""
from __future__ import annotations

import numpy as np
from sklearn.model_selection import train_test_split

NAMES = ("train", "validation", "test")
RATIOS = np.array([0.70, 0.15, 0.15])


def quotas(total):
    ideal = total * RATIOS
    counts = np.floor(ideal).astype(int)
    order = np.argsort(-(ideal - counts), kind="stable")
    counts[order[:total - counts.sum()]] += 1
    return counts


def grouped_split(groups, seed=42, time_limit=30, categories=None):
    """Tìm phép chia nguyên nhóm đạt chính xác quota nguyên bằng MILP."""
    from scipy.optimize import Bounds, LinearConstraint, milp
    from scipy.sparse import lil_matrix
    groups = np.asarray(groups, dtype=str)
    unique, inverse, counts = np.unique(groups, return_inverse=True, return_counts=True)
    n = len(unique)
    if n < 3:
        raise ValueError("Cần ít nhất ba nhóm người/style")
    target = quotas(len(groups))
    category_names = sorted(set(categories)) if categories is not None else []
    matrix = lil_matrix((n + 3 + len(category_names) * 3, n * 3), dtype=float)
    for i in range(n):
        matrix[i, i * 3:i * 3 + 3] = 1
        for split in range(3):
            matrix[n + split, i * 3 + split] = counts[i]
    rhs = np.r_[np.ones(n), target, np.ones(len(category_names) * 3)]
    upper = np.r_[np.ones(n), target, np.full(len(category_names) * 3, np.inf)]
    if categories is not None:
        categories = np.asarray(categories)
        for k, category in enumerate(category_names):
            group_counts = np.bincount(inverse[categories == category], minlength=n)
            for i in range(n):
                for split in range(3):
                    matrix[n + 3 + k * 3 + split, i * 3 + split] = group_counts[i]
    result = milp(c=np.random.default_rng(seed).uniform(0, 1, n * 3),
                  integrality=np.ones(n * 3), bounds=Bounds(0, 1),
                  constraints=LinearConstraint(matrix.tocsr(), rhs, upper),
                  options={"time_limit": time_limit, "mip_rel_gap": 1.0})
    if result.x is None:
        raise ValueError(f"Chưa tìm được 70/15/15 nguyên nhóm sau {time_limit}s; không tự chia nhỏ người/style. {result.message}")
    assignment = result.x.reshape(n, 3).argmax(1)[inverse]
    actual = np.bincount(assignment, minlength=3)
    if not np.array_equal(actual, target):
        raise ValueError(f"Solver chưa có nghiệm nguyên đúng quota: {actual} != {target}")
    return np.asarray(NAMES)[assignment]


def stratified_split(labels, duplicate_groups=None, seed=42):
    """Chữ đơn một người: stratify theo nhãn, giữ bản sao trùng hoàn toàn trong train."""
    labels = np.asarray(labels)
    target = quotas(len(labels))
    reserved = np.zeros(len(labels), bool)
    if duplicate_groups is not None:
        _, inverse, counts = np.unique(duplicate_groups, return_inverse=True, return_counts=True)
        reserved = counts[inverse] > 1
    available = np.flatnonzero(~reserved)
    train_n = int(target[0] - reserved.sum())
    first, holdout = train_test_split(available, train_size=train_n, stratify=labels[available], random_state=seed)
    val, test = train_test_split(holdout, train_size=int(target[1]), stratify=labels[holdout], random_state=seed + 1)
    result = np.full(len(labels), "train", dtype="U10")
    result[val], result[test] = "validation", "test"
    assert np.array_equal(np.array([(result == s).sum() for s in NAMES]), target)
    assert set(labels[first]) | set(labels[reserved]) == set(labels)
    return result


def describe(split):
    n = len(split)
    return {name: {"n": int(np.sum(split == name)), "percent": float(100 * np.sum(split == name) / n)} for name in NAMES}
