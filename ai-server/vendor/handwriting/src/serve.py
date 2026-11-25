"""Trang web thử nhận diện chữ viết tay bằng model đã train.

    python -m src.serve --run-name baseline

Rồi mở http://127.0.0.1:8000 (tự mở sẵn), viết lên khung và bấm "Nhận diện".
Chỉ dùng thư viện chuẩn + TensorFlow, không cần cài thêm gì.
"""
from __future__ import annotations

import argparse
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

from src import config
from src.char.inference import Predictor
from src.labels import (
    BASE_TO_IDX, BASES, MOD_TO_IDX, MODIFIERS, TONE_TO_IDX, TONES,
    compose_char, decompose_char, expected_truths,
)
from src.stroke_utils import strokes_to_points

# 196 ký tự hợp lệ (số, chữ Latin, chữ Việt có dấu) -> chỉ số (base, modifier, tone) của từng ký tự
VALID = []
for _ch in expected_truths():
    _b, _m, _t = decompose_char(_ch)
    VALID.append((_ch, BASE_TO_IDX[_b], MOD_TO_IDX[_m], TONE_TO_IDX[_t]))


def _top(p: np.ndarray, names: list[str], k: int = 3) -> list[dict]:
    idx = np.argsort(-p)[:k]
    return [{"label": names[i], "prob": float(p[i])} for i in idx]


class Recognizer:
    def __init__(self, run_name: str) -> None:
        path = config.MODELS_DIR / run_name / "best.keras"
        if not path.exists():
            raise SystemExit(f"Không thấy model: {path}\nHãy train trước: python -m src.train --run-name {run_name}")
        self.predictor = Predictor(path.parent)
        self.seq_len = self.predictor.seq_len
        self.lock = threading.Lock()

    def predict(self, strokes_json) -> dict:
        try:
            strokes = [np.asarray(s, dtype=np.float64) for s in strokes_json]
        except (ValueError, TypeError):
            raise ValueError("Dữ liệu nét viết không hợp lệ.")
        if any(s.ndim != 2 or s.shape[1] != 2 or not np.isfinite(s).all() for s in strokes if s.size):
            raise ValueError("Mỗi nét phải có dạng [[x, y], ...] với tọa độ hữu hạn.")
        strokes = [s for s in strokes if s.size]
        if not strokes:
            raise ValueError("Chưa có nét nào, hãy viết lên khung trước.")
        if len(strokes) > config.MAX_STROKES:
            raise ValueError(f"Quá nhiều nét ({len(strokes)}). Model được train với tối đa {config.MAX_STROKES} nét.")

        # tọa độ từ trang web đã chia sẵn cho kích thước khung -> [0,1], giống lúc train
        settings = self.predictor.settings
        P, S = strokes_to_points(strokes, seq_len=self.seq_len,
                                 min_pts=settings.get("min_pts_per_stroke", config.MIN_PTS_PER_STROKE),
                                 equal_mix=settings.get("stroke_equal_mix", config.STROKE_EQUAL_MIX))
        with self.lock:
            self.predictor.refresh()
            probabilities, heads = self.predictor.probabilities(P[None], S[None])
            pb, pm, pt = (p[0] for p in heads)

        # điểm của từng ký tự hợp lệ = P(base) * P(modifier) * P(tone), rồi chuẩn hóa lại
        probs = probabilities[0]
        order = np.argsort(-probs)[:5]
        candidates = [{"char": VALID[i][0], "prob": float(probs[i])} for i in order]

        raw_char = compose_char(BASES[int(pb.argmax())], MODIFIERS[int(pm.argmax())], TONES[int(pt.argmax())])
        return {
            "best": candidates[0]["char"],
            "confidence": candidates[0]["prob"],
            "candidates": candidates,
            "raw_char": raw_char,
            "base": _top(pb, BASES),
            "modifier": _top(pm, MODIFIERS),
            "tone": _top(pt, TONES),
            "n_strokes": len(strokes),
            "uncertain": bool(probs[order[0]] < 0.65 or probs[order[0]] - probs[order[1]] < 0.15),
            "hybrid_alpha": self.predictor.hybrid["alpha"] if self.predictor.hybrid else 0.0,
        }


HTML = r"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thử nhận diện chữ viết tay</title>
<style>
  :root { --bg:#f3f5fa; --card:#fff; --ink:#1b2333; --muted:#6b7490; --line:#dde2ee; --accent:#4f46e5; --ok:#15803d; --err:#be123c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b1220; --card:#121a2b; --ink:#e7ebf5; --muted:#8b93ad; --line:#263253; --accent:#818cf8; --ok:#4ade80; --err:#fb7185; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, "Segoe UI", sans-serif; padding:16px; }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:14px; }
  .wrap { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; max-width:980px; margin:0 auto; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; }
  .left { flex:1 1 380px; max-width:520px; }
  .right { flex:1 1 320px; min-width:290px; }
  canvas { width:100%; aspect-ratio:1/1; display:block; border:2px solid var(--accent); border-radius:10px; background:#fffdf9; touch-action:none; cursor:crosshair; }
  .row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center; }
  button { font:inherit; font-size:14px; font-weight:600; padding:9px 14px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  label { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:5px; cursor:pointer; }
  .big { font-size:96px; font-weight:800; line-height:1; text-align:center; color:var(--accent); min-height:100px; }
  .conf { text-align:center; color:var(--muted); font-size:14px; margin-top:2px; }
  .msg { text-align:center; color:var(--err); font-size:14px; margin-top:6px; }
  h2 { font-size:13px; margin:16px 0 6px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .bar { display:flex; align-items:center; gap:8px; font-size:14px; margin:3px 0; }
  .bar .name { width:74px; flex-shrink:0; font-weight:700; }
  .bar .track { flex:1; height:8px; background:var(--line); border-radius:4px; overflow:hidden; }
  .bar .fill { height:100%; background:var(--accent); }
  .bar .pct { width:44px; text-align:right; color:var(--muted); font-variant-numeric: tabular-nums; }
  .heads { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
  .heads div.t { font-size:12px; color:var(--muted); margin-bottom:2px; }
  .heads .item { font-size:13px; display:flex; justify-content:space-between; }
  .hint { font-size:12px; color:var(--muted); margin-top:10px; line-height:1.5; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card left">
    <h1>Thử nhận diện chữ viết tay</h1>
    <div class="sub">Viết 1 ký tự (chữ, số, có thể có dấu) vào khung rồi bấm “Nhận diện”.</div>
    <canvas id="pad"></canvas>
    <div class="row">
      <button class="primary" id="btnRecognize">Nhận diện</button>
      <button id="btnUndo">Hoàn tác nét</button>
      <button id="btnClear">Xóa</button>
      <label><input type="checkbox" id="auto"> Tự nhận diện sau 1 giây</label>
    </div>
    <div class="hint">Các đường kẻ giống khung lúc thu thập dữ liệu. Hãy viết cỡ và vị trí giống lúc thu thập:
      chữ hoa và số viết to, chữ thường viết nhỏ hơn. Dấu (mũ, móc, sắc, huyền...) viết thành nét riêng như khi thu thập.
      Phím tắt: Enter = nhận diện, Esc = xóa.</div>
  </div>

  <div class="card right">
    <div class="big" id="best">?</div>
    <div class="conf" id="conf">Chưa nhận diện</div>
    <div class="msg" id="msg"></div>

    <h2>5 ký tự khả dĩ nhất</h2>
    <div id="cands"></div>

    <h2>Model đoán từng phần</h2>
    <div class="heads">
      <div><div class="t">Chữ gốc</div><div id="hBase"></div></div>
      <div><div class="t">Dấu phụ</div><div id="hMod"></div></div>
      <div><div class="t">Dấu thanh</div><div id="hTone"></div></div>
    </div>
    <div class="hint" id="rawNote"></div>
    <div class="hint">Các tỷ lệ là điểm của model, chưa phải xác suất đúng đã hiệu chỉnh. Với a/d, hãy giữ rõ thân nét vươn cao của chữ d.</div>
  </div>
</div>

<script>
const MOD_VI = { none: "không", breve: "trăng", circumflex: "mũ", horn: "móc" };
const TONE_VI = { none: "ngang", grave: "huyền", acute: "sắc", hook: "hỏi", tilde: "ngã", dot: "nặng" };

const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let strokes = [];      // mỗi nét: [[x, y], ...] với x, y đã chia cho kích thước khung -> 0..1
let current = null;
let autoTimer = null;
let strokeVersion = 0;
let requestVersion = 0;

function invalidateResult() {
  strokeVersion++;
  requestVersion++;
  clearTimeout(autoTimer);
  document.getElementById('best').textContent = '?';
  document.getElementById('conf').textContent = 'Chờ nhận diện';
  document.getElementById('msg').textContent = '';
  ['cands', 'hBase', 'hMod', 'hTone', 'rawNote'].forEach(id => document.getElementById(id).innerHTML = '');
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  redraw();
}

function redraw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // đường kẻ giống web thu thập: 20% (trên), 80% (dòng kẻ), 92% (dưới), giữa nét đứt
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d5dbe8';
  [0.2, 0.8, 0.92].forEach(f => { ctx.beginPath(); ctx.moveTo(0, h * f); ctx.lineTo(w, h * f); ctx.stroke(); });
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#a9b3c8';
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = Math.max(5, w * 0.018);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokes.forEach(s => {
    ctx.beginPath();
    s.forEach(([x, y], i) => { i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h); });
    if (s.length === 1) ctx.lineTo(s[0][0] * w + 0.1, s[0][1] * h);
    ctx.stroke();
  });
}

function norm(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
}

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  clearTimeout(autoTimer);
  invalidateResult();
  current = [norm(e)];
  strokes.push(current);
  redraw();
});
canvas.addEventListener('pointermove', e => {
  if (!current) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  (evs.length ? evs : [e]).forEach(ev => current.push(norm(ev)));
  redraw();
});
function endStroke() {
  if (!current) return;
  current = null;
  if (document.getElementById('auto').checked) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(recognize, 1000);
  }
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

function clearAll() {
  invalidateResult();
  strokes = []; current = null;
  clearTimeout(autoTimer);
  redraw();
  document.getElementById('best').textContent = '?';
  document.getElementById('conf').textContent = 'Chưa nhận diện';
  document.getElementById('msg').textContent = '';
  ['cands', 'hBase', 'hMod', 'hTone', 'rawNote'].forEach(id => document.getElementById(id).innerHTML = '');
}

function pct(p) { return (p * 100).toFixed(p < 0.01 && p > 0 ? 1 : 0) + '%'; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderHead(id, items, names) {
  document.getElementById(id).innerHTML = items.map(it =>
    '<div class="item"><span>' + esc(names ? (names[it.label] || it.label) : it.label) + '</span><span>' + pct(it.prob) + '</span></div>'
  ).join('');
}

async function recognize() {
  if (current || !strokes.length) return;
  const version = strokeVersion;
  const request = ++requestVersion;
  clearTimeout(autoTimer);
  const msg = document.getElementById('msg');
  msg.textContent = '';
  const body = JSON.stringify({ strokes: strokes.map(s => s.map(p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4])) });
  let res, data;
  try {
    res = await fetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    data = await res.json();
  } catch (err) {
    if (version !== strokeVersion || request !== requestVersion) return;
    msg.textContent = 'Không gọi được server: ' + err;
    return;
  }
  if (version !== strokeVersion || request !== requestVersion) return;
  if (!res.ok) { msg.textContent = data.error || 'Lỗi không rõ'; return; }

  document.getElementById('best').textContent = data.best;
  document.getElementById('conf').textContent = 'Điểm nhận dạng ' + pct(data.confidence) + '  ·  ' + data.n_strokes + ' nét';
  if (data.uncertain) msg.textContent = 'Nét chưa rõ với model. Bạn kiểm tra các ký tự gợi ý bên dưới nhé.';
  document.getElementById('cands').innerHTML = data.candidates.map(c =>
    '<div class="bar"><span class="name">' + esc(c.char) + '</span><span class="track"><span class="fill" style="display:block;width:' + (c.prob * 100) + '%"></span></span><span class="pct">' + pct(c.prob) + '</span></div>'
  ).join('');
  renderHead('hBase', data.base, null);
  renderHead('hMod', data.modifier, MOD_VI);
  renderHead('hTone', data.tone, TONE_VI);
  document.getElementById('rawNote').textContent = data.raw_char !== data.best
    ? 'Ghép thẳng từ 3 phần ra “' + data.raw_char + '”, khác ký tự hợp lệ gần nhất “' + data.best + '”. Kết quả lớn ở trên đã chọn trong 196 ký tự hợp lệ.'
    : '';
}

document.getElementById('btnRecognize').onclick = recognize;
document.getElementById('btnClear').onclick = clearAll;
document.getElementById('btnUndo').onclick = () => { strokes.pop(); current = null; invalidateResult(); redraw(); if (strokes.length && document.getElementById('auto').checked) autoTimer = setTimeout(recognize, 1000); };
window.addEventListener('keydown', e => {
  if (e.key === 'Enter') recognize();
  if (e.key === 'Escape') clearAll();
});
window.addEventListener('resize', resize);
resize();
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    recognizer: Recognizer

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj: dict) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self) -> None:
        if self.path in ("/", "/index.html"):
            self._send(200, HTML.encode("utf-8"), "text/html; charset=utf-8")
        else:
            self._send(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:
        if self.path != "/predict":
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            self._json(200, self.recognizer.predict(payload.get("strokes", [])))
        except ValueError as e:               # gồm cả lỗi JSON
            self._json(400, {"error": str(e)})
        except Exception as e:                # noqa: BLE001
            self._json(500, {"error": f"Lỗi server: {e}"})

    def log_message(self, *args) -> None:     # không in log từng request cho đỡ rối
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="baseline")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    Handler.recognizer = Recognizer(args.run_name)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}"
    print(f"Model: {args.run_name}  |  mở {url}  (Ctrl+C để dừng)")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng.")


if __name__ == "__main__":
    main()
