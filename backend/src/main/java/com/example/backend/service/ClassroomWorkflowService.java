package com.example.backend.service;

import com.example.backend.dto.HomeworkDtos.*;
import com.example.backend.dto.TeacherDtos.StudentClassroomResponse;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.ZoneId;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClassroomWorkflowService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ClassroomRepository classrooms;
    private final ClassroomEnrollmentRepository enrollments;
    private final ClassroomInvitationRepository invitations;
    private final ClassroomJoinRequestRepository joinRequests;
    private final UserRepository users;
    private final StudentService students;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;

    // === Teacher: Roster Details & Edit (classroom-scoped only) ===

    @Transactional(readOnly = true)
    public List<EnrollmentDetailResponse> listEnrollmentsDetail(long teacherId, long classroomId) {
        requireOwnedClassroom(teacherId, classroomId);
        return enrollments.findByClassroomIdWithStudent(classroomId).stream()
                .map(this::toEnrollmentDetail)
                .toList();
    }

    @Transactional
    public EnrollmentDetailResponse updateEnrollment(long teacherId, long classroomId, long enrollmentId, UpdateEnrollmentRequest req) {
        requireOwnedClassroom(teacherId, classroomId);
        ClassroomEnrollment e = enrollments.findByIdAndClassroom_Id(enrollmentId, classroomId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy học sinh trong lớp."));
        String name = VietnameseText.nfc(req.displayName()).trim();
        if (name.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Tên học sinh không được để trống.");
        if (req.birthYear() != null && req.birthYear() > Year.now().getValue()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Năm sinh không hợp lệ.");
        }
        e.setDisplayName(name);
        e.setBirthYear(req.birthYear());
        e.setParentNameNote(trimNull(req.parentNameNote()));
        e.setParentPhone(trimNull(req.parentPhone()));
        e.setTeacherNote(trimNull(req.teacherNote()));
        return toEnrollmentDetail(enrollments.saveAndFlush(e));
    }

    // === Teacher: Invitations & Join Requests ===

    @Transactional(readOnly = true)
    public List<InvitationResponse> listClassroomInvitations(long teacherId, long classroomId) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        return invitations.findByClassroom_IdOrderByCreatedAtDescIdDesc(c.getId()).stream()
                .map(i -> toInvitationResponse(i, c))
                .toList();
    }

    @Transactional
    public InvitationResponse inviteParent(long teacherId, long classroomId, InviteParentRequest req) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        User teacher = users.findById(teacherId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại."));
        String email = VietnameseText.nfc(req.parentEmail()).trim().toLowerCase(Locale.ROOT);
        if (invitations.existsByClassroom_IdAndParentEmailAndStatus(classroomId, email, InvitationStatus.PENDING)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã có lời mời đang chờ phản hồi trong lớp.");
        }
        ClassroomInvitation inv = new ClassroomInvitation();
        inv.setClassroom(c);
        inv.setParentEmail(email);
        inv.setInvitedBy(teacher);
        inv.setStatus(InvitationStatus.PENDING);
        ClassroomInvitation saved = invitations.saveAndFlush(inv);
        users.findByEmail(email)
                .filter(u -> u.getRole() == UserRole.PARENT)
                .ifPresent(parent -> notifications.notifyClassInvitation(parent, c));
        return toInvitationResponse(saved, c);
    }

    @Transactional
    public void cancelInvitation(long teacherId, long classroomId, long invitationId) {
        requireOwnedClassroom(teacherId, classroomId);
        ClassroomInvitation inv = invitations.findById(invitationId)
                .filter(i -> Objects.equals(i.getClassroom().getId(), classroomId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lời mời."));
        inv.setStatus(InvitationStatus.CANCELLED);
        inv.setRespondedAt(LocalDateTime.now(VN));
        invitations.saveAndFlush(inv);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestResponse> listClassroomJoinRequests(long teacherId, long classroomId) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        return joinRequests.findByClassroomAndStatus(c.getId(), JoinRequestStatus.PENDING).stream()
                .map(r -> toJoinRequestResponse(r, c))
                .toList();
    }

    @Transactional
    public JoinRequestResponse reviewJoinRequest(long teacherId, long classroomId, long requestId, ReviewJoinRequest req) {
        Classroom c = requireOwnedClassroom(teacherId, classroomId);
        ClassroomJoinRequest jr = joinRequests.findByIdAndClassroom_Id(requestId, classroomId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu tham gia lớp."));
        if (jr.getStatus() != JoinRequestStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "Yêu cầu này đã được xử lý.");
        }
        jr.setStatus(req.approve() ? JoinRequestStatus.APPROVED : JoinRequestStatus.REJECTED);
        jr.setReviewedAt(LocalDateTime.now(VN));
        joinRequests.saveAndFlush(jr);
        if (req.approve()) {
            linkStudentToClassroom(c, jr.getStudent());
        }
        notifications.notifyJoinRequestReviewed(jr);
        return toJoinRequestResponse(jr, c);
    }

    // === Parent: Search Classrooms, Request Join, Respond Invitations ===

    @Transactional(readOnly = true)
    public List<PublicClassroomResponse> searchClassrooms(String q, GradeLevel grade) {
        String term = q == null ? "" : VietnameseText.nfc(q).trim().toLowerCase(Locale.ROOT);
        Map<Long, Long> counts = new HashMap<>();
        jdbc.query("SELECT classroom_id, COUNT(*) AS cnt FROM classroom_enrollments GROUP BY classroom_id",
                rs -> { counts.put(rs.getLong("classroom_id"), rs.getLong("cnt")); });
        return classrooms.findAllWithTeacher().stream()
                .filter(c -> grade == null || c.getGradeLevel() == grade)
                .filter(c -> term.isEmpty()
                        || c.getName().toLowerCase(Locale.ROOT).contains(term)
                        || c.getJoinCode().toLowerCase(Locale.ROOT).contains(term)
                        || displayName(c.getTeacher()).toLowerCase(Locale.ROOT).contains(term))
                .limit(50)
                .map(c -> new PublicClassroomResponse(
                        c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(),
                        displayName(c.getTeacher()), counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public JoinRequestResponse requestJoin(long parentId, long classroomId, CreateJoinRequest req) {
        User parent = users.findById(parentId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại."));
        Student student = students.requireOwned(parentId, req.studentId());
        Classroom c = classrooms.findById(classroomId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học."));
        if (enrollments.findByClassroom_IdAndStudent_Id(classroomId, student.getId()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Bé đã ở trong lớp học này rồi.");
        }
        if (joinRequests.existsByClassroom_IdAndStudent_IdAndStatus(classroomId, student.getId(), JoinRequestStatus.PENDING)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ba mẹ đã gửi yêu cầu cho bé vào lớp này rồi, chờ cô duyệt nhé.");
        }
        ClassroomJoinRequest jr = new ClassroomJoinRequest();
        jr.setClassroom(c);
        jr.setParent(parent);
        jr.setStudent(student);
        jr.setMessage(trimNull(req.message()));
        jr.setStatus(JoinRequestStatus.PENDING);
        ClassroomJoinRequest saved = joinRequests.saveAndFlush(jr);
        notifications.notifyJoinRequest(saved);
        return toJoinRequestResponse(saved, c);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestResponse> listParentJoinRequests(long parentId) {
        return joinRequests.findByParentWithDetails(parentId).stream()
                .map(r -> toJoinRequestResponse(r, r.getClassroom()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> listParentInvitations(long parentId) {
        User parent = users.findById(parentId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại."));
        return invitations.findByParentEmailAndStatusWithClassroom(parent.getEmail(), InvitationStatus.PENDING).stream()
                .map(i -> toInvitationResponse(i, i.getClassroom()))
                .toList();
    }

    @Transactional
    public StudentClassroomResponse respondInvitation(long parentId, long invitationId, RespondInvitationRequest req) {
        User parent = users.findById(parentId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại."));
        ClassroomInvitation inv = invitations.findByIdAndParentEmail(invitationId, parent.getEmail())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lời mời."));
        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "Lời mời này đã được phản hồi.");
        }
        inv.setRespondedAt(LocalDateTime.now(VN));
        if (!req.accept()) {
            inv.setStatus(InvitationStatus.DECLINED);
            invitations.saveAndFlush(inv);
            return null;
        }
        if (req.studentId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cần chọn hồ sơ bé để tham gia lớp.");
        }
        Student student = students.requireOwned(parentId, req.studentId());
        inv.setStatus(InvitationStatus.ACCEPTED);
        invitations.saveAndFlush(inv);
        ClassroomEnrollment saved = linkStudentToClassroom(inv.getClassroom(), student);
        Classroom c = saved.getClassroom();
        return new StudentClassroomResponse(saved.getId(), c.getId(), c.getName(), c.getSchoolYear(),
                c.getGradeLevel(), displayName(c.getTeacher()), saved.getJoinedAt());
    }

    // === Admin: View teacher profile & classrooms ===

    @Transactional(readOnly = true)
    public AdminTeacherDetailResponse adminTeacherDetail(long teacherId) {
        User teacher = users.findById(teacherId)
                .filter(u -> u.getRole() == UserRole.TEACHER)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản giáo viên."));
        List<Classroom> list = classrooms.findByTeacher_IdOrderByCreatedAtDescIdDesc(teacherId);
        List<AdminTeacherClassroomResponse> rows = list.stream().map(c -> {
            long sCount = jdbc.queryForObject("SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id=?", Long.class, c.getId());
            long bCount = jdbc.queryForObject("SELECT COUNT(*) FROM review_batches WHERE classroom_id=?", Long.class, c.getId());
            return new AdminTeacherClassroomResponse(c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(),
                    c.getJoinCode(), sCount, bCount, c.getCreatedAt());
        }).toList();
        return new AdminTeacherDetailResponse(teacher.getId(), displayName(teacher), teacher.getEmail(), teacher.getCreatedAt(), rows);
    }

    private ClassroomEnrollment linkStudentToClassroom(Classroom c, Student student) {
        Optional<ClassroomEnrollment> existing = enrollments.findByClassroom_IdAndStudent_Id(c.getId(), student.getId());
        if (existing.isPresent()) return existing.get();
        ClassroomEnrollment matched = enrollments.findByClassroomIdWithStudent(c.getId()).stream()
                .filter(e -> e.getStudent() == null && e.getDisplayName().equalsIgnoreCase(student.getNickname()))
                .findFirst().orElse(null);
        if (matched != null) {
            matched.setStudent(student);
            if (matched.getBirthYear() == null) matched.setBirthYear(student.getBirthYear());
            return enrollments.saveAndFlush(matched);
        }
        ClassroomEnrollment created = new ClassroomEnrollment();
        created.setClassroom(c);
        created.setStudent(student);
        created.setDisplayName(student.getNickname());
        created.setBirthYear(student.getBirthYear());
        return enrollments.saveAndFlush(created);
    }

    private Classroom requireOwnedClassroom(long teacherId, long classroomId) {
        return classrooms.findByIdAndTeacher_Id(classroomId, teacherId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học trong tài khoản giáo viên."));
    }

    private EnrollmentDetailResponse toEnrollmentDetail(ClassroomEnrollment e) {
        Student s = e.getStudent();
        User p = s == null ? null : s.getParent();
        return new EnrollmentDetailResponse(
                e.getId(),
                s == null ? null : s.getId(),
                e.getDisplayName(),
                e.getBirthYear(),
                s != null,
                p == null ? null : displayName(p),
                p == null ? null : p.getEmail(),
                e.getParentNameNote(),
                e.getParentPhone(),
                e.getTeacherNote(),
                e.getJoinedAt()
        );
    }

    private InvitationResponse toInvitationResponse(ClassroomInvitation i, Classroom c) {
        return new InvitationResponse(
                i.getId(), c.getId(), c.getName(), c.getSchoolYear(), c.getGradeLevel(),
                displayName(c.getTeacher()), i.getParentEmail(), i.getStatus(), i.getCreatedAt(), i.getRespondedAt()
        );
    }

    private JoinRequestResponse toJoinRequestResponse(ClassroomJoinRequest r, Classroom c) {
        return new JoinRequestResponse(
                r.getId(), c.getId(), c.getName(), displayName(c.getTeacher()),
                r.getParent().getId(), displayName(r.getParent()), r.getParent().getEmail(),
                r.getStudent().getId(), r.getStudent().getNickname(), r.getMessage(),
                r.getStatus(), r.getCreatedAt(), r.getReviewedAt()
        );
    }

    private String displayName(User u) {
        return u.getFullName() == null || u.getFullName().isBlank() ? u.getEmail() : u.getFullName();
    }

    private String trimNull(String s) {
        if (s == null) return null;
        String t = VietnameseText.nfc(s).trim();
        return t.isEmpty() ? null : t;
    }
}
