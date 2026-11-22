package com.example.backend.dto;

import com.example.backend.entity.enums.*;
import com.example.backend.entity.value.WritingTemplate;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public final class LearningDtos {
    private LearningDtos() { }
    public record StudentRequest(
            @NotBlank(message = "Ba mẹ nhập biệt danh của bé nhé.") @Size(max = 50, message = "Biệt danh tối đa 50 ký tự.") String nickname,
            @NotNull(message = "Ba mẹ chọn năm sinh nhé.") @Min(value = 2008, message = "Năm sinh chưa phù hợp.") Short birthYear,
            @NotNull(message = "Ba mẹ chọn cấp học nhé.") GradeLevel gradeLevel) { }
    public record StudentResponse(Long id, String nickname, Short birthYear, GradeLevel gradeLevel, LocalDateTime createdAt) { }
    public record ItemResponse(Long id, ItemType itemType, String textValue, Byte difficulty, Integer sortOrder, WritingTemplate template) { }
    public record LessonResponse(Long id, String title, GradeLevel gradeLevel, Integer sortOrder, List<ItemResponse> items) { }
    public record ItemProgress(Long itemId, Integer attempts, Byte bestScore, Byte lastScore, Boolean mastered) { }
    public record DayActivity(String date, long attempts, Double averageScore) { }
    public record StudentOverview(long submissions, long practicedItems, long masteredItems, Double averageScore,
            List<ItemProgress> progress, List<DayActivity> activity) { }
    public record SubmissionResponse(Long id, Long itemId, String expectedText, SubmissionSource source,
            String predictedText, Byte totalScore, Byte stars, String feedbackText, LocalDateTime createdAt) { }
    public record SubmissionPage(List<SubmissionResponse> content, int page, int totalPages, long totalElements) { }
}
