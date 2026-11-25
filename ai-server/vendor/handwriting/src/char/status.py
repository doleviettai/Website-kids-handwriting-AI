"""python -m src.char.status --run-name baseline_stable"""
import argparse
import json

from src.char.common import folder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-name", default="baseline_stable")
    args = parser.parse_args()
    run_dir = folder(args.run_name)
    for name in ("training_state.json", "progress.json", "hybrid_selection.json", "pipeline_result.json"):
        path = run_dir / name
        if path.exists():
            print(name)
            print(json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, indent=2))
    if not (run_dir / "training_state.json").exists():
        print("Run chưa bắt đầu.")


if __name__ == "__main__":
    main()
