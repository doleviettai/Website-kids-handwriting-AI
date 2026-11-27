---
name: learning-management
description: Hướng dẫn triển khai quản lý học tập cho Website-kids-handwriting-AI (NétXinh), gồm nhận xét Admin và theo dõi phụ huynh hỗ trợ luyện lại, báo cáo học tập PDF, bài học nháp và xuất bản. Dùng khi khảo sát, thiết kế, lập trình hoặc kiểm thử các luồng này trên kiến trúc hiện có.
---

# Quản lý học tập NétXinh

## Mục đích và phạm vi

Triển khai từng yêu cầu quản lý học tập theo code, schema và quyền hiện tại của dự án. Giao tiếp, nội dung giao diện và lỗi nghiệp vụ bằng tiếng Việt. Xác định người dùng đang yêu cầu module A, B, C hay một phần của module; kích hoạt skill không cấp phép làm cả ba module.

Nếu yêu cầu chỉ khảo sát hoặc viết tài liệu/skill, chỉ thực hiện phạm vi đó. Các yêu cầu nghiệp vụ dưới đây là tiêu chí cho lần triển khai được giao, không phải tuyên bố tính năng đã tồn tại.

## Đọc ngữ cảnh và xác định hiện trạng

1. Đọc `CLAUDE.md`, `AGENTS.md`, `README.md`, `project-memory/PROJECT_CONTEXT.md`, `project-memory/STATUS.md`, `project-memory/MODEL_REVIEW.md` và các file trong `project-memory/prompts/`.
2. Đọc `project-memory/database.dbml`; đối chiếu entity, repository, migration và metadata database thật bằng truy vấn chỉ đọc khi có kết nối. Không khởi động ứng dụng chỉ để khảo sát vì Flyway có thể tự chạy migration.
3. Khi làm UI, đọc `.claude/skills/tia-frontend-design-site/SKILL.md` và `frontend/docs/DESIGN.md`. Giữ thẩm mỹ sáng, Nunito, Pip, CSS/component hiện có; các đường dẫn Next.js/Tailwind kế thừa trong skill thiết kế không chứng minh công nghệ đó có trong repo.
4. Đọc [bản đồ code và khoảng trống đã khảo sát](references/project-map.md) để chọn điểm mở rộng. Kiểm tra lại các file liên quan trước khi sửa; bản đồ là ảnh chụp ngày 27/11/2026, không thay thế code mới hơn.
5. Kiểm tra thay đổi có sẵn. Nếu workspace thiếu metadata Git, ghi rõ không có diff nền; giữ file và thay đổi ngoài phạm vi. Khi tài liệu mâu thuẫn code, ghi nhận khác biệt, không tự biến tài liệu cũ thành hành vi mới.

## Bối cảnh và quy tắc kiến trúc

- Frontend: React 19, TypeScript, Vite 8, React Router 7, axios; backend: Java 21, Spring Boot 4.2, Gradle, JPA và JdbcTemplate; database: MySQL `kids_handwriting`, Flyway; AI: FastAPI cùng ba model nhận dạng thật.
- Backend theo `com.example.backend`: `controller → service → repository/entity`, DTO ở `dto/`, cấu hình ở `config/`, lỗi ở `exception/`. Trả DTO, không serialize entity hoặc password hash. Dùng Jakarta Validation và `ApiException`/`ApiExceptionHandler`, lỗi JSON `{"message":"..."}`.
- Giữ quy ước Java camelCase, SQL snake_case, DTO record, TypeScript khớp hợp đồng backend. Chuẩn hóa tiếng Việt bằng `VietnameseText.nfc`; xử lý trim và độ dài ở server.
- Tái sử dụng `SecurityConfig`, `JwtService`, `AccountService`; không tạo hệ auth, role hay database song song. Có ba role `ADMIN`, `PARENT`, `TEACHER`; trẻ là hồ sơ `students`, không có role/tài khoản STUDENT. Cấp học hiện tại là `MAU_GIAO` đến `LOP_5`.
- Frontend giữ `ProtectedWorkspace`, `RolePage`, `Shell` trong `src/App.tsx`; `AuthProvider`, `WorkspaceProvider`, `useResource`, `src/api/client.ts` và `src/api/types.ts`. Dùng axios instance có baseURL `/api`, Bearer JWT và xử lý 401; không tạo fetch/axios/auth hoặc địa chỉ backend tuyệt đối riêng trong component.
- API path hiện được truyền từ page/hook vào client chung; chưa có lớp API service cho từng domain. Mở rộng theo quy ước thực tế, không khẳng định lớp đó đã có. Token và bé đang chọn ở sessionStorage, dữ liệu nghiệp vụ ở server; LocalStorage chỉ dành cho tùy chọn thiết bị.
- Tái dùng `Modal`, `DeleteDialog`, `Feedback`, `DrawingCanvas`, `SubmissionResult` và các trang admin hiện có. Có loading, rỗng, lỗi kèm thử lại, thành công; chống gửi lặp; hủy/loại response cũ khi đổi bé, bộ lọc hoặc tài khoản.
- Chỉ thêm migration khi cần dữ liệu/schema mới. Chọn phiên bản tiếp theo sau khi kiểm tra thực tế, không cố định V8. Không sửa migration đã áp dụng, reset/seed lại dữ liệu đã bị xóa, bật Hibernate update, Flyway clean/baseline hay tắt FK. Thiết kế FK, index, nullability và backfill trước khi chạy; cập nhật DBML theo thay đổi thực sự.
- Ghi dữ liệu liên quan trong transaction; đọc dùng read-only khi phù hợp. Không giữ transaction trong lúc chờ HTTP AI. Khi thêm FK, rà mọi đường xóa liên quan, gồm `AdminContentService`, `StudentService`, `AdminUserService` và luồng lớp học nếu bị ảnh hưởng.
- Chính sách 25/11 vẫn áp dụng: ADMIN xóa cả bài học sẽ xóa vĩnh viễn nội dung, bài nộp, lỗi, tiến độ và các phụ thuộc liên quan trong một transaction, giữ hồ sơ/tài khoản và bài khác. Xóa riêng item có lịch sử hoặc loại lỗi đã dùng vẫn có ràng buộc. Chuyển trạng thái bài học không phải thao tác xóa.

## Bảo mật và quyền truy cập

| Thao tác | ADMIN | PARENT | TEACHER |
| --- | --- | --- | --- |
| Xem bài cảm ứng và nhận xét Admin | Theo quyền hỗ trợ hiện có | Chỉ con thuộc tài khoản | Không tự cấp thêm quyền |
| Tạo/sửa nhận xét Admin | Có | Không | Không |
| Xác nhận đã hướng dẫn, ghi chú riêng, lịch sử hỗ trợ | Xem trạng thái hỗ trợ cần thiết | Chỉ dữ liệu của mình và con mình | Không tự cấp thêm quyền |
| Xem trước/xuất PDF học tập | Không mở thêm nếu chưa được yêu cầu | Chỉ con thuộc tài khoản | Không |
| CRUD/xem trước nháp/xuất bản bài học | Có | Không | Không |
| Đọc thư viện bài học | Nhìn được nháp để quản trị | Chỉ PUBLISHED | Không dùng role này để lách bộ lọc nháp |

- Kiểm tra cả route/UI và backend. `SecurityConfig` chặn `/api/admin/**`, `/api/teacher/**`, `/api/parent/**`, `/api/students/**` theo role; service phải xác minh ownership của từng student, submission, comment, bản ghi hỗ trợ và report. Ẩn nút không bảo vệ API.
- Với PARENT, dùng `StudentService.requireOwned` hoặc truy vấn ràng buộc `student.parent.id = userId`, kể cả request đổi ID trên URL/body/query. Resource ngoài phạm vi thường trả 404; sai role 403; thiếu/hết hạn JWT 401; dữ liệu sai 400; xung đột 409 theo quy ước hiện có.
- Lấy người tạo/cập nhật/xác nhận từ principal đã xác thực, thời gian từ server. Không tin `parentId`, `authorId`, `createdBy`, role hay timestamp do client tự gán.
- Ghi chú riêng mặc định chỉ chủ ghi chú được đọc; Admin theo dõi trạng thái và thời gian hỗ trợ. Nếu cần cho Admin đọc nội dung ghi chú, phải xác định quyền đó từ yêu cầu trước khi mở. Loại nội dung riêng khỏi DTO chung, thông báo, log, báo cáo người khác và cache dùng chung.
- Không đổi owner/chia sẻ hồ sơ giữa các phụ huynh. Quyền giáo viên theo lớp và ảnh bài tập đã có không tự mở quyền đọc bài cảm ứng, nháp hoặc ghi chú riêng.

## Module A — Nhận xét và theo dõi hỗ trợ

Tái dùng `submission_comments`, `CommentService`, `NotificationController` và `SubmissionDetailPage`. Hiện đã có Admin tạo nhận xét, owner xem nhận xét và thông báo `NEW_COMMENT`; sửa nhận xét, hỗ trợ luyện lại, ghi chú riêng và lịch sử hỗ trợ chưa có.

- Admin xem danh sách bài luyện, mở nội dung/nét và kết quả thật, viết hoặc sửa nhận xét từng bài, xem trạng thái phụ huynh đã hỗ trợ. Không ghi nhận xét thủ công vào `feedback_text` của AI hoặc `student_evaluations.teacher_comment` của giáo viên.
- Parent chỉ xem bài/nhận xét của con mình, đánh dấu “Đã hướng dẫn con luyện lại”, nhập ghi chú riêng và xem lịch sử các lần xác nhận/ghi chú. Không cho Parent sửa nhận xét Admin.
- Thiết kế mở rộng phần cập nhật nhận xét với actor/thời gian cập nhật từ server; không thay tác giả gốc. Xác định rõ Admin sửa nhận xét của mình hay được sửa của Admin khác, cùng cơ chế tránh ghi đè chỉnh sửa đồng thời khi cần.
- Tách bản ghi hỗ trợ riêng khỏi danh sách nhận xét dùng chung. Dùng FK tới bài nộp, actor và thời gian; bảo toàn lịch sử các lần hỗ trợ, không chỉ ghi đè một boolean/ghi chú mới nhất. Trạng thái tổng hợp phải có quy tắc xác định từ lịch sử.
- Chống double-click, retry và request đồng thời bằng cơ chế backend như operation key có uniqueness theo actor/resource, kết hợp transaction; nút disabled chỉ là hỗ trợ UX. Phân biệt retry cùng thao tác với lần hỗ trợ mới hợp lệ, tránh unique chỉ theo phụ huynh/bài nộp làm mất nhiều lần hỗ trợ.
- Tái sử dụng thông báo trong web đã có. Không gửi nội dung ghi chú riêng qua thông báo; không tự thêm email/push. Bổ sung dọn phụ thuộc mới khi xóa bài học/bài nộp/tài khoản theo chính sách hiện tại.

## Module B — Báo cáo học tập PDF

Chọn một bé thuộc tài khoản, ngày bắt đầu/kết thúc, xem trước dữ liệu server rồi tải PDF. Chưa có API báo cáo PDF hoặc dependency tạo PDF trong dự án; lựa chọn thư viện và font khi được giao triển khai, không giả định đã có.

- Backend kiểm tra owner trước khi tổng hợp và trước khi xuất. Frontend gửi ID/khoảng ngày, không gửi điểm/tổng số/nhận xét tự tổng hợp để server tin và in lại. Preview và PDF dùng cùng logic/DTO báo cáo từ backend; không chỉ lấy một trang lịch sử hoặc mặc định thống kê bảy ngày.
- Validate ngày bắt đầu không sau ngày kết thúc; thống nhất ngày theo `Asia/Ho_Chi_Minh`. Lọc nửa mở từ 00:00 ngày đầu đến trước 00:00 ngày sau ngày cuối để bao trọn ngày kết thúc. Xác định thời gian áp dụng cho nhận xét/lịch sử hỗ trợ trước khi viết query.
- PDF gồm: thông tin hồ sơ trẻ, khoảng báo cáo, tổng số bài đã luyện, kết quả đúng nội dung, danh sách nội dung đã luyện, lỗi ghi nhận, nhận xét Admin và lịch sử phụ huynh hỗ trợ nếu có. Không dùng tên thật/thông tin tài khoản không cần thiết. Ghi chú riêng chỉ xuất cho chính chủ và theo chính sách báo cáo đã xác định.
- Tách rõ các dữ liệu sau; không sáng tạo một “điểm nhận dạng” độc lập vì schema hiện chưa có cột đó:

| Dữ liệu nguồn | Ý nghĩa và cách trình bày |
| --- | --- |
| `predicted_text`, `confidence` | Chữ model đọc và độ tin cậy 0–1, có thể định dạng %. Confidence không phải điểm viết đẹp hoặc tỷ lệ đúng nội dung |
| `is_correct`, `text_accuracy` | Đúng/sai và độ khớp nội dung 0–1; trình bày riêng với độ tin cậy |
| `shape_score`, `similarity_score`, `direction_score`, `stroke_order_score` | Tiêu chí 0–100 đối chiếu hình học với mẫu tham khảo, chỉ khi có dữ liệu |
| `total_score`, `stars` | Tổng/sao đã lưu theo thuật toán hiện có; khi có mẫu, tổng đã kết hợp geometry với textAccuracy nên không phải điểm so mẫu thuần túy |

- Nếu giữ nhãn sản phẩm “Điểm nhận dạng”, giải thích chính xác trường nguồn và thang đo; không gộp với điểm so mẫu. Không lấy `total_score` để điền cả hai cột, không coi confidence và textAccuracy là cùng chỉ số.
- `NULL` hiển thị “Chưa được ghi nhận” hoặc “—” có chú giải; không đổi thành 0 hoặc tự bù từ điểm khác. Không có bài thì tổng bài là 0, các chỉ số không đo được giữ thiếu dữ liệu. Tổng hợp chỉ số nullable phải nêu số mẫu có dữ liệu, không trộn lượt nhận dạng thuần với geometry dưới cùng một nhãn.
- Lấy kết quả đã lưu; không chạy lại inference, so lại mẫu mới hoặc thay thuật toán để tạo báo cáo. Phản hồi AI `feedback_text`, nhận xét Admin và nhận xét giáo viên là các nguồn khác nhau.
- Nhúng font có quyền sử dụng và đủ dấu tiếng Việt, kiểm tra ngắt trang, bảng dài, tên/nội dung Unicode; trả `application/pdf` và Content-Disposition phù hợp. Chặn nội dung HTML/URL tài liệu tùy ý làm renderer đọc file hoặc gọi tài nguyên không được phép. Tải file qua axios có JWT, giải phóng object URL và xử lý được lỗi JSON khi dùng responseType blob.

## Module C — Bài học nháp và xuất bản

Mở rộng CRUD `lessons`/`writing_items`, `AdminContentService`, `LearningService`, `LessonEditor`, `ItemEditor`, `DrawingCanvas`. Hiện `lessons` chỉ có id/title/grade_level/sort_order; chưa có status, mô tả, tài liệu, ảnh hay audit.

- Bài mới mặc định `DRAFT` ở backend/database. Chỉ ADMIN tạo, sửa, xóa, xem trước nháp, xuất bản hoặc chuyển lại trạng thái phù hợp. Không nhận actor audit từ request.
- Admin nhập tiêu đề, mô tả, nội dung, hướng dẫn; thêm ảnh/tài liệu liên quan; tạo/sửa mẫu nét, xem trước và quản lý danh sách/trạng thái. Bổ sung lưu trữ/schema có thiết kế rõ khi thực sự triển khai; không tái dùng thư mục ảnh vở riêng tư làm kho tài liệu bài học công khai.
- Lưu người tạo/cập nhật và thời gian tạo/cập nhật. Chốt cách xử lý actor/thời gian của bài cũ và khi tài khoản actor bị xóa; không bịa lịch sử tạo bài.
- Dùng chuyển trạng thái có validation server. Trước PUBLISHED kiểm tra các trường/nội dung bắt buộc và template/attachment hợp lệ theo loại bài, pipeline được hỗ trợ. Không bắt mọi WORD/SENTENCE phải có mẫu nét nếu luồng hiện tại cho phép template null.
- Xác định backfill trạng thái bài hiện hữu trước migration để bảo toàn thư viện/lịch sử; không để default DRAFT vô tình ẩn toàn bộ bài cũ, cũng không tự chứng nhận mọi bài cũ đủ chuẩn xuất bản.
- Parent/trẻ chỉ đọc PUBLISHED. Lọc tại backend cho danh sách, chi tiết và mọi đường lấy item/template; chặn cả gọi trực tiếp bằng lessonId/itemId, recognition preview, nộp bài, kế hoạch và gợi ý “Bài hôm nay”. Bảo vệ lại khi lưu nếu bài bị thu hồi trong thời gian chờ inference.
- Admin hiện dùng chung `LearningService.list/detail` với thư viện người học. Tách rõ truy vấn quản trị và truy vấn chỉ PUBLISHED trước khi thêm bộ lọc, để Admin vẫn quản lý/xem trước được nháp. Không dùng một tham số tùy ý của client để bỏ qua bộ lọc.
- Chuyển PUBLISHED về DRAFT không xóa items/template/submissions/progress. Xác định chính sách lịch sử và kế hoạch trỏ bài bị thu hồi, chỉnh sửa trực tiếp bài đang xuất bản hay sửa qua nháp, trước khi mở các đường đó; không tự xây hệ CMS versioning khi chưa cần.
- Giữ `template_json={width,height,strokes}`, canvas admin 900×420, validation giới hạn nét/điểm/tọa độ hiện có; không thay mẫu đã lưu bằng chữ font. Giữ unique toàn thư viện `(item_type,text_value)` và quy tắc sửa/xóa item đã có lịch sử.

## Quy tắc AI và các hành động bị cấm

- Dùng kết quả từ ba model thật: LETTER/DIGIT → SINGLE_CHAR, DIGRAPH → COMPOUND, WORD/SENTENCE → PARAGRAPH. Model từ xử lý từng từ; preview không lưu lượt, lưu chính thức phải re-infer ở server.
- Không bịa điểm, prediction, nhận xét AI hoặc gán expectedText thành kết quả model. Không trộn gợi ý từ điển với raw prediction. Không huấn luyện lại, thay checkpoint/labels, sửa pipeline/công thức chấm hoặc tính lại bài cũ chỉ để làm module quản lý học tập.
- Ba pipeline online chưa chấm ảnh CAMERA; luôn giữ `direction_score`/`stroke_order_score = NULL` cho CAMERA. Ảnh vở lớp học đã upload/chấm thủ công được không có nghĩa model nhận dạng hiện tại chấm được ảnh; V5+Kids vẫn chờ tích hợp.
- Không sửa dự án train bên ngoài `D:/Coding/Python/HandWriting`; không chuyển/copy module Voice AI vào Handwriting.
- Không viết lại chức năng đang chạy, thêm thư viện/agent/command, gửi thông báo ra ngoài hoặc mở quyền mới nếu không phục vụ yêu cầu đã được giao. Không log/lưu vào tài liệu mật khẩu, JWT, ảnh trẻ hay dữ liệu cá nhân thật.

## Quy trình triển khai từng chức năng

Thực hiện theo thứ tự; chỉ làm các bước có thay đổi liên quan.

1. Đọc tài liệu và code liên quan; ghi rõ đã có, còn thiếu, mâu thuẫn và phần chưa xác minh.
2. Xác định nghiệp vụ, actor, ma trận quyền và tiêu chí chấp nhận.
3. Đối chiếu database thật, DBML và migration; chỉ đọc metadata cần thiết, không đọc dữ liệu trẻ để khảo sát schema.
4. Chỉ ra service/repository/DTO/component có thể tái dùng và các luồng bị ảnh hưởng.
5. Trình bày đề xuất trước khi sửa: schema/backfill, hợp đồng API, quyền, UI, xử lý retry và kiểm thử. Tiếp tục trong phạm vi đã được cho phép; chỉ làm rõ quyết định còn thiếu có ảnh hưởng thật, không biến bước đề xuất thành yêu cầu duyệt lặp lại.
6. Thêm migration nếu cần, giữ dữ liệu cũ và kiểm tra các đường xóa/FK.
7. Triển khai backend, validation, ownership và lỗi thống nhất.
8. Tạo/cập nhật và chạy test backend của chức năng trước khi nối UI.
9. Triển khai frontend bằng layout/component/API client hiện có.
10. Kiểm thử tích hợp dữ liệu server, reload, đổi bé, khoảng ngày/trạng thái và responsive.
11. Kiểm thử API trực tiếp và truy cập trái quyền, gồm thay ID, giả actor, gọi nháp và retry.
12. Cập nhật `project-memory/STATUS.md`; cập nhật `PROJECT_CONTEXT.md` khi có quyết định phạm vi/kiến trúc và DBML khi schema đổi. Báo đúng file thay đổi, kiểm tra đã chạy, giới hạn và cách dùng.

Không làm cả ba module đồng thời trước khi kiểm tra phụ thuộc. Ví dụ báo cáo có nhận xét/lịch sử hỗ trợ phải biết nguồn A; khi C thêm status phải rà truy vấn bài học trong A/B và các luồng luyện tập đang có.

## Kiểm thử bắt buộc khi triển khai

Dùng JUnit/MockMvc trên MySQL và Playwright hiện có; hướng dẫn lệnh và fixture ở tài liệu tham chiếu. Tạo/cập nhật test theo module được giao, gồm cả đường thành công và từ chối quyền.

| Phạm vi | Hành vi cần chứng minh |
| --- | --- |
| A — nhận xét | ADMIN tạo và sửa nhận xét, giữ actor/thời gian; owner đọc được; PARENT không sửa; Admin khác tuân chính sách đã chọn |
| A — hỗ trợ | Parent xác nhận luyện lại, lưu ghi chú riêng, xem nhiều lần lịch sử; retry/đồng thời không nhân đôi cùng thao tác; ghi chú không lọt DTO/thông báo của người khác |
| B — báo cáo | Preview/PDF đúng bé, đủ mọi trang bài nộp và khoảng ngày, gồm biên đầu/cuối ngày, khoảng sai, dữ liệu rỗng; output đủ tám nhóm nội dung |
| B — chỉ số/PDF | Phân biệt prediction/confidence/textAccuracy/geometry/total; NULL giữ thiếu dữ liệu; tiếng Việt trích xuất và hiển thị đúng, không cắt bảng dài; file và lỗi tải đúng Content-Type |
| C — trạng thái | ADMIN tạo DRAFT, xem trước, sửa, publish hợp lệ, từ chối publish thiếu dữ liệu; trở lại DRAFT giữ lịch sử/items/template và audit |
| C — chống lộ nháp | PARENT chỉ thấy PUBLISHED; trực tiếp lessonId/itemId, preview/submit, kế hoạch/hôm nay và race thu hồi bài không lách được; ADMIN vẫn thấy nháp |
| Chung — quyền | Chưa login 401, sai role 403, PARENT A không đọc/sửa/xuất bài/ghi chú/báo cáo của PARENT B; giả actor không có tác dụng; TEACHER không được cấp quyền ADMIN ngoài ý muốn |
| Chung — dữ liệu/UI | Reload và đổi bé không lẫn dữ liệu; loading/rỗng/lỗi/thành công, mobile; migration/backfill giữ dữ liệu và xóa transaction dọn đúng phụ thuộc, giữ bài khác |

Test Java có thể mock `AiClient` tại ranh giới để kiểm tra nghiệp vụ; không biến mock thành runtime hoặc tuyên bố đã kiểm tra model. Chỉ chạy E2E với model thật khi luồng cần AI. Dùng fixture UUID và rollback/dọn đúng dữ liệu test, không reset DB hoặc khôi phục seed người dùng đã xóa. Không xem kết quả test cũ trong STATUS là kết quả của phiên hiện tại.

## Checklist hoàn thành

- [ ] Phạm vi, nghiệp vụ chưa rõ và nguồn dữ liệu đã được xác định; hiện trạng được đối chiếu code/schema.
- [ ] Tái dùng kiến trúc/auth/UI hiện có; DTO và API khớp; migration/backfill/FK chỉ đổi khi cần.
- [ ] Backend bảo vệ owner, role, draft và actor; ghi chú riêng không bị lộ; retry có hành vi xác định.
- [ ] Nhận dạng, độ đúng nội dung, geometry và điểm tổng có nhãn đúng; thiếu dữ liệu không bị biến thành điểm.
- [ ] Các hành vi và test tương ứng module đã hoàn thành; ghi chính xác lệnh/kết quả hoặc lý do chưa chạy.
- [ ] UI tiếng Việt, trạng thái tải/rỗng/lỗi/thành công và đổi bé hoạt động; PDF có font tiếng Việt nếu làm B.
- [ ] Tài liệu liên quan/STATUS đã cập nhật, giữ thay đổi người dùng và báo giới hạn còn lại.

## Cách sử dụng trong Claude Code

Từ gốc dự án, gọi skill kèm một nhiệm vụ cụ thể, ví dụ:

```text
/learning-management Khảo sát cách bổ sung sửa nhận xét Admin và lịch sử phụ huynh hướng dẫn luyện lại; chỉ đề xuất, chưa sửa code.
```

```text
/learning-management Triển khai báo cáo PDF cho phụ huynh trong khoảng ngày đã chọn, tái sử dụng nguồn dữ liệu và phân quyền hiện có.
```

Hoặc yêu cầu bằng ngôn ngữ tự nhiên “Dùng skill learning-management cho phần bài học nháp/xuất bản”, kèm phạm vi và tiêu chí hoàn thành. Nếu skill chưa xuất hiện, kiểm tra đang mở Claude Code tại đúng repo và file nằm ở `.claude/skills/learning-management/SKILL.md`.
