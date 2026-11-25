"""Một lệnh train chữ đơn + đánh giá. Mặc định chạy trực tiếp trong PyCharm Terminal."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from src import config
from src.char.common import folder, write_json


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="baseline_stable")
    ap.add_argument("--epochs", type=int, default=300)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--background", action="store_true")
    ap.add_argument("--threads", type=int, default=6)
    args, training_options = ap.parse_known_args()
    run_dir = folder(args.run_name)
    run_dir.mkdir(parents=True, exist_ok=True)
    # OS file lock: chặn hai pipeline, tự giải phóng khi process kết thúc/crash.
    if args.background:
        cmd = [sys.executable, "-u", "-m", "src.char.run_full", *[a for a in sys.argv[1:] if a != "--background"]]
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
        with (run_dir / "train.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(cmd, cwd=config.ROOT, stdout=log, stderr=subprocess.STDOUT,
                                       stdin=subprocess.DEVNULL, **options)
        write_json(run_dir / "launcher.json", {"pid": process.pid, "command": cmd})
        print(f"Đã gửi chạy nền PID={process.pid}; xem {run_dir / 'train.log'}")
        return
    lock = (run_dir / "pipeline.lock").open("a+b")
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
            raise SystemExit("Pipeline này đang chạy; không tạo lượt train trùng.")
    else:
        import fcntl
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise SystemExit("Pipeline này đang chạy.")

    def run(module, *options):
        subprocess.run([sys.executable, "-u", "-m", module, *map(str, options)], cwd=config.ROOT, check=True)

    try:
        options = ["--run-name", args.run_name, "--epochs", args.epochs, "--threads", args.threads, *training_options]
        if args.resume:
            options.append("--resume")
        run("src.char.train", *options)
        state = json.loads((run_dir / "training_state.json").read_text(encoding="utf-8"))
        if state["status"] not in ("completed", "early_stopped"):
            return
        for split in ("val", "test"):
            run("src.char.evaluate", "--run-name", args.run_name, "--split", split, "--threads", args.threads)
        write_json(run_dir / "pipeline_result.json", {"status": "completed", "training_status": state["status"]})
    except subprocess.CalledProcessError as exc:
        write_json(run_dir / "pipeline_result.json", {"status": "failed", "exit_code": exc.returncode})
        raise
    finally:
        lock.close()


if __name__ == "__main__":
    main()
