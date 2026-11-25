# NétXinh — AI hỗ trợ học chữ và luyện viết tiếng Việt

Web dành cho trẻ mẫu giáo/lớp 1, phụ huynh và admin. Stack React/Vite, Spring Boot/Java 21, MySQL và FastAPI/TensorFlow/Keras.

## Chạy trên máy hiện tại

Mở ba terminal riêng tại gốc repo:

```powershell
cd ai-server
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
cd backend
.\gradlew.bat bootRun
```

```powershell
cd frontend
npm run dev
```

Dependencies và cấu hình local đã có trên máy hiện tại. Máy khác cài [requirements AI](ai-server/requirements.txt), `npm install` trong frontend và điền mẫu cấu hình backend trước. Không chạy lại hai backend cùng cổng. Nếu IDE đang chạy phiên cũ, Stop/Run lại để nạp API mới.

- Web: [localhost:5173](http://localhost:5173).
- Model health: [127.0.0.1:8000/health](http://127.0.0.1:8000/health), API docs: [Swagger AI](http://127.0.0.1:8000/docs).
- Backend health: [localhost:8080/api/system/health](http://localhost:8080/api/system/health).

PARENT đăng ký/đăng nhập, tạo/chọn bé → bài học → chọn nội dung → **Bé bắt đầu luyện viết**. Gửi nét để nhận dạng/đánh giá và lưu vào MySQL. Từ/câu viết từng từ rồi chốt từ, sau đó gửi cả bài.

Có ba màn riêng trong **Góc luyện viết**: `/luyen-tap/chu-don` (khung vuông), `/luyen-tap/chu-ghep` (khung ngang và ảnh model thấy), `/luyen-tap/doan-van` (viết/chốt từng từ và bài ghép). **Nhận dạng thử** không lưu bài; chỉ nút gửi bài chính thức mới cập nhật lịch sử/tiến độ. Adapter gọi đúng Recognizer từ các trang demo source train; nhãn dự đoán và gợi ý từ điển tách riêng.

Ba mẹ xem lỗi tại **Góc ba mẹ** và lịch sử. ADMIN xem **Bài viết & thông báo**, CRUD thư viện/mẫu nét/loại lỗi. Chuông là thông báo trong web, chưa gửi email/push. PARENT chỉ truy cập hồ sơ con mình.

## Giới hạn hiện tại

Ba checkpoint là model nhận dạng nét online, chưa hỗ trợ ảnh camera. Model word train theo từ, chưa OCR cả trang nhiều dòng. Điểm chữ dùng độ khớp nội dung và geometry tham khảo với mẫu admin nếu có; tiêu chí thiếu cơ sở là NULL, không phải model chấm đẹp chữ đã kiểm định. Khi confidence thấp, người lớn cần xem lại trước khi kết luận bé sai.

## Tài liệu

- [AI service](ai-server/README.md): artifact/source, preprocessing, API, test và lệnh chạy.
- [Backend](backend/README.md): MySQL/Flyway, auth, API, scoring và quyền.
- [Frontend](frontend/README.md): các màn, canvas, kết quả và E2E.
- [Bộ nhớ dự án](project-memory/README.md): ngữ cảnh, trạng thái và prompt.

Credentials chỉ trong cấu hình local được Git bỏ qua. Không chứa mật khẩu admin mặc định trong README này.
