"""Đọc file .inkml do web collector tạo ra (schema kiểu VNOnDB), và kiểm tra chất lượng từng mẫu.

Cấu trúc 1 file:
    <ink>
      <annotationXML> Writer_ID, Age, Canvas_Width, ... </annotationXML>
      <traceGroup id="tg_0">
        <annotationXML> Tg_Truth, Base, Modifier, Tone </annotationXML>
        <trace id="tr_0_0">x y t ,x y t ,...</trace>     # mỗi <trace> là 1 nét
      </traceGroup>
    </ink>

Parser này cũng đọc được các file thu bằng bản collector cũ (kiểu <annotation type="...">).
"""
from __future__ import annotations

import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

import numpy as np

from src import config
from src.labels import BASE_TO_IDX, decompose_char


class InkParseError(Exception):
    """File không đọc được hoặc không phải mẫu 1 ký tự."""


@dataclass
class InkSample:
    path: str
    truth: str                      # ký tự đầy đủ, ví dụ "ắ"
    writer_id: str
    canvas_w: float | None
    canvas_h: float | None
    strokes: list[np.ndarray]       # mỗi nét: mảng (n, 4) với các cột [x, y, t, pressure] (thiếu thì NaN)
    meta: dict = field(default_factory=dict)
    ann_labels: dict = field(default_factory=dict)   # Base/Modifier/Tone ghi trong file (nếu có)

    # ---- thuộc tính tiện dụng ----
    @property
    def n_strokes(self) -> int:
        return len(self.strokes)

    @property
    def n_points(self) -> int:
        return int(sum(len(s) for s in self.strokes))

    @property
    def duration_ms(self) -> float:
        ts = [s[:, 2] for s in self.strokes if len(s)]
        if not ts:
            return 0.0
        t = np.concatenate(ts)
        t = t[~np.isnan(t)]
        return float(t.max() - t.min()) if len(t) else 0.0


def _local(tag) -> str:
    """Bỏ namespace: '{http://...}ink' -> 'ink'."""
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _text(el) -> str:
    return (el.text or "").strip()


def _collect_meta(parent) -> dict:
    """Gom metadata từ <annotationXML><Tag>..</Tag></annotationXML> và <annotation type="x">..</annotation>."""
    out: dict = {}
    for child in parent:
        name = _local(child.tag)
        if name == "annotationXML":
            for c in child:
                out[_local(c.tag)] = _text(c)
        elif name == "annotation" and child.get("type"):
            out.setdefault(child.get("type"), _text(child))
    return out


def _parse_trace(text: str) -> np.ndarray:
    rows = []
    for chunk in (text or "").split(","):
        parts = chunk.split()
        if len(parts) < 2:
            continue
        try:
            nums = [float(p) for p in parts[:4]]
        except ValueError:
            continue
        nums += [np.nan] * (4 - len(nums))
        rows.append(nums)
    return np.asarray(rows, dtype=np.float64).reshape(-1, 4)


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_inkml(path: str | Path) -> InkSample:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        raise InkParseError(f"XML lỗi: {e}") from e

    file_meta = _collect_meta(root)
    groups = [c for c in root if _local(c.tag) == "traceGroup"]
    if len(groups) == 0:
        raise InkParseError("không có <traceGroup>")
    if len(groups) > 1:
        raise InkParseError(f"có {len(groups)} traceGroup (giống dữ liệu theo dòng kiểu VNOnDB, không phải 1 ký tự)")

    g = groups[0]
    g_meta = _collect_meta(g)
    truth = unicodedata.normalize("NFC", g_meta.get("Tg_Truth") or g_meta.get("truth") or file_meta.get("label", ""))
    strokes = [_parse_trace(t.text) for t in g.iter() if _local(t.tag) == "trace"]
    strokes = [s for s in strokes if len(s) > 0]

    canvas_w = _to_float(file_meta.get("Canvas_Width") or file_meta.get("canvasWidth"))
    canvas_h = _to_float(file_meta.get("Canvas_Height") or file_meta.get("canvasHeight"))
    writer = file_meta.get("Writer_ID") or file_meta.get("writerID") or "unknown"

    ann = {
        "base": g_meta.get("Base") or file_meta.get("base"),
        "modifier": g_meta.get("Modifier") or file_meta.get("modifier"),
        "tone": g_meta.get("Tone") or file_meta.get("tone"),
    }
    return InkSample(
        path=str(path), truth=truth, writer_id=writer, canvas_w=canvas_w, canvas_h=canvas_h,
        strokes=strokes, meta=file_meta, ann_labels=ann,
    )


def iter_inkml_files(raw_dir: str | Path) -> Iterator[Path]:
    yield from sorted(Path(raw_dir).rglob("*.inkml"))


def path_length(xy: np.ndarray) -> float:
    if len(xy) < 2:
        return 0.0
    return float(np.sqrt(((xy[1:] - xy[:-1]) ** 2).sum(axis=1)).sum())


def check_sample(s: InkSample) -> tuple[list[str], list[str]]:
    """Trả về (lý do loại bỏ, cảnh báo). Mẫu có lý do loại bỏ sẽ không được đưa vào train."""
    hard: list[str] = []
    soft: list[str] = []

    if len(s.truth) != 1:
        hard.append("bad_truth")
        base = modifier = tone = None
    else:
        base, modifier, tone = decompose_char(s.truth)
        if base not in BASE_TO_IDX:
            hard.append("unknown_base")
        for key, val in (("base", base), ("modifier", modifier), ("tone", tone)):
            ann = s.ann_labels.get(key)
            if ann and ann != val:
                soft.append("label_mismatch")   # nhãn ghi trong file khác nhãn suy ra từ Tg_Truth (ta tin Tg_Truth)
                break

    if s.n_strokes == 0:
        hard.append("no_strokes")
    else:
        if s.n_points < config.MIN_POINTS:
            hard.append("too_few_points")
        if s.n_strokes > config.MAX_STROKES:
            hard.append("too_many_strokes")
        if sum(path_length(st[:, :2]) for st in s.strokes) < 1e-6:
            hard.append("zero_length")

    if s.duration_ms > config.MAX_DURATION_MS:
        soft.append("long_duration")
    if not s.canvas_w or not s.canvas_h:
        soft.append("no_canvas_size")
    return hard, soft