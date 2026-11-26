package com.example.backend.service;

import com.example.backend.dto.NotificationDtos.*;
import com.example.backend.entity.Submission;
import com.example.backend.entity.SubmissionComment;
import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.SubmissionCommentRepository;
import com.example.backend.repository.SubmissionRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.util.VietnameseText;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final SubmissionRepository submissions;
    private final SubmissionCommentRepository comments;
    private final UserRepository users;
    private final NotificationService notifications;

    @Transactional(readOnly = true)
    public List<CommentResponse> list(long userId, long submissionId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại."));
        (user.getRole() == UserRole.ADMIN
                ? submissions.findById(submissionId)
                : submissions.findByIdAndStudent_Parent_Id(submissionId, userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy bài viết trong phạm vi tài khoản."));
        return comments.findBySubmissionIdWithAuthor(submissionId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public CommentResponse add(long adminId, long submissionId, CommentRequest request) {
        User admin = users.findById(adminId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại."));
        Submission submission = submissions.findById(submissionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy bài viết."));
        String content = VietnameseText.nfc(request.content()).trim();
        if (content.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Nội dung nhận xét không được để trống.");
        }
        SubmissionComment comment = new SubmissionComment();
        comment.setSubmission(submission);
        comment.setAuthor(admin);
        comment.setContent(content);
        SubmissionComment saved = comments.saveAndFlush(comment);
        notifications.notifyNewComment(saved);
        return toResponse(saved);
    }

    private CommentResponse toResponse(SubmissionComment c) {
        String name = c.getAuthor().getFullName();
        return new CommentResponse(
                c.getId(),
                c.getSubmission().getId(),
                name == null || name.isBlank() ? "Quản trị viên NétXinh" : name,
                c.getContent(),
                c.getCreatedAt()
        );
    }
}
