# Kiểm tra ba run model người dùng đang dùng

Ngày kiểm tra: 24/11/2026. Phạm vi: đọc source/artifact/log và đối chiếu với ai-server, chạy kiểm tra inference. Không sửa project train, không resume/retrain hoặc thay checkpoint.

**Cập nhật sau khi người dùng test web:** đã sửa adapter dùng trực tiếp Recognizer của serve.py/serve_ghep.py/serve_seq.py; sửa khung square/wide và bỏ lọc nét ngắn/coalesced input. Test cùng nét giữa API và file demo thật khớp text/confidence cả ba task. status_seq.py chỉ đọc log train, không phải recognizer. Chi tiết mới nhất ở STATUS/PROJECT_CONTEXT. Thay đổi này không thay trọng số model và không xác lập accuracy mới.

## Đối chiếu checkpoint

Gốc source train: `D:/Coding/Python/HandWriting`.

| Run dưới models/ | Checkpoint | Bản dùng trong web | Kết quả |
| --- | --- | --- | --- |
| baseline_stable | best.keras | ai-server/model/don/best.keras | SHA-256 trùng hoàn toàn |
| ghep_handwriting_v4 | ghep_best.keras | ai-server/model/ghep/ghep_best.keras | SHA-256 trùng hoàn toàn |
| seq/word_stable | word_best.keras | ai-server/model/word/word_best.keras | SHA-256 trùng hoàn toàn |

Hash đầy đủ:

- SINGLE_CHAR: `686eece5e8e6592e8cafc33b523a2016da95c5949766811ea94137001cf7926d`.
- COMPOUND: `a317713d06208dd690b6f647297b2d62ffad2c790bda465cc237937261e68b44`.
- PARAGRAPH: `da69d1d3f7921c508479dd61b80dda63d96f4a5bc9b82a979da072c759e18f91`.

Các artifact bản web và source đều khớp hash: label_maps/shape_svm/train_config của chữ đơn; label_map/preprocessing/train_config của chữ ghép; charset/preprocessing/language_model/train_config của word. Các file source đã snapshot trong provenance không khác source train tại thời điểm kiểm tra.

Web nạp **bản sao đóng gói trong ai-server**, không đọc động trực tiếp models/ của project train. Nếu checkpoint train sau này thay đổi, bản web vẫn giữ bản đã xác nhận cho đến khi cập nhật cả checkpoint/labels/preprocessing/provenance tương ứng và khởi động lại.

## baseline_stable

- Kiến trúc `char_stable_v2`, CNN/BiGRU, input 128×7, head base/modifier/tone. Có custom layer ShapeSummary, feature penup_masked_v2.
- Training state: hoàn tất bằng early stopping sau 85 epoch, checkpoint tốt nhất epoch 45.
- SVM artifact có mặt nhưng hệ số được chọn alpha=0.0. Vì vậy kết quả hiện không được trộn thêm SVM, đúng lựa chọn validation của run.
- `reports/baseline_stable/metrics_test_hybrid.json` khớp hash checkpoint hiện tại: 394 mẫu, full-char accuracy 94.9239%, base 95.6853%, modifier 100%, tone 98.9848%.
- Báo cáo có writer_overlap=1: không trình bày số trên như kết quả tổng quát hóa đã kiểm định trên người viết/trẻ mới.

## ghep_handwriting_v4

- Kiến trúc `ghep_image_geometry_v2`, hai input: image 64×192×1 và geometry 275 chiều, 148 lớp; không chỉ nhận ảnh đơn thuần.
- Runtime đã nạp đúng label map 148 lớp; không có SVM hybrid của run này.
- Log/state dừng ở epoch 84/100, checkpoint tốt nhất epoch 84; progress còn ghi epoch 85. state/pipeline_result vẫn ghi running, nhưng PID training 37276 và pipeline 25824 không có tiến trình tại thời điểm kiểm tra.
- Số trong state/history epoch 84: val_accuracy=86.3795%; riêng nguồn human=90.6367%, composed=79.7297%, synthetic=98.6486%. Đây là validation trong lúc train, không phải báo cáo test hoàn tất.
- Không tìm thấy báo cáo metrics riêng dưới reports/ghep_handwriting_v4 trong lần kiểm tra. Không dùng số của run ghep_stable/ghep_701515 thay cho v4.

## seq/word_stable

- Kiến trúc masked CNN/BiGRU CTC, input features×5 và lengths; output 212 lớp. Custom ApplySequenceMask/DownsampledMask đã được nạp.
- train_config ghi **level=word**, không phải line/page/paragraph. Preprocessing step=0.04, max_t=400, stroke_order=time, w_floor=0.2, min_stroke_points=4.
- Checkpoint lưu sau 13 epoch; train state còn ghi epoch 14/running, còn pipeline_result ghi failed/exit_code=1. PID 10584/11972 từ log không tồn tại khi kiểm tra.
- train.log cho thấy lần chạy lại bị từ chối vì run đã tồn tại mà thiếu --resume. Điều này không đồng nghĩa checkpoint hỏng: checkpoint hiện tại nạp và suy luận thành công.
- State ghi best_val_cer=0.06317747 và val_wer epoch13=0.16266967. Đây là số trong log train, chưa phải báo cáo đánh giá lại checkpoint bằng bộ test độc lập.
- Tất cả file metrics hiện có dưới reports/seq/word_stable (cả thư mục con) đều có model_sha256 khác checkpoint hiện tại. Ví dụ metrics_validation.json ghi hash `a12fea411037797a669cca7f894703a2d32f099cca716480063006532197e823`; checkpoint thật là `da69d1...`. Vì vậy không dùng exact_match/CER/WER từ những báo cáo đó để đại diện model hiện tại.
- Web nhận từng từ rồi ghép/căn chỉnh câu; visual CTC quyết định nội dung nhận dạng, không dùng đáp án để ép đầu ra. language_model được giữ cùng bộ artifact nhưng không thay kết quả nhận dạng visual bằng gợi ý từ điển.

## Kiểm tra thực thi

Chạy lại 7 test FastAPI với checkpoint thật: tất cả đạt. Cả ba task ready, load được custom layers, suy luận được. Test bao gồm expected text không làm đổi prediction, validation, reference geometry và fail-closed.

Đây là xác minh tính đúng của việc tích hợp và artifact, không phải benchmark chất lượng trên dữ liệu trẻ thực tế. Trước khi sử dụng accuracy trong báo cáo đồ án, cần đánh giá lại checkpoint hiện tại, ghi hash và đúng split/decoder; không suy ra accuracy từ việc API trả 200. Chưa tự khởi chạy đánh giá toàn bộ hoặc huấn luyện lại trong lượt kiểm tra này.
