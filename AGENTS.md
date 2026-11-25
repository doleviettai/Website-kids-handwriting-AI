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
- Không tạo điểm nhận dạng hoặc nhận xét AI giả. Đã nối model thật; phân biệt rõ nhận dạng, độ khớp nội dung và so sánh hình học tham khảo với mẫu.
- Đặc tả đầy đủ ở `project-memory/prompts/04-full-project-spec.md`. Yêu cầu mới nhất ngày 24/11/2026 cho phép FastAPI/model thật, canvas gửi bài, kết quả/lỗi/tiến độ và thông báo trong web cho admin/parent. Không áp dụng điểm hoãn model cũ. Source train được người dùng chỉ định tại `D:/Coding/Python/HandWriting`, đã snapshot inference/labels đúng checkpoint sang ai-server; không sửa dự án train bên ngoài.
- Ngày 24/11/2026 người dùng yêu cầu CRUD ADMIN bài học, nội dung, canvas mẫu nét và loại lỗi/phản hồi. Đã xác nhận PARENT chỉ quản lý các bé thuộc tài khoản của mình, không chia sẻ/chuyển quyền sang tài khoản khác. Không mở truy cập chéo hồ sơ.
- Ngày 25/11/2026 người dùng yêu cầu ADMIN xóa bài học thì xóa vĩnh viễn cả nội dung, bài viết, lỗi bài viết và tiến độ liên quan, kể cả đã có lịch sử. Chính sách này thay thế điều kiện bài học phải trống trước đây; dùng transaction và giữ dữ liệu các bài khác. Xóa riêng từng nội dung/lỗi vẫn theo ràng buộc hiện tại.
- CAMERA không có dữ liệu thời gian nét: `direction_score` và `stroke_order_score` phải là `NULL`.
- Sau thay đổi đáng kể, cập nhật `project-memory/STATUS.md`; cập nhật `PROJECT_CONTEXT.md` nếu có quyết định mới về phạm vi/kiến trúc.
- Ghi chính xác kiểm tra đã chạy và giới hạn chưa xác minh. Không đưa mật khẩu, token, ảnh trẻ hoặc thông tin riêng tư vào tài liệu ngữ cảnh/prompt.

Prompt dùng lại nằm trong `project-memory/prompts/`. Hướng dẫn chạy frontend ở `frontend/README.md`.
