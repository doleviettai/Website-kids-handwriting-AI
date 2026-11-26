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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "debug=false")
@Transactional
class TeacherApiTests {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;

    MockMvc mvc;
    User admin;
    User parent;
    Student child;
    String adminToken;
    String parentToken;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();
        parent = new User();
        parent.setEmail("parent-tr-" + UUID.randomUUID() + "@example.test");
        parent.setPasswordHash("test-only");
        parent.setFullName("Mẹ Na");
        users.saveAndFlush(parent);

        child = new Student();
        child.setNickname("Bé Na");
        child.setBirthYear((short) 2020);
        child.setParent(parent);
        child.setGradeLevel(GradeLevel.LOP_1);
        students.saveAndFlush(child);

        adminToken = "Bearer " + jwt.issue(admin);
        parentToken = "Bearer " + jwt.issue(parent);
    }

    @Test
    void fullTeacherWorkflowRolesJoinCodeExportAndParentNotification() throws Exception {
        String teacherEmail = "co-lan-" + UUID.randomUUID() + "@example.test";
        String createTeacherBody = json.writeValueAsString(Map.of(
                "email", teacherEmail,
                "password", "CoGiaoNetXinh2026!",
                "fullName", "Cô Lan"
        ));

        // Parent cannot create teacher
        mvc.perform(post("/api/admin/teachers").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(createTeacherBody))
                .andExpect(status().isForbidden());

        // Admin creates teacher
        mvc.perform(post("/api/admin/teachers").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(createTeacherBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("TEACHER"));

        User teacher = users.findByEmail(teacherEmail).orElseThrow();
        String teacherToken = "Bearer " + jwt.issue(teacher);

        // Role boundaries
        mvc.perform(get("/api/teacher/classrooms").header("Authorization", parentToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/overview").header("Authorization", teacherToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/students").header("Authorization", teacherToken)).andExpect(status().isForbidden());

        // Teacher creates classroom
        String clsJson = mvc.perform(post("/api/teacher/classrooms").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Lớp 1A", "schoolYear", "2026-2027", "gradeLevel", "LOP_1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.joinCode").isString())
                .andReturn().getResponse().getContentAsString();
        long classroomId = json.readTree(clsJson).get("id").asLong();
        String joinCode = json.readTree(clsJson).get("joinCode").asText();

        // Adding a student WITHOUT parentEmail is rejected (400)
        mvc.perform(post("/api/teacher/classrooms/" + classroomId + "/enrollments")
                        .header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("displayName", "Bé Không PH", "birthYear", 2020))))
                .andExpect(status().isBadRequest());

        // Adding a student with unknown parentEmail is rejected (400)
        mvc.perform(post("/api/teacher/classrooms/" + classroomId + "/enrollments")
                        .header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "displayName", "Bé Lạ",
                                "birthYear", 2020,
                                "parentEmail", "khong-ton-tai@example.test"))))
                .andExpect(status().isBadRequest());

        // Second parent for Bé Bi (no child yet -> auto-created & linked on import)
        User parent2 = new User();
        parent2.setEmail("parent2-tr-" + UUID.randomUUID() + "@example.test");
        parent2.setPasswordHash("test-only");
        parent2.setFullName("Bố Bi");
        users.saveAndFlush(parent2);

        // Import 2 students with valid parentEmail -> both immediately linked!
        String importBody = json.writeValueAsString(Map.of("students", List.of(
                Map.of("displayName", "Bé Na", "birthYear", 2020, "parentEmail", parent.getEmail()),
                Map.of("displayName", "Bé Bi", "birthYear", 2020, "parentEmail", parent2.getEmail())
        )));
        String importedJson = mvc.perform(post("/api/teacher/classrooms/" + classroomId + "/enrollments/import")
                        .header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content(importBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].linkedParent").value(true))
                .andExpect(jsonPath("$[1].linkedParent").value(true))
                .andReturn().getResponse().getContentAsString();
        long naEnrollmentId = json.readTree(importedJson).get(0).get("id").asLong();

        // Parent joins classroom using joinCode -> idempotent, returns existing Bé Na enrollment
        mvc.perform(post("/api/students/" + child.getId() + "/join-classroom").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.enrollmentId").value(naEnrollmentId))
                .andExpect(jsonPath("$.classroomName").value("Lớp 1A"));

        // Teacher creates a review batch
        String batchJson = mvc.perform(post("/api/teacher/classrooms/" + classroomId + "/batches").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("title", "Tuần 12 - Vở sạch chữ đẹp", "batchDate", LocalDate.now().toString(), "notes", "Kiểm tra giữa kỳ"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long batchId = json.readTree(batchJson).get("id").asLong();

        // Teacher evaluates Bé Na inline
        mvc.perform(put("/api/teacher/batches/" + batchId + "/evaluations/" + naEnrollmentId).header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "rating", "HOAN_THANH_TOT",
                                "teacherComment", "Vở sạch, nét chữ đều và thẳng hàng!",
                                "needsAttention", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value("HOAN_THANH_TOT"));

        // Export CSV (UTF-8 BOM)
        String csv = mvc.perform(get("/api/teacher/batches/" + batchId + "/export.csv").header("Authorization", teacherToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(csv).startsWith("\uFEFF");
        assertThat(csv).contains("Bé Na", "Hoàn thành tốt", "Vở sạch, nét chữ đều và thẳng hàng!");

        // Send reports -> 1 sent (Bé Na), 0 skippedUnlinked, 1 skippedEmpty (Bé Bi not evaluated yet)
        mvc.perform(post("/api/teacher/batches/" + batchId + "/send-reports").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentCount").value(1))
                .andExpect(jsonPath("$.skippedUnlinked").value(0))
                .andExpect(jsonPath("$.skippedEmpty").value(1));

        // Parent sees unread notifications (added to classroom + TEACHER_REPORT) and teacher report
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(2));

        mvc.perform(get("/api/students/" + child.getId() + "/teacher-reports").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].rating").value("HOAN_THANH_TOT"))
                .andExpect(jsonPath("$[0].teacherName").value("Cô Lan"));

        // Another teacher cannot access this classroom
        User otherTeacher = new User();
        otherTeacher.setEmail("co-mai-" + UUID.randomUUID() + "@example.test");
        otherTeacher.setPasswordHash("test-only");
        otherTeacher.setRole(UserRole.TEACHER);
        users.saveAndFlush(otherTeacher);
        String otherTeacherToken = "Bearer " + jwt.issue(otherTeacher);
        mvc.perform(get("/api/teacher/classrooms/" + classroomId).header("Authorization", otherTeacherToken))
                .andExpect(status().isNotFound());

        // Delete classroom cascades cleanly
        mvc.perform(delete("/api/teacher/classrooms/" + classroomId).header("Authorization", teacherToken))
                .andExpect(status().isNoContent());
    }
}
