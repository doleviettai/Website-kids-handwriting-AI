# NétXinh — giao diện gia đình kết nối backend

## Phong cách

Giữ hướng dẫn `.claude/skills/tia-frontend-design-site/SKILL.md`: nền sáng, cream/coral/sky/mint/lavender, Nunito, Pip và minh họa SVG đã có. Trang đăng nhập/đăng ký có phần giới thiệu bên trái và form bên phải; điện thoại chuyển thành một cột. Thẻ hồ sơ, trạng thái lỗi và modal dùng tiếng Việt thân thiện. Có tắt chuyển động và hỗ trợ reduced motion.

## Luồng hiện tại

Đăng ký/đăng nhập → tạo/chọn hồ sơ → góc học tập → thư viện → xem nội dung bài. Phụ huynh quản lý hồ sơ thuộc tài khoản của mình, lưu xong sẽ chọn bé đó. Trang tiến độ và huy hiệu đọc theo ID bé. ADMIN có tổng quan, tài khoản, CRUD bài học/nội dung/loại lỗi và canvas tạo mẫu nét.

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
- `lessons`, `writing_items`: thư viện và CRUD admin, bộ lọc query URL, chuyển nội dung giữa bài, SVG từ template_json do admin vẽ.
- `submissions`, `student_progress`: chỉ đọc số liệu/lịch sử hiện có; chưa nộp hoặc chấm bài.
- `error_types`: CRUD mã/tên/mẫu phản hồi, xem trước lời nhắn cho bé. Lỗi đã dùng được bảo toàn.
- `ai_models`, `submission_errors`: chưa có màn quản lý model hoặc kết quả nhận dạng.

Backend hiện không đổi schema. Chưa có cột daily_goal nên không hiển thị form lưu mục tiêu vào database.

Các trang admin ở `src/pages/admin/`, canvas dùng lại ở `src/components/DrawingCanvas.tsx`, xác nhận xóa ở `DeleteDialog.tsx`. Canvas admin lưu mẫu theo pointerdown/up, pointercancel hủy nét dang dở; pointer capture cho phép kéo ra ngoài và kẹp tọa độ trong khung. Chỉ một pointer hoạt động. Số tròn là lớp hiển thị, không ghi thành nét của mẫu. Mẫu lưu ở 900 × 420, có thể NULL; không tạo mẫu “chuẩn” tự động từ font. Replay chỉ chạy khi bấm xem, có nút dừng. API kiểm tra kích thước và tọa độ mẫu.

## Xác minh

Build/lint, kiểm tra API trên MySQL thật và E2E bằng Google Chrome. E2E kiểm tra đăng ký/CRUD/reload/chuyển bé/đăng xuất, lỗi mạng và tràn ngang ở 375px. Màn AI chưa triển khai, không coi kết quả kiểm tra auth/dữ liệu là kiểm tra nhận dạng chữ.
