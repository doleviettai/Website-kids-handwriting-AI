package com.example.backend.controller;

import com.example.backend.dto.NotificationDtos.*;
import com.example.backend.service.CommentService;
import com.example.backend.service.NotificationService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notifications;
    private final CommentService comments;

    @GetMapping("/notifications")
    public NotificationPage list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "false") boolean unreadOnly
    ) {
        return notifications.list(userId(jwt), page, unreadOnly);
    }

    @GetMapping("/notifications/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return notifications.unreadCount(userId(jwt));
    }

    @PostMapping("/notifications/{id}/read")
    public NotificationResponse markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return notifications.markRead(userId(jwt), id);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(userId(jwt));
    }

    @GetMapping("/submissions/{id}/comments")
    public List<CommentResponse> listComments(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return comments.list(userId(jwt), id);
    }

    @PostMapping("/admin/submissions/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody CommentRequest request) {
        return comments.add(userId(jwt), id, request);
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
