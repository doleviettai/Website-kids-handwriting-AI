package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.repository.*;
import com.example.backend.service.JwtService;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "debug=false")
@Transactional
class AdminUserApiTests {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    User admin;
    String adminToken;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();
        adminToken = "Bearer " + jwt.issue(admin);
    }

    @Test
    void adminCrudFilterRoleSwitchAndAdminProtection() throws Exception {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        String parentEmail = "parent-crud-" + tag + "@example.test";
        String teacherEmail = "teacher-crud-" + tag + "@example.test";

        // Reject creating ADMIN
        mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "bad-admin-" + tag + "@example.test",
                                "password", "MatKhau1234!",
                                "fullName", "Fake Admin",
                                "role", "ADMIN"))))
                .andExpect(status().isBadRequest());

        // Create PARENT
        String createdParentJson = mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", parentEmail,
                                "password", "MatKhauPhuHuynh1!",
                                "fullName", "Phụ huynh " + tag,
                                "role", "PARENT"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("PARENT"))
                .andReturn().getResponse().getContentAsString();
        long parentId = json.readTree(createdParentJson).get("id").asLong();

        // Duplicate email rejected
        mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", parentEmail,
                                "password", "MatKhauKhac123!",
                                "fullName", "Trùng email",
                                "role", "TEACHER"))))
                .andExpect(status().isConflict());

        // Create TEACHER
        String createdTeacherJson = mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", teacherEmail,
                                "password", "MatKhauGiaoVien1!",
                                "fullName", "Cô Giáo " + tag,
                                "role", "TEACHER"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("TEACHER"))
                .andReturn().getResponse().getContentAsString();
        long teacherId = json.readTree(createdTeacherJson).get("id").asLong();

        // Non-admin blocked
        String parentToken = "Bearer " + jwt.issue(users.findById(parentId).orElseThrow());
        String teacherToken = "Bearer " + jwt.issue(users.findById(teacherId).orElseThrow());
        mvc.perform(get("/api/admin/users").header("Authorization", parentToken)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/users/" + parentId).header("Authorization", teacherToken)).andExpect(status().isForbidden());

        // Filter by role and search query
        mvc.perform(get("/api/admin/users").header("Authorization", adminToken)
                        .param("role", "TEACHER")
                        .param("q", tag))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].email").value(teacherEmail));

        // Update teacher name, password, and switch role TEACHER -> PARENT (no classrooms yet)
        String updatedEmail = "teacher-updated-" + tag + "@example.test";
        mvc.perform(put("/api/admin/users/" + teacherId).header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", updatedEmail,
                                "fullName", "Đã Đổi Tên " + tag,
                                "role", "PARENT",
                                "password", "MatKhauMoi2026!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(updatedEmail))
                .andExpect(jsonPath("$.role").value("PARENT"));

        // Verify login works with the new password
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", updatedEmail,
                                "password", "MatKhauMoi2026!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("PARENT"));

        // Protect ADMIN from edit, promotion, and deletion
        mvc.perform(put("/api/admin/users/" + admin.getId()).header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", admin.getEmail(),
                                "fullName", "Hack Admin",
                                "role", "PARENT"))))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/users/" + parentId).header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", parentEmail,
                                "fullName", "Try Promote",
                                "role", "ADMIN"))))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/admin/users/" + admin.getId()).header("Authorization", adminToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void roleSwitchBlockedWhenDataExistsAndCascadeDeleteCleansUp() throws Exception {
        String tag = UUID.randomUUID().toString().substring(0, 8);

        // Create parent and teacher via admin API
        long parentId = json.readTree(
                mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(Map.of(
                                        "email", "p-del-" + tag + "@example.test",
                                        "password", "MatKhauDel123!",
                                        "fullName", "Phụ huynh xóa",
                                        "role", "PARENT"))))
                        .andExpect(status().isCreated())
                        .andReturn().getResponse().getContentAsString()).get("id").asLong();

        long teacherId = json.readTree(
                mvc.perform(post("/api/admin/users").header("Authorization", adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(Map.of(
                                        "email", "t-del-" + tag + "@example.test",
                                        "password", "MatKhauDel123!",
                                        "fullName", "Giáo viên xóa",
                                        "role", "TEACHER"))))
                        .andExpect(status().isCreated())
                        .andReturn().getResponse().getContentAsString()).get("id").asLong();

        User parent = users.findById(parentId).orElseThrow();
        User teacher = users.findById(teacherId).orElseThrow();
        String parentToken = "Bearer " + jwt.issue(parent);
        String teacherToken = "Bearer " + jwt.issue(teacher);

        // Parent creates a child + goal
        Student child = new Student();
        child.setNickname("Bé Tí " + tag);
        child.setBirthYear((short) 2020);
        child.setParent(parent);
        child.setGradeLevel(GradeLevel.LOP_1);
        students.saveAndFlush(child);

        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("dailyTarget", 5))))
                .andExpect(status().isOk());

        // Teacher creates classroom, imports Bé Tí, creates batch & evaluation, sends report
        String clsJson = mvc.perform(post("/api/teacher/classrooms").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Lớp 1B", "schoolYear", "2026-2027", "gradeLevel", "LOP_1"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long classroomId = json.readTree(clsJson).get("id").asLong();
        String joinCode = json.readTree(clsJson).get("joinCode").asText();

        mvc.perform(post("/api/students/" + child.getId() + "/join-classroom").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isCreated());

        long batchId = json.readTree(
                mvc.perform(post("/api/teacher/classrooms/" + classroomId + "/batches").header("Authorization", teacherToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(Map.of("title", "Tuần 1", "batchDate", LocalDate.now().toString()))))
                        .andExpect(status().isCreated())
                        .andReturn().getResponse().getContentAsString()).get("id").asLong();

        // Role switch blocked while data exists
        mvc.perform(put("/api/admin/users/" + parentId).header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", parent.getEmail(),
                                "fullName", "Đổi sang GV",
                                "role", "TEACHER"))))
                .andExpect(status().isConflict());

        mvc.perform(put("/api/admin/users/" + teacherId).header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", teacher.getEmail(),
                                "fullName", "Đổi sang PH",
                                "role", "PARENT"))))
                .andExpect(status().isConflict());

        // Cascade delete PARENT -> child & goal removed, enrollment unlinked (student_id = NULL)
        mvc.perform(delete("/api/admin/users/" + parentId).header("Authorization", adminToken))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Long.class, parentId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM students WHERE id = ?", Long.class, child.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_goals WHERE student_id = ?", Long.class, child.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id = ? AND student_id IS NULL", Long.class, classroomId)).isEqualTo(1L);

        // Cascade delete TEACHER -> classroom, batch, enrollments, evaluations removed
        mvc.perform(delete("/api/admin/users/" + teacherId).header("Authorization", adminToken))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Long.class, teacherId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM classrooms WHERE id = ?", Long.class, classroomId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM review_batches WHERE id = ?", Long.class, batchId)).isZero();
    }
}
