package com.example.backend.dto;

import com.example.backend.entity.enums.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class HomeworkDtos {
    private HomeworkDtos() {}

    // === Phase 1: Classroom Roster, Invitations, Join Requests & Admin ===

    public record UpdateEnrollmentRequest(
            @NotBlank(message = "Tên học sinh không được để trống.")
            @Size(max = 80, message = "Tên học sinh tối đa 80 ký tự.")
            String displayName,
            @Min(value = 2008, message = "Năm sinh không hợp lệ.")
            Short birthYear,
            @Size(max = 100, message = "Tên phụ huynh tối đa 100 ký tự.")
            String parentNameNote,
            @Size(max = 30, message = "Số điện thoại tối đa 30 ký tự.")
            String parentPhone,
            @Size(max = 300, message = "Ghi chú tối đa 300 ký tự.")
            String teacherNote
    ) {}

    public record EnrollmentDetailResponse(
            long id,
            Long studentId,
            String displayName,
            Short birthYear,
            boolean linkedParent,
            String linkedParentName,
            String linkedParentEmail,
            String parentNameNote,
            String parentPhone,
            String teacherNote,
            LocalDateTime joinedAt
    ) {}

    public record InviteParentRequest(
            @NotBlank(message = "Cần nhập email phụ huynh.")
            @Email(message = "Email phụ huynh không hợp lệ.")
            @Size(max = 255)
            String parentEmail
    ) {}

    public record InvitationResponse(
            long id,
            long classroomId,
            String classroomName,
            String schoolYear,
            GradeLevel gradeLevel,
            String teacherName,
            String parentEmail,
            InvitationStatus status,
            LocalDateTime createdAt,
            LocalDateTime respondedAt
    ) {}

    public record RespondInvitationRequest(
            boolean accept,
            Long studentId
    ) {}

    public record PublicClassroomResponse(
            long id,
            String name,
            String schoolYear,
            GradeLevel gradeLevel,
            String teacherName,
            long studentCount
    ) {}

    public record CreateJoinRequest(
            @NotNull(message = "Cần chọn hồ sơ bé.")
            Long studentId,
            @Size(max = 300, message = "Lời nhắn tối đa 300 ký tự.")
            String message
    ) {}

    public record JoinRequestResponse(
            long id,
            long classroomId,
            String classroomName,
            String teacherName,
            long parentId,
            String parentName,
            String parentEmail,
            long studentId,
            String studentNickname,
            String message,
            JoinRequestStatus status,
            LocalDateTime createdAt,
            LocalDateTime reviewedAt
    ) {}

    public record ReviewJoinRequest(boolean approve) {}

    public record AdminTeacherClassroomResponse(
            long id,
            String name,
            String schoolYear,
            GradeLevel gradeLevel,
            String joinCode,
            long studentCount,
            long batchCount,
            LocalDateTime createdAt
    ) {}

    public record AdminTeacherDetailResponse(
            long teacherId,
            String fullName,
            String email,
            LocalDateTime createdAt,
            List<AdminTeacherClassroomResponse> classrooms
    ) {}

    // === Phase 2: Homework Assignments, Multi-page Photos, Grading & Scheduled Publish ===

    public record HomeworkCreateRequest(
            @NotBlank(message = "Tiêu đề bài tập không được để trống.")
            @Size(max = 150, message = "Tiêu đề tối đa 150 ký tự.")
            String title,
            @NotNull(message = "Cần chọn môn học.")
            Subject subject,
            @NotBlank(message = "Nội dung đề bài không được để trống.")
            @Size(max = 4000, message = "Nội dung đề bài tối đa 4000 ký tự.")
            String description,
            LocalDateTime dueAt,
            @Min(value = 1, message = "Số trang yêu cầu tối thiểu là 1.")
            @Max(value = 10, message = "Số trang yêu cầu tối đa là 10.")
            int requiredPages,
            @Size(max = 500)
            String notes
    ) {}

    public record HomeworkPageResponse(
            long id,
            int pageNumber,
            String originalFilename,
            String contentType,
            long fileSize,
            String imageUrl,
            LocalDateTime uploadedAt
    ) {}

    public record GradeHomeworkRequest(
            @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0.")
            @DecimalMax(value = "10.0", message = "Điểm tối đa là 10.")
            BigDecimal score,
            EvaluationRating rating,
            @Size(max = 1000, message = "Nhận xét tối đa 1000 ký tự.")
            String teacherComment,
            boolean needsAttention,
            GradingMode gradingMode,
            boolean sendNow,
            LocalDateTime scheduledSendAt
    ) {}

    public record ScheduleSendRequest(
            boolean sendNow,
            LocalDateTime scheduledSendAt
    ) {}

    public record HomeworkSubmissionRow(
            long enrollmentId,
            Long studentId,
            String displayName,
            boolean linkedParent,
            String parentName,
            String parentEmail,
            String parentPhone,
            Long evaluationId,
            LocalDateTime submittedAt,
            boolean late,
            List<HomeworkPageResponse> pages,
            BigDecimal score,
            EvaluationRating rating,
            GradingMode gradingMode,
            String teacherComment,
            boolean needsAttention,
            LocalDateTime sentToParentAt,
            LocalDateTime scheduledSendAt
    ) {}

    public record HomeworkDetailResponse(
            long batchId,
            long classroomId,
            String classroomName,
            GradeLevel gradeLevel,
            String title,
            Subject subject,
            boolean homework,
            String description,
            LocalDate batchDate,
            LocalDateTime dueAt,
            int requiredPages,
            String notes,
            List<HomeworkSubmissionRow> rows
    ) {}

    public record ParentHomeworkItem(
            long batchId,
            long classroomId,
            String classroomName,
            String teacherName,
            long enrollmentId,
            String title,
            Subject subject,
            String description,
            LocalDate batchDate,
            LocalDateTime dueAt,
            int requiredPages,
            LocalDateTime submittedAt,
            boolean late,
            List<HomeworkPageResponse> pages,
            boolean gradedPublished,
            BigDecimal score,
            EvaluationRating rating,
            String teacherComment,
            boolean needsAttention,
            LocalDateTime sentToParentAt
    ) {}

    public record GradebookBatchColumn(
            long batchId,
            String title,
            Subject subject,
            boolean homework,
            LocalDate batchDate,
            LocalDateTime dueAt
    ) {}

    public record GradebookCell(
            long batchId,
            boolean submitted,
            int pageCount,
            BigDecimal score,
            EvaluationRating rating,
            String teacherComment,
            boolean needsAttention,
            LocalDateTime sentToParentAt,
            LocalDateTime scheduledSendAt
    ) {}

    public record GradebookStudentRow(
            long enrollmentId,
            Long studentId,
            String displayName,
            boolean linkedParent,
            String parentName,
            String parentPhone,
            Double averageScore,
            List<GradebookCell> cells
    ) {}

    public record GradebookResponse(
            long classroomId,
            String classroomName,
            String schoolYear,
            GradeLevel gradeLevel,
            List<GradebookBatchColumn> batches,
            List<GradebookStudentRow> students
    ) {}
}
