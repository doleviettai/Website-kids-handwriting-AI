"""Giải mã CTC nhất quán: blank=0, điểm thật của chuỗi và căn chỉnh từng ký tự."""
from __future__ import annotations

import numpy as np
import tensorflow as tf

from src.seq import config_seq as cfg
from src.seq.language_seq import CharacterLanguageModel
from src.seq.metrics_seq import greedy_decode


def beam_candidates(logits, lengths, beam_width: int = 25, top_paths: int = 10):
    # TensorFlow beam decoder dành lớp CUỐI cho blank. Dời cột 0 và đổi ID trở lại.
    logits = tf.convert_to_tensor(logits, dtype=tf.float32)
    shifted = tf.concat([logits[..., 1:], logits[..., :1]], axis=-1)
    paths, _ = tf.nn.ctc_beam_search_decoder(
        tf.transpose(shifted, [1, 0, 2]), tf.cast(lengths, tf.int32),
        beam_width=beam_width, top_paths=min(top_paths, beam_width))
    rows = [set() for _ in range(int(tf.shape(logits)[0]))]
    for path in paths:
        texts = [[] for _ in rows]
        for (batch, _), value in zip(path.indices.numpy(), path.values.numpy()):
            texts[int(batch)].append(cfg.ID_TO_CHAR[int(value) + 1])
        for row, chars in zip(rows, texts):
            row.add("".join(chars))
    for row, greedy in zip(rows, greedy_decode(logits.numpy(), np.asarray(lengths))):
        row.add(greedy)
    return rows


def log_softmax(logits: np.ndarray) -> np.ndarray:
    x = np.asarray(logits, dtype=np.float64)
    x = x - x.max(axis=-1, keepdims=True)
    return x - np.log(np.exp(x).sum(axis=-1, keepdims=True))


def extended_labels(text: str) -> np.ndarray:
    labels = np.zeros(2 * len(text) + 1, dtype=np.int32)
    labels[1::2] = [cfg.CHAR_TO_ID[c] for c in text]
    return labels


def ctc_log_probability(log_probs: np.ndarray, text: str) -> float:
    """Forward CTC, bao gồm mọi căn chỉnh; dùng cùng thang điểm cho mọi ứng viên."""
    if len(log_probs) == 0:
        return 0.0 if not text else -np.inf
    states = extended_labels(text)
    skip = (states != 0) & (states != np.roll(states, 2))
    skip[:2] = False
    prev = np.full(len(states), -np.inf)
    prev[0] = log_probs[0, 0]
    if text:
        prev[1] = log_probs[0, states[1]]
    for frame in log_probs[1:]:
        one = np.full_like(prev, -np.inf)
        one[1:] = prev[:-1]
        two = np.full_like(prev, -np.inf)
        two[2:] = prev[:-2]
        prev = np.logaddexp(np.logaddexp(prev, one), np.where(skip, two, -np.inf)) + frame[states]
    return float(np.logaddexp(prev[-1], prev[-2]) if text else prev[0])


def align_chars(text: str, probs: np.ndarray) -> list[dict]:
    """Viterbi CTC. Không có đường đi hợp lệ -> hỗ trợ 0, không bịa mức tin cậy."""
    result = [{"c": c, "p": 0.0} for c in text]
    if not text or not len(probs):
        return result
    states = extended_labels(text)
    logp = np.full_like(probs, -np.inf, dtype=np.float64)
    np.log(probs, out=logp, where=probs > 0)
    skip = (states != 0) & (states != np.roll(states, 2))
    skip[:2] = False
    prev = np.full(len(states), -np.inf)
    prev[0], prev[1] = logp[0, 0], logp[0, states[1]]
    back = np.zeros((len(probs), len(states)), dtype=np.int8)
    for t in range(1, len(probs)):
        one, two = np.full_like(prev, -np.inf), np.full_like(prev, -np.inf)
        one[1:], two[2:] = prev[:-1], prev[:-2]
        choices = np.stack([prev, one, np.where(skip, two, -np.inf)])
        back[t] = choices.argmax(axis=0)
        prev = choices.max(axis=0) + logp[t, states]
    state = len(states) - (1 if prev[-1] >= prev[-2] else 2)
    if not np.isfinite(prev[state]):
        return result
    frames = [[] for _ in text]
    for t in range(len(probs) - 1, -1, -1):
        if state % 2:
            frames[state // 2].append(float(probs[t, states[state]]))
        state -= int(back[t, state])
    for item, values in zip(result, frames):
        item["p"] = float(np.mean(values)) if values else 0.0
    return result


def decode_batch(logits, lengths, language_model: CharacterLanguageModel | None = None,
                 language_weight: float = 0.5, beam_width: int = 25, top_paths: int = 10):
    """Giữ kết quả nét bút riêng với gợi ý ngôn ngữ; không nhận đáp án bài tập."""
    raw = np.asarray(logits, dtype=np.float32)
    all_candidates = beam_candidates(raw, lengths, beam_width, top_paths)
    decoded = []
    for sample, length, candidates in zip(raw, lengths, all_candidates):
        lp = log_softmax(sample[:int(length)])
        scores = {text: ctc_log_probability(lp, text) for text in candidates}
        visual = sorted(scores, key=lambda s: (-scores[s], s))
        best = visual[0]
        suggestions = set(candidates)
        if language_model is not None:
            for text in visual[:2]:
                for word in language_model.nearby_words(text):
                    candidate = word[:1].upper() + word[1:] if text[:1].isupper() else word
                    if all(c in cfg.CHAR_TO_ID for c in candidate):
                        suggestions.add(candidate)
        for text in suggestions - scores.keys():
            scores[text] = ctc_log_probability(lp, text)
        ranked = sorted(suggestions, key=lambda s: (
            -(scores[s] + (language_weight * language_model.log_probability(s)
                           if language_model is not None else 0.0)), s))
        chars = align_chars(best, np.exp(lp))
        decoded.append({
            "text": best, "chars": chars,
            "confidence": min((c["p"] for c in chars), default=0.0),
            "suggested_text": ranked[0] if ranked[0] != best else "",
            "candidates": [s for s in ranked if s and s != best][:5],
        })
    return decoded
