# Kid Handwriting AI — ngữ cảnh hiện tại

Cập nhật: 22/11/2026. Nguồn: yêu cầu người dùng và code đã triển khai/kiểm tra trong repo.

## Mục tiêu và phạm vi

Đồ án AI hỗ trợ trẻ mẫu giáo và lớp 1 học/luyện viết chữ, số tiếng Việt. Tên giao diện **NétXinh**, bạn cáo **Pip**. Đích đến là nhận chữ từ cảm ứng hoặc ảnh giấy, đánh giá và phản hồi thân thiện.

Model đang train, người dùng yêu cầu làm chức năng/database trước và **hoãn nhận dạng/chấm chữ đơn, chữ ghép, đoạn văn**. Không gọi Python, không tạo điểm giả. [Đặc tả đầy đủ](prompts/04-full-project-spec.md) giữ nội dung gốc và các điều chỉnh sau đó.

Sau bước database, người dùng đã yêu cầu **sửa frontend** vì bản demo không thay đổi. Phạm vi mới cho phép nối frontend cùng các API cần thiết: đăng ký/đăng nhập, hồ sơ nhiều bé, bài học và dữ liệu tiến độ. Không dừng ở điểm bàn giao bước 1 cũ; luồng tích hợp này đã được thực hiện.

## Kiến trúc hiện tại

| Thư mục | Hiện trạng |
| --- | --- |
| `frontend/` | React 19 + TypeScript + Vite 8 + React Router 7 + axios; đã nối API, không fallback nội dung/hồ sơ về demo |
| `backend/` | Java 21, Spring Boot 4.2.0, Gradle 9.9.2, JPA/Flyway/MySQL, Security OAuth2 Resource Server JWT |
| `ai-server/` | Python khung mẫu; chưa có AI API và chưa sửa trong các bước tích hợp web |
| `.claude/skills/` | Hướng dẫn thiết kế có sẵn; UI dùng `tia-frontend-design-site` |
| `project-memory/` | Ngữ cảnh, bàn giao, schema và prompt dùng lại |

Luồng đã chạy: frontend → Vite proxy `/api` → Spring Boot → MySQL. Luồng backend → Python AI chưa được triển khai. Giữ Gradle dù mô tả gốc ghi Maven.

## Database

Schema thật **`kids_handwriting`**, MySQL 8.0.16, local `127.0.0.1:3306`, user local `root`. Không ghi mật khẩu trong bộ nhớ. Config local ở `backend/config/local.properties`, bị Git bỏ qua; có `.example` cho máy khác. App tìm file ở cả cwd backend và cwd gốc repo.

Schema tham chiếu [database.dbml](database.dbml) có 9 bảng: `users`, `students`, `lessons`, `writing_items`, `ai_models`, `submissions`, `error_types`, `submission_errors`, `student_progress`. Flyway V1/V2 đã chạy thành công; có thêm bảng kỹ thuật `flyway_schema_history`. **Không thêm cột nghiệp vụ** trong bước nối frontend.

- Unique email, `(item_type,text_value)`, `(task,version)`; khóa ghép tiến độ `(student_id,item_id)`; các FK giữ đúng schema.
- Bảng dùng `utf8mb4_0900_as_cs` để phân biệt dấu/chữ hoa-thường. Văn bản lưu theo NFC.
- Seed: 6 bài, 58 nội dung (29 chữ cái, 10 số, 11 chữ ghép, 5 từ, 3 câu), 6 loại lỗi, 3 model metadata và 1 ADMIN BCrypt cost 12.
- `l` thuộc bài nét cơ bản; không lặp trong bài bảng chữ cái vì unique toàn cục. Template `l/0/1/o` chỉ là tham khảo, chưa thẩm định bộ mẫu chữ viết tay.
- Không sửa V1/V2 hoặc seed đã chạy; dùng migration mới khi có thay đổi. Không bật clean/baseline tự động; Hibernate chỉ validate.

## Auth và dữ liệu gia đình

- Vai trò `PARENT`, `ADMIN`; trẻ là hồ sơ thuộc phụ huynh, không có tài khoản STUDENT.
- Đăng ký qua web luôn PARENT. JWT HS256, thời hạn 1 giờ, secret Base64 >=32 byte trong config local/biến môi trường.
- Server giữ allowlist phiên JWT trong bộ nhớ. Logout thu hồi token hiện tại; restart server kết thúc toàn bộ phiên, yêu cầu đăng nhập lại. Chưa có refresh token/Redis/đa instance.
- Frontend lưu JWT trong sessionStorage của tab; ID bé đang chọn gắn với ID tài khoản. Chỉ tùy chọn giao diện dùng LocalStorage. Không tự nhập dữ liệu demo cũ vào tài khoản.
- CRUD hồ sơ chỉ lấy biệt danh, năm sinh, cấp học. Kiểm tra parent sở hữu tại service; truy cập chéo trả 404. Profile có lịch sử/tiến độ không được xóa ở phiên bản hiện tại (409), để không xóa hành trình của trẻ.
- Chỉ đọc thống kê/lịch sử/tiến độ hiện có từ MySQL. Chưa có API nộp bài hoặc cập nhật điểm, nên hồ sơ mới không có bài/điểm/thành tích.

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

Các URL `/luyen-viet` cũ chuyển về trang nội dung. Canvas demo cũ còn file nhưng **không được mount** trong luồng database mới; không lưu bài local rồi báo như đã lưu server. Phần viết/nhận xét hiển thị đang chuẩn bị theo yêu cầu hoãn model.

Chưa đăng nhập được chuyển về `/dang-nhap`. Axios gắn JWT, 401 kết thúc phiên; lỗi mạng có thông báo/thử lại, không fallback demo. useResource hủy request cũ và không hiển thị dữ liệu hồ sơ trước khi đổi bé. Modal hồ sơ dùng native dialog cho focus/Escape; sidebar điện thoại có cuộn để truy cập đăng xuất.

## API đã có

`/api/auth/register`, `/login`, `/me`, `/logout`; CRUD `/api/students`; `/api/students/{id}/overview`, `/submissions?page=0`; `/api/lessons`, `/api/lessons/{id}`; `/api/admin/overview`, `/api/admin/users?page=0`; `/api/system/health`.

Controller trả DTO, không trả entity/password hash. API admin chỉ ADMIN, API bé chỉ PARENT. Vite proxy mặc định backend 8080, có thể đổi bằng `API_PROXY_TARGET`. Khi deploy phải cấu hình reverse proxy và SPA fallback riêng. Hướng dẫn chi tiết: `backend/README.md`, `frontend/README.md`.

## Quy tắc AI dành cho giai đoạn sau

- `LETTER`, `DIGIT` → `SINGLE_CHAR`; `DIGRAPH` → `COMPOUND`; `WORD`, `SENTENCE` → `PARAGRAPH`.
- TOUCH có nét `x,y,t`. CAMERA không có lịch sử thời gian: `direction_score`, `stroke_order_score` phải NULL; entity đã bảo vệ quy tắc này.
- TEXT theo NFC khi lưu/so sánh. WORD/SENTENCE tối đa 255 ký tự trong schema gốc, chưa có item_type PARAGRAPH.
- Seed model active v1 chỉ là metadata, `model_path=NULL`, chưa có artifact/suy luận. Một active/task cần service quản lý khi làm API model sau.
- Đặc tả dự kiến trọng số TOUCH 0.3/0.3/0.2/0.2; CAMERA 0.5/0.5; PARAGRAPH nhân textAccuracy; sao >=90/70/50; thuộc khi best_score >=80 và attempts >=3. Chưa thực thi trên bài thật.
- Chưa có AiClient/MockAiClient/HttpAiClient, upload ảnh/storage hoặc chấm/segmentation. Mock trong mô tả gốc không được tự bật.

## Phong cách và phần còn lại

Đọc `.claude/skills/tia-frontend-design-site/SKILL.md` khi làm UI. Giữ nền sáng pastel, coral, Nunito, Pip/SVG, chuyển động nhẹ/tắt motion. Không chuyển repo sang Next.js theo các tham chiếu dự án gốc trong skill. Chi tiết frontend tại `frontend/docs/DESIGN.md`.

Admin hiện chỉ xem tổng quan/danh sách/thư viện. CRUD nội dung/lỗi/model, vẽ template quản trị, nộp bài, ảnh, kết quả chấm và Swagger chưa làm. Tiếp tục theo yêu cầu mới của người dùng; không suy diễn toàn bộ đặc tả đã xong.
