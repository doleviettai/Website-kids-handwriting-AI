# NétXinh — frontend kết nối MySQL qua API

React + TypeScript + Vite. Phiên bản hiện tại có đăng ký/đăng nhập, nhiều hồ sơ bé và thư viện bài học lấy từ backend. Không dùng dữ liệu mẫu/LocalStorage để thay thế dữ liệu tài khoản, hồ sơ hoặc bài học.

## Chạy

Khởi động hoặc **Stop/Run lại backend trong IDE** để nạp các API mới. Nếu chạy terminal, từ gốc repo:

```powershell
cd backend
./gradlew.bat bootRun
```

Terminal riêng cho frontend:

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173/dang-ky` để tạo tài khoản phụ huynh hoặc `/dang-nhap` nếu đã có tài khoản. Dùng URL Vite in ra nếu cổng đã có server. Khởi động lại Vite nếu đang dùng cấu hình proxy cũ. Không chạy hai backend cùng cổng 8080.

Vite chuyển `/api` sang `http://localhost:8080`. Có thể đặt `API_PROXY_TARGET` trước khi chạy Vite nếu backend dùng cổng khác. Cấu hình thực tế của backend và JWT nằm ở `backend/config/local.properties` được Git bỏ qua; xem [hướng dẫn backend](../backend/README.md).

## Luồng để xem thay đổi

1. Vào `/dang-ky`, tạo tài khoản của ba mẹ.
2. Chọn **Hồ sơ các bé** → **Thêm hồ sơ bé**; nhập biệt danh, năm sinh, cấp học.
3. Chọn **Vào góc học tập**, hoặc chuyển bé bằng bộ chọn ở thanh trên.
4. Vào **Bài học của bé**, lọc/tìm và mở một bài để xem nội dung từ database.
5. Sửa/xóa hồ sơ ở trang hồ sơ; tải lại hoặc đăng xuất/đăng nhập để kiểm tra dữ liệu đã lưu.

Hồ sơ đã có lịch sử học được giữ lại, thao tác xóa sẽ nhận thông báo giải thích.

## Các URL

| URL                      | Nội dung                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `/dang-nhap`, `/dang-ky` | Đăng nhập và tạo tài khoản phụ huynh                                |
| `/`                      | Trang chào gia đình/chọn bài theo hồ sơ bé                          |
| `/ho-so`                 | Thêm, sửa, xóa và chọn hồ sơ bé từ MySQL                            |
| `/bai-hoc`               | Bài học, tìm kiếm và bộ lọc được lưu trong query URL                |
| `/bai-hoc/:lessonId`     | Nội dung chữ/số/từ/câu và mẫu nét nếu có                            |
| `/tien-do`, `/phu-huynh` | Tiến độ, hoạt động 7 ngày và lịch sử theo bé                        |
| `/thanh-tich`            | Huy hiệu tính từ số bài đã có trong hệ thống                        |
| `/cai-dat`               | Thông tin tài khoản; tùy chọn âm thanh/chuyển động trên thiết bị    |
| `/quan-tri`              | Chỉ ADMIN: thống kê, danh sách tài khoản phân trang và xem thư viện |
| `/quan-tri/bai-hoc`      | ADMIN: thêm/sửa/xóa bài học và sắp xếp theo cấp                     |
| `/quan-tri/noi-dung`     | ADMIN: CRUD chữ/số/từ/câu, chuyển bài và vẽ mẫu nét                 |
| `/quan-tri/loai-loi`     | ADMIN: CRUD loại lỗi và mẫu phản hồi tiếng Việt                     |

## Thử chức năng quản trị

Đăng nhập tài khoản ADMIN đã cấu hình trên máy. Vào **Quản lý bài học** → **Thêm bài học**; đặt tên, cấp và thứ tự. Tại thẻ bài học, chọn **Quản lý nội dung** → **Thêm nội dung**. Chọn loại, chữ/số/từ/câu, độ khó và thứ tự; vẽ trên khung để tạo mẫu. **Lưu nội dung** ghi cả nội dung và `template_json` vào MySQL. Tải lại, mở sửa để tiếp tục mẫu đã lưu.

Canvas hỗ trợ chuột/cảm ứng/bút, hoàn tác nét cuối, bỏ mẫu, hiện chữ gợi ý, xem thứ tự nét và tải JSON. Các số tròn thể hiện điểm bắt đầu và thứ tự nét; chữ font mờ chỉ là gợi ý, người quản trị chịu trách nhiệm tạo mẫu chuẩn. Để khung trống nếu chưa có mẫu. Khung lưu ở tọa độ 900 × 420 dù kích thước hiển thị thay đổi.

Trong **Loại lỗi & phản hồi**, thêm mã duy nhất dạng `WRONG_SPACING`, tên tiếng Việt và lời góp ý; xem trước lời nhắn cho bé rồi lưu. Dữ liệu hiện chỉ được quản lý, chưa có model nào tự dùng/chấm bài.

Xóa bài học có hộp xác nhận: **xóa vĩnh viễn bài, mọi nội dung trong bài và toàn bộ bài viết/kết quả/lỗi/tiến độ của các bé liên quan đến bài đó**. Không thể hoàn tác. Số lượng nội dung trong bài hiển thị ở lời xác nhận. Lịch sử và thành tích tổng hợp của phụ huynh sẽ thay đổi khi tải lại. Dữ liệu của các bài khác và hồ sơ các bé được giữ.

Chính sách này áp dụng khi xóa **bài học**. Xóa riêng nội dung đã có bài/tiến độ hoặc loại lỗi đã dùng vẫn bị chặn. Các bộ lọc quản trị được lưu trong query URL. Sau cập nhật của admin, phụ huynh tải lại trang/đăng nhập lại để nhận dữ liệu mới.

PARENT quản lý các bé của tài khoản mình tại **Hồ sơ các bé**. Khi lưu hồ sơ mới/sửa xong, hồ sơ đó được chọn cho buổi học. Không có chức năng sửa/chuyển bé thuộc tài khoản phụ huynh khác.

`/luyen-viet` chuyển về thư viện; `/luyen-viet/:lessonId?item=:itemId` đã có canvas gửi bài vào model thật. Chi tiết bài đã lưu tại `/bai-viet/:submissionId`. Admin xem bài/lỗi và model tại `/quan-tri/bai-viet`.

## Luyện viết với model thật

Mở terminal riêng cho FastAPI trước (xem [README AI](../ai-server/README.md)):

```powershell
cd ai-server
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Chạy lại backend và frontend. PARENT chọn bé → bài học → nội dung → **Bé bắt đầu luyện viết**. Viết trên canvas, bấm **Gửi bài để nhận xét**. Nét bút, kết quả nhận dạng, model version, điểm, lỗi và tiến độ được lưu vào MySQL khi model xử lý thành công. Tải lại trang chi tiết để xem lại. Nếu AI chưa sẵn sàng, bài chưa được chấm/lưu; giao diện giữ nét để thử lại.

## Ba chế độ luyện viết riêng

| Đường dẫn | Cách viết |
| --- | --- |
| `/luyen-tap/chu-don` | Một chữ/số mỗi lượt, khung vuông 1:1, dòng kẻ 20/50/80/92% như demo chữ đơn |
| `/luyen-tap/chu-ghep` | Một chữ ghép mỗi lượt, khung ngang 5:2, dòng kẻ 38/62%, xem ảnh model sau tiền xử lý |
| `/luyen-tap/doan-van` | Khung viết từng từ 5:2 và khung bài đã ghép riêng; nhận dạng mỗi từ rồi chốt bằng nút hoặc Space |

Có bộ chọn nội dung trong từng chế độ. URL từ bài học `/luyen-viet/:lessonId?item=...` vẫn mở đúng chế độ theo loại bài. Menu PARENT có **Góc luyện viết**. Đổi chế độ/nội dung bắt đầu bài mới; nét chưa gửi không tự lưu.

**Nhận dạng thử** hiển thị máy đọc được gì, độ tin cậy/các khả năng khác, chưa lưu bài hoặc tính attempt. Có tùy chọn đọc sau nhấc bút. Nét mới/undo/reset vô hiệu kết quả thử cũ và hủy request đang chờ để tránh hiển thị lẫn bài. Hình gợi ý mặc định tắt trong practice, không gửi cho model.

Model từ/câu train theo **từng từ**: viết một từ, nhận dạng và bấm **Xong từ này** (hoặc Space khi focus ngoài form/button) để chốt. Khung bài bên cạnh hiển thị từ đã nhận dạng và confidence; sửa từ cuối khi khung hiện tại trống. **Gửi cả bài** chỉ bật khi không còn từ dang dở. Chấm nội dung từ/câu bỏ qua hoa/thường và dấu câu như demo gốc; raw prediction và gợi ý từ điển hiển thị riêng, gợi ý không tự thay nội dung của bé.

Canvas có tỷ lệ cố định theo mode ở cả desktop/mobile; giữ điểm cảm ứng gộp/getCoalescedEvents và nét dấu ngắn, không kéo méo nét theo tỷ lệ khung. Chưa nhận ảnh camera hoặc đoạn nhiều dòng trong một canvas vì checkpoint này là model word-online.

Kết quả có hai loại: độ đúng nội dung khi chưa có mẫu; hoặc đối chiếu geometry với mẫu admin khi có. Phần không đủ cơ sở đánh giá hiển thị “—”. Đây không phải model chấm chữ đẹp đã kiểm định. Khi confidence thấp, thông báo yêu cầu ba mẹ kiểm tra bài thật trước khi kết luận bé sai. Nét mờ/gợi ý và đánh số không được đưa vào nhận dạng, chỉ dữ liệu bút của bé được gửi.

Chuông header dẫn đến **Góc ba mẹ** hoặc **Bài viết & thông báo** của ADMIN. Ba mẹ xem nhóm lỗi thường gặp theo bé; admin lọc bài có lỗi, mở chi tiết và kiểm tra trạng thái ba model. Đây là thông báo trong web, làm mới khi vào trang/bấm làm mới, chưa có email/push hoặc đánh dấu đã đọc.

## Đăng nhập và dữ liệu

- Axios gắn Bearer JWT; lỗi 401 kết thúc phiên và đưa về đăng nhập. Mất kết nối có thông báo/thử lại, không âm thầm chuyển sang demo.
- JWT chỉ lưu trong `sessionStorage` của tab; hồ sơ/bài học nằm ở MySQL. ID bé đang chọn lưu theo tài khoản trong sessionStorage; đổi bé không làm lẫn dữ liệu tiến độ.
- Đăng xuất thu hồi token hiện tại trên backend khi kết nối được, rồi xóa token ở trình duyệt. Nếu mất kết nối, phiên cục bộ vẫn được xóa, token phía server chỉ kết thúc khi hết hạn hoặc server khởi động lại.
- Backend quản lý danh sách phiên JWT trong bộ nhớ: restart backend yêu cầu đăng nhập lại; hết hạn sau 1 giờ.
- Dữ liệu demo LocalStorage phiên cũ không tự nhập vào tài khoản mới. Chỉ tùy chọn giao diện tiếp tục dùng LocalStorage.
- ADMIN dùng tài khoản seed từ cấu hình local; tài khoản đăng ký qua web luôn là PARENT.

## Kiểm tra

```powershell
npm run lint
npm run build
```

Kiểm tra trình duyệt (cần backend/frontend đã chạy, Google Chrome và `mysql` trong PATH):

```powershell
npm run test:e2e
```

Có thể đặt `E2E_BASE_URL` khi frontend dùng cổng khác. E2E kiểm tra desktop/375px, đăng ký, CRUD hồ sơ, tải lại, chuyển bé, thư viện, lỗi mạng, đăng xuất và CRUD nội dung quản trị/vẽ mẫu/feedback. Test admin đăng nhập bằng credentials trong cấu hình local và chỉ tạo/sửa/xóa dữ liệu thử có UUID riêng. Sau khi chạy, chỉ tài khoản/hồ sơ/nội dung giả của lần test đó được dọn bằng MySQL CLI. Test đọc kết nối từ cấu hình local, không chạy với database production. Không bật trace/video chứa token. Ảnh kiểm tra nằm trong `test-results/` được Git bỏ qua.

Test `e2e/recognition.spec.ts` cần FastAPI/model thật, gửi cả ba task rồi kiểm tra MySQL/parent/admin; chỉ dọn bài/lỗi/tiến độ/hồ sơ/tài khoản giả UUID do chính test đó tạo. Không coi test kỹ thuật là phép đo accuracy nhận dạng trên trẻ thực tế.

`e2e/lesson-cascade.spec.ts` tạo riêng bài/nội dung và lịch sử fixture, kiểm tra hộp xác nhận xóa, quyền ADMIN, bài/nét/lỗi/tiến độ đã biến mất và hồ sơ bé vẫn còn. Chỉ dọn dữ liệu UUID của chính test. Có thể chạy riêng `npm run test:e2e -- admin-content.spec.ts lesson-cascade.spec.ts family.spec.ts` để kiểm tra thay đổi xóa bài mà không cần nạp model AI.

Khi deploy, cấu hình proxy `/api` tới backend và fallback đường dẫn ứng dụng về `index.html`; proxy dev của Vite không áp dụng vào thư mục `dist/`.
