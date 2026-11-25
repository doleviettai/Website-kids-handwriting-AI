# NétXinh — FastAPI cho ba model chữ viết tay

Chạy từ thư mục `ai-server/`, Python 3.12:

```powershell
# Chỉ tạo venv nếu máy chưa có
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Nếu venv và dependencies đã có trên máy hiện tại, chỉ cần dòng uvicorn. Không cần train lại. Mở [Swagger AI](http://127.0.0.1:8000/docs) và [trạng thái model](http://127.0.0.1:8000/health). Đợi thông báo startup complete trước khi gửi bài. CPU trên Windows được hỗ trợ, không cần CUDA.

## Model và nguồn inference

| Task | Checkpoint | Input thực tế |
| --- | --- | --- |
| SINGLE_CHAR | `model/don/best.keras` | Online strokes → 128 × 7 feature, base/modifier/tone và SVM hybrid khớp hash |
| COMPOUND | `model/ghep/ghep_best.keras` | Online strokes → ảnh 64 × 192 × 1 và geometry, 148 lớp |
| PARAGRAPH | `model/word/word_best.keras` | Online strokes từng từ → features × 5 và lengths, CTC 212 lớp |

Checkpoint đã so SHA-256 với source người dùng cung cấp tại `D:/Coding/Python/HandWriting`: khớp `baseline_stable`, `ghep_handwriting_v4`, `seq/word_stable`. Không thay model gốc. Bản sao code ở `vendor/handwriting/src`, labels/preprocessing/SVM đúng run cạnh checkpoint; `vendor/provenance.json` lưu hash nguồn. Dự án train bên ngoài không bị sửa; khi chạy không phụ thuộc đường dẫn đó. Không copy dataset/bài trẻ vào web.

Custom layers `ShapeSummary`, `ApplySequenceMask`, `DownsampledMask` dùng source gốc. Adapter nay khởi tạo trực tiếp `src.serve.Recognizer`, `src.ghep.serve_ghep.Recognizer` và `src.seq.serve_seq.Recognizer` từ snapshot đã đối chiếu với các trang test của người dùng. Không tự viết lại logic predictor/decoder; chỉ đổi đường dẫn run sang bộ artifact local. Không chạy HTTP server hoặc training của source gốc. `status_seq.py` chỉ báo tiến độ train, không nhận dạng.

**Giới hạn:** model `word_best.keras` train theo từng từ, không phải OCR cả trang/ảnh đoạn văn. UI cho bé viết từng từ, bấm “Xong từ này”, rồi ghép kết quả thành câu theo thứ tự. Chữ ghép chỉ nhận trong tập 148 lớp; chữ ngoài tập có thể bị gán lớp gần nhất.

**CAMERA chưa hỗ trợ:** ba pipeline cần nét online có hướng/thứ tự/geometry. API trả 422, không dựng nét giả từ ảnh. Khi có model ảnh phù hợp cần pipeline riêng; hướng/thứ tự nét CAMERA luôn NULL.

## API

`GET /health`: trạng thái từng task, version, path và SHA-256. `UP` khi cả ba tải được, nếu thiếu dependency/artifact sẽ `DEGRADED`. Không fallback mock.

`POST /analyze` nhận JSON:

```json
{
  "task": "SINGLE_CHAR",
  "modelVersion": "v1",
  "source": "TOUCH",
  "expectedText": "l",
  "width": 900,
  "height": 420,
  "strokes": [[{"x":450,"y":90,"t":1000},{"x":450,"y":330,"t":1100}]],
  "wordEnds": [],
  "template": null
}
```

Khung 1–4096, 1–100 nét, tối đa 20.000 điểm; thời gian tăng dần, tọa độ hữu hạn trong khung. `wordEnds` chỉ cho PARAGRAPH, là số nét tích lũy tại cuối mỗi từ: `[2,5]` nghĩa là từ 1 nét 0–1, từ 2 nét 2–4. Mốc cuối bằng số nét.

Đáp án chỉ dùng so sánh **sau nhận dạng**, không truyền vào predictor. CTC dùng decoder gốc có language_model; `text` là visual prediction, `suggested_text` là gợi ý ngôn ngữ riêng, không thay kết quả bằng đáp án/gợi ý. Response analyze có predictedText/confidence/textAccuracy, model path/version, điểm tham khảo nullable, errors và segments theo từng từ với strokeStart/strokeEnd. Text theo NFC; accuracy `max(0,1-Levenshtein/len(expected))`. Với bài từ/câu, phép đối chiếu bỏ qua hoa/thường và dấu câu `.,;:!?"()` như trang test gốc; predictedText vẫn giữ nguyên. Không bịa bbox/vị trí ảnh.

`POST /recognize` là nhận dạng thử, không đánh giá/lưu bài. Nhận `{task,modelVersion,width,height,strokes}`, không cần đáp án. Trả `text`, `confidence`, `uncertain`, danh sách `candidates`, mức hỗ trợ từng ký tự (`chars` cho word), `suggestedText` riêng và `preview` ảnh 64×192 model chữ ghép thực sự nhìn thấy. Preview không tăng attempt hay tiến độ. Backend bảo vệ endpoint tương ứng `/api/recognition/preview` bằng JWT/ownership.

Canvas chữ đơn có tỷ lệ **1:1**, chuẩn hóa từng trục về 0–1, round4 số thập phân như JS serve.py. Canvas chữ ghép và từ/câu **5:2**, giữ tỷ lệ hình học trong cả desktop/mobile. Điểm được thu bằng Pointer Events/getCoalescedEvents, không lọc bỏ nét dấu ngắn hoặc làm tròn thành pixel nguyên trước inference. Thay đổi tỷ lệ canvas có thể làm input khác hẳn dù cùng checkpoint.

FastAPI phục vụ backend trên loopback/mạng nội bộ; frontend gọi Spring Boot. Khi deploy remote cần xác thực service/network thích hợp; không expose dịch vụ này trực tiếp ra trình duyệt.

## Đánh giá

- Ba model là model **nhận dạng**, không phải model chấm độ đẹp chữ.
- Không có mẫu: hình dạng/tương đồng/hướng/thứ tự NULL, chỉ báo độ khớp nội dung.
- Có mẫu chữ đơn/ghép: hình dạng là IoU nét raster sau chuẩn hóa bounding box, tương đồng là IoU theo khung. Hướng/thứ tự chỉ so khi gán được nét tương ứng. Đây là geometry tham khảo, chưa hiệu chuẩn thành thang đo giáo dục.
- Mã lỗi: WRONG_TEXT, LOW_CONFIDENCE (<0.65), MISSING_STROKES, EXTRA_STROKES; WRONG_DIRECTION/STROKE_ORDER_WRONG khi đủ đối chiếu. Phản hồi được quản lý trong MySQL.
- Confidence là mức tin cậy recognizer, không phải xác suất bé đúng/điểm đẹp. Phụ huynh/admin xem bài thật trước khi kết luận, nhất là confidence thấp.
- Backend quyết định điểm/sao, phản hồi và tiến độ; FastAPI không ghi DB.

## Kiểm tra

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

10 test: load/predict ba model thật, đáp án không làm đổi nhận dạng, preview/decoder, validation/CAMERA, NULL khi thiếu mẫu, geometry/alignment, fail-closed và chính sách đối chiếu word. Test parity nạp trực tiếp các file demo bên source train (nếu có trên máy), gửi cùng nét ở hai kích thước và xác nhận text/confidence khớp. Chỉ test chính sách so sánh word dùng fixture cố định để tách khỏi chất lượng OCR, không dùng fixture trong runtime. Đây là kiểm tra kỹ thuật, không phải benchmark accuracy trên tập trẻ thực tế.

TensorFlow/Keras pin cùng bản artifact. Thay checkpoint phải mang labels/preprocessing/custom source đúng run, cập nhật version/provenance và restart; không chỉ thay `.keras` rồi giữ mapping cũ. Loader kiểm tra hash checkpoint và artifact của run, readiness báo lỗi khi không khớp. SHA-256 trên health là bản đã nạp lúc startup.
