# NétXinh — Bé vui học viết

Frontend luyện viết chữ, số tiếng Việt cho trẻ mẫu giáo và lớp 1. Chạy độc lập, chưa cần backend hoặc database.

## Chạy thử

Mở terminal ở thư mục dự án:

```powershell
cd frontend
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, mặc định http://localhost:5173. Nếu dependencies đã được cài, chỉ cần `npm run dev`. Dừng server bằng `Ctrl+C`.

## Các màn hình

| Đường dẫn       | Nội dung                                              |
| --------------- | ----------------------------------------------------- |
| `/`             | Góc học tập, mục tiêu ngày, nhóm bài và bạn cáo Pip   |
| `/bai-hoc`      | Bài học theo cấp, loại nội dung và tìm kiếm           |
| `/luyen-viet`   | Chọn nội dung luyện tự do                             |
| `/luyen-viet/2` | Luyện chữ a, ă, â; viết cảm ứng, hoàn tác, ảnh/camera |
| `/thanh-tich`   | Huy hiệu dựa trên hoạt động thực hành                 |
| `/tien-do`      | Biểu đồ 7 ngày, lịch sử, xem lại nét đã lưu           |
| `/phu-huynh`    | Theo dõi hoạt động cho ba mẹ                          |
| `/cai-dat`      | Tên bé, năm sinh, cấp học và mục tiêu ngày            |

Thử chọn bài → viết bằng chuột hoặc cảm ứng → **Con viết xong rồi** → mở **Hành trình của bé** để xem bài đã lưu. Đổi tên bé trong **Cài đặt**; thông tin vẫn được giữ sau khi tải lại trang.

## Phần đang hoạt động

- Điều hướng, lọc/tìm bài học và chọn nội dung.
- Canvas lưu nét `x, y, t`, hoàn tác, xóa, đổi màu, chữ gợi ý.
- Chọn ảnh JPG/PNG/WebP tối đa 10 MB, camera khi thiết bị cho phép.
- Phát âm tiếng Việt bằng giọng thiết bị khi có hỗ trợ.
- Lưu hồ sơ và nét bút bằng LocalStorage, thống kê thực hành và huy hiệu.
- Bố cục theo kích thước màn hình, menu điện thoại, tắt âm thanh/chuyển động.

**AI chưa được kết nối:** bài được lưu ở trạng thái chờ, không tự tạo điểm/nhận xét nhận dạng. Ảnh chỉ ở phiên xem hiện tại, chưa upload hoặc lưu lâu dài; có nút tải bài về. Chữ gợi ý chưa phải template viết tay chuẩn. Xem [thiết kế và ánh xạ schema](docs/DESIGN.md).

## Kiểm tra và đóng gói

```powershell
npm run lint
npm run build
npm run preview
```

Build tạo `dist/`. Khi triển khai, web server cần chuyển các đường dẫn ứng dụng về `index.html` để hỗ trợ React Router.
