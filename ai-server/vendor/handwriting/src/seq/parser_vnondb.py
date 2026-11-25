"""Đọc dữ liệu VNOnDB (mức từ / dòng / đoạn) và danh sách chia tập chính thức ICFHR2018.

Mỗi file .inkml là 1 TRANG viết. Trong file:
    <annotationXML> Writer_ID, Age, Gender, SamplingRate ... </annotationXML>
    <traceGroup id="tg_0_0">                       <- 1 từ / 1 dòng / 1 đoạn tùy mức
        <annotationXML><Tg_Truth>Bản</Tg_Truth></annotationXML>
        <trace id="..."> x y ,x y ,x y ... </trace>   <- mỗi <trace> là 1 nét
"""
from __future__ import annotations

import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from src.seq import config_seq as cfg


@dataclass
class Unit:
    group_id: str
    text: str                    # nhãn đã chuẩn hóa NFC
    strokes: list[np.ndarray]    # mỗi nét: (n, 2) tọa độ gốc của thiết bị


def _local(tag) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def read_split(split: str) -> list[str]:
    """split: 'train' | 'validation' | 'test'. File .txt có thể dùng CRLF nên dùng split() thay vì split('\\n')."""
    path = cfg.SPLIT_DIR / f"{split}_set.txt"
    if not path.exists():
        raise SystemExit(f"Không thấy {path}\nKiểm tra lại đường dẫn VNONDB_DIR trong src/seq/config_seq.py")
    return path.read_text(encoding="utf-8-sig").split()


def _parse_points(text: str) -> np.ndarray:
    """'x y ,x y ,x y' hoặc 'x y, x y' -> mảng (n, 2). Bỏ cột thứ 3 (áp lực) nếu có."""
    text = (text or "").strip()
    if not text:
        return np.zeros((0, 2))
    n_points = text.count(",") + 1
    chunks = text.replace(",", " ").split()
    k = len(text.split(",", 1)[0].split())
    if k >= 2 and len(chunks) == n_points * k:               # trường hợp thường gặp: mọi điểm cùng số cột
        return np.asarray(chunks, dtype=np.float64).reshape(n_points, k)[:, :2]
    rows = []                                                # dự phòng: điểm có số cột khác nhau
    for p in text.split(","):
        v = p.split()
        if len(v) >= 2:
            rows.append((float(v[0]), float(v[1])))
    return np.asarray(rows, dtype=np.float64).reshape(-1, 2)


def parse_page(path: str | Path) -> tuple[dict, list[Unit]]:
    root = ET.parse(path).getroot()
    meta: dict = {}
    units: list[Unit] = []
    for child in root:
        name = _local(child.tag)
        if name == "annotationXML":
            meta = {_local(c.tag): (c.text or "").strip() for c in child}
        elif name == "traceGroup":
            text = ""
            for c in child:
                if _local(c.tag) == "annotationXML":
                    for cc in c:
                        if _local(cc.tag) == "Tg_Truth":
                            text = (cc.text or "").strip()
            strokes = [_parse_points(t.text) for t in child.iter() if _local(t.tag) == "trace"]
            units.append(Unit(child.get("id", ""), unicodedata.normalize("NFC", text), [s for s in strokes if len(s)]))
    return meta, units