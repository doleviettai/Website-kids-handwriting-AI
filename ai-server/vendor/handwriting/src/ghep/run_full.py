"""Một lệnh cho PyCharm Terminal: dữ liệu -> CNN + hình học -> SVM -> đánh giá."""
import argparse
import json
import os
import subprocess
import sys

from src.char.common import write_json
from .config_ghep import ROOT, run_dirs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-name", default="ghep_stable")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--threads", type=int, default=6)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--background", action="store_true")
    parser.add_argument("--skip-train", action="store_true")
    args, extra = parser.parse_known_args()
    model_dir, report_dir = run_dirs(args.run_name)
    model_dir.mkdir(parents=True, exist_ok=True)
    if args.background:
        command = [sys.executable, "-u", "-m", "src.ghep.run_full", *[x for x in sys.argv[1:] if x != "--background"]]
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
        with (model_dir / "train.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                       stdin=subprocess.DEVNULL, **options)
        write_json(model_dir / "launcher.json", {"pid": process.pid, "command": command})
        print(f"Đã gửi chạy nền PID={process.pid}; xem {model_dir / 'train.log'}")
        return
    lock = (model_dir / "pipeline.lock").open("a+b")
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
            raise SystemExit("Pipeline này đang chạy; không tạo lượt train trùng")
    else:
        import fcntl
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise SystemExit("Pipeline này đang chạy")

    def run(module, *options):
        subprocess.run([sys.executable, "-u", "-m", module, *map(str, options)], cwd=ROOT, check=True)

    try:
        write_json(model_dir / "pipeline_result.json", {"status": "running", "pid": os.getpid()})
        if not args.skip_train:
            options = ["--run-name", args.run_name, "--threads", args.threads, *extra]
            if args.epochs is not None:
                options.extend(["--epochs", args.epochs])
            if args.resume:
                options.append("--resume")
            run("src.ghep.train_ghep", *options)
            state = json.loads((model_dir / "state.json").read_text(encoding="utf-8"))
            if state["status"] not in ("completed", "early_stopped"):
                write_json(model_dir / "pipeline_result.json", {"status": state["status"]})
                return
        for split in ("validation", "test"):
            run("src.ghep.evaluate_ghep", "--run-name", args.run_name, "--split", split, "--threads", args.threads)
        write_json(model_dir / "pipeline_result.json", {"status": "completed"})
    except subprocess.CalledProcessError as exc:
        write_json(model_dir / "pipeline_result.json", {"status": "failed", "exit_code": exc.returncode})
        raise
    finally:
        lock.close()


if __name__ == "__main__":
    main()
