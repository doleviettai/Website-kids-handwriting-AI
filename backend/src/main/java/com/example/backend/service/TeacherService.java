package com.example.backend.service;

import com.example.backend.dto.TeacherDtos.*;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.EvaluationRating;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.EntityManager;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeacherService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ClassroomRepository classrooms;
    private final ClassroomEnrollmentRepository enrollments;
    private final ReviewBatchRepository batches;
    private final StudentEvaluationRepository evaluations;
    private final UserRepository users;
    private final StudentRepository studentRepo;
    private final StudentService students;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<ClassroomSummary> listClassrooms(long teacherId) {
        return classrooms.findByTeacher_IdOrderByCreatedAtDescIdDesc(teacherId).stream()
                .map(this::toClassroomSummary)
                .toList();
    }

    @Transactional
    public ClassroomSummary createClassroom(long teacherId, ClassroomRequest request) {
        User teacher = users.findById(teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại."));
        Classroom c = new Classroom();
        c.setTeacher(teacher);
        applyClassroom(c, request);
        c.setJoinCode(generateJoinCode());
        return toClassroomSummary(classrooms.saveAndFlush(c));
    }

    @Transactional
    public ClassroomSummary updateClassroom(long teacherId, long classroomId, ClassroomRequest request) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        applyClassroom(c, request);
        return toClassroomSummary(classrooms.saveAndFlush(c));
    }

    @Transactional
    public void deleteClassroom(long teacherId, long classroomId) {
        requireOwnedClassroom(teacherId, classroomId);
        entityManager.flush();
        jdbc.update("""
                DELETE p FROM homework_submission_pages p
                JOIN student_evaluations ev ON ev.id = p.evaluation_id
                JOIN review_batches b ON b.id = ev.batch_id
                WHERE b.classroom_id = ?
                """, classroomId);
        jdbc.update("""
                DELETE ev FROM student_evaluations ev
                JOIN review_batches b ON b.id = ev.batch_id
                WHERE b.classroom_id = ?
                """, classroomId);
        jdbc.update("DELETE FROM review_batches WHERE classroom_id = ?", classroomId);
        jdbc.update("DELETE FROM classroom_invitations WHERE classroom_id = ?", classroomId);
        jdbc.update("DELETE FROM classroom_join_requests WHERE classroom_id = ?", classroomId);
        jdbc.update("DELETE FROM classroom_enrollments WHERE classroom_id = ?", classroomId);
        jdbc.update("DELETE FROM classrooms WHERE id = ?", classroomId);
        entityManager.clear();
    }

    @Transactional(readOnly = true)
    public ClassroomDetail classroomDetail(long teacherId, long classroomId) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        List<ClassroomEnrollment> list = enrollments.findByClassroomIdWithStudent(classroomId);
        Map<Long, Long> subCounts = new HashMap<>();
        List<Long> studentIds = list.stream().map(e -> e.getStudent() == null ? null : e.getStudent().getId()).filter(Objects::nonNull).toList();
        if (!studentIds.isEmpty()) {
            String placeholders = studentIds.stream().map(id -> "?").collect(Collectors.joining(","));
            jdbc.query(
                    "SELECT student_id, COUNT(*) AS cnt FROM submissions WHERE student_id IN (" + placeholders + ") GROUP BY student_id",
                    rs -> { subCounts.put(rs.getLong("student_id"), rs.getLong("cnt")); },
                    studentIds.toArray());
        }
        List<EnrollmentResponse> enrollmentRows = list.stream().map(e -> toEnrollmentResponse(e, subCounts)).toList();
        long totalStudents = enrollmentRows.size();
        List<BatchSummary> batchRows = batches.findByClassroom_IdOrderByBatchDateDescIdDesc(classroomId).stream()
                .map(b -> toBatchSummary(b, totalStudents))
                .toList();
        return new ClassroomDetail(toClassroomSummary(c), enrollmentRows, batchRows);
    }

    @Transactional
    public EnrollmentResponse addEnrollment(long teacherId, long classroomId, EnrollmentRequest request) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        ClassroomEnrollment saved = enrollments.saveAndFlush(buildEnrollment(c, request));
        notifications.notifyAddedToClassroom(saved);
        return toEnrollmentResponse(saved, Map.of());
    }

    @Transactional
    public List<EnrollmentResponse> importEnrollments(long teacherId, long classroomId, EnrollmentImportRequest request) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        List<EnrollmentResponse> saved = new ArrayList<>();
        for (EnrollmentRequest req : request.students()) {
            ClassroomEnrollment created = enrollments.saveAndFlush(buildEnrollment(c, req));
            notifications.notifyAddedToClassroom(created);
            saved.add(toEnrollmentResponse(created, Map.of()));
        }
        return saved;
    }

    @Transactional
    public void deleteEnrollment(long teacherId, long classroomId, long enrollmentId) {
        requireOwnedClassroom(teacherId, classroomId);
        enrollments.findByIdAndClassroom_Id(enrollmentId, classroomId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy học sinh trong lớp."));
        entityManager.flush();
        jdbc.update("""
                DELETE p FROM homework_submission_pages p
                JOIN student_evaluations ev ON ev.id = p.evaluation_id
                WHERE ev.enrollment_id = ?
                """, enrollmentId);
        jdbc.update("DELETE FROM student_evaluations WHERE enrollment_id = ?", enrollmentId);
        jdbc.update("DELETE FROM classroom_enrollments WHERE id = ?", enrollmentId);
        entityManager.clear();
    }

    @Transactional
    public BatchSummary createBatch(long teacherId, long classroomId, BatchRequest request) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        String title = VietnameseText.nfc(request.title()).trim();
        if (title.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Tên đợt chấm không hợp lệ.");
        ReviewBatch b = new ReviewBatch();
        b.setClassroom(c);
        b.setTitle(title);
        b.setBatchDate(request.batchDate());
        b.setNotes(request.notes() == null ? null : VietnameseText.nfc(request.notes()).trim());
        ReviewBatch saved = batches.saveAndFlush(b);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id=?", Long.class, classroomId);
        return toBatchSummary(saved, total);
    }

    @Transactional
    public void deleteBatch(long teacherId, long classroomId, long batchId) {
        requireOwnedClassroom(teacherId, classroomId);
        ReviewBatch b = batches.findByIdAndClassroom_Teacher_Id(batchId, teacherId)
                .filter(row -> Objects.equals(row.getClassroom().getId(), classroomId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đợt chấm."));
        entityManager.flush();
        jdbc.update("""
                DELETE p FROM homework_submission_pages p
                JOIN student_evaluations ev ON ev.id = p.evaluation_id
                WHERE ev.batch_id = ?
                """, b.getId());
        jdbc.update("DELETE FROM student_evaluations WHERE batch_id = ?", b.getId());
        jdbc.update("DELETE FROM review_batches WHERE id = ?", b.getId());
        entityManager.clear();
    }

    @Transactional(readOnly = true)
    public BatchSheet batchSheet(long teacherId, long batchId) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        Classroom c = b.getClassroom();
        List<ClassroomEnrollment> list = enrollments.findByClassroomIdWithStudent(c.getId());
        Map<Long, StudentEvaluation> byEnrollment = evaluations.findByBatch_Id(batchId).stream()
                .collect(Collectors.toMap(ev -> ev.getEnrollment().getId(), Function.identity()));
        List<EvaluationRow> rows = list.stream().map(e -> {
            StudentEvaluation ev = byEnrollment.get(e.getId());
            return toEvaluationRow(e, ev);
        }).toList();
        return new BatchSheet(b.getId(), c.getId(), c.getName(), c.getSchoolYear(), b.getTitle(), b.getBatchDate(), b.getNotes(), rows);
    }

    @Transactional
    public EvaluationRow saveEvaluation(long teacherId, long batchId, long enrollmentId, EvaluationRequest request) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        ClassroomEnrollment e = enrollments.findByIdAndClassroom_Id(enrollmentId, b.getClassroom().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Học sinh không thuộc lớp của đợt chấm này."));
        StudentEvaluation ev = evaluations.findByBatch_IdAndEnrollment_Id(batchId, enrollmentId).orElseGet(() -> {
            StudentEvaluation created = new StudentEvaluation();
            created.setBatch(b);
            created.setEnrollment(e);
            return created;
        });
        ev.setRating(request.rating());
        String comment = request.teacherComment() == null ? null : VietnameseText.nfc(request.teacherComment()).trim();
        ev.setTeacherComment(comment == null || comment.isEmpty() ? null : comment);
        ev.setNeedsAttention(request.needsAttention());
        StudentEvaluation saved = evaluations.saveAndFlush(ev);
        return toEvaluationRow(e, saved);
    }

    @Transactional
    public SendReportsResponse sendReports(long teacherId, long batchId, Long enrollmentId) {
        ReviewBatch b = requireOwnedBatch(teacherId, batchId);
        List<ClassroomEnrollment> targets;
        if (enrollmentId != null) {
            ClassroomEnrollment one = enrollments.findByIdAndClassroom_Id(enrollmentId, b.getClassroom().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy học sinh trong lớp."));
            targets = List.of(one);
        } else {
            targets = enrollments.findByClassroomIdWithStudent(b.getClassroom().getId());
        }
        Map<Long, StudentEvaluation> byEnrollment = evaluations.findByBatch_Id(batchId).stream()
                .collect(Collectors.toMap(ev -> ev.getEnrollment().getId(), Function.identity()));

        int sent = 0;
        int skippedUnlinked = 0;
        int skippedEmpty = 0;
        LocalDateTime now = LocalDateTime.now(VN);
        for (ClassroomEnrollment e : targets) {
            if (e.getStudent() == null) {
                skippedUnlinked++;
                continue;
            }
            StudentEvaluation ev = byEnrollment.get(e.getId());
            if (ev == null || (ev.getRating() == null && (ev.getTeacherComment() == null || ev.getTeacherComment().isBlank()))) {
                skippedEmpty++;
                continue;
            }
            ev.setSentToParentAt(now);
            evaluations.save(ev);
            notifications.notifyTeacherReport(ev);
            sent++;
        }
        evaluations.flush();
        return new SendReportsResponse(sent, skippedUnlinked, skippedEmpty);
    }

    @Transactional(readOnly = true)
    public String exportBatchCsv(long teacherId, long batchId) {
        BatchSheet sheet = batchSheet(teacherId, batchId);
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF'); // UTF-8 BOM for Microsoft Excel Vietnamese compatibility
        sb.append("STT,Học sinh,Năm sinh,Liên kết phụ huynh,Xếp loại (TT27),Cần chú ý,Nhận xét của giáo viên,Đã gửi phụ huynh\r\n");
        int idx = 1;
        for (EvaluationRow r : sheet.rows()) {
            sb.append(idx++).append(',');
            sb.append(csv(r.displayName())).append(',');
            sb.append(r.birthYear() == null ? "" : r.birthYear()).append(',');
            sb.append(csv(r.linkedParent() ? (r.parentName() != null ? r.parentName() : "Đã liên kết") : "Chưa liên kết")).append(',');
            sb.append(csv(ratingLabel(r.rating()))).append(',');
            sb.append(csv(r.needsAttention() ? "Cần chú ý" : "")).append(',');
            sb.append(csv(r.teacherComment() == null ? "" : r.teacherComment())).append(',');
            sb.append(csv(r.sentToParentAt() == null ? "Chưa gửi" : r.sentToParentAt().toString())).append("\r\n");
        }
        return sb.toString();
    }

    // === Parent-side classroom linking & viewing teacher reports ===

    @Transactional
    public StudentClassroomResponse joinClassroom(long parentId, long studentId, JoinClassroomRequest request) {
        Student student = students.requireOwned(parentId, studentId);
        String code = VietnameseText.nfc(request.joinCode()).trim().toUpperCase(Locale.ROOT);
        Classroom c = classrooms.findByJoinCode(code)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học với mã này. Ba mẹ kiểm tra lại mã cô gửi nhé."));
        Optional<ClassroomEnrollment> existing = enrollments.findByClassroom_IdAndStudent_Id(c.getId(), studentId);
        if (existing.isPresent()) {
            return toStudentClassroom(existing.get());
        }
        // Try matching an unlinked roster entry with identical display name (case-insensitive)
        List<ClassroomEnrollment> roster = enrollments.findByClassroomIdWithStudent(c.getId());
        ClassroomEnrollment matched = roster.stream()
                .filter(e -> e.getStudent() == null && e.getDisplayName().equalsIgnoreCase(student.getNickname()))
                .findFirst()
                .orElse(null);
        ClassroomEnrollment saved;
        if (matched != null) {
            matched.setStudent(student);
            if (matched.getBirthYear() == null) matched.setBirthYear(student.getBirthYear());
            saved = enrollments.saveAndFlush(matched);
        } else {
            ClassroomEnrollment created = new ClassroomEnrollment();
            created.setClassroom(c);
            created.setStudent(student);
            created.setDisplayName(student.getNickname());
            created.setBirthYear(student.getBirthYear());
            saved = enrollments.saveAndFlush(created);
        }
        return toStudentClassroom(saved);
    }

    @Transactional(readOnly = true)
    public List<StudentClassroomResponse> studentClassrooms(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        return enrollments.findByStudentIdWithClassroom(studentId).stream()
                .map(this::toStudentClassroom)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ParentTeacherReport> studentTeacherReports(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        return evaluations.findSentReportsForStudent(studentId).stream()
                .map(ev -> new ParentTeacherReport(
                        ev.getId(),
                        ev.getBatch().getId(),
                        ev.getBatch().getTitle(),
                        ev.getBatch().getBatchDate(),
                        ev.getBatch().getClassroom().getName(),
                        displayTeacher(ev.getBatch().getClassroom().getTeacher()),
                        ev.getRating(),
                        ev.getTeacherComment(),
                        Boolean.TRUE.equals(ev.getNeedsAttention()),
                        ev.getSentToParentAt()
                ))
                .toList();
    }

    private Classroom requireOwnedClassroom(long teacherId, long classroomId) {
        return classrooms.findByIdAndTeacher_Id(classroomId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học trong tài khoản giáo viên."));
    }

    private ReviewBatch requireOwnedBatch(long teacherId, long batchId) {
        return batches.findByIdAndClassroom_Teacher_Id(batchId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đợt chấm."));
    }

    private void applyClassroom(Classroom c, ClassroomRequest request) {
        String name = VietnameseText.nfc(request.name()).trim();
        String year = VietnameseText.nfc(request.schoolYear()).trim();
        if (name.isEmpty() || year.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Tên lớp và năm học không hợp lệ.");
        c.setName(name);
        c.setSchoolYear(year);
        c.setGradeLevel(request.gradeLevel());
    }

    private ClassroomEnrollment buildEnrollment(Classroom c, EnrollmentRequest req) {
        String name = VietnameseText.nfc(req.displayName()).trim();
        if (name.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Tên học sinh không được để trống.");
        if (req.birthYear() != null && req.birthYear() > Year.now().getValue()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Năm sinh không thể lớn hơn năm hiện tại.");
        }
        String parentEmail = req.parentEmail() == null ? "" : VietnameseText.nfc(req.parentEmail()).trim().toLowerCase(Locale.ROOT);
        if (parentEmail.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cần nhập email tài khoản phụ huynh để gửi bài tập và thông báo.");
        }
        User parent = users.findByEmail(parentEmail)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "Không tìm thấy tài khoản phụ huynh với email " + parentEmail + ". Phụ huynh cần có tài khoản trước để nhận bài tập và thông báo."));
        if (parent.getRole() != UserRole.PARENT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email " + parentEmail + " không thuộc tài khoản phụ huynh.");
        }
        Student student = studentRepo.findByParent_IdOrderByCreatedAtAsc(parent.getId()).stream()
                .filter(s -> s.getNickname().equalsIgnoreCase(name))
                .findFirst()
                .orElseGet(() -> {
                    Student created = new Student();
                    created.setParent(parent);
                    created.setNickname(name);
                    created.setBirthYear(req.birthYear());
                    created.setGradeLevel(c.getGradeLevel());
                    return studentRepo.saveAndFlush(created);
                });
        if (enrollments.findByClassroom_IdAndStudent_Id(c.getId(), student.getId()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Học sinh \"" + name + "\" đã có trong lớp học này.");
        }
        ClassroomEnrollment e = new ClassroomEnrollment();
        e.setClassroom(c);
        e.setStudent(student);
        e.setDisplayName(name);
        e.setBirthYear(req.birthYear() != null ? req.birthYear() : student.getBirthYear());
        String pName = req.parentNameNote() == null ? null : VietnameseText.nfc(req.parentNameNote()).trim();
        e.setParentNameNote(pName != null && !pName.isEmpty() ? pName : parent.getFullName());
        String pPhone = req.parentPhone() == null ? null : VietnameseText.nfc(req.parentPhone()).trim();
        e.setParentPhone(pPhone != null && !pPhone.isEmpty() ? pPhone : null);
        return e;
    }

    private String generateJoinCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (!classrooms.existsByJoinCode(code)) return code;
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không tạo được mã lớp duy nhất.");
    }

    private ClassroomSummary toClassroomSummary(Classroom c) {
        long studentCount = jdbc.queryForObject("SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id=?", Long.class, c.getId());
        long batchCount = jdbc.queryForObject("SELECT COUNT(*) FROM review_batches WHERE classroom_id=?", Long.class, c.getId());
        return new ClassroomSummary(c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(), c.getJoinCode(), studentCount, batchCount, c.getCreatedAt());
    }

    private EnrollmentResponse toEnrollmentResponse(ClassroomEnrollment e, Map<Long, Long> subCounts) {
        Student s = e.getStudent();
        return new EnrollmentResponse(
                e.getId(),
                s == null ? null : s.getId(),
                e.getDisplayName(),
                e.getBirthYear(),
                s != null,
                s == null ? null : s.getParent().getFullName(),
                s == null ? 0L : subCounts.getOrDefault(s.getId(), 0L),
                e.getJoinedAt()
        );
    }

    private BatchSummary toBatchSummary(ReviewBatch b, long totalStudents) {
        long evaluated = jdbc.queryForObject(
                "SELECT COUNT(*) FROM student_evaluations WHERE batch_id=? AND (rating IS NOT NULL OR (teacher_comment IS NOT NULL AND teacher_comment<>''))",
                Long.class, b.getId());
        long attention = jdbc.queryForObject(
                "SELECT COUNT(*) FROM student_evaluations WHERE batch_id=? AND needs_attention=TRUE",
                Long.class, b.getId());
        long sent = jdbc.queryForObject(
                "SELECT COUNT(*) FROM student_evaluations WHERE batch_id=? AND sent_to_parent_at IS NOT NULL",
                Long.class, b.getId());
        return new BatchSummary(b.getId(), b.getClassroom().getId(), b.getTitle(), b.getBatchDate(), b.getNotes(),
                evaluated, attention, sent, totalStudents, b.getCreatedAt());
    }

    private EvaluationRow toEvaluationRow(ClassroomEnrollment e, StudentEvaluation ev) {
        Student s = e.getStudent();
        return new EvaluationRow(
                e.getId(),
                s == null ? null : s.getId(),
                e.getDisplayName(),
                e.getBirthYear(),
                s != null,
                s == null ? null : s.getParent().getFullName(),
                ev == null ? null : ev.getRating(),
                ev == null ? null : ev.getTeacherComment(),
                ev != null && Boolean.TRUE.equals(ev.getNeedsAttention()),
                ev == null ? null : ev.getImageUrl(),
                ev == null ? null : ev.getSentToParentAt(),
                ev == null ? null : ev.getUpdatedAt()
        );
    }

    private StudentClassroomResponse toStudentClassroom(ClassroomEnrollment e) {
        Classroom c = e.getClassroom();
        return new StudentClassroomResponse(
                e.getId(), c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(),
                displayTeacher(c.getTeacher()), e.getJoinedAt()
        );
    }

    private String displayTeacher(User teacher) {
        return teacher.getFullName() == null || teacher.getFullName().isBlank() ? "Giáo viên chủ nhiệm" : teacher.getFullName();
    }

    private String ratingLabel(EvaluationRating rating) {
        if (rating == null) return "";
        return switch (rating) {
            case HOAN_THANH_TOT -> "Hoàn thành tốt";
            case HOAN_THANH -> "Hoàn thành";
            case CAN_CO_GANG -> "Cần cố gắng";
        };
    }

    private String csv(String value) {
        if (value == null) return "";
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n") || escaped.contains("\r")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }
}
