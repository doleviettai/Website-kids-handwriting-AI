package com.example.backend.dto;

import com.example.backend.entity.enums.*;
import com.example.backend.entity.value.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class AiDtos {
    private AiDtos() { }
    public record SubmitRequest(@NotNull @Positive Long studentId, @NotNull @Positive Long itemId,
            @Min(1) @Max(4096) int width, @Min(1) @Max(4096) int height,
            @NotNull @Size(min=1,max=100) List<List<StrokePoint>> strokes,
            @Size(max=100) List<Integer> wordEnds) { }
    public record AiRequest(ModelTask task, String expectedText, SubmissionSource source, String modelVersion,
            int width, int height, List<List<StrokePoint>> strokes, List<Integer> wordEnds, WritingTemplate template) { }
    public record RecognitionRequest(ModelTask task, String modelVersion, int width, int height, List<List<StrokePoint>> strokes) { }
    public record Candidate(String text, BigDecimal confidence) { }
    public record RecognitionResult(String text, BigDecimal confidence, boolean uncertain, List<Candidate> candidates,
            List<Candidate> chars, String suggestedText, String preview) { }
    public record Finding(String code, Integer segmentIndex, Integer strokeIndex) { }
    public record AiResult(ModelTask task, String modelVersion, String modelPath, String predictedText,
            BigDecimal confidence, BigDecimal textAccuracy, Byte shapeScore, Byte similarityScore,
            Byte directionScore, Byte strokeOrderScore, List<Map<String,Object>> segments, List<Finding> errors, String assessmentMethod) { }
    public record ErrorResponse(String code, String nameVi, String feedback, Integer segmentIndex, Integer strokeIndex) { }
    public record SubmissionDetail(Long id, Long studentId, String nickname, Long itemId, Long lessonId,
            String expectedText, String predictedText, SubmissionSource source, String modelName, String modelVersion,
            BigDecimal confidence, BigDecimal textAccuracy, Boolean correct, Byte shapeScore, Byte similarityScore,
            Byte directionScore, Byte strokeOrderScore, Byte totalScore, Byte stars, String feedbackText,
            String assessmentMethod, List<List<StrokePoint>> strokes, List<Map<String,Object>> segments,
            List<ErrorResponse> errors, LocalDateTime createdAt, ModelTask task) { }
    public record ReviewRow(Long id, Long studentId, String nickname, String expectedText, String predictedText,
            Byte totalScore, BigDecimal confidence, LocalDateTime createdAt, long errors) { }
    public record ReviewPage(List<ReviewRow> content, int page, int totalPages, long totalElements) { }
    public record Attention(String code, String nameVi, String feedback, long occurrences) { }
}
