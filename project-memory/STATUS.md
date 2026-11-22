# Trạng thái và bàn giao

Cập nhật: 22/11/2026. Công việc mới nhất: người dùng yêu cầu sửa frontend; đã nối auth/hồ sơ/bài học/tiến độ với API và MySQL. Phần model tiếp tục hoãn.

## Cập nhật tài khoản admin gần nhất

Theo yêu cầu người dùng, đã đổi mật khẩu của đúng tài khoản ADMIN `admin@netxinh.local` trong MySQL bằng BCrypt cost 12 và đồng bộ cấu hình local (không ghi giá trị mật khẩu vào bộ nhớ). Đã xác minh qua backend tạm: login 200, role ADMIN, overview quản trị 200, logout 204; đã dừng server kiểm tra. Backend cổng 8080 không phản hồi tại thời điểm kiểm tra, cần chạy lại từ IDE nếu muốn dùng web. Không sửa migration V1/V2 hoặc các tài khoản khác; ràng buộc mật khẩu của seed database mới vẫn giữ nguyên.

## Đã triển khai trong lượt nối frontend

- Giao diện đăng nhập/đăng ký riêng `/dang-nhap`, `/dang-ky` theo phong cách NétXinh.
- API đăng ký PARENT, login BCrypt, JWT HS256 1 giờ, `/auth/me`, logout thu hồi token; kiểm tra role và parent sở hữu.
- `app.jwt.secret` đã sinh riêng trong config local bị Git bỏ qua, không ghi vào docs/prompt.
- CRUD hồ sơ bé trên MySQL; danh sách nhiều bé, bộ chọn trên header, sửa/xóa bằng modal. Profile có lịch sử/tiến độ được giữ lại, trả 409 nếu xóa.
- Trang chào gia đình chưa có bé, dashboard theo bé, danh mục thật 6 bài/58 nội dung, bộ lọc query URL và trang chi tiết bài/mẫu nét.
- Tiến độ/huy hiệu/lịch sử phân trang đọc từ MySQL theo bé; hồ sơ mới là rỗng, không gán dữ liệu mẫu.
- ADMIN có trang tổng quan, thống kê, danh sách tài khoản phân trang và xem thư viện. Chưa có CRUD nội dung/template admin.
- Axios + interceptor Bearer/401, React Context, request cancellation khi đổi hồ sơ, lỗi/tải/thử lại; không dùng dữ liệu demo làm fallback.
- Vite proxy `/api` → backend mặc định 8080; test có thể đổi `API_PROXY_TARGET`.
- Sidebar điện thoại có cuộn; đã sửa lỗi nút logout nằm ngoài viewport. Modal có focus trap/Escape. Chụp kiểm tra desktop/375px, không tràn ngang ở các màn đã kiểm tra.
- Bản canvas demo cũ vẫn còn file nhưng không mount trong luồng mới; URL luyện viết cũ chuyển sang chi tiết bài. Phần viết/nhận xét thông báo đang chuẩn bị, đúng yêu cầu hoãn model.
- Cập nhật README hai project, tài liệu thiết kế, AGENTS và bộ nhớ.

## Kiểm tra

- Backend `compileJava` và `test bootJar` đã thành công sau thêm API: **11 test, 0 lỗi** (7 persistence + 4 API).
- API test xác minh đăng ký/login/logout, hash không lộ qua response, email trùng, invalid token, CRUD, profile validation, thư viện từ DB, phân quyền ADMIN và chặn gia đình khác xem/sửa/xóa/đọc tiến độ/lịch sử.
- E2E Google Chrome: **2 test đạt**; đăng ký qua UI, tạo/sửa/xóa/chọn nhiều bé, tải lại giữ dữ liệu MySQL, xem thư viện 6 bài/58 nội dung, trạng thái rỗng, lỗi mạng và đăng xuất/chặn trang cần login. Kiểm tra responsive desktop/375px, không có pageerror.
- Ảnh QA ở `frontend/test-results/` được Git bỏ qua: login-mobile, dashboard-desktop, lesson-mobile.
- Test backend dùng transaction rollback. E2E tạo tài khoản `e2e-<UUID>@example.test`, sau mỗi lượt chỉ dọn tài khoản/hồ sơ giả của lượt đó qua MySQL CLI. Không xóa tài khoản thật của người dùng.
- Frontend build/lint đã đạt ở lần xác nhận cuối sau chỉnh sửa/format; backend test/bootJar cũng đã chạy lại thành công. Không coi các test web là xác minh nhận dạng AI.

## Cần chạy để thấy thay đổi

Người dùng đang có backend chạy trong IDE trên cổng 8080. Nếu chưa Stop/Run lại sau khi sửa code, đó vẫn là API bước 1 cũ. **Stop/Run lại backend**, rồi khởi động lại Vite để nhận proxy và mở `/dang-ky` hoặc `/dang-nhap`. Không tự dừng tiến trình IDE của người dùng trong lượt này.

```powershell
# Terminal backend, từ gốc repo
cd backend
./gradlew.bat bootRun
```

```powershell
# Terminal khác, từ gốc repo
cd frontend
npm install
npm run dev
```

URL thường `http://localhost:5173/dang-ky`. Nếu còn giao diện cũ, tải lại bằng Ctrl+F5 và kiểm tra đúng server/thư mục. Session của backend được giữ trong bộ nhớ; restart backend yêu cầu đăng nhập lại.

Trong phiên kiểm tra dùng backend riêng cổng 18080 và Vite riêng 15173 để không chiếm cổng IDE. Đã dừng các server kiểm tra trước khi bàn giao. Đã xác minh bootJar cũng chạy từ gốc repo và đọc được config local, health UP và JWT endpoint trả 401 khi không có token. Frontend đang chạy trên cả localhost/127.0.0.1:5173 đã phục vụ App.tsx mới có AuthProvider; backend IDE vẫn cần restart để có API mới.

## Nền tảng database đã có trước đó

MySQL `kids_handwriting` local 3306, user root, schema V1/V2 đúng 9 bảng, enum/FK/unique/index, collation utf8mb4_0900_as_cs. Seed 6 bài, 58 nội dung, 6 lỗi, 3 model metadata và ADMIN BCrypt. Không thêm cột hoặc đổi migration trong bước nối web.

Config local `backend/config/local.properties`, app đọc từ cwd backend hoặc gốc repo. ADMIN local email `admin@netxinh.local`, mật khẩu xem khóa `app.bootstrap.admin.password` trong file local; thay fallback YAML không thay password trong MySQL. Không ghi secret vào bộ nhớ.

## Chưa làm

- Nhận dạng/chấm chữ đơn, chữ ghép, đoạn văn; AiClient/mock/HTTP và Python API.
- Nộp bài, upload ảnh/FileStorageService, kết quả phân đoạn/lỗi và cập nhật tiến độ từ bài mới.
- CRUD admin lessons/items/error_types/models, vẽ template, Swagger.
- Refresh token/Redis/đa instance; hiện đăng xuất offline chỉ xóa phiên trình duyệt, token server hết hạn sau tối đa 1 giờ hoặc khi restart.
- Nhập dữ liệu demo local cũ vào tài khoản thật (không tự thực hiện).

## Lưu ý workspace

- Đã có thay đổi sẵn `D ai-server/model/__init__.py`, các file bộ nhớ và backend chưa commit. Không tự khôi phục file/xóa thay đổi khác hoặc commit.
- Không chỉnh Python hoặc migration/seed đã chạy; giữ Gradle. Không reset database để chạy test.
- Đặc tả gốc ở `prompts/04-full-project-spec.md`; yêu cầu frontend mới nhất mở rộng phạm vi vượt điểm dừng bước 1 cũ.
