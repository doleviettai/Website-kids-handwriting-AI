package com.example.backend.service;

import com.example.backend.dto.AdminContentDtos.*;
import com.example.backend.dto.LearningDtos.LessonResponse;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.ItemType;
import com.example.backend.entity.value.WritingTemplate;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
@Transactional
public class AdminContentService {
    private final LessonRepository lessons;
    private final WritingItemRepository items;
    private final ErrorTypeRepository errors;
    private final LearningService learning;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;

    public LessonResponse createLesson(LessonRequest request) { return saveLesson(new Lesson(), request); }
    public LessonResponse updateLesson(long id, LessonRequest request) { return saveLesson(lesson(id), request); }

    private LessonResponse saveLesson(Lesson lesson, LessonRequest request) {
        lesson.setTitle(VietnameseText.nfc(request.title()).trim());
        lesson.setGradeLevel(request.gradeLevel());
        lesson.setSortOrder(request.sortOrder());
        lessons.saveAndFlush(lesson);
        return learning.detail(lesson.getId());
    }

    public void deleteLesson(long id) {
        entityManager.flush();
        // Lock the parent and its items so concurrent inserts/moves cannot add
        // dependent history while it is being removed. All deletes share this transaction.
        if (jdbc.queryForList("SELECT id FROM lessons WHERE id=? FOR UPDATE", Long.class, id).isEmpty())
            throw missing("Không tìm thấy bài học.");
        jdbc.queryForList("SELECT id FROM writing_items WHERE lesson_id=? ORDER BY id FOR UPDATE", Long.class, id);
        jdbc.update("""
                DELETE se FROM submission_errors se
                JOIN submissions s ON s.id=se.submission_id
                JOIN writing_items wi ON wi.id=s.item_id WHERE wi.lesson_id=?
                """, id);
        jdbc.update("""
                DELETE sp FROM student_progress sp
                JOIN writing_items wi ON wi.id=sp.item_id WHERE wi.lesson_id=?
                """, id);
        jdbc.update("""
                DELETE s FROM submissions s
                JOIN writing_items wi ON wi.id=s.item_id WHERE wi.lesson_id=?
                """, id);
        jdbc.update("DELETE FROM writing_items WHERE lesson_id=?", id);
        jdbc.update("DELETE FROM lessons WHERE id=?", id);
        // Native bulk deletes must not leave stale managed entities in this context.
        entityManager.clear();
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> listItems() {
        return items.findAll(Sort.by("sortOrder", "id")).stream().map(this::itemResponse).toList();
    }

    public ItemResponse createItem(ItemRequest request) { return saveItem(new WritingItem(), request); }
    public ItemResponse updateItem(long id, ItemRequest request) {
        WritingItem item = items.findById(id).orElseThrow(() -> missing("Không tìm thấy nội dung này."));
        String normalized = VietnameseText.nfc(request.textValue()).trim();
        if ((!Objects.equals(normalized, item.getTextValue()) || request.itemType() != item.getItemType()) && usedItem(id))
            throw conflict("Nội dung đã có bài viết hoặc tiến độ. Giữ nguyên chữ và loại nội dung để bảo toàn lịch sử; có thể sửa mẫu nét, độ khó hoặc chuyển bài học.");
        return saveItem(item, request);
    }

    private ItemResponse saveItem(WritingItem item, ItemRequest request) {
        String text = VietnameseText.nfc(request.textValue()).trim();
        validateText(request.itemType(), text);
        validateTemplate(request.template());
        items.findByItemTypeAndTextValue(request.itemType(), text).ifPresent(existing -> {
            if (!Objects.equals(existing.getId(), item.getId())) throw conflict("Nội dung này đã tồn tại ở loại đã chọn. Hãy sửa nội dung hiện có hoặc chọn chữ khác.");
        });
        item.setLesson(request.lessonId() == null ? null : lesson(request.lessonId()));
        item.setItemType(request.itemType()); item.setTextValue(text);
        item.setDifficulty(request.difficulty()); item.setSortOrder(request.sortOrder());
        item.setTemplateJson(request.template());
        return itemResponse(items.saveAndFlush(item));
    }

    public void deleteItem(long id) {
        WritingItem item = items.findById(id).orElseThrow(() -> missing("Không tìm thấy nội dung này."));
        if (usedItem(id)) throw conflict("Nội dung đã có bài viết hoặc tiến độ của bé nên chưa thể xóa. Bạn có thể chỉnh mẫu nét hoặc chuyển nội dung sang bài khác.");
        items.delete(item); items.flush();
    }

    @Transactional(readOnly = true)
    public List<ErrorTypeResponse> listErrors() {
        return errors.findAll(Sort.by("code")).stream().map(this::errorResponse).toList();
    }

    public ErrorTypeResponse createError(ErrorTypeRequest request) { return saveError(new ErrorType(), request); }
    public ErrorTypeResponse updateError(int id, ErrorTypeRequest request) {
        ErrorType error = errors.findById(id).orElseThrow(() -> missing("Không tìm thấy loại lỗi."));
        if (!error.getCode().equals(request.code()) && usedError(id))
            throw conflict("Mã lỗi đã được dùng trong bài viết nên không thể đổi. Bạn vẫn có thể sửa tên và mẫu phản hồi.");
        return saveError(error, request);
    }

    private ErrorTypeResponse saveError(ErrorType error, ErrorTypeRequest request) {
        errors.findByCode(request.code()).ifPresent(existing -> {
            if (!Objects.equals(existing.getId(), error.getId())) throw conflict("Mã lỗi đã tồn tại. Hãy dùng mã khác.");
        });
        error.setCode(request.code()); error.setNameVi(VietnameseText.nfc(request.nameVi()).trim());
        error.setFeedbackTemplateVi(VietnameseText.nfc(request.feedbackTemplateVi()).trim());
        return errorResponse(errors.saveAndFlush(error));
    }

    public void deleteError(int id) {
        ErrorType error = errors.findById(id).orElseThrow(() -> missing("Không tìm thấy loại lỗi."));
        if (usedError(id)) throw conflict("Loại lỗi đã được dùng trong bài viết nên không thể xóa. Bạn có thể sửa tên hoặc mẫu phản hồi.");
        errors.delete(error); errors.flush();
    }

    private void validateText(ItemType type, String text) {
        int length = text.codePointCount(0, text.length());
        if (length == 0 || length > 255) throw invalid("Nội dung cần từ 1 đến 255 ký tự sau chuẩn hóa.");
        if (text.codePoints().anyMatch(Character::isISOControl)) throw invalid("Nội dung không được chứa ký tự điều khiển hoặc xuống dòng.");
        if (type == ItemType.LETTER && (length != 1 || !Character.isLetter(text.codePointAt(0))))
            throw invalid("Chữ cái cần đúng một ký tự chữ sau chuẩn hóa NFC.");
        if (type == ItemType.DIGIT && !text.matches("[0-9]")) throw invalid("Chữ số cần đúng một số từ 0 đến 9.");
        if (type == ItemType.DIGRAPH && (length < 2 || length > 3 || !text.codePoints().allMatch(Character::isLetter)))
            throw invalid("Chữ ghép cần 2 hoặc 3 ký tự chữ liền nhau, ví dụ ch hoặc ngh.");
    }

    private void validateTemplate(WritingTemplate template) {
        if (template == null) return;
        if (template.width() < 1 || template.width() > 4096 || template.height() < 1 || template.height() > 4096
                || template.strokes() == null || template.strokes().isEmpty() || template.strokes().size() > 100)
            throw invalid("Mẫu nét cần kích thước 1–4096 và từ 1 đến 100 nét; chọn bỏ mẫu nếu chưa có nét.");
        int points = 0;
        for (var stroke : template.strokes()) {
            if (stroke == null || stroke.isEmpty()) throw invalid("Mỗi nét trong mẫu phải có ít nhất một điểm.");
            points += stroke.size();
            if (points > 20000) throw invalid("Mẫu nét tối đa 20.000 điểm. Hãy đơn giản hóa mẫu trước khi lưu.");
            for (var point : stroke) {
                if (point == null || !Double.isFinite(point.x()) || !Double.isFinite(point.y())
                        || point.x() < 0 || point.x() > template.width() || point.y() < 0 || point.y() > template.height())
                    throw invalid("Tọa độ mẫu nét phải nằm trong khung vẽ.");
            }
        }
    }

    private boolean usedItem(long id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE item_id=?", Long.class, id) > 0
                || jdbc.queryForObject("SELECT COUNT(*) FROM student_progress WHERE item_id=?", Long.class, id) > 0;
    }
    private boolean usedError(int id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM submission_errors WHERE error_type_id=?", Long.class, id) > 0;
    }
    private Lesson lesson(long id) { return lessons.findById(id).orElseThrow(() -> missing("Không tìm thấy bài học.")); }
    private ItemResponse itemResponse(WritingItem item) {
        return new ItemResponse(item.getId(), item.getLesson() == null ? null : item.getLesson().getId(), item.getItemType(), item.getTextValue(), item.getDifficulty(), item.getSortOrder(), item.getTemplateJson());
    }
    private ErrorTypeResponse errorResponse(ErrorType error) {
        return new ErrorTypeResponse(error.getId(), error.getCode(), error.getNameVi(), error.getFeedbackTemplateVi());
    }
    private ApiException missing(String message) { return new ApiException(HttpStatus.NOT_FOUND, message); }
    private ApiException conflict(String message) { return new ApiException(HttpStatus.CONFLICT, message); }
    private ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
}
