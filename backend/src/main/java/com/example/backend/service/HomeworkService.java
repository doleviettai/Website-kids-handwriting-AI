package com.example.backend.service;

import com.example.backend.dto.HomeworkDtos.*;
import com.example.backend.dto.TeacherDtos.BatchSummary;
import com.example.backend.dto.TeacherDtos.SendReportsResponse;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class HomeworkService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGES_PER_SUBMISSION = 10;

    private final ClassroomRepository classrooms;
    private final ClassroomEnrollmentRepository enrollments;
    private final ReviewBatchRepository batches;
    private final StudentEvaluationRepository evaluations;
    private final HomeworkSubmissionPageRepository pages;
    private final UserRepository users;
    private final StudentService students;
    private final NotificationService notifications;
    private final HomeworkStorageService storage;
    private final JdbcTemplate jdbc;

    @Transactional
    public BatchSummary createHomework(long teacherId, long classroomId, HomeworkCreateRequest req) {
        Classroom c = classrooms.findByIdAndTeacher_Id(classroomId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học."));
        String title = VietnameseText.nfc(req.title()).trim();
        String desc = VietnameseText.nfc(req.description()).trim();
        if (title.isEmpty() || desc.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tiêu đề và nội dung đề bài không được để trống.");
        }
        ReviewBatch b = new ReviewBatch();
        b.setClassroom(c);
        b.setTitle(title);
        b.setSubject(req.subject());
        b.setIsHomework(true);
        b.setBatchDate(LocalDate.now(VN));
        b.setDescription(desc);
        b.setDueAt(req.dueAt());
        b.setRequiredPages((byte) req.requiredPages());
        b.setNotes(req.notes() == null ? null : VietnameseText.nfc(req.notes()).trim());
        ReviewBatch saved = batches.saveAndFlush(b);

        List<ClassroomEnrollment> roster = enrollments.findByClassroomIdWithStudent(classroomId);
        for (ClassroomEnrollment e : roster) {
            if (e.getStudent() != null) {
                notifications.notifyHomeworkAssigned(e.getStudent().getParent(), e.getStudent(), saved);
            }
        }
        return new BatchSummary(saved.getId(), c.getId(), saved.getTitle(), saved.getBatchDate(), saved.getNotes(),
                0L, 0L, 0L, roster.size(), saved.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public HomeworkDetailResponse teacherHomeworkDetail(long teacherId, long batchId) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        Classroom c = b.getClassroom();
        List<ClassroomEnrollment> roster = enrollments.findByClassroomIdWithStudent(c.getId());
        List<StudentEvaluation> evalList = evaluations.findByBatch_Id(batchId);
        Map<Long, StudentEvaluation> byEnroll = evalList.stream()
                .collect(Collectors.toMap(ev -> ev.getEnrollment().getId(), Function.identity()));
        Map<Long, List<HomeworkPageResponse>> pagesByEval = loadPagesMap(evalList);

        List<HomeworkSubmissionRow> rows = roster.stream().map(e -> {
            StudentEvaluation ev = byEnroll.get(e.getId());
            Student s = e.getStudent();
            User p = s == null ? null : s.getParent();
            List<HomeworkPageResponse> pList = ev == null ? List.of() : pagesByEval.getOrDefault(ev.getId(), List.of());
            boolean late = ev != null && ev.getSubmittedAt() != null && b.getDueAt() != null && ev.getSubmittedAt().isAfter(b.getDueAt());
            return new HomeworkSubmissionRow(
                    e.getId(),
                    s == null ? null : s.getId(),
                    e.getDisplayName(),
                    s != null,
                    p != null ? displayName(p) : e.getParentNameNote(),
                    p == null ? null : p.getEmail(),
                    e.getParentPhone(),
                    ev == null ? null : ev.getId(),
                    ev == null ? null : ev.getSubmittedAt(),
                    late,
                    pList,
                    ev == null ? null : ev.getScore(),
                    ev == null ? null : ev.getRating(),
                    ev == null ? GradingMode.MANUAL : ev.getGradingMode(),
                    ev == null ? null : ev.getTeacherComment(),
                    ev != null && Boolean.TRUE.equals(ev.getNeedsAttention()),
                    ev == null ? null : ev.getSentToParentAt(),
                    ev == null ? null : ev.getScheduledSendAt()
            );
        }).toList();

        return new HomeworkDetailResponse(
                b.getId(), c.getId(), c.getName(), c.getGradeLevel(), b.getTitle(), b.getSubject(),
                Boolean.TRUE.equals(b.getIsHomework()), b.getDescription(), b.getBatchDate(), b.getDueAt(),
                b.getRequiredPages() == null ? 1 : b.getRequiredPages(), b.getNotes(), rows
        );
    }

    @Transactional
    public HomeworkSubmissionRow gradeEvaluation(long teacherId, long batchId, long enrollmentId, GradeHomeworkRequest req) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        ClassroomEnrollment e = enrollments.findByIdAndClassroom_Id(enrollmentId, b.getClassroom().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Học sinh không thuộc lớp này."));
        StudentEvaluation ev = evaluations.findByBatch_IdAndEnrollment_Id(batchId, enrollmentId).orElseGet(() -> {
            StudentEvaluation created = new StudentEvaluation();
            created.setBatch(b);
            created.setEnrollment(e);
            return created;
        });
        ev.setScore(req.score());
        ev.setRating(req.rating());
        ev.setGradingMode(req.gradingMode() == null ? GradingMode.MANUAL : req.gradingMode());
        String comment = req.teacherComment() == null ? null : VietnameseText.nfc(req.teacherComment()).trim();
        ev.setTeacherComment(comment == null || comment.isEmpty() ? null : comment);
        ev.setNeedsAttention(req.needsAttention());

        LocalDateTime now = LocalDateTime.now(VN);
        if (req.sendNow()) {
            ev.setScheduledSendAt(null);
            if (e.getStudent() != null) {
                ev.setSentToParentAt(now);
            }
        } else if (req.scheduledSendAt() != null) {
            ev.setScheduledSendAt(req.scheduledSendAt());
        }
        StudentEvaluation saved = evaluations.saveAndFlush(ev);
        if (req.sendNow() && e.getStudent() != null) {
            notifications.notifyHomeworkGraded(saved);
        }

        List<HomeworkPageResponse> pList = pages.findByEvaluation_IdOrderByPageNumberAscIdAsc(saved.getId()).stream()
                .map(this::toPageResponse).toList();
        Student s = e.getStudent();
        User p = s == null ? null : s.getParent();
        boolean late = saved.getSubmittedAt() != null && b.getDueAt() != null && saved.getSubmittedAt().isAfter(b.getDueAt());
        return new HomeworkSubmissionRow(
                e.getId(), s == null ? null : s.getId(), e.getDisplayName(), s != null,
                p != null ? displayName(p) : e.getParentNameNote(), p == null ? null : p.getEmail(), e.getParentPhone(),
                saved.getId(), saved.getSubmittedAt(), late, pList, saved.getScore(), saved.getRating(),
                saved.getGradingMode(), saved.getTeacherComment(), Boolean.TRUE.equals(saved.getNeedsAttention()),
                saved.getSentToParentAt(), saved.getScheduledSendAt()
        );
    }

    @Transactional
    public SendReportsResponse scheduleOrSendBatch(long teacherId, long batchId, ScheduleSendRequest req) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        if (!req.sendNow() && req.scheduledSendAt() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cần chọn gửi ngay hoặc chọn thời gian hẹn gửi điểm.");
        }
        List<ClassroomEnrollment> roster = enrollments.findByClassroomIdWithStudent(b.getClassroom().getId());
        Map<Long, StudentEvaluation> byEnroll = evaluations.findByBatch_Id(batchId).stream()
                .collect(Collectors.toMap(ev -> ev.getEnrollment().getId(), Function.identity()));
        int sent = 0, skippedUnlinked = 0, skippedEmpty = 0;
        LocalDateTime now = LocalDateTime.now(VN);
        for (ClassroomEnrollment e : roster) {
            if (e.getStudent() == null) { skippedUnlinked++; continue; }
            StudentEvaluation ev = byEnroll.get(e.getId());
            if (ev == null || (ev.getScore() == null && ev.getRating() == null
                    && (ev.getTeacherComment() == null || ev.getTeacherComment().isBlank()))) {
                skippedEmpty++;
                continue;
            }
            if (req.sendNow()) {
                ev.setSentToParentAt(now);
                ev.setScheduledSendAt(null);
                evaluations.save(ev);
                notifications.notifyHomeworkGraded(ev);
            } else {
                ev.setScheduledSendAt(req.scheduledSendAt());
                evaluations.save(ev);
            }
            sent++;
        }
        evaluations.flush();
        return new SendReportsResponse(sent, skippedUnlinked, skippedEmpty);
    }

    @Transactional
    public int publishDueScheduled() {
        LocalDateTime now = LocalDateTime.now(VN);
        List<StudentEvaluation> due = evaluations.findDueScheduled(now);
        int count = 0;
        for (StudentEvaluation ev : due) {
            ev.setSentToParentAt(now);
            ev.setScheduledSendAt(null);
            evaluations.save(ev);
            if (ev.getEnrollment().getStudent() != null) {
                notifications.notifyHomeworkGraded(ev);
                count++;
            }
        }
        if (!due.isEmpty()) evaluations.flush();
        return count;
    }

    @Transactional(readOnly = true)
    public GradebookResponse classroomGradebook(long teacherId, long classroomId, Subject subjectFilter) {
        Classroom c = classrooms.findByIdAndTeacher_Id(classroomId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học."));
        List<ReviewBatch> batchList = batches.findByClassroom_IdOrderByBatchDateDescIdDesc(classroomId).stream()
                .filter(b -> subjectFilter == null || b.getSubject() == subjectFilter)
                .toList();
        List<ClassroomEnrollment> roster = enrollments.findByClassroomIdWithStudent(classroomId);
        List<Long> batchIds = batchList.stream().map(ReviewBatch::getId).toList();
        List<StudentEvaluation> allEvals = batchIds.isEmpty() ? List.of() : evaluations.findByBatchIds(batchIds);
        Map<String, StudentEvaluation> byKey = allEvals.stream()
                .collect(Collectors.toMap(ev -> ev.getBatch().getId() + ":" + ev.getEnrollment().getId(), Function.identity()));
        Map<Long, List<HomeworkPageResponse>> pagesByEval = loadPagesMap(allEvals);

        List<GradebookBatchColumn> cols = batchList.stream()
                .map(b -> new GradebookBatchColumn(b.getId(), b.getTitle(), b.getSubject(),
                        Boolean.TRUE.equals(b.getIsHomework()), b.getBatchDate(), b.getDueAt()))
                .toList();

        List<GradebookStudentRow> rows = roster.stream().map(e -> {
            List<GradebookCell> cells = new ArrayList<>();
            double sum = 0; int scored = 0;
            for (ReviewBatch b : batchList) {
                StudentEvaluation ev = byKey.get(b.getId() + ":" + e.getId());
                int pCount = ev == null ? 0 : pagesByEval.getOrDefault(ev.getId(), List.of()).size();
                if (ev != null && ev.getScore() != null) {
                    sum += ev.getScore().doubleValue();
                    scored++;
                }
                cells.add(new GradebookCell(
                        b.getId(),
                        ev != null && (ev.getSubmittedAt() != null || pCount > 0),
                        pCount,
                        ev == null ? null : ev.getScore(),
                        ev == null ? null : ev.getRating(),
                        ev == null ? null : ev.getTeacherComment(),
                        ev != null && Boolean.TRUE.equals(ev.getNeedsAttention()),
                        ev == null ? null : ev.getSentToParentAt(),
                        ev == null ? null : ev.getScheduledSendAt()
                ));
            }
            Student s = e.getStudent();
            User p = s == null ? null : s.getParent();
            return new GradebookStudentRow(
                    e.getId(), s == null ? null : s.getId(), e.getDisplayName(), s != null,
                    p != null ? displayName(p) : e.getParentNameNote(), e.getParentPhone(),
                    scored == 0 ? null : Math.round((sum / scored) * 100.0) / 100.0,
                    cells
            );
        }).toList();

        return new GradebookResponse(c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(), cols, rows);
    }

    // === Parent: View Homework & Upload Multi-page Photos ===

    @Transactional(readOnly = true)
    public List<ParentHomeworkItem> listParentHomework(long parentId, long studentId, Subject subjectFilter) {
        students.requireOwned(parentId, studentId);
        List<ClassroomEnrollment> myEnrollments = enrollments.findByStudentIdWithClassroom(studentId);
        if (myEnrollments.isEmpty()) return List.of();

        Map<Long, ClassroomEnrollment> enrollByClassroom = myEnrollments.stream()
                .collect(Collectors.toMap(e -> e.getClassroom().getId(), Function.identity()));
        List<ReviewBatch> allBatches = new ArrayList<>();
        for (ClassroomEnrollment e : myEnrollments) {
            allBatches.addAll(batches.findByClassroom_IdOrderByBatchDateDescIdDesc(e.getClassroom().getId()));
        }
        List<ReviewBatch> filtered = allBatches.stream()
                .filter(b -> Boolean.TRUE.equals(b.getIsHomework()))
                .filter(b -> subjectFilter == null || b.getSubject() == subjectFilter)
                .sorted(Comparator.comparing(ReviewBatch::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        if (filtered.isEmpty()) return List.of();

        List<Long> batchIds = filtered.stream().map(ReviewBatch::getId).toList();
        List<StudentEvaluation> evals = evaluations.findByBatchIds(batchIds);
        Map<String, StudentEvaluation> byKey = evals.stream()
                .collect(Collectors.toMap(ev -> ev.getBatch().getId() + ":" + ev.getEnrollment().getId(), Function.identity()));
        Map<Long, List<HomeworkPageResponse>> pagesByEval = loadPagesMap(evals);

        List<ParentHomeworkItem> out = new ArrayList<>();
        for (ReviewBatch b : filtered) {
            Classroom c = b.getClassroom();
            ClassroomEnrollment e = enrollByClassroom.get(c.getId());
            if (e == null) continue;
            StudentEvaluation ev = byKey.get(b.getId() + ":" + e.getId());
            List<HomeworkPageResponse> pList = ev == null ? List.of() : pagesByEval.getOrDefault(ev.getId(), List.of());
            boolean published = ev != null && ev.getSentToParentAt() != null;
            boolean late = ev != null && ev.getSubmittedAt() != null && b.getDueAt() != null && ev.getSubmittedAt().isAfter(b.getDueAt());
            out.add(new ParentHomeworkItem(
                    b.getId(), c.getId(), c.getName(), displayName(c.getTeacher()), e.getId(),
                    b.getTitle(), b.getSubject(), b.getDescription(), b.getBatchDate(), b.getDueAt(),
                    b.getRequiredPages() == null ? 1 : b.getRequiredPages(),
                    ev == null ? null : ev.getSubmittedAt(), late, pList, published,
                    published ? ev.getScore() : null,
                    published ? ev.getRating() : null,
                    published ? ev.getTeacherComment() : null,
                    published && Boolean.TRUE.equals(ev.getNeedsAttention()),
                    published ? ev.getSentToParentAt() : null
            ));
        }
        return out;
    }

    @Transactional
    public List<HomeworkPageResponse> uploadHomeworkPages(long parentId, long batchId, long enrollmentId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ít nhất một ảnh bài làm.");
        }
        ReviewBatch b = batches.findById(batchId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy bài tập."));
        ClassroomEnrollment e = enrollments.findByIdAndClassroom_Id(enrollmentId, b.getClassroom().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy ghi danh học sinh."));
        if (e.getStudent() == null || !Objects.equals(e.getStudent().getParent().getId(), parentId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy bài tập trong phạm vi tài khoản của ba mẹ.");
        }
        StudentEvaluation ev = evaluations.findByBatch_IdAndEnrollment_Id(batchId, enrollmentId).orElseGet(() -> {
            StudentEvaluation created = new StudentEvaluation();
            created.setBatch(b);
            created.setEnrollment(e);
            return evaluations.saveAndFlush(created);
        });
        if (ev.getSentToParentAt() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "Bài tập đã được giáo viên chấm và công bố điểm, không thể sửa ảnh nộp.");
        }
        List<HomeworkSubmissionPage> existing = pages.findByEvaluation_IdOrderByPageNumberAscIdAsc(ev.getId());
        if (existing.size() + files.size() > MAX_PAGES_PER_SUBMISSION) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mỗi bài nộp tối đa " + MAX_PAGES_PER_SUBMISSION + " trang ảnh.");
        }
        int nextPage = existing.stream().mapToInt(p -> p.getPageNumber()).max().orElse(0) + 1;
        for (MultipartFile file : files) {
            HomeworkStorageService.StoredFile stored = storage.store(batchId, enrollmentId, file);
            HomeworkSubmissionPage page = new HomeworkSubmissionPage();
            page.setEvaluation(ev);
            page.setPageNumber((byte) nextPage++);
            page.setStoragePath(stored.relativePath());
            page.setOriginalFilename(stored.originalFilename());
            page.setContentType(stored.contentType());
            page.setFileSize(stored.size());
            pages.save(page);
        }
        ev.setSubmittedAt(LocalDateTime.now(VN));
        evaluations.saveAndFlush(ev);
        pages.flush();
        return pages.findByEvaluation_IdOrderByPageNumberAscIdAsc(ev.getId()).stream()
                .map(this::toPageResponse).toList();
    }

    @Transactional
    public void deleteHomeworkPage(long parentId, long pageId) {
        HomeworkSubmissionPage page = pages.findByIdWithAccessGraph(pageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy trang ảnh."));
        Student s = page.getEvaluation().getEnrollment().getStudent();
        if (s == null || !Objects.equals(s.getParent().getId(), parentId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy trang ảnh trong tài khoản của ba mẹ.");
        }
        if (page.getEvaluation().getSentToParentAt() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "Bài tập đã công bố điểm, không thể xóa ảnh.");
        }
        String path = page.getStoragePath();
        pages.delete(page);
        pages.flush();
        storage.deleteQuietly(path);
    }

    public record PageBinary(byte[] bytes, String contentType, String filename) {}

    @Transactional(readOnly = true)
    public PageBinary loadPageImage(long userId, long pageId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại."));
        HomeworkSubmissionPage page = pages.findByIdWithAccessGraph(pageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy trang ảnh."));
        boolean allowed = user.getRole() == UserRole.ADMIN
                || (user.getRole() == UserRole.TEACHER && Objects.equals(page.getEvaluation().getBatch().getClassroom().getTeacher().getId(), userId))
                || (user.getRole() == UserRole.PARENT && page.getEvaluation().getEnrollment().getStudent() != null
                    && Objects.equals(page.getEvaluation().getEnrollment().getStudent().getParent().getId(), userId));
        if (!allowed) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy trang ảnh.");
        }
        return new PageBinary(storage.load(page.getStoragePath()), page.getContentType(), page.getOriginalFilename());
    }

    private ReviewBatch requireOwnedBatch(long teacherId, long batchId) {
        return batches.findByIdAndClassroom_Teacher_Id(batchId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đợt bài tập."));
    }

    private Map<Long, List<HomeworkPageResponse>> loadPagesMap(List<StudentEvaluation> evals) {
        if (evals.isEmpty()) return Map.of();
        List<Long> ids = evals.stream().map(StudentEvaluation::getId).toList();
        return pages.findByEvaluationIds(ids).stream()
                .collect(Collectors.groupingBy(
                        p -> p.getEvaluation().getId(),
                        Collectors.mapping(this::toPageResponse, Collectors.toList())
                ));
    }

    private HomeworkPageResponse toPageResponse(HomeworkSubmissionPage p) {
        return new HomeworkPageResponse(
                p.getId(), p.getPageNumber(), p.getOriginalFilename(), p.getContentType(), p.getFileSize(),
                "/api/homework/pages/" + p.getId() + "/image", p.getUploadedAt()
        );
    }

    private String displayName(User u) {
        return u.getFullName() == null || u.getFullName().isBlank() ? u.getEmail() : u.getFullName();
    }
}
