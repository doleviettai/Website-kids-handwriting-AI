"""Mô hình thống kê ký tự + từ vựng, chỉ học từ nhãn trong tập train."""
from __future__ import annotations

import math
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from src.seq.artifacts_seq import write_json


def fold_marks(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower())
                   if not unicodedata.combining(c)).replace("đ", "d")


class CharacterLanguageModel:
    def __init__(self, counts: dict[str, dict[str, int]], words: dict[str, int], alpha: float = 0.1):
        self.counts = counts
        self.words = words
        self.alpha = alpha
        self.totals = {ctx: sum(row.values()) for ctx, row in counts.items()}
        self.vocab_size = max(len(counts.get("", {})), 1)
        self.by_fold = defaultdict(set)
        self.deletions = defaultdict(set)
        for word in words:
            key = fold_marks(word)
            self.by_fold[key].add(word)
            for i in range(len(key)):
                self.deletions[key[:i] + key[i + 1:]].add(word)

    @classmethod
    def fit(cls, texts):
        counts = defaultdict(Counter)
        words = Counter()
        for text in texts:
            text = unicodedata.normalize("NFC", str(text)).lower().strip()
            words.update(text.split())
            context = "^^"
            for char in text + "$":
                for width in range(3):
                    counts[context[-width:] if width else ""][char] += 1
                context = (context + char)[-2:]
        return cls({ctx: dict(row) for ctx, row in counts.items()}, dict(words))

    @classmethod
    def load(cls, path: Path):
        import json
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(data["counts"], data["words"], data["alpha"])

    def save(self, path: Path):
        write_json(path, {"version": 1, "trained_on": "train", "alpha": self.alpha,
                          "counts": self.counts, "words": self.words})

    def log_probability(self, text: str) -> float:
        text = unicodedata.normalize("NFC", text).lower().strip()
        score, context = 0.0, "^^"
        for char in text + "$":
            p = 1.0 / self.vocab_size
            for width in range(3):
                ctx = context[-width:] if width else ""
                if ctx in self.counts:
                    local = (self.counts[ctx].get(char, 0) + self.alpha) / (
                        self.totals[ctx] + self.alpha * self.vocab_size)
                    p = 0.7 * local + 0.3 * p
            score += math.log(max(p, 1e-30))
            context = (context + char)[-2:]
        return score / (len(text) + 1)

    def nearby_words(self, text: str, limit: int = 6) -> list[str]:
        key = fold_marks(text)
        candidates = set(self.by_fold.get(key, ())) | set(self.deletions.get(key, ()))
        for i in range(len(key)):
            short = key[:i] + key[i + 1:]
            candidates.update(self.by_fold.get(short, ()))
            candidates.update(self.deletions.get(short, ()))
        return sorted(candidates, key=lambda w: (-self.words[w], w))[:limit]
