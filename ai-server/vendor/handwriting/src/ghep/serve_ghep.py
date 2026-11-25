"""Trang demo nhận diện CHỮ GHÉP (CNN phân loại 148 tổ hợp: th, ngh, uyên, ương...):

    python -m src.ghep.serve_ghep --run-name ghep_v1

Mở http://127.0.0.1:8002 (tự mở sẵn). Viết từng chữ ghép lên khung bằng chuột, bấm Space để sang chữ tiếp.
Có thể nhập danh sách chữ cần viết vào ô bên dưới để app đối chiếu từng chữ.
Chỉ dùng thư viện chuẩn + TensorFlow + Pillow (đã có sẵn trong project).
Lưu ý: model chỉ chọn trong 148 chữ ghép đã học, viết chữ ngoài danh sách vẫn ra một đáp án gần nhất.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from PIL import Image

from .config_ghep import run_dirs
from .data_ghep import normalize, render, validate_strokes
from .inference_ghep import Predictor
from .collect_ghep import save_correction


class Recognizer:
    def __init__(self, run_name: str, which: str = "best") -> None:
        model_dir, _ = run_dirs(run_name)
        self.predictor = Predictor(model_dir, which)
        self.run_name = run_name
        self.classes = self.predictor.classes
        self.lock = threading.Lock()

    def predict(self, strokes_json, k: int = 5) -> dict:
        try:
            strokes = validate_strokes(strokes_json)
        except (ValueError, TypeError):
            raise ValueError("Dữ liệu nét viết không hợp lệ.")
        n_points = sum(len(s) for s in strokes)
        if not isinstance(k, int) or k < 1:
            raise ValueError("k phải là số nguyên dương")

        img = render(normalize(strokes))  # đúng ảnh model nhìn thấy khi train/đánh giá
        with self.lock:
            self.predictor.refresh()
            probs = self.predictor.probabilities([strokes])[0]

        order = np.argsort(-probs)[:k]
        cands = [{"text": self.classes[i], "p": float(probs[i])} for i in order]
        buf = io.BytesIO()
        Image.fromarray((img[..., 0] * 255).astype("uint8")).save(buf, "PNG")
        preview = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        return {
            "text": cands[0]["text"],
            "confidence": cands[0]["p"],
            "candidates": cands,
            "n_strokes": len(strokes),
            "n_points": n_points,
            "preview": preview,
            "uncertain": bool(probs[order[0]] < 0.65 or
                              (len(order) > 1 and probs[order[0]] - probs[order[1]] < 0.15)),
            "hybrid_alpha": self.predictor.hybrid["alpha"] if self.predictor.hybrid else 0.0,
            "run_name": self.run_name,
        }


HTML = r"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo nhận diện chữ ghép</title>
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
  .live b { font-size:30px; color:var(--ink); letter-spacing:.02em; }
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
  .cand-pill { display:inline-block; font-size:14px; padding:3px 8px; border-radius:6px; border:1px solid var(--line); background:var(--card); color:var(--accent); margin:2px 4px 0 0; font-weight:500; }
  .seen { margin-top:8px; font-size:12px; color:var(--muted); }
  .seen img { display:block; width:288px; max-width:100%; image-rendering:pixelated; border:1px solid var(--line); border-radius:6px; background:#000; margin-top:4px; }
  details { margin-top:10px; }
  summary { cursor:pointer; font-size:13px; color:var(--muted); }
  .units { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .unit { font-size:15px; padding:3px 9px; border-radius:6px; border:1px solid var(--line); background:var(--card); color:var(--ink); font-weight:500; cursor:pointer; }
  input[type="text"], select { font:inherit; padding:7px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink); }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Luyện viết và nhận diện chữ ghép</h1>

    <div class="sub">Viết <b>một chữ ghép</b> (ví dụ: th, ngh, uyên, ương...) lên khung, thêm đủ dấu rồi bấm <b>Space</b> để sang chữ tiếp. Viết liền một dòng ngang, chấm chữ i và các dấu mũ, móc viết rõ.</div>
    <canvas id="pad"></canvas>
    <div class="live">Đang đoán: <b id="live">...</b> <span id="liveConf"></span></div>
    <div id="candsBox" style="display:none; margin-top:6px; font-size:13px; color:var(--muted);">
      Các khả năng khác: <span id="candsList"></span>
    </div>
    <div class="seen" id="seenBox" style="display:none;">Ảnh model nhìn thấy:<img id="seen" alt=""></div>
    <div class="msg" id="msg"></div>
    <details>
      <summary>Model đoán sai? Lưu nét đang viết với nhãn đúng</summary>
      <div class="row">
        <input id="writerId" type="text" maxlength="80" placeholder="Mã người viết, ví dụ tai01">
        <select id="correctLabel" aria-label="Chọn nhãn đúng"><option value="">Chọn chữ thực sự đã viết</option></select>
        <button id="btnSaveSample" type="button">Lưu mẫu train</button>
      </div>
      <div class="hint" id="saveStatus">Chỉ lưu khi bạn bấm nút. Dùng cùng mã cho cùng người. Mẫu được dùng khi tạo lượt train mới.</div>
    </details>
    <div class="row">
      <button class="primary" id="btnNext">Chữ tiếp (Space)</button>
      <button id="btnClear">Xóa chữ đang viết (Esc)</button>
      <button id="btnUndo">Hoàn tác nét (Ctrl+Z)</button>
      <button id="btnDelWord">Xóa chữ cuối (Backspace)</button>
      <button id="btnReset">Làm lại từ đầu</button>
    </div>
  </div>

  <div class="card">
    <h2>Danh sách chữ cần viết (không bắt buộc)</h2>
    <textarea id="expected" placeholder="Nhập các chữ ghép cách nhau bằng dấu cách, ví dụ: th ngh uyên ương"></textarea>
    <label><input type="checkbox" id="ignoreCase" checked> Bỏ qua phân biệt chữ hoa / chữ thường khi chấm</label>
    <div class="hint">Chữ thứ n bạn viết được đối chiếu với chữ thứ n trong danh sách. Model chỉ biết 148 chữ ghép bên dưới, viết chữ ngoài danh sách vẫn sẽ ra một đáp án gần nhất.</div>
    <details>
      <summary>Xem 148 chữ ghép model đã học (bấm vào một chữ để thêm vào danh sách)</summary>
      <div class="units" id="units"></div>
    </details>
  </div>

  <div class="card">
    <h2>Kết quả</h2>
    <div class="next" id="next"></div>
    <div class="words" id="words"></div>
    <div class="score" id="score"></div>
    <div class="hint" id="legend">Chữ màu cam hoặc đỏ: model chưa chắc chắn, hãy kiểm tra lại. Phần trăm là mức tin cậy của model, không phải xác suất viết đúng.</div>
  </div>
</div>

<script>
const CLASSES = __CLASSES__;
const canvas = document.getElementById('pad');

const ctx = canvas.getContext('2d');
let strokes = [];       // mỗi nét: [[x, y], ...] theo pixel của khung
let current = null;
let words = [];         // các chữ ghép đã chốt: {text, p}
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
function conf(text, p) {
  return '<span class="' + (p < 0.5 ? 'c-low' : p < 0.8 ? 'c-mid' : '') + '" title="' + pct(p) + '">' + esc(text) + '</span>';
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
    document.getElementById('msg').textContent = d.uncertain ? 'Model chưa chắc chắn. Bạn kiểm tra các gợi ý hoặc lưu mẫu với nhãn đúng để train lần sau.' : '';
    document.getElementById('live').innerHTML = conf(d.text, d.confidence);
    document.getElementById('liveConf').textContent = 'điểm nhận dạng ' + pct(d.confidence);

    const cBox = document.getElementById('candsBox');
    const cList = document.getElementById('candsList');
    const others = d.candidates.slice(1);
    if (others.length) {
      cList.innerHTML = others.map(c => '<span class="cand-pill">' + esc(c.text) + ' ' + pct(c.p) + '</span>').join('');
      cBox.style.display = 'block';
    } else {
      cBox.style.display = 'none';
    }
    document.getElementById('seen').src = d.preview;
    document.getElementById('seenBox').style.display = 'block';
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
  document.getElementById('seenBox').style.display = 'none';
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
    words.push({ text: d.text, p: d.confidence });
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
  return document.getElementById('expected').value.split(/[\s,.;:!?]+/).filter(Boolean).map(w => w.normalize('NFC'));
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
    return '<div class="chip' + cls + '">' + conf(w.text, w.p) + extra + '</div>';
  }).join('');

  const next = document.getElementById('next');
  const score = document.getElementById('score');
  if (exp.length) {
    next.innerHTML = words.length < exp.length ? 'Chữ cần viết tiếp (chữ ' + (words.length + 1) + '/' + exp.length + '): <b>' + esc(exp[words.length]) + '</b>' : 'Đã viết hết danh sách.';
    const done = Math.min(words.length, exp.length);
    score.textContent = done ? 'Đúng ' + right + ' / ' + done + ' chữ đã viết' : '';
  } else {
    next.textContent = '';
    score.textContent = words.length ? 'Nhận diện được: ' + words.map(w => w.text).join(' ') : '';
  }
}

document.getElementById('units').innerHTML = CLASSES.map(c => '<button class="unit" type="button">' + esc(c) + '</button>').join('');
document.getElementById('correctLabel').innerHTML = '<option value="">Chọn chữ thực sự đã viết</option>' + CLASSES.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
document.getElementById('btnSaveSample').onclick = async () => {
  const status = document.getElementById('saveStatus');
  const button = document.getElementById('btnSaveSample');
  if (!strokes.length || current) { status.textContent = 'Viết xong một chữ ghép trước khi lưu.'; return; }
  const truth = document.getElementById('correctLabel').value;
  const writer = document.getElementById('writerId').value.trim();
  if (!truth || !writer) { status.textContent = 'Nhập mã người viết và chọn nhãn đúng.'; return; }
  button.disabled = true;
  try {
    const response = await fetch('/samples', {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({strokes, truth, writer})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không lưu được mẫu');
    status.textContent = data.message;
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
};
document.getElementById('units').addEventListener('click', e => {
  if (!e.target.classList.contains('unit')) return;
  const ta = document.getElementById('expected');
  ta.value = (ta.value.trim() ? ta.value.trim() + ' ' : '') + e.target.textContent;
  render();
});

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
    page: bytes

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
            self._send(200, self.page, "text/html; charset=utf-8")
        else:
            self._send(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:
        if self.path not in ("/predict", "/samples"):
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(payload, dict):
                raise ValueError("Request phải là JSON object")
            if self.path == "/samples":
                self._json(200, save_correction(payload.get("strokes", []), payload.get("truth", ""),
                                             payload.get("writer", ""), self.recognizer.classes))
            else:
                self._json(200, self.recognizer.predict(payload.get("strokes", [])))
        except ValueError as e:
            self._json(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": f"Lỗi server: {e}"})

    def log_message(self, *args) -> None:
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-name", default="ghep_stable")
    ap.add_argument("--weights", default="best", choices=["best", "last"])
    ap.add_argument("--port", type=int, default=8002)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    rec = Recognizer(args.run_name, args.weights)
    Handler.recognizer = rec
    classes_json = json.dumps(rec.classes, ensure_ascii=False).replace("</", "<\\/")
    Handler.page = HTML.replace("__CLASSES__", classes_json).encode("utf-8")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}"
    print(f"Model: {args.run_name} ({args.weights}) | {len(rec.classes)} chữ ghép | mở {url} (Ctrl+C để dừng)")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng.")


if __name__ == "__main__":
    main()
