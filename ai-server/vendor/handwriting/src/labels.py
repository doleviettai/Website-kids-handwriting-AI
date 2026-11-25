"""Nhãn base / modifier / tone, và hàm phân rã ký tự giống hệt `decomposeChar` trong web collector.

Ví dụ:  "ắ" -> base "a", modifier "breve", tone "acute"
        "đ" -> base "đ", modifier "none",  tone "none"
"""
import unicodedata
from string import ascii_lowercase, ascii_uppercase

# Danh sách CỐ ĐỊNH (không phụ thuộc dữ liệu) để chỉ số lớp không bị đổi khi thu thêm dữ liệu.
BASES = list("0123456789") + list(ascii_lowercase) + list(ascii_uppercase) + ["đ", "Đ"]   # 64 lớp
MODIFIERS = ["none", "breve", "circumflex", "horn"]                                        # 4 lớp
TONES = ["none", "grave", "acute", "hook", "tilde", "dot"]                                 # 6 lớp

BASE_TO_IDX = {c: i for i, c in enumerate(BASES)}
MOD_TO_IDX = {c: i for i, c in enumerate(MODIFIERS)}
TONE_TO_IDX = {c: i for i, c in enumerate(TONES)}

_TONE_MARKS = {0x0300: "grave", 0x0301: "acute", 0x0303: "tilde", 0x0309: "hook", 0x0323: "dot"}
_MOD_MARKS = {0x0306: "breve", 0x0302: "circumflex", 0x031B: "horn"}
_TONE_TO_MARK = {v: chr(k) for k, v in _TONE_MARKS.items()}
_MOD_TO_MARK = {v: chr(k) for k, v in _MOD_MARKS.items()}


def decompose_char(ch: str) -> tuple[str, str, str]:
    """Tách 1 ký tự thành (base, modifier, tone)."""
    base, modifier, tone = "", "none", "none"
    for c in unicodedata.normalize("NFD", ch.strip()):
        cp = ord(c)
        if cp in _TONE_MARKS:
            tone = _TONE_MARKS[cp]
        elif cp in _MOD_MARKS:
            modifier = _MOD_MARKS[cp]
        else:
            base += c
    return base, modifier, tone


def compose_char(base: str, modifier: str, tone: str) -> str:
    """Ghép ngược (base, modifier, tone) thành 1 ký tự hiển thị được."""
    s = base + _MOD_TO_MARK.get(modifier, "") + _TONE_TO_MARK.get(tone, "")
    return unicodedata.normalize("NFC", s)


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def expected_truths() -> list[str]:
    """Toàn bộ 196 ký tự mà web collector có thể yêu cầu viết (bộ 'Tất cả Latin + số + Việt')."""
    tone_lower = _nfc(
        "áàảãạ" "ắằẳẵặ" "ấầẩẫậ" "éèẻẽẹ" "ếềểễệ" "íìỉĩị"
        "óòỏõọ" "ốồổỗộ" "ớờởỡợ" "úùủũụ" "ứừửữự" "ýỳỷỹỵ"
    )
    mod_lower = _nfc("ăâêôơư")
    lower = list(ascii_lowercase) + ["đ"] + list(mod_lower) + list(tone_lower)
    upper = [c.upper() for c in lower]
    return list("0123456789") + upper + lower