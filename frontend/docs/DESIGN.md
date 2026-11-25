# NétXinh — giao diện gia đình kết nối backend

## Phong cách

Giữ hướng dẫn `.claude/skills/tia-frontend-design-site/SKILL.md`: nền sáng, cream/coral/sky/mint/lavender, Nunito, Pip và minh họa SVG đã có. Trang đăng nhập/đăng ký có phần giới thiệu bên trái và form bên phải; điện thoại chuyển thành một cột. Thẻ hồ sơ, trạng thái lỗi và modal dùng tiếng Việt thân thiện. Có tắt chuyển động và hỗ trợ reduced motion.

## Luồng hiện tại

Đăng ký/đăng nhập → tạo/chọn hồ sơ → góc học tập → thư viện → xem nội dung bài. Phụ huynh quản lý hồ sơ thuộc tài khoản của mình, lưu xong sẽ chọn bé đó. Trang tiến độ và huy hiệu đọc theo ID bé. ADMIN có tổng quan, tài khoản, CRUD bài học/nội dung/loại lỗi và canvas tạo mẫu nét.

Phần luyện viết đã nối FastAPI/model thật qua Java API. `PracticePage` dùng `DrawingCanvas` ở mode practice, `SubmissionResult` hiển thị kết quả, nét đã lưu và mã lỗi. Mẫu admin và nét học sinh dùng cùng cấu trúc tọa độ, nhưng không gửi chữ gợi ý vào model. Canvas demo cũ không còn dùng để lưu bài local. Camera chưa hỗ trợ bởi checkpoint online hiện có.

## Chế độ canvas đã sửa theo demo gốc

`/luyen-tap/chu-don`: khung vuông 1:1, chuẩn420×420 và dòng kẻ giống serve.py. `/luyen-tap/chu-ghep`: khung5:2, chuẩn900×360, có ảnh sau preprocessing. `/luyen-tap/doan-van`: canvas từ5:2 và document các từ đã chốt, preview trước commit/sửa từ cuối/Space. Các tỷ lệ giữ trên mobile; không có min-height kéo méo canvas. Template admin giữ chuẩn900×420 để tương thích mẫu đã có.

Canvas practice mặc định tắt font gợi ý, giữ coalesced events và tọa độ float, không lọc bỏ điểm nét ngắn. Các lớp guide không gửi cho recognizer. Preview do useRecognition quản lý theo object drawing, có debounce tùy chọn, cancellation và invalidation; thay nét không được hiển thị kết quả request trước. Preview không lưu lượt/tiến độ.

Nhận dạng thử hiển thị text/confidence/candidates, word có mức hỗ trợ ký tự và gợi ý từ điển riêng. Document hiển thị chính visual text, không tự chọn gợi ý thành chữ của bé. Chỉ chốt từ sau inference thành công, chỉ gửi cả bài khi không còn từ dang dở. Word scoring bỏ qua hoa/thường/dấu câu như demo gốc và chú thích rõ. Kết quả saved có task để hiển thị nét đúng tỷ lệ; dữ liệu lưu vẫn theo900×420 đã có để không đổi schema.

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
- `submissions`, `student_progress`: lưu bài/kết quả/lỗi và cập nhật lượt/điểm theo bé; lỗi AI không tạo bài hoàn thành giả. Có trang xem lại riêng.
- `error_types`: CRUD mã/tên/mẫu phản hồi, xem trước lời nhắn cho bé. Lỗi đã dùng được bảo toàn.
- `ai_models`: gắn model path/version đã xử lý và hiển thị readiness; chưa có CRUD phiên bản model.
- `submission_errors`: báo từng lỗi trong chi tiết, nhóm lỗi trên trang phụ huynh, danh sách bài cần xem lại cho admin. Chuông dẫn tới báo cáo trong app, chưa có push/email/đã đọc.

Model word là CTC mức từ, UI chốt từng từ để tránh gán nhầm toàn trang cho model từ. Các tiêu chí thiếu dữ liệu để NULL và hiển thị “—”; không dùng confidence làm điểm đẹp chữ. Điểm từ hình học mẫu được chú thích là tham khảo, nhận dạng-only không được coi là thành thạo viết. Độ tin cậy thấp nhắc phụ huynh kiểm tra, không khẳng định lỗi của trẻ.

Backend hiện không đổi schema. Chưa có cột daily_goal nên không hiển thị form lưu mục tiêu vào database.

Ngày 25/11/2026: người dùng đổi chính sách xóa bài học. Hộp xác nhận ghi “Xóa vĩnh viễn”, số nội dung của bài và toàn bộ bài viết/kết quả/lỗi/tiến độ liên quan sẽ bị xóa, không thể hoàn tác. ADMIN không cần chuyển nội dung trước khi xóa bài. Sau khi xóa, thư viện được tải lại; số liệu parent thay đổi theo dữ liệu còn lại khi tải lại trang. Quyền PARENT vẫn giới hạn hồ sơ riêng và không được gọi API xóa bài. Xóa riêng item/error type chưa thay đổi chính sách.

Các trang admin ở `src/pages/admin/`, canvas dùng lại ở `src/components/DrawingCanvas.tsx`, xác nhận xóa ở `DeleteDialog.tsx`. Canvas admin lưu mẫu theo pointerdown/up, pointercancel hủy nét dang dở; pointer capture cho phép kéo ra ngoài và kẹp tọa độ trong khung. Chỉ một pointer hoạt động. Số tròn là lớp hiển thị, không ghi thành nét của mẫu. Mẫu lưu ở 900 × 420, có thể NULL; không tạo mẫu “chuẩn” tự động từ font. Replay chỉ chạy khi bấm xem, có nút dừng. API kiểm tra kích thước và tọa độ mẫu.

## Xác minh

Build/lint, kiểm tra API trên MySQL thật và E2E bằng Google Chrome. E2E kiểm tra đăng ký/CRUD/reload/chuyển bé/đăng xuất, lỗi mạng và tràn ngang ở 375px. Màn AI chưa triển khai, không coi kết quả kiểm tra auth/dữ liệu là kiểm tra nhận dạng chữ.
