"""Xem tiến độ mà không cần import TensorFlow: python -m src.seq.status_seq --run-name word_stable."""
import argparse
import json

from src.seq import config_seq as cfg


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-name", default="word_stable")
    args = ap.parse_args()
    folder = cfg.MODELS_DIR / args.run_name
    for name in ("training_state.json", "progress.json"):
        path = folder / name
        if path.exists():
            print(name)
            print(json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
