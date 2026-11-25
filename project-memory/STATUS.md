# Trạng thái và bàn giao

Cập nhật: 25/11/2026. Yêu cầu mới nhất: ADMIN xóa bài học thì xóa cả nội dung và lịch sử liên quan; đã xóa thật bài 1 theo yêu cầu. Phần sửa model/canvas trước đó được giữ nguyên.

## Xóa bài học kèm lịch sử — 25/11/2026

- Người dùng cho phép rõ xóa luôn bài 1 “Những nét bút đầu tiên” cùng lịch sử, và đổi chính sách chung khi admin xóa bài. Yêu cầu mới thay thế điều kiện bài phải trống cũ.
- `AdminContentService.deleteLesson`: khóa lesson và writing_items trong transaction, xóa lỗi bài viết → tiến độ → bài viết → nội dung → bài học theo lesson_id. Clear JPA context sau native deletes để tránh cache entity đã xóa. Không sửa schema/migration hoặc tắt FK.
- UI xác nhận xóa vĩnh viễn, số nội dung hiện trong bài, bài viết/kết quả/lỗi/tiến độ của các bé liên quan và không thể hoàn tác. Sau xóa tải lại thư viện, thông báo đã xóa toàn bộ dữ liệu liên quan. PARENT tiếp tục bị chặn quyền xóa bài học.
- Đã **xóa thật bài id=1** qua API ADMIN mới trên backend kiểm tra: 1 lesson, 1 writing_item (`l`), 4 submissions, 7 submission_errors, 2 student_progress. Đối chiếu ID trước/sau: các bản ghi không thuộc bài này và hồ sơ/tài khoản/danh mục model/lỗi giữ nguyên. Chi tiết bài1 trả404, không còn bản ghi liên quan. Không ghi nhận danh tính hoặc bài viết của trẻ vào tài liệu.
- Thao tác xóa thật dùng script tạm trong backend/build/tmp (Git ignore) để gọi API/admin và đối chiếu dữ liệu, đã dọn script sau khi xong. Không tự xóa bài khác.
- Kiểm tra: frontend build/lint đạt; **22 test Java** đạt, bao gồm populated lesson deletion, quyền, giữ bài khác và rollback database khôi phục đầy đủ; **4 E2E liên quan** đạt (admin CRUD/cancel, family desktop/mobile, xóa populated lesson+history bằng UI). Đã xem ảnh hộp xác nhận. Các test danh mục cập nhật theo count database, không ép giữ nguyên seed6bài/58nội dung. Test JSON mẫu dùng fixture rollback, không khôi phục seed admin đã xóa.
- Hiện còn 5 bài/56 nội dung trong local DB sau thao tác; số0 đã không còn trước phiên này, được giữ nguyên thay đổi sẵn có của người dùng. Đã chạy lại toàn bộ22testJava và2E2Egiađình sau khi xóa thật, tất cả đạt. Dữ liệu test được dọn/rollback, kiểm tra không có FK mồ côi ở bài viết/lỗi/tiến độ, không còn userE2E.
- Cấu hình backend IDE8080 vẫn cần Stop/Run để nạp chính sách xóa mới cho lần dùng sau. Frontend tải lại Ctrl+F5. Backend18080/Vite15173 dùng để kiểm tra đã được dừng trước bàn giao để tránh chiếm cổng.
- Xóa riêng item có lịch sử và xóa/đổi mã error_type đã dùng vẫn bị chặn. Chính sách xóa cascaded chỉ áp dụng qua hành động xóa cả bài học của ADMIN.

## Sửa canvas và parity demo — phiên mới nhất

- Đã đọc serve.py, serve_ghep.py, status_seq.py và tìm đúng serve_seq.py nhận dạng word. Không sửa project train ngoài repo. Giữ nguyên các thư mục model đầy đủ vừa được người dùng copy thêm vào ai-server.
- Adapter Python dùng trực tiếp Recognizer gốc của ba demo, local run don/ghep/word; cùng labels/preprocessing/custom layers, hash verification. Word sử dụng decoder/language_model như demo nhưng suggestedText tách khỏi visual text.
- Khắc phục tỷ lệ: SINGLE_CHAR canvas vuông420×420; COMPOUND/PARAGRAPH ngang900×360. Không dùng một canvas900×420 cho tất cả task hoặc đổi tỷ lệ khác trên mobile. Giữ điểm float/coalesced events, không bỏ nét dấu ngắn. Gợi ý chữ mặc định tắt trong practice.
- Tách URL và UI ba chế độ `/luyen-tap/chu-don`, `/chu-ghep`, `/doan-van`; menu Góc luyện viết, nhận dạng thử trước khi lưu, word document có từ/confidence đã nhận dạng, sửa từ cuối, Space để chốt. Không tự nhận cả đoạn nhiều dòng bằng model từ.
- API preview /recognize và /api/recognition/preview có ownership, không ghi bài/progress. Response gồm text/confidence/candidates/chars/suggestedText và ảnh model ghép thấy; stale requests bị hủy khi viết tiếp. Kết quả lưu chính thức vẫn do server re-infer, không lấy nhãn client.
- So sánh từ/câu bỏ qua hoa/thường và dấu câu giống demo word, lưu raw prediction. Kết quả cũ trong DB không bị tính lại. Chữ đơn/ghép so NFC chính xác. Chế độ xem nét đã lưu dùng tỷ lệ theo task; không thêm cột schema.
- Kiểm tra Python parity với file demo thực bên dự án train: cùng nét ở 2 kích thước, cả ba task khớp text/confidence. Có test preview không dùng đáp án, không thay visual text bằng từ điển, và chính sách đối chiếu word. Java thêm test preview ownership/không tạo attempt (21 test tổng); sửa assertion review để không giả định DB chưa có bài thật. Không xóa/reset bài người dùng để chạy test.
- Kiểm tra cuối đạt: build/lint frontend; **10 test Python**, **21 test Java**, **5 E2E**. Test mới kiểm tra mode/aspect desktop/mobile, giữ nét ngắn, preview không tăng attempt, response cũ không xuất hiện khi viết tiếp, Space chốt từ, sửa/chốt/lưu cả bài. Test parity với 3 file demo gốc khớp text/confidence ở 2 kích thước mỗi task.
- Đã xem ảnh QA single/compound/passage; báo cáo ở frontend/test-results bị Git bỏ qua. Test xóa đúng dữ liệu giả UUID, MySQL không còn user E2E; bài thật sẵn có được giữ nguyên. Không đổi schema/migration trong lượt này.
- Server kiểm tra cổng18000/18080/15173 được dừng trước bàn giao; cần restart FastAPI/Java/Vite cũ để nạp code. Không thay checkpoint, không train lại model. Giữ cấu hình và file model/data người dùng vừa copy thêm.

## Kiểm tra lại các run theo xác nhận của người dùng

Người dùng xác nhận ba run: baseline_stable, ghep_handwriting_v4 và seq/word_stable dưới D:/Coding/Python/HandWriting/models. Đã đối chiếu lại: checkpoint, artifact và snapshot source của web khớp hash với ba run này; 7 test AI chạy lại đều đạt. Báo cáo chi tiết [MODEL_REVIEW.md](MODEL_REVIEW.md).

Phát hiện khi đọc log: baseline hoàn thành early stop; v4 còn state running ở epoch84/100 nhưng các PID ghi log không còn; word có checkpoint dùng được sau13epoch nhưng lần chạy pipeline lại thất bại do run đã tồn tại/thiếu --resume. Metrics word hiện có đều thuộc hash checkpoint khác, chưa đại diện bản word_best.keras hiện dùng. Chưa resume/retrain hoặc sửa dự án train bên ngoài; không thay cấu hình runtime vì bản tích hợp đã khớp run được chỉ định.

## Đã triển khai trong lượt nối AI

- Xác minh SHA-256 ba checkpoint với source người dùng chỉ định `D:/Coding/Python/HandWriting`: don khớp baseline_stable; ghep khớp ghep_handwriting_v4; word khớp seq/word_stable.
- Copy snapshot inference, custom Keras layers, labels/preprocessing đúng run, SVM của chữ đơn và metadata vào ai-server. Không sửa dự án train bên ngoài hoặc các file .keras người dùng đưa. Provenance ở vendor/provenance.json; khi artifact/checkpoint đổi phải cập nhật đúng bộ, không dùng nhãn cũ âm thầm.
- Cài dependencies trong ai-server/.venv: TensorFlow 2.21, Keras 3.15.1, FastAPI/Uvicorn, Numpy/Pillow/sklearn/joblib và các thư viện cần cho inference. Requirements và README AI đã có.
- FastAPI `/health` và `/analyze`, load ba model thật, fail-closed, giới hạn body/nét/điểm/tọa độ/thời gian. Đáp án chỉ dùng đối chiếu sau prediction, không ép output theo expected text.
- Model word train ở mức từ: UI viết/chốt từng từ, wordEnds nhóm nét; CTC nhận dạng từng group, căn chỉnh để báo từ thiếu/thừa/sai và lưu segments. Chưa OCR cả trang/đoạn nhiều dòng hoặc camera.
- Java AiClient/HttpAiClient gọi FastAPI; POST /api/submissions xác minh owner trước và lúc lưu, result/task/path/version hợp lệ, không ghi bài/attempt khi AI lỗi. Không giữ transaction DB trong lúc chờ HTTP.
- Ghi submissions/submission_errors/student_progress cùng transaction; khóa hồ sơ bé chống mất lượt; strokes lưu tọa độ chuẩn 900×420. Lưu model ID/version và đầy đủ kết quả/nét để mở lại. Item/template vừa đổi trong lúc inference sẽ yêu cầu tải lại bài.
- V3 **chỉ migration dữ liệu**, không thay schema cột: điền model_path v1 còn NULL và thêm WRONG_TEXT/LOW_CONFIDENCE/MISSING_STROKES/EXTRA_STROKES/WRONG_DIRECTION. V1/V2 giữ nguyên, hiện có 11 loại lỗi.
- Canvas thật `/luyen-viet/:lessonId?item=...`, chi tiết `/bai-viet/:submissionId`; nhận dạng, độ tin cậy, độ đúng, tiêu chí nullable, sao, lỗi/từ và nét đã lưu. Mất dịch vụ không báo bài đã lưu; giữ nét để thử lại.
- Parent: chuông/Góc ba mẹ, nhóm lỗi theo con, lịch sử và link kết quả. Admin: `/quan-tri/bai-viet`, lọc bài lỗi/tất cả, phân trang, xem chi tiết và trạng thái ba model.
- Thông báo là trong web, làm mới khi vào trang/bấm nút; không có push/email/đã đọc. PARENT chỉ xem con mình; ADMIN được xem bài để hỗ trợ, không mở truy cập chéo giữa phụ huynh.

## Đánh giá: cơ sở và giới hạn

- Model hiện là nhận dạng chữ, không phải model chấm độ đẹp đã hiệu chuẩn.
- Có mẫu admin (chữ đơn/ghép): shape là IoU raster sau chuẩn hóa, similarity theo khung. Hướng so chuỗi resample (kể cả nét tròn), thứ tự chỉ khi gán được nét; thiếu cơ sở để NULL. Kết quả được gắn nhãn geometry tham khảo.
- Không mẫu: các tiêu chí NULL và tổng là độ đúng nội dung. Không lấy confidence làm điểm đẹp hoặc tạo điểm ngẫu nhiên.
- Tổng khi có mẫu là trung bình trọng số tiêu chí có thật (0.3/0.3/0.2/0.2, chuẩn hóa khi thiếu) × textAccuracy, sao 90/70/50. Không mẫu =100×textAccuracy. Nhận dạng-only không đánh dấu thành thạo; điều kiện thuộc cần geometry, attempts>=3, điểm hiện tại>=80, text đúng và confidence>=0.65.
- Feedback lấy danh mục DB; LOW_CONFIDENCE nhắc người lớn kiểm tra thay vì kết luận trẻ sai. Bộ dữ liệu mẫu nét seed chưa được thẩm định; cần admin chuẩn hóa mẫu và đánh giá trên nhóm tuổi thực tế.
- CAMERA chưa hỗ trợ: ba pipeline online cần thứ tự/hướng/geometry. Không tạo nét từ ảnh giả; không gán điểm hướng/thứ tự CAMERA.
- Chưa có idempotency: nếu frontend timeout lúc server vừa lưu, xem lịch sử trước khi gửi lại để tránh lặp bài.

## Kiểm tra đã chạy

- Frontend build và lint đạt. E2E Google Chrome **4 test đạt cùng lượt**: CRUD admin/canvas, lỗi mạng mobile, luồng gia đình và pipeline nhận dạng thật qua ba dịch vụ.
- E2E AI viết bằng canvas, gửi chữ đơn thật, rồi gửi chữ ghép và câu qua API thật; kiểm tra dữ liệu MySQL/tiến độ, mở lại kết quả, nhóm lỗi parent và admin review/readiness. Không mock model trong E2E.
- FastAPI **7 test đạt với checkpoint thật**: ba model load/predict; expected answer không đổi prediction; validation/CAMERA; không mẫu để NULL; geometry/alignment/reverse direction; model unavailable fail-closed.
- Java `test bootJar`: **20 test đạt** (16 trước + 4 submission API). Kiểm tra quyền, dữ liệu hợp lệ, lưu lỗi/progress, result malformed, AI unavailable không lưu và nhận dạng-only không tự đánh dấu thuộc. Test double chỉ trong Java boundary tests, ứng dụng luôn HTTP thật.
- Đã xem ảnh QA desktop admin và kết quả 375px trong frontend/test-results (Git ignore). Đây là kiểm tra kỹ thuật, chưa phải benchmark accuracy/giáo dục trên tập dữ liệu trẻ độc lập.
- Java test rollback. E2E dọn đúng tài khoản/hồ sơ/bài/lỗi/progress thử có UUID của test; không xóa dữ liệu người dùng.
- Sau chỉnh cuối hash/version/geometry: đã chạy lại Python 7 test đạt; Java 20 test/bootJar đạt; frontend build/lint đạt; restart các server kiểm tra bằng bản cuối và chạy lại cả 4 E2E, tất cả đạt. Kiểm tra MySQL: V1/V2/V3 success, 11 loại lỗi, không còn tài khoản hoặc bài viết E2E.

## Chạy để xem

Từ gốc repo, ba terminal riêng:

```powershell
cd ai-server
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
cd backend
./gradlew.bat bootRun
```

```powershell
cd frontend
npm run dev
```

Dependencies trên máy này đã cài. Máy khác xem ai-server/requirements.txt và README. AI `/health` phải UP ba model, Swagger Python ở `/docs`. Backend AI_BASE_URL mặc định http://127.0.0.1:8000. Restart backend nếu đang dùng bản cũ trong IDE, không chạy hai tiến trình cùng cổng. JWT allowlist trong RAM, restart cần login lại.

Phiên kiểm tra dùng FastAPI 18000, backend 18080, Vite 15173; đã dừng trước bàn giao. Không mặc định server người dùng còn chạy. Mở web thường http://localhost:5173, chọn bé → bài/nội dung → Bé bắt đầu luyện viết. README gốc repo có lệnh chạy cả ba dịch vụ.

## Các chức năng nền đã có

Auth JWT/BCrypt; CRUD nhiều hồ sơ con; bài học từ MySQL; parent ownership. ADMIN CRUD bài/nội dung/loại lỗi và canvas mẫu. Xóa cả bài học xóa luôn lịch sử theo chính sách25/11. Xóa riêng nội dung có lịch sử/đổi text hoặc loại, lỗi đã dùng vẫn được bảo vệ. Không reset DB hoặc sửa migration cũ.

MySQL kids_handwriting local3306, config backend/config/local.properties bị Git bỏ qua. Admin local email admin@netxinh.local; password trong file local (không ghi trong bộ nhớ). JWT key riêng; source config public không chứa secrets.

## Còn lại

Quản lý phiên bản model, Java Swagger, upload ảnh/model camera riêng, OCR trang nhiều dòng, email/push/đã đọc, idempotency, refresh token/Redis/đa instance và kiểm định độ chính xác/điểm giáo dục. Không khẳng định đã hoàn thành những phần này.

## Workspace

Không tự commit, không sửa project train bên ngoài; giữ nguyên .keras. Python vendor snapshot còn module train phụ để bảo toàn import, FastAPI chỉ gọi inference. Khi thay checkpoint cần đúng labels/preprocessing/source và cập nhật provenance/version. Không đưa password/token/ảnh trẻ vào prompt/ngữ cảnh. Mô tả đầy đủ trong PROJECT_CONTEXT và README ba project.
