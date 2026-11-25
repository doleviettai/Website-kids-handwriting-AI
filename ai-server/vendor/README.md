# Snapshot inference từ dự án huấn luyện của người dùng

Source sao chép từ `D:/Coding/Python/HandWriting/src` theo đường dẫn người dùng cung cấp. `provenance.json` ghi SHA-256 các file nguồn và artifact. Giữ namespace `src.*` để deserialize đúng custom Keras layers; không sửa dự án train bên ngoài.

Chỉ module inference/preprocessing/decoding được FastAPI gọi. Không chứa dataset/ảnh trẻ. SVM là artifact trusted của người dùng, chỉ nạp từ đường dẫn cố định; API không cho upload/deserialize model hay pickle tùy ý.
