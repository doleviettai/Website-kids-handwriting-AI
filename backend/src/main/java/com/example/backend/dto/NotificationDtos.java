package com.example.backend.dto;

import com.example.backend.entity.enums.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class NotificationDtos {
    private NotificationDtos() {}

    public record NotificationResponse(
            long id,
            NotificationType type,
            String title,
            String message,
            Long submissionId,
            Long studentId,
            boolean read,
            LocalDateTime createdAt
    ) {}

    public record NotificationPage(
            List<NotificationResponse> items,
            int page,
            int totalPages,
            long totalElements,
            long unreadCount
    ) {}

    public record UnreadCountResponse(long unreadCount) {}

    public record CommentRequest(
            @NotBlank(message = "Nội dung nhận xét không được để trống.")
            @Size(max = 1000, message = "Nhận xét tối đa 1000 ký tự.")
            String content
    ) {}

    public record CommentResponse(
            long id,
            long submissionId,
            String authorName,
            String content,
            LocalDateTime createdAt
    ) {}
}
