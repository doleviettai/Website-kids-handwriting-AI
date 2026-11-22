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

Frontend gọi qua Vite proxy `/api`, không cần CORS khi dùng proxy này. API lỗi trả JSON với `message` tiếng Việt, validation Jakarta và kiểm tra sở hữu ở service. Backend không trả entity trực tiếp.

## Phiên JWT

HS256, thời hạn 1 giờ, secret cấu hình riêng. Backend giữ allowlist phiên trong bộ nhớ để logout vô hiệu hóa token ngay. Restart backend sẽ kết thúc tất cả phiên; người dùng đăng nhập lại. Chưa có refresh token/Redis hoặc đa instance. Vite/production proxy phải giữ header Authorization. Không log token hoặc mật khẩu.

## Kiểm tra

```powershell
./gradlew.bat test bootJar
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

11 test tích hợp MySQL thật: 7 test schema/seed/JSON/NFC/unique/khóa ghép/giới hạn CAMERA và 4 test HTTP auth/CRUD/quyền sở hữu/role/validation/logout. Dữ liệu test được rollback, không reset database; AUTO_INCREMENT có thể có khoảng trống. Đối chiếu bộ seed gốc khi chạy test trên database local.

## Phần còn lại

CRUD nội dung/lỗi/model, trình vẽ template admin, nộp bài, lưu ảnh, chấm điểm và Swagger chưa triển khai. Đặc tả đầy đủ ở [kho prompt](../project-memory/prompts/04-full-project-spec.md). Khi model sẵn sàng mới chốt AiRequest/AiResult, thêm AiClient/HttpAiClient và cấu hình `ai.mode=http`. Không tự bật MockAiClient. CAMERA không có điểm hướng/thứ tự nét.
