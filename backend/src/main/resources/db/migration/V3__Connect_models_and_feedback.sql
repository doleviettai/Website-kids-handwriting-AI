-- Model paths correspond to the checkpoint-matched inference service (v1).
UPDATE ai_models SET model_path='model/don/best.keras' WHERE task='SINGLE_CHAR' AND version='v1' AND model_path IS NULL;
UPDATE ai_models SET model_path='model/ghep/ghep_best.keras' WHERE task='COMPOUND' AND version='v1' AND model_path IS NULL;
UPDATE ai_models SET model_path='model/word/word_best.keras' WHERE task='PARAGRAPH' AND version='v1' AND model_path IS NULL;

INSERT INTO error_types(code,name_vi,feedback_template_vi)
SELECT 'WRONG_TEXT','Nội dung nhận dạng chưa khớp','Máy đang đọc khác với nội dung bài học. Ba mẹ cùng bé xem lại chữ và thử viết chậm thêm một lần nhé.'
WHERE NOT EXISTS (SELECT 1 FROM error_types WHERE code='WRONG_TEXT');
INSERT INTO error_types(code,name_vi,feedback_template_vi)
SELECT 'LOW_CONFIDENCE','Kết quả nhận dạng cần kiểm tra','Máy chưa đọc rõ bài này. Ba mẹ xem lại cùng bé trước khi kết luận bé viết sai nhé.'
WHERE NOT EXISTS (SELECT 1 FROM error_types WHERE code='LOW_CONFIDENCE');
INSERT INTO error_types(code,name_vi,feedback_template_vi)
SELECT 'MISSING_STROKES','Số nét ít hơn mẫu','Số nét đang ít hơn mẫu tham khảo. Bé xem mẫu rồi kiểm tra lại nhé.'
WHERE NOT EXISTS (SELECT 1 FROM error_types WHERE code='MISSING_STROKES');
INSERT INTO error_types(code,name_vi,feedback_template_vi)
SELECT 'EXTRA_STROKES','Số nét nhiều hơn mẫu','Số nét đang nhiều hơn mẫu tham khảo. Bé kiểm tra chỗ nhấc bút và thử lại nhé.'
WHERE NOT EXISTS (SELECT 1 FROM error_types WHERE code='EXTRA_STROKES');
INSERT INTO error_types(code,name_vi,feedback_template_vi)
SELECT 'WRONG_DIRECTION','Hướng nét khác mẫu','Một số nét có hướng khác mẫu tham khảo. Mình xem điểm bắt đầu rồi thử lại nhé.'
WHERE NOT EXISTS (SELECT 1 FROM error_types WHERE code='WRONG_DIRECTION');
