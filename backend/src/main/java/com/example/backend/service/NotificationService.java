package com.example.backend.service;

import com.example.backend.dto.NotificationDtos.*;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.NotificationType;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.NotificationRepository;
import com.example.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> REVIEW_ERROR_CODES = Set.of("LOW_CONFIDENCE", "WRONG_TEXT");

    private final NotificationRepository notifications;
    private final UserRepository users;

    @Transactional
    public void notifyNeedsReview(Submission submission, Set<String> errorCodes) {
        if (errorCodes == null || errorCodes.stream().noneMatch(REVIEW_ERROR_CODES::contains)) return;
        Student student = submission.getStudent();
        String snippet = truncate(submission.getItem().getTextValue(), 40);
        boolean lowConf = errorCodes.contains("LOW_CONFIDENCE");

        List<Notification> batch = new ArrayList<>();
        Notification parentNotice = new Notification();
        parentNotice.setRecipient(student.getParent());
        parentNotice.setType(NotificationType.NEEDS_REVIEW);
        parentNotice.setSubmission(submission);
        parentNotice.setStudent(student);
        parentNotice.setTitle(truncate("Bài viết của bé " + student.getNickname() + " cần xem lại", 150));
        parentNotice.setMessage(truncate(lowConf
                ? "Máy chưa đọc rõ bài '" + snippet + "'. Ba mẹ mở xem lại cùng bé nhé."
                : "Nội dung nhận dạng bài '" + snippet + "' chưa khớp bài mẫu. Ba mẹ xem lại cùng bé nhé.", 500));
        batch.add(parentNotice);

        for (User admin : users.findByRole(UserRole.ADMIN)) {
            Notification adminNotice = new Notification();
            adminNotice.setRecipient(admin);
            adminNotice.setType(NotificationType.NEEDS_REVIEW);
            adminNotice.setSubmission(submission);
            adminNotice.setStudent(student);
            adminNotice.setTitle(truncate("Bài viết cần kiểm tra (#" + submission.getId() + ")", 150));
            adminNotice.setMessage(truncate("Bài '" + snippet + "' của bé " + student.getNickname()
                    + (lowConf ? " có độ tin cậy thấp." : " nhận dạng chưa khớp nội dung."), 500));
            batch.add(adminNotice);
        }
        notifications.saveAll(batch);
    }

    @Transactional
    public void notifyNewComment(SubmissionComment comment) {
        Submission submission = comment.getSubmission();
        Student student = submission.getStudent();
        Notification notice = new Notification();
        notice.setRecipient(student.getParent());
        notice.setType(NotificationType.NEW_COMMENT);
        notice.setSubmission(submission);
        notice.setStudent(student);
        notice.setTitle(truncate("Có nhận xét mới cho bài viết của bé " + student.getNickname(), 150));
        notice.setMessage(truncate(comment.getContent(), 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyTeacherReport(StudentEvaluation evaluation) {
        Student student = evaluation.getEnrollment().getStudent();
        if (student == null) return;
        Classroom classroom = evaluation.getBatch().getClassroom();
        Notification notice = new Notification();
        notice.setRecipient(student.getParent());
        notice.setType(NotificationType.TEACHER_REPORT);
        notice.setSubmission(null);
        notice.setStudent(student);
        notice.setTitle(truncate("Cô chủ nhiệm gửi báo cáo " + evaluation.getBatch().getTitle() + " cho bé " + student.getNickname(), 150));
        String comment = evaluation.getTeacherComment();
        String msg = (comment != null && !comment.isBlank())
                ? comment
                : "Cô " + displayTeacher(classroom.getTeacher()) + " (" + classroom.getName() + ") đã cập nhật đánh giá cho bé.";
        notice.setMessage(truncate(msg, 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyClassInvitation(User parent, Classroom classroom) {
        Notification notice = new Notification();
        notice.setRecipient(parent);
        notice.setType(NotificationType.CLASS_INVITATION);
        notice.setTitle(truncate("Lời mời tham gia lớp " + classroom.getName(), 150));
        notice.setMessage(truncate("Giáo viên " + displayTeacher(classroom.getTeacher())
                + " mời ba mẹ đưa bé vào lớp " + classroom.getName() + " (" + classroom.getSchoolYear() + ").", 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyJoinRequest(ClassroomJoinRequest req) {
        Notification notice = new Notification();
        notice.setRecipient(req.getClassroom().getTeacher());
        notice.setType(NotificationType.JOIN_REQUEST);
        notice.setStudent(req.getStudent());
        notice.setTitle(truncate("Yêu cầu tham gia lớp " + req.getClassroom().getName(), 150));
        String parentName = req.getParent().getFullName() == null || req.getParent().getFullName().isBlank()
                ? req.getParent().getEmail() : req.getParent().getFullName();
        notice.setMessage(truncate("Phụ huynh " + parentName + " xin cho bé " + req.getStudent().getNickname()
                + " tham gia lớp " + req.getClassroom().getName() + ".", 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyJoinRequestReviewed(ClassroomJoinRequest req) {
        Classroom classroom = req.getClassroom();
        Student student = req.getStudent();
        boolean approved = req.getStatus() == com.example.backend.entity.enums.JoinRequestStatus.APPROVED;
        Notification notice = new Notification();
        notice.setRecipient(req.getParent());
        notice.setType(NotificationType.CLASS_INVITATION);
        notice.setStudent(student);
        if (approved) {
            notice.setTitle(truncate("Đã được duyệt vào lớp " + classroom.getName(), 150));
            notice.setMessage(truncate("Giáo viên " + displayTeacher(classroom.getTeacher())
                    + " đã duyệt cho bé " + student.getNickname() + " tham gia lớp " + classroom.getName()
                    + ". Ba mẹ vào mục Lớp học & Bài tập để xem bài tập nhé!", 240));
        } else {
            notice.setTitle(truncate("Yêu cầu vào lớp " + classroom.getName() + " chưa được duyệt", 150));
            notice.setMessage(truncate("Giáo viên " + displayTeacher(classroom.getTeacher())
                    + " đã từ chối yêu cầu cho bé " + student.getNickname() + " vào lớp " + classroom.getName() + ".", 240));
        }
        notifications.save(notice);
    }

    @Transactional
    public void notifyAddedToClassroom(ClassroomEnrollment enrollment) {
        Student student = enrollment.getStudent();
        if (student == null) return;
        Classroom classroom = enrollment.getClassroom();
        Notification notice = new Notification();
        notice.setRecipient(student.getParent());
        notice.setType(NotificationType.CLASS_INVITATION);
        notice.setStudent(student);
        notice.setTitle(truncate("Bé " + student.getNickname() + " đã được thêm vào lớp " + classroom.getName(), 150));
        notice.setMessage(truncate("Giáo viên " + displayTeacher(classroom.getTeacher())
                + " đã thêm bé " + student.getNickname() + " vào lớp " + classroom.getName()
                + " (" + classroom.getSchoolYear() + ").", 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyHomeworkAssigned(User parent, Student student, ReviewBatch batch) {
        Notification notice = new Notification();
        notice.setRecipient(parent);
        notice.setType(NotificationType.HOMEWORK_ASSIGNED);
        notice.setStudent(student);
        String subjectLabel = batch.getSubject() == com.example.backend.entity.enums.Subject.TOAN ? "Toán" : "Tiếng Việt";
        notice.setTitle(truncate("Bài tập " + subjectLabel + " mới: " + batch.getTitle(), 150));
        String due = batch.getDueAt() == null ? "" : " Hạn nộp: " + batch.getDueAt().toLocalDate() + ".";
        notice.setMessage(truncate("Lớp " + batch.getClassroom().getName() + " vừa giao bài tập cho bé "
                + student.getNickname() + "." + due, 240));
        notifications.save(notice);
    }

    @Transactional
    public void notifyHomeworkGraded(StudentEvaluation evaluation) {
        Student student = evaluation.getEnrollment().getStudent();
        if (student == null) return;
        ReviewBatch batch = evaluation.getBatch();
        Notification notice = new Notification();
        notice.setRecipient(student.getParent());
        notice.setType(NotificationType.HOMEWORK_GRADED);
        notice.setStudent(student);
        notice.setTitle(truncate("Đã có điểm bài tập: " + batch.getTitle() + " (" + student.getNickname() + ")", 150));
        String scoreText = evaluation.getScore() == null ? "" : "Điểm: " + evaluation.getScore().stripTrailingZeros().toPlainString() + "/10. ";
        String comment = evaluation.getTeacherComment() == null ? "" : evaluation.getTeacherComment();
        String msg = (scoreText + comment).trim();
        if (msg.isEmpty()) msg = "Giáo viên đã chấm và gửi đánh giá bài tập cho bé.";
        notice.setMessage(truncate(msg, 240));
        notifications.save(notice);
    }

    private String displayTeacher(User teacher) {
        return teacher.getFullName() == null || teacher.getFullName().isBlank() ? "chủ nhiệm" : teacher.getFullName();
    }

    @Transactional(readOnly = true)
    public NotificationPage list(long userId, int page, boolean unreadOnly) {
        if (page < 0 || page > 100000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Số trang không hợp lệ.");
        }
        var pageable = PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        var result = unreadOnly
                ? notifications.findByRecipient_IdAndReadAtIsNull(userId, pageable)
                : notifications.findByRecipient_Id(userId, pageable);
        long unreadCount = notifications.countByRecipient_IdAndReadAtIsNull(userId);
        List<NotificationResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return new NotificationPage(items, page, result.getTotalPages(), result.getTotalElements(), unreadCount);
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount(long userId) {
        return new UnreadCountResponse(notifications.countByRecipient_IdAndReadAtIsNull(userId));
    }

    @Transactional
    public NotificationResponse markRead(long userId, long notificationId) {
        Notification notice = notifications.findByIdAndRecipient_Id(notificationId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo."));
        if (notice.getReadAt() == null) {
            notice.setReadAt(LocalDateTime.now(VN));
            notifications.saveAndFlush(notice);
        }
        return toResponse(notice);
    }

    @Transactional
    public void markAllRead(long userId) {
        notifications.markAllRead(userId, LocalDateTime.now(VN));
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.getSubmission() == null ? null : n.getSubmission().getId(),
                n.getStudent() == null ? null : n.getStudent().getId(),
                n.getReadAt() != null,
                n.getCreatedAt()
        );
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        if (text.length() <= max) return text;
        return text.substring(0, Math.max(0, max - 1)) + "…";
    }
}
