"""Chạy nền pipeline train dài và tự đánh giá khi xong, không mở cửa sổ console.

python -m src.seq.run_full --run-name word_stable --data-name word_v2 --init-from thu --lr 0.0005 --background
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from src import config
from src.seq import config_seq as cfg
from src.seq.artifacts_seq import write_json


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="word_stable")
    ap.add_argument("--data-name", default="word_v2")
    ap.add_argument("--epochs", type=int, default=cfg.EPOCHS)
    ap.add_argument("--init-from", default=None)
    ap.add_argument("--lr", type=float, default=0.0005)
    ap.add_argument("--threads", type=int, default=6)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--background", action="store_true")
    args = ap.parse_args()
    if not args.run_name or any(c in args.run_name for c in '/\\:') or args.run_name in ('.', '..'):
        raise SystemExit("run-name phải là tên thư mục đơn")
    cfg.processed_dir("word", args.data_name)
    run_dir = cfg.MODELS_DIR / args.run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    launcher_path = run_dir / "launcher.json"
    if args.background:
        if launcher_path.exists():
            import ctypes
            old = json.loads(launcher_path.read_text(encoding="utf-8"))
            if os.name == "nt":
                # Query-only process handle. Exit code STILL_ACTIVE = 259.
                kernel = ctypes.WinDLL("kernel32", use_last_error=True)
                kernel.OpenProcess.restype = ctypes.c_void_p
                kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
                kernel.CloseHandle.argtypes = [ctypes.c_void_p]
                handle = kernel.OpenProcess(0x1000, False, old["pid"])
                if handle:
                    code = ctypes.c_ulong()
                    kernel.GetExitCodeProcess(handle, ctypes.byref(code))
                    kernel.CloseHandle(handle)
                    if code.value == 259:
                        raise SystemExit(f"Pipeline đang chạy với PID {old['pid']}")
        forwarded = [arg for arg in sys.argv[1:] if arg != "--background"]
        command = [sys.executable, "-u", "-m", "src.seq.run_full", *forwarded]
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
        with (run_dir / "train.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(command, cwd=config.ROOT, stdout=log, stderr=subprocess.STDOUT,
                                       stdin=subprocess.DEVNULL, **options)
        write_json(launcher_path, {"pid": process.pid, "command": command, "log": str(run_dir / "train.log")})
        print(f"Đã chạy nền PID={process.pid}\nLog: {run_dir / 'train.log'}")
        return

    def run(module, *arguments):
        try:
            subprocess.run([sys.executable, "-u", "-m", module, *map(str, arguments)],
                           cwd=config.ROOT, check=True)
        except subprocess.CalledProcessError as exc:
            write_json(run_dir / "pipeline_result.json", {"status": "failed", "module": module,
                                                          "exit_code": exc.returncode})
            raise

    if not args.resume and not (cfg.processed_dir("word", args.data_name) / "data.npz").exists():
        run("src.seq.preprocess_seq", "--level", "word", "--data-name", args.data_name)
    train_args = ["--run-name", args.run_name, "--epochs", str(args.epochs), "--threads", str(args.threads)]
    if args.resume:
        train_args.append("--resume")
    else:
        train_args += ["--data-name", args.data_name, "--lr", str(args.lr)]
        if args.init_from:
            train_args += ["--init-from", args.init_from]
    run("src.seq.train_seq", *train_args)
    state = json.loads((run_dir / "training_state.json").read_text(encoding="utf-8"))
    if state["status"] not in ("completed", "early_stopped"):
        print(f"Chưa đánh giá cuối: train đang ở trạng thái {state['status']}")
        return
    # Test chỉ được đo sau train, không dùng để chọn model/tham số ngôn ngữ.
    run("src.seq.evaluate_seq", "--run-name", args.run_name, "--split", "test", "--threads", args.threads)
    run("src.seq.evaluate_seq", "--run-name", args.run_name, "--split", "validation",
        "--max-samples", "1000", "--decoder", "all", "--threads", args.threads)
    write_json(run_dir / "pipeline_result.json", {"status": "completed", "training_status": state["status"]})


if __name__ == "__main__":
    main()
