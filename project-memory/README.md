# Bộ nhớ dự án và kho prompt

Thư mục này lưu ngữ cảnh trong repo để tiếp tục đồ án qua các phiên làm việc hoặc đổi công cụ AI. Đây là tài liệu để AI đọc lại; không phải cơ chế ghi nhớ tự động của mô hình.

| Tài liệu | Nội dung |
| --- | --- |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Mô tả đồ án, kiến trúc, yêu cầu và quy tắc nghiệp vụ |
| [STATUS.md](STATUS.md) | Đã làm, chưa làm, kiểm tra và việc cần tiếp tục |
| [database.dbml](database.dbml) | Schema MySQL gốc gồm 9 bảng, lưu ở định dạng DBML |
| [prompts/README.md](prompts/README.md) | Cách dùng và danh sách prompt |
| [prompts/01-resume-project.md](prompts/01-resume-project.md) | Đọc lại ngữ cảnh trước khi tiếp tục |
| [prompts/02-implement-feature.md](prompts/02-implement-feature.md) | Giao một tính năng cụ thể cho AI |
| [prompts/03-update-handoff.md](prompts/03-update-handoff.md) | Cập nhật trạng thái trước khi kết thúc phiên |
| [prompts/04-full-project-spec.md](prompts/04-full-project-spec.md) | Đặc tả đầy đủ, trình tự thực hiện và phần model để sau |

## Sử dụng

Khi mở phiên chat mới trong repo, dùng:

```text
Đọc AGENTS.md, project-memory/PROJECT_CONTEXT.md và project-memory/STATUS.md.
Đối chiếu với code, tóm tắt trạng thái rồi thực hiện yêu cầu sau:
[Ghi công việc cần làm ở đây]
```

`AGENTS.md` cung cấp điểm đọc cho Codex; `CLAUDE.md` cung cấp điểm đọc cho Claude. Nếu công cụ không tự nạp các file này, gửi prompt trên hoặc đính kèm tài liệu liên quan.

Cuối mỗi đợt thay đổi đáng kể, cập nhật `STATUS.md` và các quyết định mới trong `PROJECT_CONTEXT.md`. Giữ schema phân biệt rõ với migration đã triển khai. Các đề xuất chưa được duyệt không ghi như việc đã hoàn thành.
