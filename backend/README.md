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
| `PUT/DELETE /api/admin/lessons/{id}` | ADMIN: sửa; xóa vĩnh viễn bài, nội dung và toàn bộ lịch sử/lỗi/tiến độ liên quan |
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

**Chính sách xóa bài học cập nhật 25/11/2026 theo yêu cầu người dùng:** ADMIN được xóa bài học dù có nội dung/lịch sử. Trong một transaction, khóa bài và các nội dung rồi xóa submission_errors → student_progress → submissions → writing_items → lessons theo phạm vi lesson_id. Bài viết/kết quả/điểm và thông báo lỗi của bài đó bị xóa vĩnh viễn; các hồ sơ bé/tài khoản/danh mục lỗi/model và dữ liệu bài khác được giữ. UI xác nhận rõ không thể hoàn tác. Không đổi schema/FK hoặc sửa migration, không tắt kiểm tra khóa ngoại.

Việc **xóa riêng một nội dung** vẫn bị chặn khi nội dung đã có bài viết/tiến độ; đổi chữ/loại đã dùng vẫn bị chặn. Loại lỗi đã dùng không được xóa/đổi mã, nhưng sửa tên/phản hồi được. Những trường hợp này trả 409. Nếu cần xóa toàn bộ lịch sử của một bài, dùng thao tác xóa bài học.

PARENT tạo/sửa hồ sơ qua `/api/students` như trước: owner lấy từ JWT, không tin `parentId` trong body. Không có API PARENT chuyển hoặc quản lý hồ sơ tài khoản khác. Hồ sơ đã có lịch sử/tiến độ không bị xóa tự động.

## Phần còn lại

Quản lý phiên bản model, lưu ảnh/camera và Swagger cho API Java chưa triển khai. Phần nộp nét/nhận dạng/kết quả đã được nối như bên dưới; không có MockAiClient.

## Nộp bài và FastAPI — cập nhật 24/11/2026

Khởi động [FastAPI](../ai-server/README.md) trên `127.0.0.1:8000` trước, sau đó chạy backend. `app.ai.base-url`/`AI_BASE_URL` đổi địa chỉ dịch vụ nếu dùng cổng khác. Không gọi trực tiếp model từ frontend. V3 chỉ thêm metadata path và 5 mã lỗi mới, không đổi bảng/cột, không sửa V1/V2. Tổng cộng hiện 11 mã lỗi. V3 điền path vào metadata v1 đang NULL; task phải có đúng một active model và path/version trùng dịch vụ.

| API | Chức năng |
| --- | --- |
| `GET /api/ai/status` | JWT: kiểm tra FastAPI và ba model, camera/word mode |
| `POST /api/recognition/preview` | PARENT: nhận dạng thử một chữ/từ đang viết, cùng request bài nộp nhưng wordEnds rỗng; không lưu bài/tiến độ |
| `POST /api/submissions` | PARENT: `studentId,itemId,width,height,strokes,wordEnds`; nhận dạng thật rồi lưu bài/lỗi/tiến độ |
| `GET /api/submissions/{id}` | PARENT sở hữu bé hoặc ADMIN: kết quả, nét, lỗi, model version và segments |
| `GET /api/students/{id}/attention` | PARENT sở hữu: nhóm lỗi và số bài có lỗi để ba mẹ xem lại |
| `GET /api/admin/reviews?page=0&onlyErrors=true` | ADMIN: bài viết cần xem lại, 20 bản ghi/trang |

Không ghi bài/attempt khi FastAPI lỗi, kết quả không hợp lệ hoặc mã phản hồi chưa có trong danh mục. Ownership được kiểm tra trước khi gọi AI và khi lưu; ghi bài/lỗi/tiến độ trong cùng transaction, khóa hồ sơ bé để tránh mất lượt khi ghi đồng thời. Không giữ transaction DB trong lúc chờ HTTP AI. Timeout inference 90 giây, frontend chờ tối đa 110 giây; nếu frontend mất kết nối sau khi server đã lưu, cần xem lịch sử trước khi gửi lại để tránh lặp lượt (chưa có idempotency key).

Tọa độ lưu chuẩn 900 × 420 để xem lại. Model CTC train theo từ: `wordEnds` chỉ ranh giới nhóm nét, expected text không dùng để ép nhận dạng. Segments lưu alignment từng từ và mốc nét để xem lại, không bịa bbox. Camera không được gửi vào pipeline hiện tại.

Điểm hình dạng/tương đồng/hướng/thứ tự có thể NULL khi không đủ mẫu/đối chiếu. Điểm tổng khi có mẫu: trung bình trọng số của tiêu chí có thật (0.3/0.3/0.2/0.2, chuẩn hóa lại nếu thiếu tiêu chí), nhân độ khớp nội dung. Không mẫu: `100*textAccuracy`, được gắn nhãn độ đúng nội dung. Với PARAGRAPH, đối chiếu nội dung bỏ qua hoa/thường và dấu câu như demo gốc; is_correct dựa trên textAccuracy=1, predictedText giữ nguyên. Với chữ đơn/ghép vẫn đối chiếu chính xác NFC. Không coi confidence là điểm đẹp chữ. Sao theo 90/70/50; nhận dạng thuần túy không đánh dấu thành thạo. Đánh dấu thuộc cần mẫu, lượt>=3, điểm hiện tại>=80, text khớp và confidence>=0.65.

Phản hồi ghép từ `error_types` trong database; câu khích lệ khi không lỗi nằm ở `app.scoring.positive-feedback`. Hệ số nằm trong `ScoringProperties`/application.yaml. `LOW_CONFIDENCE` là yêu cầu người lớn kiểm tra, không kết luận bé viết sai. Thông báo là trang/chuông trong web, có nút làm mới; chưa có email, push, trạng thái đã đọc hoặc thông báo thời gian thực.

Kiểm tra Java hiện có **22 test**: thêm test xóa bài có nội dung/lịch sử/lỗi/tiến độ, rollback transaction khôi phục đầy đủ và giữ bài/hồ sơ khác; PARENT không được xóa bài. Test tổng danh mục dùng số lượng thực tế thay vì ép DB giữ nguyên số bài seed. Một số test còn dùng nội dung seed tham khảo, nên dùng DB phát triển. Có E2E xóa bài có lịch sử thật trên dữ liệu fixture UUID; các test AI khác không cần chạy lại khi chỉ đổi xóa bài. Không reset DB để chạy test.
