package com.example.backend.dto;

import com.example.backend.entity.enums.GradeLevel;
import com.example.backend.entity.enums.ItemType;
import com.example.backend.entity.value.WritingTemplate;
import jakarta.validation.constraints.*;

public final class AdminContentDtos {
    private AdminContentDtos() { }

    public record LessonRequest(
            @NotBlank(message = "Nhập tên bài học.") @Size(max = 200, message = "Tên bài học tối đa 200 ký tự.") String title,
            @NotNull(message = "Chọn cấp học.") GradeLevel gradeLevel,
            @NotNull @Min(value = 0, message = "Thứ tự phải từ 0 trở lên.") Integer sortOrder) { }

    public record ItemRequest(
            @Positive Long lessonId,
            @NotNull(message = "Chọn loại nội dung.") ItemType itemType,
            @NotBlank(message = "Nhập chữ, số, từ hoặc câu.") @Size(max = 255, message = "Nội dung tối đa 255 ký tự.") String textValue,
            @NotNull @Min(1) @Max(3) Byte difficulty,
            @NotNull @Min(value = 0, message = "Thứ tự phải từ 0 trở lên.") Integer sortOrder,
            WritingTemplate template) { }

    public record ItemResponse(Long id, Long lessonId, ItemType itemType, String textValue,
            Byte difficulty, Integer sortOrder, WritingTemplate template) { }

    public record ErrorTypeRequest(
            @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{0,49}", message = "Mã lỗi dùng chữ in hoa, số và dấu gạch dưới; bắt đầu bằng chữ, tối đa 50 ký tự.") String code,
            @NotBlank(message = "Nhập tên lỗi tiếng Việt.") @Size(max = 150) String nameVi,
            @NotBlank(message = "Nhập mẫu phản hồi tiếng Việt.") @Size(max = 5000, message = "Phản hồi tối đa 5000 ký tự.") String feedbackTemplateVi) { }

    public record ErrorTypeResponse(Integer id, String code, String nameVi, String feedbackTemplateVi) { }
}
