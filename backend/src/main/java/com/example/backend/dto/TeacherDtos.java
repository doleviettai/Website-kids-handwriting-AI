package com.example.backend.dto;

import com.example.backend.entity.enums.EvaluationRating;
import com.example.backend.entity.enums.GradeLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TeacherDtos {
    private TeacherDtos() {}

    public record ClassroomRequest(
            @NotBlank(message = "Tên lớp không được để trống.")
            @Size(max = 100, message = "Tên lớp tối đa 100 ký tự.")
            String name,
            @NotBlank(message = "Năm học không được để trống.")
            @Size(max = 30, message = "Năm học tối đa 30 ký tự.")
            String schoolYear,
            @NotNull(message = "Cần chọn cấp học.")
            GradeLevel gradeLevel
    ) {}

    public record ClassroomSummary(
            long id,
            String name,
            String schoolYear,
            GradeLevel gradeLevel,
            String joinCode,
            long studentCount,
            long batchCount,
            LocalDateTime createdAt
    ) {}

    public record EnrollmentRequest(
            @NotBlank(message = "Tên học sinh không được để trống.")
            @Size(max = 80, message = "Tên học sinh tối đa 80 ký tự.")
            String displayName,
            @Min(value = 2008, message = "Năm sinh không hợp lệ.")
            Short birthYear,
            @NotBlank(message = "Cần nhập email tài khoản phụ huynh để gửi bài tập và thông báo.")
            @Email(message = "Email phụ huynh không hợp lệ.")
            @Size(max = 255, message = "Email phụ huynh tối đa 255 ký tự.")
            String parentEmail,
            @Size(max = 100, message = "Tên phụ huynh tối đa 100 ký tự.")
            String parentNameNote,
            @Size(max = 25, message = "Số điện thoại tối đa 25 ký tự.")
            String parentPhone
    ) {}

    public record EnrollmentImportRequest(
            @NotEmpty(message = "Danh sách học sinh không được để trống.")
            @Size(max = 100, message = "Mỗi lần nhập tối đa 100 học sinh.")
            List<@Valid EnrollmentRequest> students
    ) {}

    public record EnrollmentResponse(
            long id,
            Long studentId,
            String displayName,
            Short birthYear,
            boolean linkedParent,
            String parentName,
            long submissionCount,
            LocalDateTime joinedAt
    ) {}

    public record BatchRequest(
            @NotBlank(message = "Tên đợt chấm không được để trống.")
            @Size(max = 150, message = "Tên đợt chấm tối đa 150 ký tự.")
            String title,
            @NotNull(message = "Cần chọn ngày chấm.")
            LocalDate batchDate,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự.")
            String notes
    ) {}

    public record BatchSummary(
            long id,
            long classroomId,
            String title,
            LocalDate batchDate,
            String notes,
            long evaluatedCount,
            long attentionCount,
            long sentCount,
            long totalStudents,
            LocalDateTime createdAt
    ) {}

    public record ClassroomDetail(
            ClassroomSummary classroom,
            List<EnrollmentResponse> enrollments,
            List<BatchSummary> batches
    ) {}

    public record EvaluationRequest(
            EvaluationRating rating,
            @Size(max = 1000, message = "Nhận xét tối đa 1000 ký tự.")
            String teacherComment,
            boolean needsAttention
    ) {}

    public record EvaluationRow(
            long enrollmentId,
            Long studentId,
            String displayName,
            Short birthYear,
            boolean linkedParent,
            String parentName,
            EvaluationRating rating,
            String teacherComment,
            boolean needsAttention,
            String imageUrl,
            LocalDateTime sentToParentAt,
            LocalDateTime updatedAt
    ) {}

    public record BatchSheet(
            long batchId,
            long classroomId,
            String classroomName,
            String schoolYear,
            String title,
            LocalDate batchDate,
            String notes,
            List<EvaluationRow> rows
    ) {}

    public record SendReportsRequest(Long enrollmentId) {}

    public record SendReportsResponse(int sentCount, int skippedUnlinked, int skippedEmpty) {}

    public record JoinClassroomRequest(
            @NotBlank(message = "Ba mẹ nhập mã lớp của cô giáo nhé.")
            @Size(max = 16, message = "Mã lớp tối đa 16 ký tự.")
            String joinCode
    ) {}

    public record StudentClassroomResponse(
            long enrollmentId,
            long classroomId,
            String classroomName,
            String schoolYear,
            GradeLevel gradeLevel,
            String teacherName,
            LocalDateTime joinedAt
    ) {}

    public record ParentTeacherReport(
            long evaluationId,
            long batchId,
            String batchTitle,
            LocalDate batchDate,
            String classroomName,
            String teacherName,
            EvaluationRating rating,
            String teacherComment,
            boolean needsAttention,
            LocalDateTime sentToParentAt
    ) {}
}
