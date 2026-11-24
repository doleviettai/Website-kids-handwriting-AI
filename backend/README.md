# NétXinh backend

Spring Boot 4.2.0, Java 21, Gradle Wrapper, MySQL `kids_handwriting`. Đã có Flyway V1/V2, entity/repository, API auth JWT, hồ sơ bé, bài học và dữ liệu tiến độ để frontend dùng trực tiếp. Không gọi model Python hoặc sinh điểm giả.

## Chạy

```powershell
cd backend
./gradlew.bat bootRun
```

Nếu backend đang chạy từ trước khi sửa code, Stop/Run lại trong IDE. Chỉ chạy một tiến trình trên cổng 8080. Kiểm tra `http://localhost:8080/api/system/health`.

`config/local.properties` đã cấu hình trên máy hiện tại và được Git bỏ qua. App tìm file này khi chạy ở `backend/` hoặc gốc repo. Máy khác sao chép `config/local.properties.example` thành `config/local.properties`, điền credentials và JWT secret. Không commit file thật.

JWT secret là ít nhất 32 byte ngẫu nhiên, mã hóa Base64. Máy hiện tại đã được tạo riêng trong cấu hình local. Có thể tạo khóa mới bằng PowerShell:

```powershell
$jwtBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtBytes)
[Convert]::ToBase64String($jwtBytes)
```

Nếu PowerShell/.NET chưa hỗ trợ Fill, dùng Node `node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"` và lưu riêng vào `app.jwt.secret`. Đây là thao tác tạo khóa trên máy, không ghi khóa vào tài liệu.

Các biến môi trường datasource: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`; cổng API `SERVER_PORT`. Nếu không dùng local config, cần `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` cho schema mới. Giá trị admin trong local properties được import có thể ưu tiên hơn placeholder YAML; chỉ dùng một cách cấu hình admin.

## Database

Schema tham chiếu ở [database.dbml](../project-memory/database.dbml). V1 tạo 9 bảng nghiệp vụ; V2 Java migration chạy SQL seed và tạo admin BCrypt cost 12 từ cấu hình. Có 6 bài, 58 nội dung, 6 loại lỗi, 3 đăng ký model v1 và 1 admin. Không sửa migration đã chạy; thay đổi dữ liệu/schema sau này dùng migration mới.

Tất cả bảng dùng `utf8mb4_0900_as_cs`, giữ khác biệt `a/ă/â`, `o/ô/ơ` và chữ hoa/thường. NFC trước khi lưu. Model seed có `model_path=NULL`, chỉ là metadata. Hibernate chỉ validate schema; Flyway không tự baseline hoặc clean database.

Tài khoản admin local: email `admin@netxinh.local`, mật khẩu xem `app.bootstrap.admin.password` trong file local. Đổi fallback trong YAML không đổi mật khẩu đã seed vào MySQL. Tài khoản đăng ký qua web luôn là PARENT, không nhận role từ request.

## API hiện có

| Method/URL | Quyền và chức năng |
| --- | --- |
| `GET /api/system/health` | Công khai: kết nối DB/migration/số lượng seed |
| `POST /api/auth/register` | Công khai: email/password/fullName; tạo PARENT, trả JWT |
| `POST /api/auth/login` | Công khai: email/password, trả JWT |
| `GET /api/auth/me` | JWT: thông tin tài khoản, không có password hash |
| `POST /api/auth/logout` | JWT: thu hồi token hiện tại |
| `GET /api/students` | PARENT: chỉ các bé thuộc tài khoản |
| `POST /api/students` | PARENT: nickname/birthYear/gradeLevel |
| `PUT /api/students/{id}` | PARENT: sửa hồ sơ thuộc tài khoản |
| `DELETE /api/students/{id}` | PARENT: xóa hồ sơ chưa có bài/tiến độ; trả 409 nếu có lịch sử |
| `GET /api/students/{id}/overview` | PARENT sở hữu bé: số liệu/lộ trình/7 ngày |
| `GET /api/students/{id}/submissions?page=0` | PARENT sở hữu bé: lịch sử phân trang, 10 bản ghi/trang |
| `GET /api/lessons`, `GET /api/lessons/{id}` | JWT: nội dung từ MySQL và template nếu có |
| `GET /api/admin/overview` | ADMIN: thống kê tổng quan |
| `GET /api/admin/users?page=0` | ADMIN: danh sách tài khoản, 20 bản ghi/trang |
| `GET/POST /api/admin/lessons` | ADMIN: danh sách và tạo bài học |
| `PUT/DELETE /api/admin/lessons/{id}` | ADMIN: sửa hoặc xóa bài học trống |
| `GET/POST /api/admin/items` | ADMIN: danh sách/tạo chữ, số, chữ ghép, từ, câu |
| `PUT/DELETE /api/admin/items/{id}` | ADMIN: sửa nội dung/mẫu nét hoặc xóa nội dung chưa có lịch sử |
| `GET/POST /api/admin/error-types` | ADMIN: danh sách/tạo loại lỗi và mẫu phản hồi tiếng Việt |
| `PUT/DELETE /api/admin/error-types/{id}` | ADMIN: chỉnh sửa/xóa loại lỗi |

Frontend gọi qua Vite proxy `/api`, không cần CORS khi dùng proxy này. API lỗi trả JSON với `message` tiếng Việt, validation Jakarta và kiểm tra sở hữu ở service. Backend không trả entity trực tiếp.

## Phiên JWT

HS256, thời hạn 1 giờ, secret cấu hình riêng. Backend giữ allowlist phiên trong bộ nhớ để logout vô hiệu hóa token ngay. Restart backend sẽ kết thúc tất cả phiên; người dùng đăng nhập lại. Chưa có refresh token/Redis hoặc đa instance. Vite/production proxy phải giữ header Authorization. Không log token hoặc mật khẩu.

## Kiểm tra

```powershell
./gradlew.bat test bootJar
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

16 test tích hợp MySQL thật: 7 test persistence, 4 test auth/gia đình và 5 test quản trị nội dung. Kiểm tra CRUD, NFC, mẫu JSON, ràng buộc xóa, quyền ADMIN, chặn truy cập hồ sơ gia đình khác và gán owner theo tài khoản đăng nhập. Dữ liệu test được rollback, không reset database; AUTO_INCREMENT có thể có khoảng trống. Các test seed vẫn đối chiếu số lượng seed gốc, nên chạy trên database local dành cho phát triển trước khi thêm nội dung thật.

## Quản trị nội dung và mẫu nét

Giữ nguyên schema; không cần migration mới. Request bài học: `title`, `gradeLevel`, `sortOrder`. Request nội dung: `lessonId` (nullable), `itemType`, `textValue`, `difficulty` (1–3), `sortOrder`, `template` (nullable, lưu vào `template_json`).

`template` gồm `{width,height,strokes:[[{x,y,t?}]]}`. Canvas mới lưu 900 × 420; API nhận khung 1–4096, tối đa 100 nét/20.000 điểm, tất cả tọa độ hữu hạn và trong khung. Mẫu không có nét phải gửi `null`. Chữ đơn đúng một ký tự chữ sau NFC; số một ký tự 0–9; chữ ghép 2–3 ký tự chữ; từ/câu tối đa 255 ký tự. Index unique giữ nội dung mỗi loại duy nhất trong toàn thư viện, không chỉ trong một bài.

Không xóa bài học còn nội dung; cần chuyển/xóa nội dung trước. Không xóa nội dung đã có bài viết/tiến độ hoặc đổi chữ/loại của nội dung đã được sử dụng; vẫn sửa được mẫu/độ khó/thứ tự/bài học. Loại lỗi đã dùng không được xóa/đổi mã, nhưng vẫn sửa tên và phản hồi. Các trường hợp này trả HTTP 409 và lý do tiếng Việt; FK vẫn bảo vệ database nếu có cập nhật đồng thời.

PARENT tạo/sửa hồ sơ qua `/api/students` như trước: owner lấy từ JWT, không tin `parentId` trong body. Không có API PARENT chuyển hoặc quản lý hồ sơ tài khoản khác. Hồ sơ đã có lịch sử/tiến độ không bị xóa tự động.

## Phần còn lại

Quản lý phiên bản model, nộp bài, lưu ảnh, chấm điểm và Swagger chưa triển khai. Đặc tả đầy đủ ở [kho prompt](../project-memory/prompts/04-full-project-spec.md). Khi model sẵn sàng mới chốt AiRequest/AiResult, thêm AiClient/HttpAiClient và cấu hình `ai.mode=http`. Không tự bật MockAiClient. CAMERA không có điểm hướng/thứ tự nét.
