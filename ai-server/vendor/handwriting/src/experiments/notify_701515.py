"""Theo dõi hai model đến hết đánh giá, kiểm tra nạp demo rồi báo hoàn tất trên Windows."""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from src.char.common import atomic_file, write_json
from .prepare_701515 import EXPERIMENT, ROOT, assert_originals

RUNS = {
    "ghep": {"folder": "models/ghep_701515", "state": "state.json", "model": "ghep_best.keras"},
    "seq": {"folder": "models/seq/word_701515", "state": "training_state.json", "model": "word_best.keras"},
}


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, PermissionError, json.JSONDecodeError):
        return {}


def completion_status(root=ROOT):
    result = {}
    for kind, cfg in RUNS.items():
        folder = Path(root) / cfg["folder"]
        state = read_json(folder / cfg["state"])
        pipeline = read_json(folder / "pipeline_result.json")
        model = folder / cfg["model"]
        ready = (state.get("status") in ("completed", "early_stopped") and state.get("stage") == "finished"
                 if kind == "ghep" else state.get("status") in ("completed", "early_stopped"))
        ready = bool(ready and pipeline.get("status") == "completed" and model.is_file())
        if kind == "ghep":
            ready = ready and (folder / "shape_svm.joblib").is_file() and (folder / "hybrid_selection.json").is_file()
        result[kind] = {"ready": ready, "status": state.get("status", "waiting"),
                        "epoch": state.get("completed_epochs", state.get("epoch", 0)),
                        "stage": state.get("stage", "waiting"), "model": str(model)}
    return result


def process_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        code = wintypes.DWORD()
        return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
    finally:
        kernel.CloseHandle(handle)


def spawn(command, log):
    options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
    with Path(log).open("a", encoding="utf-8") as stream:
        return subprocess.Popen(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, **options)


def show_notification():
    success = (EXPERIMENT / "READY_TO_TEST.txt").exists()
    if success:
        message = ("ĐÃ HOÀN THÀNH train và đánh giá ghep_701515 + word_701515.\n"
                   "Đã kiểm tra nạp model và nhận dạng. Bạn có thể test trong PyCharm.\n\n"
                   "Xem reports/split_701515/READY_TO_TEST.txt để lấy lệnh demo.")
    else:
        message = ("Lượt train 70/15/15 cần kiểm tra, chưa hoàn thành.\n"
                   "Xem reports/split_701515/completion_watch.json và experiment.log.")
    if os.name == "nt":
        # Một cửa sổ thông báo cho chính người dùng, không gửi ra ngoài máy.
        ctypes.windll.user32.MessageBoxW(None, message, "HandWriting — tiến độ train", 0x40 if success else 0x30)
    else:
        print(message, flush=True)


def verify_demos():
    """Chỉ chạy sau khi cả hai pipeline báo xong; nạp model và gọi đường demo thật."""
    import numpy as np
    import tensorflow as tf
    tf.config.threading.set_intra_op_parallelism_threads(2)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    from src.ghep.data_ghep import load_split
    from src.ghep.serve_ghep import Recognizer as GhepRecognizer
    from src.seq.serve_seq import Recognizer as SeqRecognizer
    from src.seq.data_seq import SeqData
    status = completion_status()
    if not all(row["ready"] for row in status.values()):
        raise ValueError("Chưa đủ hai model hoàn tất train và đánh giá")
    assert_originals()
    ghep = GhepRecognizer("ghep_701515")
    sample = load_split("test", ROOT / "models/ghep_701515/data")[0]
    first = ghep.predict([s.tolist() for s in sample["strokes"]])
    if not isinstance(first["text"], str) or not np.isfinite(first["confidence"]):
        raise ValueError("Demo chữ ghép không trả kết quả hợp lệ")
    if ghep.predictor.hybrid is None:
        raise ValueError("SVM chữ ghép không khớp checkpoint; chưa thể báo sẵn sàng")
    seq = SeqRecognizer("word_701515")
    data = SeqData("word", "word_701515")
    index = int(data.indices("test")[0])
    a, b = map(int, data.offsets[index:index + 2])
    xy, start = data.xy[a:b], data.start[a:b]
    cuts = np.flatnonzero(start)
    strokes = [xy[s:(cuts[k + 1] if k + 1 < len(cuts) else len(xy))].tolist() for k, s in enumerate(cuts)]
    second = seq.predict(strokes)
    if not isinstance(second["text"], str) or not np.isfinite(second["confidence"]):
        raise ValueError("Demo seq không trả kết quả hợp lệ")
    write_json(EXPERIMENT / "demo_load_verification.json", {
        "status": "passed", "ghep": {"ref": sample["truth"], "prediction": first["text"],
                                      "model": str(ghep.predictor.path)},
        "seq": {"ref": data.df.iloc[index]["text"], "prediction": second["text"],
                "model": str(seq.model_path)},
        "note": "Kiểm tra khả năng chạy demo; không phải khẳng định đúng mọi mẫu."})


def watch():
    lock = (EXPERIMENT / "completion_watch.lock").open("a+b")
    if os.name == "nt":
        import msvcrt
        lock.seek(0)
        if not lock.read(1):
            lock.write(b"0")
            lock.flush()
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise SystemExit("Đã có tiến trình theo dõi hoàn tất")
    else:
        import fcntl
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    state_path = EXPERIMENT / "completion_watch.json"
    state = {"status": "watching", "pid": os.getpid(), "restarts": 0}
    try:
        while True:
            models = completion_status()
            state.update(models=models, checked_at=time.time())
            write_json(state_path, state)
            if all(row["ready"] for row in models.values()):
                state["status"] = "verifying_demos"
                write_json(state_path, state)
                subprocess.run([sys.executable, "-u", "-m", "src.experiments.notify_701515", "--verify-demos"],
                               cwd=ROOT, check=True, timeout=300)
                assert_originals()
                lines = ["ĐÃ HOÀN THÀNH: ghep_701515 và word_701515 đã train, đánh giá và kiểm tra nạp demo.",
                         "", "Dừng demo cũ nếu chiếm cùng cổng, rồi chạy trong Terminal PyCharm:", "",
                         "python -m src.ghep.serve_ghep --run-name ghep_701515",
                         "http://127.0.0.1:8002", "",
                         "python -m src.seq.serve_seq --run-name word_701515",
                         "http://127.0.0.1:8001", "",
                         "Các model gốc vẫn được giữ nguyên. Xem báo cáo riêng trong reports/ghep_701515 và reports/seq/word_701515."]
                with atomic_file(EXPERIMENT / "READY_TO_TEST.txt") as temp:
                    temp.write_text("\n".join(lines) + "\n", encoding="utf-8")
                state.update(status="completed", completed_at=time.time())
                write_json(state_path, state)
                print(lines[0], flush=True)
                spawn([sys.executable, "-m", "src.experiments.notify_701515", "--show-notification"],
                      EXPERIMENT / "completion_notification.log")
                return
            pipeline = read_json(EXPERIMENT / "experiment_state.json")
            if not process_alive(pipeline.get("pid")):
                # Nếu launcher vừa tạo child, cho nó ghi PID thật ở vòng kế tiếp.
                launcher = read_json(EXPERIMENT / "launcher.json")
                if process_alive(launcher.get("pid")):
                    time.sleep(30)
                    continue
                assert_originals()
                if state["restarts"] >= 3:
                    raise RuntimeError("Pipeline đã dừng và đã thử tiếp tục 3 lần; xem experiment.log")
                process = spawn([sys.executable, "-u", "-m", "src.experiments.run_701515", "--resume"],
                                EXPERIMENT / "experiment.log")
                state["restarts"] += 1
                write_json(EXPERIMENT / "launcher.json", {"pid": process.pid, "restarted_by_watcher": True})
            time.sleep(30)
    except Exception as exc:
        state.update(status="failed", error=str(exc))
        write_json(state_path, state)
        spawn([sys.executable, "-m", "src.experiments.notify_701515", "--show-notification"],
              EXPERIMENT / "completion_notification.log")
        raise
    finally:
        lock.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--background", action="store_true")
    parser.add_argument("--show-notification", action="store_true")
    parser.add_argument("--verify-demos", action="store_true")
    args = parser.parse_args()
    if args.show_notification:
        show_notification()
    elif args.verify_demos:
        verify_demos()
    elif args.background:
        existing = read_json(EXPERIMENT / "completion_watch.json")
        if process_alive(existing.get("pid")):
            print(f"Đang theo dõi hoàn tất với PID={existing['pid']}")
            return
        process = spawn([sys.executable, "-u", "-m", "src.experiments.notify_701515"],
                        EXPERIMENT / "completion_watch.log")
        print(f"Đã theo dõi hoàn tất, PID={process.pid}")
    else:
        watch()


if __name__ == "__main__":
    main()
