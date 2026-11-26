package com.example.backend.controller;

import com.example.backend.dto.AccountDtos.AccountResponse;
import com.example.backend.dto.AccountDtos.AdminCreateUserRequest;
import com.example.backend.dto.AccountDtos.AdminUpdateUserRequest;
import com.example.backend.dto.AccountDtos.RegisterRequest;
import com.example.backend.dto.HomeworkDtos.AdminTeacherDetailResponse;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.repository.*;
import com.example.backend.service.AccountService;
import com.example.backend.service.AdminUserService;
import com.example.backend.service.ClassroomWorkflowService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin") @RequiredArgsConstructor
public class AdminOverviewController {
    private final UserRepository users;
    private final StudentRepository students;
    private final SubmissionRepository submissions;
    private final LessonRepository lessons;
    private final AccountService accounts;
    private final AdminUserService adminUsers;
    private final ClassroomWorkflowService classroomWorkflow;
    private final JdbcTemplate jdbc;

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        var result = new java.util.LinkedHashMap<String, Object>();
        result.put("users", users.count()); result.put("students", students.count());
        result.put("submissions", submissions.count()); result.put("lessons", lessons.count());
        result.put("averageScore", jdbc.queryForObject("SELECT AVG(total_score) FROM submissions", Double.class));
        return result;
    }

    @GetMapping("/users")
    public Map<String, Object> users(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) String q) {
        return adminUsers.list(page, role, q);
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        return adminUsers.create(request);
    }

    @PutMapping("/users/{id}")
    public AccountResponse updateUser(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @Valid @RequestBody AdminUpdateUserRequest request) {
        return adminUsers.update(Long.parseLong(jwt.getSubject()), id, request);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        adminUsers.delete(Long.parseLong(jwt.getSubject()), id);
    }

    @PostMapping("/teachers")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse createTeacher(@Valid @RequestBody RegisterRequest request) {
        return accounts.createTeacher(request);
    }

    @GetMapping("/teachers/{id}/classrooms")
    public AdminTeacherDetailResponse teacherClassrooms(@PathVariable long id) {
        return classroomWorkflow.adminTeacherDetail(id);
    }
}
