"""Train ba lượt thử riêng; bản cũ và các lệnh demo cũ giữ nguyên."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from src.char.common import write_json
from .prepare_701515 import EXPERIMENT, ROOT, assert_originals, prepare


def commands(epochs=None, resume=False):
    budgets = {"char": 300, "ghep": 100, "seq": 160}
    if epochs is not None:
        budgets = {key: epochs for key in budgets}
    char = ["src.char.run_full", "--run-name", "baseline_701515", "--epochs", str(budgets["char"])]
    ghep = ["src.ghep.run_full", "--run-name", "ghep_701515", "--epochs", str(budgets["ghep"])]
    seq = ["src.seq.run_full", "--run-name", "word_701515", "--epochs", str(budgets["seq"])]
    if resume:
        for cmd in (char, ghep, seq):
            cmd.append("--resume")
    else:
        char += ["--processed-dir", str(EXPERIMENT / "prepared/char"), "--init-from="]
        ghep += ["--init-from=", "--robust-geometry", "--composed-per-class", "16", "--glyph-validation-per-class", "3",
                 "--samples-per-class", "16", "--patience", "20", "--lr-patience", "6"]
        seq += ["--data-name", "word_701515", "--lr", "0.0005"]
    return {"char": char, "ghep": ghep, "seq": seq}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--background", action="store_true")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--only", choices=["all", "char", "ghep", "seq"], default="all")
    parser.add_argument("--epochs", type=int, default=None, help="ghi đè ngân sách để chạy smoke; bỏ qua để train đầy đủ")
    args = parser.parse_args()
    prepare()
    if args.prepare_only:
        return
    if args.background:
        command = [sys.executable, "-u", "-m", "src.experiments.run_701515", *[a for a in sys.argv[1:] if a != "--background"]]
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
        with (EXPERIMENT / "experiment.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                       stdin=subprocess.DEVNULL, **options)
        write_json(EXPERIMENT / "launcher.json", {"pid": process.pid, "command": command})
        print(f"Thí nghiệm chạy nền PID={process.pid}; log: {EXPERIMENT / 'experiment.log'}")
        return
    lock = (EXPERIMENT / "experiment.lock").open("a+b")
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
            raise SystemExit("Đã có tiến trình thí nghiệm chạy")
    else:
        import fcntl
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        state_path = EXPERIMENT / "experiment_state.json"
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"models": {}}
        state.update(status="running", pid=os.getpid())
        for kind in ("char", "ghep", "seq"):
            if args.only != "all" and args.only != kind:
                continue
            previous = state["models"].get(kind, {})
            desired_command = commands(args.epochs)[kind]
            budget = int(desired_command[desired_command.index("--epochs") + 1])
            previous_command = previous.get("command", [])
            previous_budget = previous.get("budget", int(previous_command[previous_command.index("--epochs") + 1]) if "--epochs" in previous_command else 0)
            if previous.get("status") == "completed" and previous_budget >= budget:
                print(f"{kind}: đã hoàn tất, giữ nguyên", flush=True)
                continue
            command = commands(args.epochs, resume=False)[kind]
            if args.resume:
                run_names = {"char": ROOT / "models/baseline_701515", "ghep": ROOT / "models/ghep_701515",
                             "seq": ROOT / "models/seq/word_701515"}
                if (run_names[kind] / "train_config.json").exists():
                    command = commands(args.epochs, resume=True)[kind]
            state["current_model"] = kind
            state["models"][kind] = {"status": "running", "command": command, "budget": budget}
            write_json(state_path, state)
            assert_originals()
            print(f"Đang train {kind}: {' '.join(command)}", flush=True)
            subprocess.run([sys.executable, "-u", "-m", *command], cwd=EXPERIMENT / "workspace", check=True)
            assert_originals()
            run_names = {"char": ROOT / "models/baseline_701515", "ghep": ROOT / "models/ghep_701515",
                         "seq": ROOT / "models/seq/word_701515"}
            status_name = "state.json" if kind == "ghep" else "training_state.json"
            training_state = json.loads((run_names[kind] / status_name).read_text(encoding="utf-8"))
            if training_state["status"] not in ("completed", "early_stopped"):
                state["models"][kind]["status"] = training_state["status"]
                state["status"] = "interrupted"
                write_json(state_path, state)
                return
            state["models"][kind]["status"] = "completed"
            write_json(state_path, state)
        state["status"] = "completed"
        write_json(state_path, state)
        if args.only == "all":
            subprocess.run([sys.executable, "-u", "-m", "src.experiments.compare_701515"], cwd=ROOT, check=True)
        print("Đã hoàn thành thí nghiệm. Các model gốc giữ nguyên.", flush=True)
    except Exception as exc:
        state.update(status="failed", error=str(exc))
        write_json(state_path, state)
        raise
    finally:
        lock.close()


if __name__ == "__main__":
    main()
