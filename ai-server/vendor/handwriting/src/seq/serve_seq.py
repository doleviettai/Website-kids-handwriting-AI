"""Trang demo nhận diện chữ viết tay CẢ TỪ / DÒNG (model CTC + Beam Search + Từ điển tiếng Việt):

    python -m src.seq.serve_seq --run-name word_stable

Mở http://127.0.0.1:8001 (tự mở sẵn). Viết từng từ lên khung bằng chuột, bấm Space để sang từ tiếp.
Có thể dán bài chính tả mẫu vào ô bên dưới để app kiểm tra từng từ.
Chỉ dùng thư viện chuẩn + TensorFlow, không cần cài thêm gì.
"""
from __future__ import annotations

import argparse
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import keras
import numpy as np
import tensorflow as tf

from src.seq import config_seq as cfg
from src.seq import model_seq  # noqa: F401  (đăng ký lớp DownsampledMask để nạp được model)
from src.seq.features_seq import features_from_xy
from src.seq.artifacts_seq import best_model_path, preprocessing_settings, run_settings
from src.seq.decode_seq import decode_batch
from src.seq.language_seq import CharacterLanguageModel
from src.seq.model_seq import output_lengths
from src.seq.preprocess_seq import process_unit


class Recognizer:
    def __init__(self, run_name: str, level: str | None = None) -> None:
        run_dir = cfg.MODELS_DIR / run_name
        path = best_model_path(run_dir)
        if not path.exists():
            raise SystemExit(f"Không thấy model: {path}")
        level, data_name = run_settings(run_dir, level)
        self.model = keras.models.load_model(path)
        self.model_path = path
        self.model_mtime_ns = path.stat().st_mtime_ns
        self.preprocessing = preprocessing_settings(run_dir, level, data_name)
        language_path = run_dir / "language_model.json"
        if language_path.exists():
            self.language_model = CharacterLanguageModel.load(language_path)
        else:
            import pandas as pd
            df = pd.read_csv(cfg.processed_dir(level, data_name) / "samples.csv", keep_default_na=False)
            self.language_model = CharacterLanguageModel.fit(df.loc[df["split"] == "train", "text"])
        self.lock = threading.Lock()

    def predict(self, strokes_json, expected: str = "") -> dict:
        # Giữ expected cho client cũ; chỉ dùng đáp án để so sánh sau nhận dạng.
        try:
            strokes = [np.asarray(s, dtype=np.float64).reshape(-1, 2) for s in strokes_json]
        except (ValueError, TypeError):
            raise ValueError("Dữ liệu nét viết không hợp lệ.")
        strokes = [s for s in strokes if len(s)]
        if not strokes:
            raise ValueError("Chưa có nét nào, hãy viết lên khung trước.")
        if any(not np.isfinite(s).all() for s in strokes):
            raise ValueError("Tọa độ nét phải hữu hạn.")
        res = process_unit(strokes, **self.preprocessing)
        if res is None:
            raise ValueError("Không xử lý được nét viết (nét quá dài hoặc quá ít).")
        xy, start = res
        lengths = np.array([len(xy)], dtype=np.int32)
        feats = features_from_xy(xy[None], start[None], lengths)
        with self.lock:
            # Checkpoint được thay nguyên tử sau epoch tốt hơn; demo tự nhận bản mới.
            if hasattr(self, "model_path"):
                mtime = self.model_path.stat().st_mtime_ns
                if mtime != self.model_mtime_ns:
                    self.model = keras.models.load_model(self.model_path)
                    self.model_mtime_ns = mtime
            logits = self.model([feats, tf.constant(lengths)], training=False)
        result = decode_batch(logits.numpy(), output_lengths(lengths).numpy(), self.language_model)[0]
        result.update(n_strokes=len(strokes), n_points=len(xy))
        return result


HTML = r"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo nhận diện chữ viết tay - cả từ</title>
<style>
  :root { --bg:#f3f5fa; --card:#fff; --ink:#1b2333; --muted:#6b7490; --line:#dde2ee; --accent:#4f46e5;
          --ok:#15803d; --okbg:#dcfce7; --err:#be123c; --errbg:#fee2e2; --warn:#b45309; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b1220; --card:#121a2b; --ink:#e7ebf5; --muted:#8b93ad; --line:#263253; --accent:#818cf8;
            --ok:#4ade80; --okbg:#10321d; --err:#fb7185; --errbg:#3a1220; --warn:#fbbf24; color-scheme: dark; }
  }
  * { box-sizing: border-box; }

  body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, "Segoe UI", sans-serif; padding:16px; }
  .wrap { max-width:900px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; }
  h1 { font-size:18px; margin:0 0 2px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:10px; line-height:1.5; }
  canvas { width:100%; aspect-ratio:5/2; display:block; border:2px solid var(--accent); border-radius:10px; background:#fffdf9; touch-action:none; cursor:crosshair; }
  .row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center; }
  button { font:inherit; font-size:14px; font-weight:600; padding:9px 14px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  .live { margin-top:10px; font-size:14px; color:var(--muted); }
  .live b { font-size:26px; color:var(--ink); letter-spacing:.02em; }
  .msg { color:var(--err); font-size:13px; min-height:18px; margin-top:6px; }
  h2 { font-size:13px; margin:0 0 8px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .next { font-size:15px; margin-bottom:10px; }
  .next b { font-size:22px; color:var(--accent); }
  .words { display:flex; flex-wrap:wrap; gap:8px; min-height:46px; }
  .chip { border:1px solid var(--line); border-radius:10px; padding:6px 10px; font-size:22px; position:relative; }
  .chip.ok { background:var(--okbg); border-color:var(--ok); }
  .chip.bad { background:var(--errbg); border-color:var(--err); }
  .chip .exp { display:block; font-size:12px; color:var(--err); margin-top:2px; }
  .c-mid { color:var(--warn); }
  .c-low { color:var(--err); text-decoration:underline wavy; }
  textarea { width:100%; min-height:64px; border:1px solid var(--line); border-radius:8px; padding:8px; font:inherit; background:var(--bg); color:var(--ink); }
  label { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:5px; cursor:pointer; margin-top:8px; }
  .score { font-size:14px; margin-top:8px; }
  .hint { font-size:12px; color:var(--muted); line-height:1.5; }
  .cand-pill { display:inline-block; font-size:13px; padding:3px 8px; border-radius:6px; border:1px solid var(--line); background:var(--card); color:var(--accent); margin:2px 4px 0 0; font-weight:500; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Luyện viết và nhận diện chữ viết tay</h1>

    <div class="sub">Viết <b>một từ</b> lên khung, thêm đủ dấu rồi bấm <b>Space</b> để sang từ tiếp. Viết cỡ vừa và giữ rõ các nét mũ, móc.</div>
    <canvas id="pad"></canvas>
    <div class="live">Đang đoán: <b id="live">...</b> <span id="liveConf"></span></div>
    <div id="candsBox" style="display:none; margin-top:6px; font-size:13px; color:var(--muted);">
      Gợi ý tiếng Việt (tham khảo): <span id="candsList"></span>
    </div>
    <div class="msg" id="msg"></div>
    <div class="row">
      <button class="primary" id="btnNext">Từ tiếp (Space)</button>
      <button id="btnClear">Xóa từ đang viết (Esc)</button>
      <button id="btnUndo">Hoàn tác nét (Ctrl+Z)</button>
      <button id="btnDelWord">Xóa từ cuối (Backspace)</button>
      <button id="btnReset">Làm lại từ đầu</button>
    </div>
  </div>

  <div class="card">
    <h2>Bài chính tả mẫu (không bắt buộc)</h2>
    <textarea id="expected" placeholder="Dán bài vào đây, ví dụ: tôi là phương"></textarea>
    <label><input type="checkbox" id="ignoreCase" checked> Bỏ qua phân biệt chữ hoa / chữ thường khi chấm</label>
    <div class="hint">Dấu câu (. , ! ? : ;) được bỏ qua khi chấm. Bài mẫu dùng để đối chiếu kết quả bé viết. Gợi ý tiếng Việt không được tính vào điểm.</div>
  </div>

  <div class="card">
    <h2>Kết quả</h2>
    <div class="next" id="next"></div>
    <div class="words" id="words"></div>
    <div class="score" id="score"></div>
    <div class="hint" id="legend">Chữ màu cam hoặc đỏ: nét chưa rõ với model, hãy kiểm tra lại. Mức hỗ trợ từ nét không phải điểm đẹp hay xác suất viết đúng.</div>
  </div>
</div>

<script>
const canvas = document.getElementById('pad');

const ctx = canvas.getContext('2d');
let strokes = [];       // mỗi nét: [[x, y], ...] theo pixel của khung
let current = null;
let words = [];         // các từ đã nhận diện: {text, chars}
let previewTimer = null;
let previewSeq = 0;
let lastResult = null;
let strokeVersion = 0;
let committing = false;

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  redraw();
}

function redraw() {
  const r = canvas.getBoundingClientRect();
  const dpr = canvas.width / (r.width || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d5dbe8';
  [0.38, 0.62].forEach(f => { ctx.beginPath(); ctx.moveTo(0, r.height * f); ctx.lineTo(r.width, r.height * f); ctx.stroke(); });
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokes.forEach(s => {
    ctx.beginPath();
    s.forEach(([x, y], i) => { i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]);
    ctx.stroke();
  });
}

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10];
}

canvas.addEventListener('pointerdown', e => {
  if (committing) return;
  if (canvas.setPointerCapture && e.pointerId !== undefined) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  clearTimeout(previewTimer);
  strokeVersion++;
  resetLive();
  current = [pos(e)];
  strokes.push(current);
  redraw();
});
canvas.addEventListener('pointermove', e => {
  if (!current) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  (evs.length ? evs : [e]).forEach(ev => current.push(pos(ev)));
  redraw();
});
function endStroke() {
  if (!current) return;
  current = null;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 350);
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pct(p) { return Math.round(p * 100) + '%'; }

function charsHtml(chars) {
  return chars.map(c => '<span class="' + (c.p < 0.5 ? 'c-low' : c.p < 0.8 ? 'c-mid' : '') + '" title="' + pct(c.p) + '">' + esc(c.c) + '</span>').join('');
}

async function predict(strokeData) {
  const res = await fetch('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strokes: strokeData })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi không rõ');
  return data;
}

async function preview() {
  if (!strokes.length || current || committing) return;
  const my = ++previewSeq;
  const version = strokeVersion;
  try {
    const d = await predict(strokes);
    if (my !== previewSeq || version !== strokeVersion || committing) return;
    lastResult = { ...d, version };
    document.getElementById('msg').textContent = '';
    document.getElementById('live').innerHTML = charsHtml(d.chars) || '(rỗng)';
    document.getElementById('liveConf').textContent = d.chars.length ? 'mức hỗ trợ thấp nhất ' + pct(d.confidence) : '';

    const cBox = document.getElementById('candsBox');
    const cList = document.getElementById('candsList');
    if (d.candidates && d.candidates.length) {
      cList.innerHTML = d.candidates.map(c => '<span class="cand-pill">' + esc(c) + '</span>').join('');
      cBox.style.display = 'block';
    } else {
      cBox.style.display = 'none';
    }
  } catch (err) {
    if (my === previewSeq && version === strokeVersion) document.getElementById('msg').textContent = String(err.message || err);
  }
}

function resetLive() {
  previewSeq++;
  lastResult = null;
  document.getElementById('live').textContent = '...';
  document.getElementById('liveConf').textContent = '';
  document.getElementById('candsBox').style.display = 'none';
}

function clearCurrent() {
  strokeVersion++;
  strokes = []; current = null;
  clearTimeout(previewTimer);
  resetLive();
  document.getElementById('msg').textContent = '';
  redraw();
}

async function commitWord() {
  if (!strokes.length || current || committing) return;
  committing = true;
  document.getElementById('btnNext').disabled = true;
  const version = strokeVersion;
  previewSeq++;
  clearTimeout(previewTimer);
  try {
    let d = lastResult && lastResult.version === version ? lastResult : null;
    if (!d) {
      d = await predict(strokes);
    }
    if (version !== strokeVersion) return;
    words.push({ text: d.text, chars: d.chars });
    clearCurrent();
    render();
  } catch (err) {
    document.getElementById('msg').textContent = String(err.message || err);
  } finally {
    committing = false;
    document.getElementById('btnNext').disabled = false;
  }
}

function expectedWords() {
  const raw = document.getElementById('expected').value;
  return raw.replace(/[.,;:!?"()]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.normalize('NFC'));
}
function same(a, b, ignoreCase) {
  a = a.normalize('NFC'); b = b.normalize('NFC');
  return ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function render() {
  const exp = expectedWords();
  const ignoreCase = document.getElementById('ignoreCase').checked;

  let right = 0;
  document.getElementById('words').innerHTML = words.map((w, i) => {
    let cls = '', extra = '';
    if (i < exp.length) {
      if (same(w.text, exp[i], ignoreCase)) { cls = ' ok'; right++; }
      else { cls = ' bad'; extra = '<span class="exp">đáp án: ' + esc(exp[i]) + '</span>'; }
    }
    return '<div class="chip' + cls + '">' + (charsHtml(w.chars) || '(rỗng)') + extra + '</div>';
  }).join('');

  const next = document.getElementById('next');
  const score = document.getElementById('score');
  if (exp.length) {
    next.innerHTML = words.length < exp.length ? 'Từ cần viết tiếp (từ ' + (words.length + 1) + '/' + exp.length + '): <b>' + esc(exp[words.length]) + '</b>' : 'Đã viết hết bài.';
    const done = Math.min(words.length, exp.length);
    score.textContent = done ? 'Đúng ' + right + ' / ' + done + ' từ đã viết' : '';
  } else {
    next.textContent = '';
    score.textContent = words.length ? 'Câu nhận diện được: ' + words.map(w => w.text).join(' ') : '';
  }
}

document.getElementById('btnNext').onclick = commitWord;
document.getElementById('btnClear').onclick = clearCurrent;
document.getElementById('btnUndo').onclick = () => { strokes.pop(); current = null; strokeVersion++; resetLive(); redraw(); clearTimeout(previewTimer); if (strokes.length) previewTimer = setTimeout(preview, 200); };
document.getElementById('btnDelWord').onclick = () => { words.pop(); render(); };
document.getElementById('btnReset').onclick = () => { words = []; clearCurrent(); render(); };
document.getElementById('expected').addEventListener('input', render);
document.getElementById('ignoreCase').addEventListener('change', render);

window.addEventListener('keydown', e => {
  const t = e.target && e.target.tagName;
  if (t === 'TEXTAREA' || t === 'INPUT') return;
  if (e.key === ' ') { e.preventDefault(); commitWord(); }
  else if (e.key === 'Escape') clearCurrent();
  else if (e.key === 'Backspace') { words.pop(); render(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); document.getElementById('btnUndo').onclick(); }
});
document.addEventListener('click', e => { if (e.target && e.target.tagName === 'BUTTON') e.target.blur(); });
window.addEventListener('resize', resize);
resize();
render();
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
            strokes = payload.get("strokes", [])
            expected = payload.get("expected", "")
            self._json(200, self.recognizer.predict(strokes, expected=expected))
        except ValueError as e:
            self._json(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": f"Lỗi server: {e}"})

    def log_message(self, *args) -> None:
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="word_stable")
    ap.add_argument("--level", default=None, choices=list(cfg.LEVELS))
    ap.add_argument("--port", type=int, default=8001)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    Handler.recognizer = Recognizer(args.run_name, level=args.level)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}"
    print(f"Model: {args.run_name} (mức: {args.level}) | mở {url} (Ctrl+C để dừng)")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng.")


if __name__ == "__main__":
    main()
