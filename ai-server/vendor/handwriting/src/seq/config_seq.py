"""Cấu hình cho model 2 (nhận dạng cả từ / cả dòng bằng CTC)."""
from src import config
from src.labels import expected_truths

# ---------------------------------------------------------------- đường dẫn (khớp cấu trúc thư mục của bạn)
VNONDB_DIR = config.ROOT / "dataset" / "raw" / "vnondb" / "VNOnDB_InkData"
SPLIT_DIR = VNONDB_DIR / "VNOnDB_ICFHR2018_dataSplit"
PROCESSED_DIR = config.ROOT / "dataset" / "processed_seq"
MODELS_DIR = config.MODELS_DIR / "seq"
REPORTS_DIR = config.REPORTS_DIR / "seq"

SPLITS = ["train", "validation", "test"]        # tên theo file chia tập chính thức của VNOnDB


def level_dir(level: str):
    """level: 'word' | 'line'  ->  .../InkData_word/InkData_word"""
    return VNONDB_DIR / f"InkData_{level}" / f"InkData_{level}"


# ---------------------------------------------------------------- bộ ký tự CTC
# 196 ký tự (số, chữ Latin, chữ Việt có dấu) + khoảng trắng + dấu câu có trong VNOnDB mức dòng.
# Chỉ số 0 dành cho "blank" của CTC. Ký tự lạ ngoài bộ này (vd 'ƒ' xuất hiện 1 lần) sẽ bị bỏ qua và báo cáo.
PUNCT = list('.,"-:()?/!%&;*')
CHARSET = [" "] + PUNCT + sorted(expected_truths())
CHAR_TO_ID = {c: i + 1 for i, c in enumerate(CHARSET)}
ID_TO_CHAR = {i + 1: c for i, c in enumerate(CHARSET)}
N_CLASSES = len(CHARSET) + 1

# ---------------------------------------------------------------- tham số theo mức
#   step     : khoảng cách giữa 2 điểm sau resample (theo đơn vị chiều cao của từ/dòng)
#   max_t    : số điểm tối đa của 1 mẫu (vượt thì tăng step)
#   batch    : kích thước batch khi train

#   max_label: số ký tự tối đa của nhãn
#   w_floor  : chuẩn hóa chia cho max(chiều cao, w_floor * chiều rộng). Từ: 0.2 (đề phòng từ rất dẹt).
#              Dòng: 0 (dòng rất dài nên chỉ được chia theo chiều cao, nếu không dòng bị co nhỏ quá)
LEVELS = {
    "word": dict(step=0.04, max_t=400, batch=64, max_label=16, w_floor=0.2),
    "line": dict(step=0.10, max_t=900, batch=8, max_label=130, w_floor=0.0),
}

DOWNSAMPLE = 2          # CNN giảm độ dài chuỗi đi 2 lần trước khi vào GRU
MIN_STROKE_POINTS = 4   # giữ hình dạng nét mũ / móc ngắn, không chỉ hai đầu mút

# ---------------------------------------------------------------- augmentation (chỉ tập train)
AUG_ROTATION_DEG = 4.0
AUG_SCALE_X = 0.15      # co giãn ngang +- 15%
AUG_SCALE_Y = 0.08
AUG_SHEAR = 0.25        # nghiêng chữ (độ nghiêng chữ giữa các người viết khác nhau khá nhiều)
AUG_JITTER = 0.003      # nhiễu từng điểm (theo đơn vị chiều cao của từ)

# ---------------------------------------------------------------- huấn luyện
SEED = 42
LEARNING_RATE = 1e-3
EPOCHS = 160
EARLY_STOP_PATIENCE = 20    # dừng theo validation, không ép chạy đủ số epoch
LR_PLATEAU_PATIENCE = 5
GRAD_CLIP = 5.0


def processed_dir(level: str, data_name: str | None = None):
    name = data_name or level
    if not name or name in (".", "..") or "/" in name or "\\" in name or ":" in name:
        raise ValueError("data-name phải là tên thư mục đơn, ví dụ word_v2")
    return PROCESSED_DIR / name
