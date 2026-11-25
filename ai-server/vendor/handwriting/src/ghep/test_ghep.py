"""Thử model chữ ghép.

    # 1) Thử một/vài file inkml (in top-3 và so với nhãn trong file)
    python -m src.ghep.test_ghep --run-name ghep_v1 --inkml dataset/raw/inkml_ghep/cons_t-h/xxx.inkml

    # 2) Thử cả thư mục (đệ quy), in độ chính xác và các mẫu sai
    python -m src.ghep.test_ghep --run-name ghep_v1 --dir dataset/raw/inkml_ghep

    # 3) Tự viết bằng chuột vào khung rồi xem kết quả (mặc định nếu không chọn chế độ nào)
    python -m src.ghep.test_ghep --run-name ghep_v1 --draw
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from .config_ghep import IMG_H, IMG_W, run_dirs
from .data_ghep import normalize, parse_inkml, render
from .inference_ghep import Predictor


# ----------------------------------------------------------------------------
# Nạp model + dự đoán
# ----------------------------------------------------------------------------
def load(run_name, which="best"):
    model_dir, _ = run_dirs(run_name)
    path = model_dir / f"ghep_{which}.keras"
    if not path.exists():
        raise FileNotFoundError(f"Không thấy {path}. Hãy train trước hoặc kiểm tra --run-name.")
    predictor = Predictor(model_dir, which)
    return predictor, predictor.classes


def predict_batch(model, classes, strokes_list, k=3):
    """strokes_list: list các mẫu, mỗi mẫu là list mảng (n,2) toạ độ x,y thô.
    Trả về list top-k [(nhãn, xác suất), ...] cho từng mẫu."""
    probs = model.probabilities(strokes_list)
    out = []
    for p in probs:
        idx = np.argsort(-p)[:k]
        out.append([(classes[i], float(p[i])) for i in idx])
    return out


def fmt(top):
    return " | ".join(f"{lab} {p * 100:.1f}%" for lab, p in top)


# ----------------------------------------------------------------------------
# Chế độ 1 + 2: file inkml / thư mục
# ----------------------------------------------------------------------------
def run_files(model, classes, paths, verbose=True, split=None):
    items = [parse_inkml(p) for p in paths]
    if split:
        selected = [(p, s) for p, s in zip(paths, items) if s["split"] == split]
        paths, items = [p for p, _ in selected], [s for _, s in selected]
        if not items:
            raise ValueError(f"Không có mẫu thuộc split {split}")
    tops = []
    for i in range(0, len(items), 64):
        tops += predict_batch(model, classes, [it["strokes"] for it in items[i:i + 64]])

    n = ok = 0
    wrong = []
    for p, it, top in zip(paths, items, tops):
        truth = it["truth"]
        flag = ""
        if truth:
            n += 1
            hit = top[0][0] == truth
            ok += hit
            flag = "ĐÚNG" if hit else f"SAI (nhãn: {truth})"
            if not hit:
                wrong.append((p, truth, top))
        if verbose:
            print(f"{p.parent.name}/{p.name}: {fmt(top)}  {flag}")
    if n:
        print(f"\nĐúng {ok}/{n} = {ok / n:.2%}")
        if wrong and not verbose:
            print(f"Các mẫu sai ({len(wrong)}):")
            for p, truth, top in wrong[:30]:
                print(f"  {p.parent.name}/{p.name}: nhãn={truth} -> đoán {fmt(top)}")
            if len(wrong) > 30:
                print(f"  ... và {len(wrong) - 30} mẫu sai khác")


# ----------------------------------------------------------------------------
# Chế độ 3: vẽ bằng chuột
# ----------------------------------------------------------------------------
def run_draw(model, classes, k=3):
    import tkinter as tk

    from PIL import Image

    try:
        from PIL import ImageTk
    except ImportError:  # không có ImageTk thì bỏ phần xem trước
        ImageTk = None

    W, H = 900, 320
    root = tk.Tk()
    root.title("Test chữ ghép - viết vào khung, nhả chuột để nhận dạng")
    canvas = tk.Canvas(root, width=W, height=H, bg="white", highlightthickness=1,
                       highlightbackground="#888", cursor="pencil")
    canvas.pack(padx=8, pady=8)

    result = tk.StringVar(value="Viết một chữ ghép (vd: th, ngh, uyên, ương...) vào khung.")
    tk.Label(root, textvariable=result, font=("Segoe UI", 15), justify="left",
             anchor="w").pack(fill="x", padx=8)
    preview = tk.Label(root)
    preview.pack(padx=8, pady=4)

    strokes, items = [], []

    def recognize():
        if not strokes:
            result.set("Viết một chữ ghép vào khung.")
            preview.configure(image="")
            return
        st = [np.asarray(s, dtype=np.float32) for s in strokes]
        top = predict_batch(model, classes, [st], k)[0]
        result.set("\n".join(f"{i + 1}. {lab}    {p * 100:5.1f}%" for i, (lab, p) in enumerate(top)))
        if ImageTk is not None:  # ảnh mà model thực sự nhìn thấy
            arr = (render(normalize(st))[..., 0] * 255).astype("uint8")
            img = Image.fromarray(arr).resize((IMG_W * 3, IMG_H * 3), Image.NEAREST)
            photo = ImageTk.PhotoImage(img)
            preview.configure(image=photo)
            preview.image = photo

    def down(e):
        strokes.append([(e.x, e.y)])
        items.append([canvas.create_oval(e.x - 1.5, e.y - 1.5, e.x + 1.5, e.y + 1.5,
                                         fill="black", outline="black")])

    def move(e):
        if not strokes:
            return
        x0, y0 = strokes[-1][-1]
        strokes[-1].append((e.x, e.y))
        items[-1].append(canvas.create_line(x0, y0, e.x, e.y, width=3, capstyle=tk.ROUND))

    def up(_e):
        recognize()

    def undo(_e=None):
        if strokes:
            strokes.pop()
            for i in items.pop():
                canvas.delete(i)
        recognize()

    def clear(_e=None):
        canvas.delete("all")
        strokes.clear()
        items.clear()
        recognize()

    canvas.bind("<ButtonPress-1>", down)
    canvas.bind("<B1-Motion>", move)
    canvas.bind("<ButtonRelease-1>", up)
    root.bind("<Control-z>", undo)
    root.bind("<Key-c>", clear)

    bar = tk.Frame(root)
    bar.pack(pady=(0, 8))
    tk.Button(bar, text="Hoàn tác nét (Ctrl+Z)", command=undo).pack(side="left", padx=4)
    tk.Button(bar, text="Xóa hết (C)", command=clear).pack(side="left", padx=4)
    root.mainloop()


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="ghep_stable")
    ap.add_argument("--split", choices=["train", "validation", "test"], help="lọc split khi dùng --dir")
    ap.add_argument("--weights", default="best", choices=["best", "last"])
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--inkml", nargs="+", help="một hoặc nhiều file .inkml")
    g.add_argument("--dir", help="thư mục chứa .inkml (đệ quy)")
    g.add_argument("--draw", action="store_true", help="vẽ bằng chuột (mặc định)")
    a = ap.parse_args()

    model, classes = load(a.run_name, a.weights)
    if a.inkml:
        run_files(model, classes, [Path(p) for p in a.inkml], verbose=True)
    elif a.dir:
        paths = sorted(Path(a.dir).rglob("*.inkml"))
        if not paths:
            raise SystemExit(f"Không thấy file .inkml trong {a.dir}")
        run_files(model, classes, paths, verbose=False, split=a.split)
    else:
        run_draw(model, classes)


if __name__ == "__main__":
    main()
