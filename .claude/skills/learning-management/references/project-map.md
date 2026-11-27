# Bản đồ dự án cho learning-management

Khảo sát ngày 27/11/2026 tại workspace Website-kids-handwriting-AI. Đây là chỉ dẫn chọn file và các khoảng trống thực tế; đọc lại code trước mỗi lần triển khai.

## Bằng chứng và giới hạn khảo sát

- Đã đọc `CLAUDE.md`, `AGENTS.md`, README gốc/backend/frontend, PROJECT_CONTEXT, STATUS, MODEL_REVIEW, toàn bộ năm file trong `project-memory/prompts/`, DBML và hướng dẫn thiết kế.
- Đã khảo sát `backend/src/main/java/com/example/backend/` (controller/service/repository/entity/dto/config/exception/migration), migration SQL, Gradle; `frontend/src/` (routing, context, hook, client/types, trang Admin/Parent, component), package.json và bộ test; đọc phần chấm trong `ai-server/app/evaluation.py`.
- Truy vấn metadata bằng MySQL CLI trong transaction READ ONLY rồi ROLLBACK: server MySQL 8.4.4, schema `kids_handwriting`, 21 bảng nghiệp vụ và `flyway_schema_history`; V1–V7 đều success. Không khởi động backend, chạy migration, sửa DB hoặc đọc danh tính/ảnh/bài viết của trẻ.
- Đây là kiểm tra tĩnh và metadata database, không xác nhận các endpoint, UI hoặc model chạy được trong phiên này. Workspace gốc không có metadata Git; không có diff nền để suy ra file nào người dùng đang sửa.

## Kiến trúc xác nhận từ code

| Phần | Cấu trúc và điểm vào |
| --- | --- |
| Backend | `backend/build.gradle`: Java 21, Spring Boot 4.2.0, Gradle; Spring MVC/Security/OAuth2 Resource Server/JPA/Flyway/MySQL/Validation, Lombok |
| Frontend | `frontend/package.json`: React 19, TypeScript, Vite 8, Router 7, axios và Playwright; không có framework Next.js, Zustand hoặc thư viện PDF trong manifest |
| Phiên | `JwtService`: HS256, TTL 3600 giây, allowlist trong RAM; restart cần login lại. `AuthProvider` và axios lưu JWT trong sessionStorage, xử lý 401 |
| Phân quyền | `SecurityConfig` ràng buộc prefix theo role; ownership tại service/repository. Đăng ký luôn PARENT; TEACHER và ADMIN đã tồn tại |
| Database | V1 nền, V2 Java seed, V3 model/feedback, V4 mục tiêu/kế hoạch/nhận xét/thông báo, V5 giáo viên/lớp, V6 bài tập/ảnh/sổ điểm, V7 seed demo |
| UI | `frontend/src/App.tsx`: ProtectedWorkspace → WorkspaceProvider → Shell, RolePage và React Router; dùng CSS trong App.css/ConnectedApp.css, component đã có |

Không diễn giải phần cũ trong README/PROJECT_CONTEXT/DESIGN nói “chưa gọi Python”, “chưa có mục tiêu”, “chưa có đã đọc/upload” thành hiện trạng. Code có model online thật, mục tiêu/kế hoạch, thông báo có read_at và ảnh vở riêng tư. Chấm ảnh bằng model V5+Kids vẫn chờ, khác với model nét online đã nối.

## Quan hệ dữ liệu cần giữ

- `students.parent_id → users.id`; `submissions.student_id → students.id`, `item_id → writing_items.id`, `model_id → ai_models.id`.
- `writing_items.lesson_id → lessons.id` nullable; unique toàn cục `(item_type,text_value)`, không phải unique theo lesson.
- `submission_comments.submission_id → submissions.id`, `author_id → users.id`; content VARCHAR(1000), created_at DATETIME; chưa có updated_at/editor hoặc dữ liệu hỗ trợ luyện lại.
- `submission_errors` nối bài nộp và `error_types`; `student_progress` dùng khóa ghép student/item. `practice_plan_items` khóa ghép plan/item.
- `notifications` có recipient, student/submission tùy chọn và read_at. Các native delete hiện tự dọn phụ thuộc, không dựa vào ON DELETE CASCADE.
- Nhánh lớp: teacher → classrooms → classroom_enrollments/review_batches → student_evaluations → homework_submission_pages. Enrollment có thể liên kết student; đây không phải quyền chuyển owner hồ sơ.
- Các cột tiếng Việt dùng utf8mb4; submissions có DECIMAL(5,4) cho confidence/text_accuracy, các điểm nullable TINYINT. Ngày giờ DB là DATETIME, logic ngày sử dụng Asia/Ho_Chi_Minh.

## Điểm mở rộng cho từng module

Các đường dẫn Java dưới đây tương đối với `backend/src/main/java/com/example/backend/`.

| Nghiệp vụ | File và hành vi đã có | Phần chưa có |
| --- | --- | --- |
| Danh sách/xem bài | `controller/SubmissionController.java`, `service/ReviewService.java`, `service/SubmissionService.java`, `service/StudentOverviewService.java`; ADMIN reviews 20/trang, lịch sử PARENT 10/trang | Bộ lọc và aggregate theo khoảng ngày phục vụ PDF |
| Nhận xét Admin | `controller/NotificationController.java`, `service/CommentService.java`, `repository/SubmissionCommentRepository.java`, `entity/SubmissionComment.java`, `dto/NotificationDtos.java` | Sửa nhận xét/audit sửa, idempotency; lưu xác nhận/ghi chú riêng/lịch sử hỗ trợ |
| CRUD bài/mẫu | `controller/AdminContentController.java`, `service/AdminContentService.java`, `dto/AdminContentDtos.java`, `entity/Lesson.java`, `entity/WritingItem.java` | Status DRAFT/PUBLISHED, audit lesson, mô tả/ảnh/tài liệu và validation xuất bản |
| Thư viện | `controller/LessonController.java`, `service/LearningService.java`, `repository/LessonRepository.java` | Lọc PUBLISHED; list/detail hiện trả mọi bài, Admin đang gọi chung service |
| Chấm/lưu bài | `service/SubmissionPersistence.java`, `service/SubmissionService.java`, `service/HttpAiClient.java`, `config/ScoringProperties.java` | Kiểm tra trạng thái bài trong prepare/save khi triển khai C |
| Kế hoạch | `service/PlanningService.java`, `service/StudentOverviewService.java` | Rà lọc nháp khi lấy nội dung kế hoạch/hôm nay/lộ trình |
| Xóa phụ thuộc | `service/AdminContentService.java`, `service/StudentService.java`, `service/AdminUserService.java` | Bổ sung xử lý FK mới của A/C khi có |
| Báo cáo PDF | Có CSV giáo viên và window.print ở màn đợt chấm | Chưa có API preview/PDF PARENT hoặc dependency PDF; CSV/in phiếu không phải module B |

Frontend cần xem:

- `frontend/src/pages/SubmissionDetailPage.tsx`: xem nhận xét, form ADMIN tạo nhận xét; chưa có sửa/hỗ trợ/ghi chú riêng.
- `frontend/src/pages/admin/AdminReviewsPage.tsx`: danh sách bài cần xem lại; `frontend/src/pages/JourneyPage.tsx`: lịch sử và góc ba mẹ.
- `frontend/src/pages/admin/AdminLessonsPage.tsx`, `LessonEditor.tsx`, `AdminItemsPage.tsx`, `ItemEditor.tsx`: tái dùng CRUD/mẫu; hiện LessonEditor chỉ gửi title/gradeLevel/sortOrder.
- `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/hooks/useResource.ts`, `frontend/src/context/WorkspaceProvider.tsx`: client chung, hợp đồng DTO và dữ liệu theo bé.
- `frontend/src/components/DrawingCanvas.tsx`, `SubmissionResult.tsx`, `Feedback.tsx`, `Modal.tsx`, `DeleteDialog.tsx`: canvas, kết quả và trạng thái dùng lại.
- `frontend/src/pages/teacher/TeacherBatchPage.tsx` có tải CSV bằng blob và window.print; `ParentClassroomPage.tsx` là lớp/bài tập giáo viên, không phải nguồn báo cáo bài cảm ứng.

## API hiện có liên quan

| Method và đường dẫn | Quyền/hành vi |
| --- | --- |
| GET `/api/admin/reviews?page=0&onlyErrors=true` | ADMIN xem danh sách bài |
| GET `/api/students/{id}/submissions?page=0` | PARENT sở hữu, lịch sử 10/trang |
| GET `/api/submissions/{id}` | ADMIN hoặc PARENT sở hữu xem kết quả/nét |
| GET `/api/submissions/{id}/comments` | ADMIN hoặc PARENT sở hữu xem nhận xét |
| POST `/api/admin/submissions/{id}/comments` | ADMIN tạo nhận xét, thông báo NEW_COMMENT; chưa có PUT/PATCH |
| GET/POST `/api/admin/lessons`, PUT/DELETE `/api/admin/lessons/{id}` | CRUD ADMIN |
| GET/POST `/api/admin/items`, PUT/DELETE `/api/admin/items/{id}` | CRUD nội dung và mẫu |
| GET `/api/lessons`, `/api/lessons/{id}` | Đã xác thực, chưa lọc trạng thái |
| POST `/api/recognition/preview`, `/api/submissions` | PARENT sở hữu, preview không lưu; submit re-infer và lưu |
| GET `/api/students/{id}/today` | Kế hoạch/ngày theo bé sở hữu |

Các API sửa nhận xét, hỗ trợ luyện lại, preview/PDF báo cáo và publish/unpublish là hợp đồng cần thiết kế khi triển khai, không phải endpoint đang có.

## DBML chưa khớp migration/database

Giữ DBML là tham chiếu, không chạy DDL từ những khác biệt này trong nhiệm vụ tạo skill. Metadata thật đã xác nhận các giá trị sau:

| Vị trí | DBML hiện ghi | Migration V6/database thật |
| --- | --- | --- |
| classroom_invitations | enrollment_id, invited_email, invited_user_id | parent_email, invited_by; không có ba cột bên trái |
| homework_submission_pages | image_path và unique (evaluation_id,page_number) | storage_path, content_type, file_size; index thường trên (evaluation_id,page_number) |
| student_evaluations | graded_at | Không có graded_at; có updated_at và scheduled_send_at |
| classroom_enrollments | parent_phone VARCHAR(25), teacher_note VARCHAR(500) | VARCHAR(30), VARCHAR(300) |
| review_batches.description | VARCHAR(2000) | TEXT |

Không tự sửa migration đã chạy để khớp DBML. Nếu lần sau cần đồng bộ tài liệu schema, đối chiếu lại metadata và cập nhật tài liệu trong phạm vi được giao.

## Cơ sở chỉ số khi làm PDF

`ai-server/app/evaluation.py` tạo recognition/textAccuracy và tiêu chí geometry nullable. `SubmissionPersistence.save` lưu kết quả:

- Có tiêu chí geometry: trung bình các tiêu chí có thật theo trọng số cấu hình 0.3/0.3/0.2/0.2, chuẩn hóa theo trọng số hiện diện, nhân textAccuracy; clamp 0–100 và làm tròn.
- Không geometry: total_score = làm tròn 100 × textAccuracy. Sao theo 90/70/50. Vì vậy total_score không phải điểm geometry thuần hoặc confidence.
- Không đổi công thức khi làm báo cáo. Không dùng mẫu hiện tại để tái tính kết quả lịch sử.
- Điểm giáo viên `student_evaluations.score` là 0–10, có grading_mode; không trộn vào điểm AI 0–100 nếu chưa có yêu cầu báo cáo mở rộng rõ ràng.

## Kiểm thử và quyết định còn thiếu

- Java: `backend/src/test/java/com/example/backend/`, ưu tiên `NotificationApiTests.java`, `SubmissionApiTests.java`, `AdminContentApiTests.java`, `FamilyApiTests.java`, `PlanningApiTests.java`; có MockMvc, SpringBootTest, MockitoBean AiClient và transaction rollback trên MySQL thật.
- Frontend: `frontend/playwright.config.ts`, `frontend/e2e/`; Chrome, workers=1, trace/video tắt. Một số fixture phụ thuộc seed và CLI mysql; kiểm tra trước khi chạy, không thay seed để làm test đạt.
- Khi triển khai: trong backend chạy `.\gradlew.bat test bootJar`; trong frontend chạy `npm run build`, `npm run lint`, `npm run test:e2e -- <tệp-test-liên-quan>` với server/dependencies cần thiết. Không chạy test ứng dụng khi chỉ sửa skill/tài liệu.
- Chưa xác định từ code: chính sách Admin sửa nhận xét của Admin khác; ai ngoài chủ được đọc ghi chú riêng; thời gian lọc nhận xét/hỗ trợ trong PDF; engine/font PDF; backfill lesson cũ và audit; quy tắc completeness để publish; quyền xem lịch sử/kế hoạch khi thu hồi bài. Làm rõ quyết định ảnh hưởng tính năng tại lần triển khai, không tự thêm quyền hoặc dữ liệu.
