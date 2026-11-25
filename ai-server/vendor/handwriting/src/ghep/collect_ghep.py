"""Lưu mẫu do người dùng chủ động sửa nhãn; chỉ bổ sung train cho run mới."""
from datetime import datetime, timezone
from pathlib import Path
import unicodedata
import uuid
import xml.etree.ElementTree as ET

from src.char.common import atomic_file
from .config_ghep import RAW_DIR
from .data_ghep import validate_strokes


def save_correction(strokes, truth, writer, classes, raw_dir=None):
    if not isinstance(truth, str) or not isinstance(writer, str):
        raise ValueError("Nhãn và mã người viết phải là chuỗi")
    truth = unicodedata.normalize("NFC", truth.strip())
    writer = unicodedata.normalize("NFC", writer.strip())
    if truth not in classes:
        raise ValueError("Chọn nhãn đúng trong danh sách chữ ghép model đã biết")
    if not writer or len(writer) > 80 or any(ord(c) < 32 for c in writer):
        raise ValueError("Nhập mã người viết (1–80 ký tự), dùng cùng mã cho cùng một người")
    strokes = validate_strokes(strokes)
    root = ET.Element("ink")
    meta = ET.SubElement(root, "annotationXML")
    for name, value in {"Data_Source": "human", "Writer_ID": writer, "Dataset_Split": "train",
                        "Template_Family": "browser_correction", "Point_Format": "x y",
                        "Collected_At": datetime.now(timezone.utc).isoformat()}.items():
        ET.SubElement(meta, name).text = value
    group = ET.SubElement(root, "traceGroup", id="tg_0")
    annotation = ET.SubElement(group, "annotationXML")
    ET.SubElement(annotation, "Tg_Truth").text = truth
    for i, stroke in enumerate(strokes):
        ET.SubElement(group, "trace", id=f"tr_{i}").text = ",".join(f"{x:.6f} {y:.6f}" for x, y in stroke)
    folder = Path(raw_dir or RAW_DIR) / "browser_corrections"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}.inkml"
    with atomic_file(path) as temp:
        ET.ElementTree(root).write(temp, encoding="utf-8", xml_declaration=True)
    return {"saved": True, "file": path.name, "truth": truth,
            "message": "Đã lưu mẫu có nhãn để train run mới. Model đang mở chưa học mẫu này."}
