"""Cấu hình chung cho toàn bộ pipeline. Sửa số ở đây thay vì sửa rải rác trong code."""
import sys
from pathlib import Path

# Windows: ép console in được tiếng Việt (ắ, ộ, đ...) thay vì báo lỗi mã hóa
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# ---------------------------------------------------------------- đường dẫn
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "dataset" / "raw" / "inkml"      # giải nén ZIP từ web collector vào đây
PROCESSED_DIR = ROOT / "dataset" / "processed"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

# ------------------------------------------------------------- tiền xử lý
SEQ_LEN = 64                # mỗi mẫu được resample về đúng 64 điểm
MAX_STROKES = 10            # mẫu có nhiều nét hơn mức này bị loại (ký tự thường chỉ 1-6 nét)
MIN_POINTS = 8              # tổng số điểm tối thiểu của 1 mẫu
MIN_PTS_PER_STROKE = 3      # mỗi nét được giữ ít nhất 3 điểm sau resample (để nét dấu nhỏ không bị mất)
STROKE_EQUAL_MIX = 0.3      # 0 = chia điểm hoàn toàn theo độ dài nét, 1 = chia đều cho mọi nét.
                            # Giá trị 0.3 giúp nét dấu (ngắn) vẫn có đủ điểm
MAX_DURATION_MS = 15_000    # chỉ cảnh báo (không loại) nếu 1 ký tự viết quá lâu

# ------------------------------------------------------------ chia dữ liệu
SEED = 42
SPLIT_MODE = "auto"         # auto | group | random
MIN_WRITERS_FOR_GROUP_SPLIT = 6   # ít người hơn mức này thì auto sẽ chia ngẫu nhiên (kèm cảnh báo)
VAL_FRAC = 0.15
TEST_FRAC = 0.15

# ------------------------------------------------------------- augmentation (chỉ cho tập train)
AUG_ROTATION_DEG = 10.0     # xoay ngẫu nhiên +- độ
AUG_SCALE = 0.08            # co giãn mỗi trục ngẫu nhiên +- 8%
AUG_SHEAR = 0.10            # nghiêng chữ
AUG_SHIFT = 0.04            # dịch chuyển (theo tỉ lệ canvas)
AUG_JITTER = 0.004          # nhiễu từng điểm (theo tỉ lệ canvas)

# ---------------------------------------------------------------- huấn luyện
BATCH_SIZE = 64
EPOCHS = 150
LEARNING_RATE = 1e-3
EARLY_STOP_PATIENCE = 20
LR_PLATEAU_PATIENCE = 8
USE_CLASS_WEIGHTS = True    # bù cho lớp ít mẫu (xem train.py)
LOSS_WEIGHTS = {"base": 1.0, "modifier": 0.6, "tone": 0.6}