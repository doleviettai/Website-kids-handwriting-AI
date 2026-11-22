# Hướng dẫn làm việc với kid-handwriting-ai

## Đọc ngữ cảnh trước khi bắt đầu

1. Đọc `project-memory/PROJECT_CONTEXT.md` để hiểu mục tiêu, kiến trúc và các quyết định của dự án.
2. Đọc `project-memory/STATUS.md` để biết phần đã làm, giới hạn và công việc còn lại.
3. Khi làm database/backend/AI, đọc `project-memory/database.dbml` — schema tham chiếu do người dùng cung cấp; đối chiếu với migration trong backend và trạng thái database thật.
4. Khi làm giao diện, đọc `.claude/skills/tia-frontend-design-site/SKILL.md` và `frontend/docs/DESIGN.md`.

## Cách tiếp tục công việc

- Trao đổi và viết nội dung giao diện bằng tiếng Việt.
- Yêu cầu hiện tại của người dùng quyết định phạm vi công việc; danh sách việc còn lại không tự cấp phép triển khai tất cả.
- Đối chiếu tài liệu với code thực tế. Nếu khác nhau, ghi rõ khác biệt và cập nhật tài liệu theo kết quả kiểm tra.
- Giữ lại thay đổi sẵn có của người dùng; không tự khôi phục file đã bị xóa hoặc ghi đè phần việc khác.
- Không tạo điểm nhận dạng hoặc nhận xét AI giả. Giao diện hiện chờ kết nối model.
- Đặc tả đầy đủ ở `project-memory/prompts/04-full-project-spec.md`. Yêu cầu mới nhất đã cho phép nối frontend và các API cần thiết: auth JWT, hồ sơ bé, nội dung và dữ liệu tiến độ. Không dừng ở điểm chờ bước 1 cũ khi xử lý yêu cầu tích hợp này. Model/nhận dạng/chấm bài vẫn hoãn, chưa gọi Python.
- CAMERA không có dữ liệu thời gian nét: `direction_score` và `stroke_order_score` phải là `NULL`.
- Sau thay đổi đáng kể, cập nhật `project-memory/STATUS.md`; cập nhật `PROJECT_CONTEXT.md` nếu có quyết định mới về phạm vi/kiến trúc.
- Ghi chính xác kiểm tra đã chạy và giới hạn chưa xác minh. Không đưa mật khẩu, token, ảnh trẻ hoặc thông tin riêng tư vào tài liệu ngữ cảnh/prompt.

Prompt dùng lại nằm trong `project-memory/prompts/`. Hướng dẫn chạy frontend ở `frontend/README.md`.
