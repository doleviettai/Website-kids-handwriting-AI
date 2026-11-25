"""Xem tiến độ train từ terminal khác (không ảnh hưởng tiến trình đang train).

    python -m src.ghep.status --run-name ghep
"""
import argparse
import json

from .config_ghep import run_dirs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="ghep_stable")
    ap.add_argument("--tail", type=int, default=15)
    a = ap.parse_args()
    model_dir, _ = run_dirs(a.run_name)
    sp, lg = model_dir / "state.json", model_dir / "train.log"
    if not sp.exists():
        print(f"Chưa có run '{a.run_name}' trong {model_dir}")
        return
    print(json.dumps(json.loads(sp.read_text(encoding="utf-8")), ensure_ascii=False, indent=2))
    for name in ("progress.json", "hybrid_selection.json", "pipeline_result.json"):
        path = model_dir / name
        if path.exists():
            print(name)
            print(json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, indent=2))
    if lg.exists():
        print("--- train.log ---")
        print("\n".join(lg.read_text(encoding="utf8").splitlines()[-a.tail:]))


if __name__ == "__main__":
    main()
