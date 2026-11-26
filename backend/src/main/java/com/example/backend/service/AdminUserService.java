package com.example.backend.service;

import com.example.backend.dto.AccountDtos.AccountResponse;
import com.example.backend.dto.AccountDtos.AdminCreateUserRequest;
import com.example.backend.dto.AccountDtos.AdminUpdateUserRequest;
import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.UserRepository;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminUserService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public Map<String, Object> list(int page, UserRole role, String q) {
        if (page < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Số trang không hợp lệ.");
        }
        String keyword = q == null ? null : VietnameseText.nfc(q).trim();
        if (keyword != null && keyword.isEmpty()) {
            keyword = null;
        }
        Page<User> result = users.searchUsers(role, keyword, PageRequest.of(page, 20, Sort.by("id")));
        var body = new LinkedHashMap<String, Object>();
        body.put("content", result.getContent().stream().map(AccountResponse::from).toList());
        body.put("totalPages", result.getTotalPages());
        body.put("totalElements", result.getTotalElements());
        body.put("page", page);
        return body;
    }

    @Transactional
    public AccountResponse create(AdminCreateUserRequest request) {
        if (request.role() == UserRole.ADMIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ cho phép tạo tài khoản phụ huynh hoặc giáo viên.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã tồn tại trong hệ thống.");
        }
        validatePassword(request.password());
        User user = new User();
        user.setEmail(email);
        user.setFullName(VietnameseText.nfc(request.fullName()).trim());
        user.setPasswordHash(passwords.encode(request.password()));
        user.setRole(request.role());
        return AccountResponse.from(users.saveAndFlush(user));
    }

    @Transactional
    public AccountResponse update(long adminId, long userId, AdminUpdateUserRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản."));
        if (user.getRole() == UserRole.ADMIN || userId == adminId) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Không thể chỉnh sửa tài khoản quản trị viên tại đây.");
        }
        if (request.role() == UserRole.ADMIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể nâng quyền lên quản trị viên tại đây.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmailAndIdNot(email, userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã được sử dụng bởi tài khoản khác.");
        }
        if (user.getRole() != request.role()) {
            if (user.getRole() == UserRole.PARENT && request.role() == UserRole.TEACHER) {
                Long studentCount = jdbc.queryForObject("SELECT COUNT(*) FROM students WHERE parent_id = ?", Long.class, userId);
                if (studentCount != null && studentCount > 0) {
                    throw new ApiException(HttpStatus.CONFLICT, "Phụ huynh này đang quản lý hồ sơ bé, không thể chuyển sang vai trò giáo viên.");
                }
            } else if (user.getRole() == UserRole.TEACHER && request.role() == UserRole.PARENT) {
                Long classroomCount = jdbc.queryForObject("SELECT COUNT(*) FROM classrooms WHERE teacher_id = ?", Long.class, userId);
                if (classroomCount != null && classroomCount > 0) {
                    throw new ApiException(HttpStatus.CONFLICT, "Giáo viên này đang phụ trách lớp học, không thể chuyển sang vai trò phụ huynh.");
                }
            }
        }
        user.setEmail(email);
        user.setFullName(VietnameseText.nfc(request.fullName()).trim());
        user.setRole(request.role());
        if (request.password() != null && !request.password().isBlank()) {
            validatePassword(request.password());
            user.setPasswordHash(passwords.encode(request.password()));
        }
        return AccountResponse.from(users.saveAndFlush(user));
    }

    @Transactional
    public void delete(long adminId, long userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản."));
        if (user.getRole() == UserRole.ADMIN || userId == adminId) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Không thể xóa tài khoản quản trị viên.");
        }
        entityManager.flush();

        // Remove teacher-owned records (evaluations -> batches -> enrollments -> classrooms).
        jdbc.update("""
                DELETE ev FROM student_evaluations ev
                JOIN review_batches b ON b.id = ev.batch_id
                JOIN classrooms c ON c.id = b.classroom_id
                WHERE c.teacher_id = ?
                """, userId);
        jdbc.update("""
                DELETE b FROM review_batches b
                JOIN classrooms c ON c.id = b.classroom_id
                WHERE c.teacher_id = ?
                """, userId);
        jdbc.update("""
                DELETE ce FROM classroom_enrollments ce
                JOIN classrooms c ON c.id = ce.classroom_id
                WHERE c.teacher_id = ?
                """, userId);
        jdbc.update("DELETE FROM classrooms WHERE teacher_id = ?", userId);

        // Remove parent-owned and user-owned records in FK order.
        jdbc.update("""
                DELETE n FROM notifications n
                JOIN submissions s ON s.id = n.submission_id
                JOIN students st ON st.id = s.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("""
                DELETE n FROM notifications n
                JOIN students st ON st.id = n.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("DELETE FROM notifications WHERE recipient_id = ?", userId);

        jdbc.update("""
                DELETE sc FROM submission_comments sc
                JOIN submissions s ON s.id = sc.submission_id
                JOIN students st ON st.id = s.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("DELETE FROM submission_comments WHERE author_id = ?", userId);

        jdbc.update("""
                DELETE se FROM submission_errors se
                JOIN submissions s ON s.id = se.submission_id
                JOIN students st ON st.id = s.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("""
                DELETE sp FROM student_progress sp
                JOIN students st ON st.id = sp.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("""
                DELETE s FROM submissions s
                JOIN students st ON st.id = s.student_id
                WHERE st.parent_id = ?
                """, userId);

        jdbc.update("""
                DELETE pi FROM practice_plan_items pi
                JOIN practice_plans p ON p.id = pi.plan_id
                JOIN students st ON st.id = p.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("""
                DELETE p FROM practice_plans p
                JOIN students st ON st.id = p.student_id
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("""
                DELETE g FROM student_goals g
                JOIN students st ON st.id = g.student_id
                WHERE st.parent_id = ?
                """, userId);

        jdbc.update("""
                UPDATE classroom_enrollments ce
                JOIN students st ON st.id = ce.student_id
                SET ce.student_id = NULL
                WHERE st.parent_id = ?
                """, userId);
        jdbc.update("DELETE FROM students WHERE parent_id = ?", userId);

        jdbc.update("DELETE FROM users WHERE id = ?", userId);
        entityManager.clear();
    }

    private void validatePassword(String password) {
        if (password.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu cần tối thiểu 8 ký tự.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu tối đa 72 byte.");
        }
    }

    private String normalizeEmail(String email) {
        return VietnameseText.nfc(email).trim().toLowerCase(Locale.ROOT);
    }
}
