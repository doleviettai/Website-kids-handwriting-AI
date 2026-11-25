from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

from src import config


def replace_file(source, target, *, attempts=10):
    """Retry Windows sharing/access errors without truncating the previous file."""
    for attempt in range(attempts):
        try:
            os.replace(source, target)
            return
        except PermissionError:
            if attempt + 1 == attempts:
                raise
            time.sleep(min(0.05 * 2 ** attempt, 0.5))


@contextmanager
def atomic_file(path, *, attempts=10):
    """A unique sibling temp file; commit only after its writer has closed it."""
    path = Path(path)
    # Preserve the suffix: Keras requires .keras and matplotlib infers .png.
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.stem}.",
                                     suffix=path.suffix, delete=False) as handle:
        temp = Path(handle.name)
    try:
        yield temp
        replace_file(temp, path, attempts=attempts)
    finally:
        try:
            temp.unlink(missing_ok=True)
        except PermissionError:
            # A scanner may also hold the staging file. Preserve the real error.
            pass


def write_json(path, value, *, required=True):
    payload = json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
    try:
        with atomic_file(path, attempts=10 if required else 3) as temp:
            temp.write_text(payload, encoding="utf-8")
    except PermissionError:
        if required:
            raise
        # Display-only progress can remain stale until the next callback.
        return False
    return True


def folder(name):
    if not name or name in (".", "..", "seq") or any(c in name for c in '/\\:'):
        raise ValueError("run-name phải là một tên thư mục đơn, ví dụ baseline_stable")
    return config.MODELS_DIR / name


def signature(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
