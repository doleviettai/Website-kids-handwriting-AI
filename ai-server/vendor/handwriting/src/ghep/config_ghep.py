"""Đường dẫn và hằng số dùng chung cho pipeline chữ ghép."""
from pathlib import Path

# .../HandWriting/src/ghep/config_ghep.py -> ROOT = .../HandWriting
ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "dataset" / "raw" / "inkml_ghep"
PROC_DIR = ROOT / "dataset" / "processed_ghep"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

# Kích thước ảnh đầu vào của model (cao x rộng). Chữ ghép có dạng ngang nên dùng ảnh rộng.
IMG_H, IMG_W = 64, 192

# Tên split đúng như thẻ <Dataset_Split> trong file inkml
SPLITS = ("train", "validation", "test")


def run_dirs(run_name: str):
    if not run_name or run_name in (".", "..", "seq") or any(c in run_name for c in '/\\:'):
        raise ValueError("run-name phải là tên thư mục đơn, ví dụ ghep_stable")
    return MODELS_DIR / run_name, REPORTS_DIR / run_name
