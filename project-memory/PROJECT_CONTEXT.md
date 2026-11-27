# Kid Handwriting AI — ngữ cảnh hiện tại

Cập nhật: 27/11/2026 (khảo sát code và metadata database; không triển khai tính năng mới). Nguồn: yêu cầu người dùng, code và kết quả kiểm tra ghi trong STATUS.md.

## Đối chiếu code và database khi tạo skill — 27/11/2026

Phạm vi lượt này chỉ khảo sát và hoàn thiện skill `.claude/skills/learning-management/SKILL.md`, kèm `references/project-map.md`; chưa triển khai các tính năng quản lý học tập mới. Các mô tả cũ bên dưới cần đọc cùng kết quả đối chiếu này.

- Code hiện có ba role PARENT/TEACHER/ADMIN, cấp học MAU_GIAO đến LOP_5, lớp/đợt chấm/bài tập giáo viên, mục tiêu/kế hoạch, nhận xét Admin tạo/xem, thông báo lưu DB có đã đọc và ảnh vở nhiều trang có kiểm tra quyền. Model nét online đã nối thật; model V5+Kids chấm ảnh vở vẫn chờ tích hợp. Không suy ra việc upload ảnh đồng nghĩa ba model online hỗ trợ CAMERA.
- Metadata chỉ đọc xác nhận MySQL **8.4.4**, database kids_handwriting, **21 bảng nghiệp vụ**, Flyway V1–V7 success. Con số MySQL 8.0.16, schema chỉ tới V4, “chưa có đã đọc/upload” ở phần mô tả cũ không còn phản ánh đầy đủ workspace hiện tại.
- DBML là tham chiếu và hiện lệch V6/database ở một số cột/bảng: classroom_invitations, homework_submission_pages, graded_at của student_evaluations, độ dài ghi chú liên hệ lớp và kiểu description của review_batches. Tên cột/kiểu/index thật ghi tại tài liệu tham chiếu của skill; không sửa migration hay schema theo DBML chưa khớp.
- Ba nhóm nghiệp vụ của skill là mục tiêu cho lần triển khai được giao: (A) mở rộng sửa nhận xét Admin và lịch sử phụ huynh hỗ trợ/ghi chú riêng, (B) báo cáo học tập PDF theo bé/khoảng ngày từ backend, (C) bài học DRAFT/PUBLISHED có audit. Các phần mới này **chưa triển khai**; không có cột/endpoint/dependency PDF hoặc status bài học trong code hiện tại.
- Báo cáo phải phân biệt predicted_text/confidence, text_accuracy/is_correct, tiêu chí geometry nullable và total_score đã kết hợp nội dung với geometry. Không có một cột “điểm nhận dạng” độc lập; không đổi công thức/model để bổ sung số liệu báo cáo.

## Chính sách xóa bài học mới nhất

Ngày 25/11/2026 người dùng yêu cầu xóa luôn bài 1 “Những nét bút đầu tiên”, và từ nay ADMIN xóa bài học thì xóa cả lịch sử của bài. Đã triển khai deleteLesson trong transaction: khóa lesson/items, xóa submission_errors, student_progress, submissions, writing_items và lesson. Không yêu cầu bài trống; thay thế điều kiện chặn cũ. Giữ bảng/cột/migration cũ, không tắt FK. UI thông báo xóa vĩnh viễn/không hoàn tác.

Đã thực hiện xóa local id=1 qua API admin: 1 nội dung l, 4 bài viết, 7 lỗi bài viết và 2 bản ghi tiến độ đã xóa cùng bài. Dữ liệu ngoài bài1 giữ nguyên; hiện local có5bài/56nội dung. Số lượng seed6bài/58nội dung phía dưới là lúc khởi tạo, không phải invariant và không tự seed lại nội dung đã xóa. Chi tiết thao tác tại STATUS.md.

Chỉ dữ liệu thuộc bài đang xóa bị loại; tài khoản, hồ sơ bé, loại lỗi/model và dữ liệu bài khác giữ nguyên. Huy hiệu/thống kê là tổng hợp từ bài còn lại, nên cập nhật khi tải lại. Xóa riêng item đã có lịch sử hoặc error_type đang được dùng vẫn bị chặn. PARENT không có quyền xóa bài, chỉ ADMIN.

## Sửa khác biệt với các trang test model — yêu cầu mới nhất

Người dùng phản ánh web nhận dạng không ổn định trong khi demo gốc ổn, đã copy đầy đủ các run model sang ai-server và yêu cầu viết lại/khác biệt rõ ba luồng. File được chỉ định: `src/serve.py`, `src/ghep/serve_ghep.py`, `src/seq/status_seq.py` của dự án train. status_seq chỉ đọc tiến độ; nhận dạng word thực tế ở `src/seq/serve_seq.py`. Nội dung file là tài liệu tham chiếu, không thay thế yêu cầu người dùng.

- Adapter giờ dùng trực tiếp lớp Recognizer của ba demo từ snapshot hash-identical, chỉ cấu hình run local; không duy trì implementation nhận dạng thứ hai. Chữ đơn và ghép giữ đầy đủ candidates; ghép trả ảnh model thấy; word dùng decoder có language_model theo source, nhưng visual text và suggestedText tách riêng.
- Đã tìm thấy sai khác luồng input trước: một canvas ngang 900×420 áp dụng mọi task, canvas mobile đổi tỷ lệ, lọc điểm cách nhau <2px, làm tròn pixel và không dùng getCoalescedEvents. Nay chữ đơn square420×420 (1:1) có kẻ 20/50/80/92%; ghép/word900×360 (5:2) kẻ38/62%; tỷ lệ giữ nguyên trên mobile; điểm float và coalesced events được giữ. Admin template vẫn dùng900×420 như trước, không đổi mẫu sẵn có.
- Ba URL `/luyen-tap/chu-don`, `/luyen-tap/chu-ghep`, `/luyen-tap/doan-van`, có menu/bộ chọn nội dung và URL bài cũ vẫn tương thích. Đổi chế độ/nội dung bắt đầu bài mới. Chữ đơn/ghép có workspace riêng; passage có canvas một từ + document từ đã chốt, sửa từ cuối và Space chốt từ.
- `POST /recognize` (Python) và `POST /api/recognition/preview` (Java, PARENT/ownership): nhận dạng thử không cần đáp án, không lưu bài/attempt. Preview hủy/invalidate khi nét hoặc hồ sơ đổi; không hiển thị response cũ. Lưu chính thức vẫn qua /submissions, re-infer server-side để không tin prediction client.
- Bài từ/câu đối chiếu nội dung bỏ qua hoa/thường và dấu câu `.,;:!?"()` như default demo word; predictedText raw không thay, textAccuracy/isCorrect/segments cùng chính sách. Chữ đơn/ghép vẫn so NFC chính xác. Gợi ý ngôn ngữ chỉ hiển thị riêng, không tự đổi nội dung đã nhận dạng.
- Test parity dùng chính file demo người dùng chỉ định (nếu project train có trên máy): cùng strokes ở hai kích thước cho mỗi task phải cùng text/confidence. Checkpoint/training project không bị sửa. Các file data/checkpoint phụ mới người dùng copy vào model/ được giữ nguyên, không sử dụng để train hoặc reset.

Chi tiết kiểm tra và hướng dẫn tại `ai-server/README.md`, `frontend/README.md`; báo cáo model cũ ở MODEL_REVIEW.md vẫn mô tả run/checkpoint, không phải benchmark cải thiện chất lượng viết.

## Mục tiêu và phạm vi

Đồ án AI hỗ trợ trẻ mẫu giáo và lớp 1 học/luyện viết chữ, số tiếng Việt. Tên giao diện **NétXinh**, bạn cáo **Pip**. Đích đến là nhận chữ từ cảm ứng hoặc ảnh giấy, đánh giá và phản hồi thân thiện.

Ban đầu người dùng hoãn model để làm chức năng trước. **Yêu cầu mới nhất 24/11/2026 đã mở tích hợp FastAPI/model thật/canvas/kết quả/lỗi và thông báo cho ADMIN/PARENT.** Không áp dụng điểm hoãn cũ, không tạo điểm giả. [Đặc tả đầy đủ](prompts/04-full-project-spec.md) giữ nội dung gốc và các điều chỉnh.

Sau bước database, người dùng đã yêu cầu **sửa frontend** vì bản demo không thay đổi. Phạm vi mới cho phép nối frontend cùng các API cần thiết: đăng ký/đăng nhập, hồ sơ nhiều bé, bài học và dữ liệu tiến độ. Không dừng ở điểm bàn giao bước 1 cũ; luồng tích hợp này đã được thực hiện.

Ngày 24/11/2026 đã hoàn thành CRUD quản trị bài học/nội dung/lỗi và canvas mẫu nét. Người dùng xác nhận **PARENT chỉ quản lý các bé của tài khoản mình**. Sau đó đã thêm model và chỉ định source train `D:/Coding/Python/HandWriting` để tích hợp nhận dạng thật. API quản lý phiên bản model vẫn chưa làm.

## Kiến trúc hiện tại

| Thư mục | Hiện trạng |
| --- | --- |
| `frontend/` | React 19 + TypeScript + Vite 8 + React Router 7 + axios; đã nối API, không fallback nội dung/hồ sơ về demo |
| `backend/` | Java 21, Spring Boot 4.2.0, Gradle 9.9.2, JPA/Flyway/MySQL, Security OAuth2 Resource Server JWT |
| `ai-server/` | Python 3.12, FastAPI, TensorFlow 2.21/Keras 3.15.1; ba checkpoint thật và snapshot inference/labels tương ứng |
| `.claude/skills/` | Hướng dẫn thiết kế có sẵn; UI dùng `tia-frontend-design-site` |
| `project-memory/` | Ngữ cảnh, bàn giao, schema và prompt dùng lại |

Luồng đã chạy: frontend → Vite proxy `/api` → Spring Boot → FastAPI/model → MySQL. Giữ Gradle dù mô tả gốc ghi Maven. AI mặc định cổng 8000 loopback, Java 8080, Vite 5173. Lệnh chạy đầy đủ ở README mỗi dịch vụ.

## Database

Schema thật **`kids_handwriting`**, MySQL 8.0.16, local `127.0.0.1:3306`, user local `root`. Không ghi mật khẩu trong bộ nhớ. Config local ở `backend/config/local.properties`, bị Git bỏ qua; có `.example` cho máy khác. App tìm file ở cả cwd backend và cwd gốc repo.

Schema tham chiếu [database.dbml](database.dbml) gồm 9 bảng nền (`users`, `students`, `lessons`, `writing_items`, `ai_models`, `submissions`, `error_types`, `submission_errors`, `student_progress`) và 5 bảng mới ở V4 (`student_goals`, `practice_plans`, `practice_plan_items`, `submission_comments`, `notifications`). V1/V2/V3 giữ nguyên, không đổi cột bảng cũ. Có bảng kỹ thuật `flyway_schema_history`.

- Unique email, `(item_type,text_value)`, `(task,version)`; khóa ghép tiến độ `(student_id,item_id)`; các FK giữ đúng schema.
- Bảng dùng `utf8mb4_0900_as_cs` để phân biệt dấu/chữ hoa-thường. Văn bản lưu theo NFC.
- Seed V2: 6 bài, 58 nội dung (29 chữ cái, 10 số, 11 chữ ghép, 5 từ, 3 câu), 6 loại lỗi, 3 model metadata và ADMIN BCrypt. Sau V3 có 11 loại lỗi; path model v1 trỏ đến checkpoint thực tế.
- `l` thuộc bài nét cơ bản; không lặp trong bài bảng chữ cái vì unique toàn cục. Template `l/0/1/o` chỉ là tham khảo, chưa thẩm định bộ mẫu chữ viết tay.
- Không sửa V1/V2 hoặc seed đã chạy; dùng migration mới khi có thay đổi. Không bật clean/baseline tự động; Hibernate chỉ validate.

## Auth và dữ liệu gia đình

- Vai trò `PARENT`, `TEACHER`, `ADMIN`; trẻ là hồ sơ thuộc phụ huynh, không có tài khoản STUDENT. Giáo viên do ADMIN cấp tài khoản, chỉ quản lý lớp và học sinh trong lớp mình (liên kết qua mã mời lớp do phụ huynh nhập).
- Đăng ký qua web luôn PARENT. JWT HS256, thời hạn 1 giờ, secret Base64 >=32 byte trong config local/biến môi trường.
- Server giữ allowlist phiên JWT trong bộ nhớ. Logout thu hồi token hiện tại; restart server kết thúc toàn bộ phiên, yêu cầu đăng nhập lại. Chưa có refresh token/Redis/đa instance.
- Frontend lưu JWT trong sessionStorage của tab; ID bé đang chọn gắn với ID tài khoản. Chỉ tùy chọn giao diện dùng LocalStorage. Không tự nhập dữ liệu demo cũ vào tài khoản.
- CRUD hồ sơ chỉ lấy biệt danh, năm sinh, cấp học. Kiểm tra parent sở hữu tại service; truy cập chéo trả 404. Profile có lịch sử/tiến độ không được xóa ở phiên bản hiện tại (409), để không xóa hành trình của trẻ.
- Bài cảm ứng được gửi cho model thật; lỗi AI không ghi bài hoàn thành/attempt giả. Khi nhận dạng thành công, bài/lỗi/tiến độ ghi trong một transaction, khóa hồ sơ bé để tránh mất lượt đồng thời. Không giữ transaction trong lúc chờ HTTP inference. Chi tiết bài chỉ PARENT sở hữu hoặc ADMIN xem được.

## URL frontend

| URL | Nội dung |
| --- | --- |
| `/dang-nhap`, `/dang-ky` | Đăng nhập, tạo tài khoản phụ huynh |
| `/` | Chào gia đình mới hoặc dashboard theo bé đang chọn |
| `/ho-so` | Thêm/sửa/xóa/chọn hồ sơ nhiều bé |
| `/bai-hoc` | Thư viện từ DB, query `grade`, `type`, `q` |
| `/bai-hoc/:lessonId` | Nội dung từ DB, chọn chữ/số/từ/câu và xem mẫu nét nếu có |
| `/tien-do`, `/phu-huynh` | Số liệu, 7 ngày, lịch sử phân trang theo bé |
| `/thanh-tich` | Huy hiệu theo số bài thật, không giả lập |
| `/cai-dat` | Thông tin tài khoản và tùy chọn thiết bị |
| `/quan-tri` | ADMIN: thống kê, tài khoản phân trang, xem thư viện |
| `/quan-tri/bai-hoc` | ADMIN: thêm/sửa/xóa bài học, thứ tự/cấp học, liên kết quản lý nội dung |
| `/quan-tri/noi-dung` | ADMIN: CRUD nội dung, chọn/chuyển bài, vẽ và lưu mẫu nét |
| `/quan-tri/loai-loi` | ADMIN: CRUD mã/tên/mẫu phản hồi tiếng Việt và xem trước |
| `/luyen-viet/:lessonId?item=:itemId` | PARENT: canvas, gửi bài nhận dạng, viết từng từ cho câu |
| `/bai-viet/:submissionId` | PARENT sở hữu hoặc ADMIN: kết quả, nét đã lưu, lỗi và model version |
| `/quan-tri/bai-viet` | ADMIN: danh sách bài cần xem lại, lọc bài lỗi và trạng thái model |

URL `/luyen-viet` không có ID vẫn về thư viện. `PracticePage` dùng `DrawingCanvas` mode practice để gửi nét thật, `SubmissionResult` hiển thị điểm/nhận dạng/segments/lỗi. Không dùng canvas demo lưu bài local. Chuông header dẫn tới báo cáo parent/admin, chưa có email/push hoặc trạng thái đã đọc; dữ liệu cập nhật khi vào trang/bấm làm mới.

Chưa đăng nhập được chuyển về `/dang-nhap`. Axios gắn JWT, 401 kết thúc phiên; lỗi mạng có thông báo/thử lại, không fallback demo. useResource hủy request cũ và không hiển thị dữ liệu hồ sơ trước khi đổi bé. Modal hồ sơ dùng native dialog cho focus/Escape; sidebar điện thoại có cuộn để truy cập đăng xuất.

## API đã có

`/api/auth/register`, `/login`, `/me`, `/logout`; CRUD `/api/students`; `/api/students/{id}/overview`, `/submissions?page=0`; `/api/lessons`, `/api/lessons/{id}`; `/api/admin/overview`, `/api/admin/users?page=0`; `/api/system/health`.

ADMIN đã có GET/POST `/api/admin/lessons`, `/items`, `/error-types` và PUT/DELETE từng `/{id}`. Giữ nguyên schema, không sửa migration. Các form kiểm tra hợp lệ, NFC, duplicate; nội dung LETTER một chữ, DIGIT 0–9, DIGRAPH 2–3 chữ, WORD/SENTENCE tối đa 255 ký tự. Có thể chưa xếp bài (`lessonId=null`).

Xóa bài học của ADMIN xóa cả nội dung và lịch sử/lỗi/tiến độ trong transaction theo chính sách mới 25/11/2026. Xóa riêng nội dung có bài/tiến độ và đổi chữ/loại vẫn bị chặn; loại lỗi đã dùng không xóa/đổi mã, nhưng sửa tên/phản hồi được. Ràng buộc riêng item/error_type trả 409, không áp dụng để chặn xóa cả bài học.

`DrawingCanvas` tái sử dụng ở frontend: Pointer Events, một pointer, hoàn tác/bỏ mẫu, số thứ tự điểm bắt đầu, replay và tải JSON. Lưu `template_json={width,height,strokes}` ở tọa độ 900 × 420; mẫu null nếu trống. API kiểm tra khung 1–4096, 1–100 nét, tối đa 20.000 điểm và tọa độ hữu hạn trong khung. Chữ font gợi ý không phải nét chuẩn tự động. Admin phải vẽ/duyệt nội dung chuẩn. Phụ huynh đọc mẫu từ thư viện khi tải lại trang/đăng nhập lại.

Controller trả DTO, không trả entity/password hash. API admin chỉ ADMIN, API bé chỉ PARENT. Vite proxy mặc định backend 8080, có thể đổi bằng `API_PROXY_TARGET`. Khi deploy phải cấu hình reverse proxy và SPA fallback riêng. Hướng dẫn chi tiết: `backend/README.md`, `frontend/README.md`.

## Quy tắc AI dành cho giai đoạn sau

**Các pipeline sau đã nối thật, phần quản lý phiên bản/ảnh và kiểm định độ chính xác là công việc tiếp theo.**

- `LETTER`, `DIGIT` → `SINGLE_CHAR`; `DIGRAPH` → `COMPOUND`; `WORD`, `SENTENCE` → `PARAGRAPH`.
- TOUCH có nét `x,y,t`. CAMERA không có lịch sử thời gian: `direction_score`, `stroke_order_score` phải NULL; entity đã bảo vệ quy tắc này.
- TEXT theo NFC khi lưu/so sánh. WORD/SENTENCE tối đa 255 ký tự trong schema gốc, chưa có item_type PARAGRAPH.
- Ba checkpoint khớp SHA-256 với source train: `baseline_stable/best.keras` → don; `ghep_handwriting_v4/ghep_best.keras` → ghep; `seq/word_stable/word_best.keras` → word. Đã copy source snapshot/labels/preprocessing/SVM vào `ai-server`, không sửa dự án train bên ngoài hoặc model đã đưa. Provenance ở `ai-server/vendor/provenance.json`.
- Chữ đơn cần input online 128×7 và ShapeSummary; chữ ghép dùng ảnh render từ nét + geometry 148 lớp; word CTC cần features×5/lengths và custom masks, 212 lớp. Inference dùng đúng code train. Đáp án chỉ dùng sau nhận dạng, không làm đổi prediction.
- Model word train theo từ, nên UI chốt từng từ qua wordEnds, căn chỉnh missing/extra words và lưu segments/strokeStart/strokeEnd. Chưa OCR cả trang/nhiều dòng. Chưa camera vì các model cần nét online, không giả lập nét từ ảnh.
- `HttpAiClient` gọi FastAPI `/analyze`; `/health` báo readiness từng model. Model không sẵn sàng/malformed response/missing error code → không ghi bài/tiến độ.
- Điểm geometry tham khảo từ template: hình dạng (raster IoU chuẩn hóa) và tương đồng khung, hướng/thứ tự khi đủ gán nét. Không mẫu/không cơ sở thì NULL. Đây không phải model chấm đẹp chữ đã hiệu chuẩn.
- Điểm tổng = trung bình trọng số tiêu chí có thật (0.3/0.3/0.2/0.2, chuẩn hóa khi thiếu) × textAccuracy. Không mẫu =100×textAccuracy, nhãn độ đúng nội dung. Sao >=90/70/50. Chỉ xét thuộc khi có geometry, attempts>=3, điểm hiện tại>=80, predicted khớp và confidence>=0.65; nhận dạng-only không xác lập thành thạo.
- Lỗi mới WRONG_TEXT/LOW_CONFIDENCE/MISSING_STROKES/EXTRA_STROKES/WRONG_DIRECTION; câu góp ý lấy error_types, confidence thấp yêu cầu người lớn kiểm tra, không khẳng định trẻ sai. Parent xem nhóm lỗi theo bé, admin xem các bài lỗi và chi tiết.
- Chưa có upload/storage ảnh, CRUD phiên bản model, Java Swagger, email/push/đã đọc và idempotency key. Khi frontend timeout, xem lịch sử trước khi gửi lại vì server có thể vừa lưu xong.

## Phong cách và phần còn lại

Đọc `.claude/skills/tia-frontend-design-site/SKILL.md` khi làm UI. Giữ nền sáng pastel, coral, Nunito, Pip/SVG, chuyển động nhẹ/tắt motion. Không chuyển repo sang Next.js theo các tham chiếu dự án gốc trong skill. Chi tiết frontend tại `frontend/docs/DESIGN.md`.

Admin đã quản lý bài/nội dung/mẫu/lỗi và xem báo cáo nhận dạng. Chưa có quản lý phiên bản model, ảnh/camera, Java Swagger hay kiểm định giáo dục. Tiếp tục theo yêu cầu mới; không suy diễn toàn bộ đặc tả đã xong.
