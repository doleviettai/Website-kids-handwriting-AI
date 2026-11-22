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

Các URL `/luyen-viet` cũ được chuyển về trang nội dung bài học. Phần canvas demo cũ chưa được gắn vào luồng mới. **Nhận dạng, chấm và gửi bài chưa mở**, đúng phạm vi trì hoãn model. Tiến độ/huy hiệu không tự gán điểm hoặc thành tích mẫu; hồ sơ mới có dữ liệu rỗng.

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

Có thể đặt `E2E_BASE_URL` khi frontend dùng cổng khác. E2E tạo tài khoản giả riêng mỗi lần, kiểm tra desktop/375px, đăng ký, CRUD hồ sơ, tải lại, chuyển bé, thư viện, lỗi mạng và đăng xuất. Sau khi chạy, chỉ tài khoản/hồ sơ giả của lần test đó được dọn bằng MySQL CLI. Test đọc kết nối từ cấu hình local, không chạy với database production. Không bật trace/video chứa token. Ảnh kiểm tra nằm trong `test-results/` được Git bỏ qua.

Khi deploy, cấu hình proxy `/api` tới backend và fallback đường dẫn ứng dụng về `index.html`; proxy dev của Vite không áp dụng vào thư mục `dist/`.
