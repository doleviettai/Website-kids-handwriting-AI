# NétXinh — Thiết kế frontend

## Phạm vi bản đầu

Giao diện tiếng Việt chạy độc lập bằng React + TypeScript + Vite. Dành cho trẻ mẫu giáo và lớp 1, cùng một hồ sơ bé trên trình duyệt. Chưa kết nối Spring Boot, MySQL hoặc Python AI.

Áp dụng `.claude/skills/tia-frontend-design-site/SKILL.md`: nền sáng, cream, coral, sky, mint và lavender; font Nunito cho nội dung tiếng Việt; thẻ bo tròn và chuyển động nhẹ. Nhân vật cáo Pip, biểu tượng và minh họa được vẽ bằng SVG trong dự án. Các tham chiếu Next.js trong skill thuộc dự án gốc, không áp dụng trực tiếp vào Vite. Skill phụ `tia-frontend-design` không có trong các thư mục skill đã tìm, nên bản này sử dụng hướng dẫn trong repo.

## Luồng chính

1. Vào góc học tập, chọn cấp học và nhóm bài.
2. Chọn bài và chữ/số/từ/câu cần luyện.
3. Viết bằng Pointer Events trên canvas hoặc chọn ảnh/chụp camera.
4. Lưu lượt luyện tập. Nội dung chờ AI, không sinh điểm nhận dạng giả.
5. Xem lượt luyện trong hành trình và huy hiệu dựa trên số lần thực hành.

Canvas hỗ trợ chuột, ngón tay và bút cảm ứng, hoàn tác từng nét, xóa bài, đổi màu, bật/tắt gợi ý. Điểm nét chuẩn hóa về hệ tọa độ 900 × 420, gồm `x`, `y`, `t`. Chữ gợi ý dùng font hiển thị, chưa phải mẫu chữ viết tay chuẩn hay hoạt ảnh thứ tự nét.

## Ánh xạ dữ liệu

| Bảng                               | Giao diện                             | Trạng thái                                  |
| ---------------------------------- | ------------------------------------- | ------------------------------------------- |
| `users`                            | Góc ba mẹ                             | Chưa có xác thực hoặc tài khoản thật        |
| `students`                         | Hồ sơ, tên, năm sinh, cấp học         | Một hồ sơ cục bộ                            |
| `lessons`                          | Thẻ bài, bộ lọc cấp học               | Nội dung mẫu trong `src/data.ts`            |
| `writing_items`                    | Chữ/số/từ/câu trong mỗi bài           | Nội dung mẫu, NFC khi lưu                   |
| `ai_models`                        | Phân tuyến trong `modelTaskFor`       | Chưa gọi model                              |
| `submissions`                      | Canvas, camera, lịch sử, chi tiết nét | Lưu cục bộ, điểm AI là `null`               |
| `error_types`, `submission_errors` | Phản hồi sau chấm                     | Chờ AI, không tự bịa lỗi                    |
| `student_progress`                 | Nội dung đã luyện, mục tiêu ngày      | Tổng hợp lượt lưu, chưa đánh dấu thành thạo |

Phân tuyến đúng schema: `LETTER`, `DIGIT` → `SINGLE_CHAR`; `DIGRAPH` → `COMPOUND`; `WORD`, `SENTENCE` → `PARAGRAPH`.

ID bài mẫu và ID nội dung dạng `lessonId:text` chỉ dùng frontend. Khi tích hợp phải lấy khóa chính database. `status: PENDING_AI` là trạng thái giao diện bổ sung, chưa có trong schema đã đưa. Ảnh cần upload và nhận `image_url` từ backend trước khi lưu chính thức.

## Lưu trữ và giới hạn

- LocalStorage lưu hồ sơ, nét bút và lịch sử sau khi tải lại trang.
- Ảnh chỉ xem trong phiên hiện tại bằng object URL, chưa lưu LocalStorage/máy chủ. Có nút tải bài về tại màn luyện viết.
- Thống kê và huy hiệu tính từ lượt luyện thật trên trình duyệt, không gán trước điểm/lịch sử mẫu.
- Camera cần HTTPS hoặc localhost và quyền người dùng cấp; có thể chọn ảnh thay thế.
- Phát âm dùng SpeechSynthesis `vi-VN`, phụ thuộc giọng thiết bị.
- Font Google có thể cần mạng ở lần đầu; SVG được đóng gói cùng ứng dụng.
- Có breakpoint cho điện thoại, tablet và desktop, tùy chọn tắt chuyển động và `prefers-reduced-motion`.

## Bước tích hợp tiếp theo

Xác thực PARENT/ADMIN, nhiều hồ sơ bé, danh mục từ API, upload ảnh, API tạo bài viết và trạng thái xử lý, ba model AI, kết quả phân đoạn/lỗi, cập nhật tiến độ, trang quản trị. CAMERA phải giữ `direction_score` và `stroke_order_score` là `null` vì ảnh không có dữ liệu thời gian nét.
