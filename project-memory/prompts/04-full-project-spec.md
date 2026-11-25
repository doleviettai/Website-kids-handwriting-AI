# Đặc tả đầy đủ — triển khai chức năng trước, nối model sau

Nguồn: mô tả người dùng gửi ngày 22/11/2026. Nội dung gốc được giữ bên dưới để tra cứu.

## Điều chỉnh có hiệu lực từ yêu cầu mới nhất

**Cập nhật 25/11/2026:** ADMIN xóa bài học thì xóa vĩnh viễn nội dung, bài viết/kết quả, lỗi và tiến độ liên quan; người dùng đã yêu cầu xóa thật bài1 “Những nét bút đầu tiên”. Không áp dụng điều kiện “bài phải trống” cũ; thực hiện transaction theo lesson_id, giữ dữ liệu bài khác và hồ sơ bé. Xóa riêng item/error_type vẫn giữ ràng buộc. Đọc STATUS.md để biết trạng thái thao tác thật.

**Cập nhật 24/11/2026:** người dùng đã đưa model và yêu cầu nối FastAPI/canvas/nhận dạng/kết quả/lỗi/tiến độ, báo trong web cho ADMIN/PARENT. Yêu cầu này thay thế phần hoãn model ở các gạch đầu dòng cũ phía dưới. Đã chỉ định source train `D:/Coding/Python/HandWriting`; dùng đúng pipeline/nhãn, không mock. Model word thực tế theo từ nên câu/đoạn được gửi từng từ; CAMERA chưa hỗ trợ bởi ba model online này. Đọc PROJECT_CONTEXT.md và STATUS.md hiện tại.

- Bước 1 (database, Flyway, seed, entity/repository) đã hoàn thành. Yêu cầu tiếp theo của người dùng là sửa frontend; đã cho phép nối các màn auth/hồ sơ/bài học/tiến độ cùng API cần thiết. Đọc STATUS.md trước khi tiếp tục, không dùng điểm dừng bước 1 cũ để bỏ dở yêu cầu mới.
- Chưa làm nhận dạng/chấm chữ đơn, chữ ghép, đoạn văn; chưa gọi model hoặc service Python. Mô tả MockAiClient phía dưới là phương án tương lai, chưa áp dụng ở bước 1.
- Repo thực tế dùng Gradle + Spring Boot + Java 21; giữ Gradle, không chuyển sang Maven.
- Schema MySQL thực tế: `kids_handwriting`, cổng `3306`; DBML nằm tại `../database.dbml`, không thay schema nghiệp vụ.
- Credentials chỉ nằm trong cấu hình local được Git bỏ qua hoặc biến môi trường; không đưa mật khẩu vào prompt/bộ nhớ.
- Giao diện React đã có demo; không coi mô tả “chưa có code nghiệp vụ” là trạng thái frontend hiện tại.

---

## Mô tả người dùng cung cấp

# VAI TRÒ
Bạn là senior full-stack developer. Hãy xây dựng web "Luyện viết chữ, số tiếng Việt cho trẻ em" (mẫu giáo đến lớp 1).

# BỐI CẢNH
- Thư mục gốc: D:\Coding\Java\kid-handwriting-ai, gồm backend/ (Spring Boot, Maven, Java 21) và frontend/ (React + Vite + TypeScript). Hai project đã được tạo khung, chưa có code nghiệp vụ.
- Database: MySQL, utf8mb4, quản lý bằng Flyway. Schema nằm ở cuối prompt (DBML). KHÔNG tự ý đổi schema; nếu thấy cần sửa thì dừng lại và đề xuất trước.
- Giao diện tiếng Việt, thiết kế cho trẻ em: nút to, màu sáng, dùng tốt trên máy tính bảng và điện thoại.

# GIAI ĐOẠN HIỆN TẠI: ĐỦ CHỨC NĂNG, CHƯA NỐI MODEL AI
Hệ thống có 3 model AI viết bằng Python (chữ đơn, chữ ghép, đoạn văn) sẽ được nối ở giai đoạn sau. Bây giờ:
- KHÔNG gọi service Python nào, KHÔNG viết code Python.
- Tạo interface `AiClient` với hàm `AiResult analyze(AiRequest request)`.
- Cài đặt `MockAiClient` (dùng khi `ai.mode=mock`). Sau này sẽ thêm `HttpAiClient` (`ai.mode=http`) mà không phải sửa phần còn lại.
- Chọn model theo item_type: LETTER, DIGIT -> SINGLE_CHAR; DIGRAPH -> COMPOUND; WORD, SENTENCE -> PARAGRAPH. Lấy bản `ai_models` có is_active = true của task đó, gán vào submissions.model_id.

## Hợp đồng AI (cố định ngay từ bây giờ)
AiRequest:
- task (SINGLE_CHAR | COMPOUND | PARAGRAPH), expectedText, source (TOUCH | CAMERA)
- strokes: danh sách nét [[{x,y,t}]] (chỉ khi TOUCH)
- imagePath hoặc imageBytes (khi CAMERA, hoặc ảnh render từ nét vẽ)
- templateStrokes: lấy từ writing_items.template_json (có thể null)

AiResult:
- predictedText, confidence (0-1), textAccuracy (0-1)
- segments: [{index, expected, predicted, confidence, score}] (chỉ cho PARAGRAPH)
- shapeScore, similarityScore (0-100)
- directionScore, strokeOrderScore (0-100, null khi CAMERA)
- errors: [{code, segmentIndex, strokeIndex}] (code phải tồn tại trong error_types)

## Hành vi của MockAiClient
- Kết quả giả lập hợp lý, không hoàn toàn ngẫu nhiên: với TOUCH, so số nét của trẻ với số nét của mẫu; ít hoặc nhiều hơn thì hạ điểm và sinh lỗi tương ứng (ví dụ STROKE_ORDER_WRONG, TOO_SMALL). Không có mẫu thì dùng điểm ngẫu nhiên trong khoảng 55-95.
- Với CAMERA: directionScore và strokeOrderScore = null.
- predictedText = expectedText với xác suất khoảng 85%, còn lại sai một ký tự.
- Giả lập độ trễ 300-800 ms.

# QUY TẮC NGHIỆP VỤ
- total_score: TOUCH = 0.3*shape + 0.3*similarity + 0.2*direction + 0.2*strokeOrder. CAMERA = 0.5*shape + 0.5*similarity. PARAGRAPH nhân thêm trọng số textAccuracy. Mỗi hệ số đặt trong một class cấu hình riêng, dễ chỉnh.
- stars: >=90 -> 3, >=70 -> 2, >=50 -> 1, còn lại 0.
- feedback_text: ghép từ error_types.feedback_template_vi của các lỗi phát hiện; không có lỗi thì dùng câu khen. Không hard-code nội dung phản hồi trong code.
- Sau mỗi bài nộp, cập nhật student_progress: attempts + 1, last_score, best_score, last_attempt_at; is_mastered = true khi best_score >= 80 và attempts >= 3.
- text_value luôn chuẩn hóa Unicode NFC trước khi lưu hoặc so sánh.
- So sánh predictedText với expectedText sau khi chuẩn hóa NFC.

# CHỨC NĂNG
## Chung
- Đăng ký (mặc định role PARENT), đăng nhập, đăng xuất bằng JWT, mật khẩu BCrypt.
- Phân quyền theo role; phụ huynh chỉ truy cập được dữ liệu của con mình.

## Phụ huynh (PARENT)
1. Quản lý hồ sơ trẻ: thêm, sửa, xóa; chỉ nhập biệt danh, năm sinh, cấp học (không lưu họ tên thật).
2. Chọn hồ sơ trẻ để vào học.
3. Lộ trình học: danh sách bài học theo cấp học của trẻ, trong mỗi bài là các chữ/số, hiển thị trạng thái (chưa học, đang học, đã thuộc) và số sao cao nhất.
4. Màn hình luyện viết:
   - Hiện chữ mẫu mờ phía sau (vẽ từ template_json nếu có), có nút xem mẫu chuyển động theo thứ tự nét.
   - Canvas viết bằng cảm ứng/chuột/bút dùng Pointer Events, thu từng điểm {x, y, t}, tách nét theo pointerdown/pointerup, có nút Xóa và Hoàn tác nét cuối. Chặn cuộn trang khi viết (touch-action: none).
   - Tab "Chụp ảnh": mở camera hoặc chọn ảnh từ máy (input file, capture), xem trước ảnh rồi mới gửi.
   - Gửi bài, hiện loading, rồi hiện kết quả: sao (có hiệu ứng), điểm từng tiêu chí, chữ model nhận ra, lời phản hồi, danh sách lỗi. Với đoạn văn hiện kết quả từng từ/chữ. Với CAMERA ẩn hai tiêu chí hướng nét và thứ tự nét.
   - Nút "Viết lại" và "Bài tiếp theo".
5. Lịch sử bài viết của trẻ (lọc theo chữ, ngày), xem lại chi tiết từng bài.
6. Tiến độ: tổng số chữ đã thuộc, biểu đồ điểm trung bình theo ngày, danh sách chữ hay sai (nhiều lần điểm thấp).

## Quản trị (ADMIN)
1. CRUD lessons.
2. CRUD writing_items, kèm trình vẽ mẫu: admin vẽ trực tiếp trên canvas để tạo template_json (width, height, strokes).
3. CRUD error_types (code, tên, mẫu phản hồi tiếng Việt).
4. Quản lý ai_models (task, name, version, model_path, is_active); khi bật một bản thì tự tắt các bản khác cùng task.
5. Xem danh sách người dùng và thống kê tổng quan (số trẻ, số bài nộp, điểm trung bình).

# LƯU TRỮ ẢNH
Tạo interface `FileStorageService`, cài đặt bản lưu vào thư mục local `uploads/` (cấu hình đường dẫn qua application.yml) và phục vụ qua URL. Sau này có thể thêm bản Cloudinary. Chỉ nhận jpg, png, webp, giới hạn 5 MB; đặt tên file ngẫu nhiên (UUID).

# DỮ LIỆU MẪU (Flyway V2)
- 1 tài khoản ADMIN (email và mật khẩu lấy từ biến môi trường hoặc ghi chú rõ trong README).
- Lessons theo lộ trình: nét cơ bản, chữ số 0-9, bảng chữ cái tiếng Việt (có dấu), chữ ghép (ch, th, ng, nh, gh, ngh, kh, tr, ph, gi, qu), một số từ và câu ngắn.
- writing_items tương ứng; template_json chỉ cần seed vài mục đơn giản (ví dụ 1, 0, l, o), các mục còn lại để NULL để admin vẽ sau.
- error_types với các code: ROUND_TOO_OPEN, WRONG_START_POINT, STROKE_ORDER_WRONG, TOO_SMALL, TILTED, WRONG_SPACING kèm câu phản hồi tiếng Việt thân thiện với trẻ.
- 3 dòng ai_models (SINGLE_CHAR, COMPOUND, PARAGRAPH, version v1, is_active = true).

# YÊU CẦU KỸ THUẬT
Backend:
- Kiến trúc controller / service / repository / entity / dto / config / exception; không trả entity ra API, dùng DTO.
- Validation (Jakarta), global exception handler trả JSON lỗi thống nhất (message tiếng Việt).
- Phân trang cho lịch sử bài viết.
- Tài liệu API bằng springdoc-openapi (Swagger UI).
- Cột JSON ánh xạ đúng kiểu (stroke_data, template_json, segments_json).
- Chặn truy cập chéo: phụ huynh A không xem được trẻ hoặc bài viết của phụ huynh B (kiểm tra ở tầng service).
- Không log dữ liệu nhạy cảm (mật khẩu, JWT).

Frontend:
- React Router, axios instance có interceptor gắn JWT và xử lý 401, state đơn giản (Context hoặc Zustand), form có validate.
- Vite proxy /api sang http://localhost:8080.
- Component DrawingCanvas tái sử dụng được cho cả màn luyện viết lẫn trình vẽ mẫu của admin.
- Giao diện responsive, ưu tiên máy tính bảng; ngôn ngữ giao diện tiếng Việt.

# CÁCH LÀM VIỆC
Làm theo từng bước và DỪNG sau mỗi bước để tôi chạy thử:
1. Flyway V1 (schema) + V2 (seed) + entity + repository.
2. Auth JWT và phân quyền.
3. API nội dung học và API admin (lessons, items, error_types, ai_models).
4. API nộp bài: FileStorageService, AiClient + MockAiClient, tính điểm, cập nhật tiến độ.
5. Frontend: layout, đăng nhập/đăng ký, quản lý hồ sơ trẻ, lộ trình học.
6. Frontend: DrawingCanvas, màn luyện viết (cảm ứng + chụp ảnh), màn kết quả.
7. Frontend: lịch sử, tiến độ, các trang admin.
Sau mỗi bước: liệt kê file đã tạo hoặc sửa, cách chạy kiểm tra, và các giả định bạn đã đặt ra.

Cuối cùng viết README ngắn: cách chạy backend, frontend, tài khoản admin mặc định, và mục "Nối model AI thật" mô tả việc cần làm là thêm HttpAiClient và đổi ai.mode=http.

# SCHEMA (DBML)
[DÁN TOÀN BỘ DBML Ở ĐÂY]
