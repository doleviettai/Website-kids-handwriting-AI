# NétXinh — giao diện gia đình kết nối backend

## Phong cách

Giữ hướng dẫn `.claude/skills/tia-frontend-design-site/SKILL.md`: nền sáng, cream/coral/sky/mint/lavender, Nunito, Pip và minh họa SVG đã có. Trang đăng nhập/đăng ký có phần giới thiệu bên trái và form bên phải; điện thoại chuyển thành một cột. Thẻ hồ sơ, trạng thái lỗi và modal dùng tiếng Việt thân thiện. Có tắt chuyển động và hỗ trợ reduced motion.

## Luồng hiện tại

Đăng ký/đăng nhập → tạo/chọn hồ sơ → góc học tập → thư viện → xem nội dung bài. Phụ huynh có thể chỉnh/xóa hồ sơ chưa có lịch sử. Trang tiến độ và huy hiệu đọc theo ID bé. ADMIN có trang tổng quan và danh sách tài khoản; chưa có CRUD nội dung hoặc trình vẽ template quản trị.

Phần viết và nhận xét đang được chuẩn bị, chưa gọi Python hoặc tạo mock scoring. Không gắn canvas demo cũ vào hồ sơ database để tránh ghi local nhưng khiến người dùng tưởng đã lưu server.

## Dữ liệu và thành phần

| Vị trí                                      | Vai trò                                                      |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/api/client.ts`                         | Axios, Bearer JWT, xử lý 401 và lỗi mạng                     |
| `src/api/types.ts`                          | Kiểu dữ liệu DTO từ backend                                  |
| `src/context/AuthProvider.tsx`              | Kiểm tra phiên, nhận token sau auth và logout                |
| `src/context/WorkspaceProvider.tsx`         | Hồ sơ, bài học và tiến độ của bé đang chọn                   |
| `src/hooks/useResource.ts`                  | Fetch có hủy request và trạng thái tải/lỗi theo khóa dữ liệu |
| `src/pages/`                                | Các trang auth, hồ sơ, bài học, tiến độ, tài khoản, admin    |
| `src/components/Modal.tsx`                  | Native dialog, focus trap và Escape                          |
| `src/ConnectedApp.css`                      | Bố cục/form/trạng thái của luồng kết nối                     |
| `src/App.css`, `src/components/Artwork.tsx` | Phong cách nền và artwork dùng lại                           |

Hồ sơ/bài học/thống kê không fallback về `src/data.ts`. File đó chỉ còn được dùng cho nhãn cấp học/loại và nhóm bộ lọc; dữ liệu bài demo cũ không được nạp vào app. Các ID nội dung nhận trực tiếp từ API/MySQL.

JWT dùng sessionStorage của tab; ID bé được chọn gắn theo ID tài khoản. Tùy chọn thiết bị dùng LocalStorage. Dữ liệu cũ và dữ liệu tài khoản không tự trộn. Khi đổi URL dữ liệu hoặc bé đang chọn, useResource không hiển thị response cũ và hủy request đang chạy để tránh lẫn hồ sơ.

## Ánh xạ nghiệp vụ

- `users`: đăng ký, đăng nhập, thông tin tài khoản; mật khẩu/BCrypt không trả về web.
- `students`: CRUD biệt danh/năm sinh/cấp học, kiểm tra phụ huynh sở hữu ở service.
- `lessons`, `writing_items`: thư viện, bộ lọc query URL, nội dung và SVG từ template_json có sẵn.
- `submissions`, `student_progress`: chỉ đọc số liệu/lịch sử hiện có; chưa nộp hoặc chấm bài.
- `ai_models`, `error_types`, `submission_errors`: chưa có màn CRUD hoặc kết quả nhận dạng.

Backend hiện không đổi schema. Chưa có cột daily_goal nên không hiển thị form lưu mục tiêu vào database.

## Xác minh

Build/lint, kiểm tra API trên MySQL thật và E2E bằng Google Chrome. E2E kiểm tra đăng ký/CRUD/reload/chuyển bé/đăng xuất, lỗi mạng và tràn ngang ở 375px. Màn AI chưa triển khai, không coi kết quả kiểm tra auth/dữ liệu là kiểm tra nhận dạng chữ.
