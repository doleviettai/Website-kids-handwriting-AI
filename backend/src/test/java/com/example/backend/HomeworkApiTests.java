package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.backend.entity.Student;
import com.example.backend.entity.User;
import com.example.backend.entity.enums.*;
import com.example.backend.repository.*;
import com.example.backend.service.HomeworkService;
import com.example.backend.service.JwtService;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "debug=false")
@Transactional
class HomeworkApiTests {
    private static final byte[] MINIMAL_PNG = new byte[] {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
    };

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @Autowired HomeworkService homeworkService;

    MockMvc mvc;
    User teacher;
    User parent1;
    User parent2;
    User admin;
    Student child1;
    Student child2;
    String teacherToken;
    String parent1Token;
    String parent2Token;
    String adminToken;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        teacher = createUser("teacher-" + UUID.randomUUID() + "@example.test", "Cô Lan", UserRole.TEACHER);
        parent1 = createUser("parent1-" + UUID.randomUUID() + "@example.test", "Mẹ Na", UserRole.PARENT);
        parent2 = createUser("parent2-" + UUID.randomUUID() + "@example.test", "Bố Bi", UserRole.PARENT);
        admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();

        child1 = createStudent(parent1, "Bé Na", GradeLevel.LOP_2);
        child2 = createStudent(parent2, "Bé Bi", GradeLevel.LOP_5);

        teacherToken = "Bearer " + jwt.issue(teacher);
        parent1Token = "Bearer " + jwt.issue(parent1);
        parent2Token = "Bearer " + jwt.issue(parent2);
        adminToken = "Bearer " + jwt.issue(admin);
    }

    @Test
    void classroomInvitationsJoinRequestsAdminViewAndHomeworkScheduledPublishWorkEndToEnd() throws Exception {
        // 1. Teacher creates Grade 2 classroom (MAU_GIAO..LOP_5 supported)
        String classJson = mvc.perform(post("/api/teacher/classrooms").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Lớp 2A",
                                "schoolYear", "2026-2027",
                                "gradeLevel", "LOP_2"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gradeLevel").value("LOP_2"))
                .andReturn().getResponse().getContentAsString();
        long classId = json.readTree(classJson).get("id").asLong();

        // 2. Admin can inspect teacher profile & classrooms
        mvc.perform(get("/api/admin/teachers/" + teacher.getId() + "/classrooms").header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.teacherId").value(teacher.getId()))
                .andExpect(jsonPath("$.classrooms.length()").value(1))
                .andExpect(jsonPath("$.classrooms[0].name").value("Lớp 2A"));

        // 3. Teacher invites parent1 -> parent1 accepts with child1
        String invJson = mvc.perform(post("/api/teacher/classrooms/" + classId + "/invitations").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("parentEmail", parent1.getEmail()))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long invId = json.readTree(invJson).get("id").asLong();

        mvc.perform(get("/api/parent/invitations").header("Authorization", parent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        String acceptedJson = mvc.perform(post("/api/parent/invitations/" + invId + "/respond").header("Authorization", parent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("accept", true, "studentId", child1.getId()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long enroll1Id = json.readTree(acceptedJson).get("enrollmentId").asLong();

        // 4. Parent2 searches classrooms and requests to join -> Teacher approves
        mvc.perform(get("/api/parent/classrooms/search?q=2A&grade=LOP_2").header("Authorization", parent2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(classId));

        String reqJson = mvc.perform(post("/api/parent/classrooms/" + classId + "/join-requests").header("Authorization", parent2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("studentId", child2.getId(), "message", "Xin cho Bi vào lớp"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long joinReqId = json.readTree(reqJson).get("id").asLong();

        mvc.perform(post("/api/teacher/classrooms/" + classId + "/join-requests/" + joinReqId + "/review").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("approve", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // 5. Teacher updates classroom-scoped parent contact/notes on enrollment
        mvc.perform(put("/api/teacher/classrooms/" + classId + "/enrollments/" + enroll1Id).header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "displayName", "Bé Na (Tổ 1)",
                                "birthYear", 2019,
                                "parentNameNote", "Chị Hoa",
                                "parentPhone", "0909123456",
                                "teacherNote", "Chăm ngoan"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentPhone").value("0909123456"))
                .andExpect(jsonPath("$.linkedParentEmail").value(parent1.getEmail()));

        // 6. Teacher assigns TOAN homework
        LocalDateTime due = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
        String hwJson = mvc.perform(post("/api/teacher/classrooms/" + classId + "/homework").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "title", "Bài tập đặt tính cộng trừ",
                                "subject", "TOAN",
                                "description", "Làm bài 1, 2 trang 14 vở bài tập Toán và chụp 2 trang nộp cô.",
                                "dueAt", due.toString(),
                                "requiredPages", 2))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long batchId = json.readTree(hwJson).get("id").asLong();

        // 7. Parent1 uploads 2 pages of homework photos
        MockMultipartFile f1 = new MockMultipartFile("files", "trang1.png", "image/png", MINIMAL_PNG);
        MockMultipartFile f2 = new MockMultipartFile("files", "trang2.png", "image/png", MINIMAL_PNG);
        String pagesJson = mvc.perform(multipart("/api/parent/homework/" + batchId + "/enrollments/" + enroll1Id + "/pages")
                        .file(f1).file(f2).header("Authorization", parent1Token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        long page1Id = json.readTree(pagesJson).get(0).get("id").asLong();

        // Authorized image access: teacher & parent1 OK, parent2 404
        mvc.perform(get("/api/homework/pages/" + page1Id + "/image").header("Authorization", teacherToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/homework/pages/" + page1Id + "/image").header("Authorization", parent2Token))
                .andExpect(status().isNotFound());

        // 8. Teacher grades child1 with scheduledSendAt in the past (simulating due scheduled publish)
        LocalDateTime pastSchedule = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(1);
        mvc.perform(put("/api/teacher/homework/" + batchId + "/enrollments/" + enroll1Id + "/grade").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "score", 9.5,
                                "rating", "HOAN_THANH_TOT",
                                "teacherComment", "Trình bày sạch đẹp, tính đúng hết!",
                                "needsAttention", false,
                                "gradingMode", "MANUAL",
                                "sendNow", false,
                                "scheduledSendAt", pastSchedule.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(9.5))
                .andExpect(jsonPath("$.sentToParentAt").isEmpty());

        // Before scheduler runs, parent1 must NOT see unpublished score
        mvc.perform(get("/api/parent/students/" + child1.getId() + "/homework?subject=TOAN").header("Authorization", parent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].gradedPublished").value(false))
                .andExpect(jsonPath("$[0].score").isEmpty());

        // Run scheduler -> publishes due scheduled grade and notifies parent1
        int published = homeworkService.publishDueScheduled();
        assertThat(published).isGreaterThanOrEqualTo(1);

        mvc.perform(get("/api/parent/students/" + child1.getId() + "/homework?subject=TOAN").header("Authorization", parent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].gradedPublished").value(true))
                .andExpect(jsonPath("$[0].score").value(9.5));

        // 9. Teacher checks gradebook
        mvc.perform(get("/api/teacher/classrooms/" + classId + "/gradebook?subject=TOAN").header("Authorization", teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batches.length()").value(1))
                .andExpect(jsonPath("$.students.length()").value(2));

        // Cleanup uploaded temp page
        mvc.perform(delete("/api/teacher/classrooms/" + classId).header("Authorization", teacherToken))
                .andExpect(status().isNoContent());
    }

    private User createUser(String email, String name, UserRole role) {
        User u = new User();
        u.setEmail(email);
        u.setFullName(name);
        u.setPasswordHash("test-only");
        u.setRole(role);
        return users.saveAndFlush(u);
    }

    private Student createStudent(User parent, String nickname, GradeLevel grade) {
        Student s = new Student();
        s.setParent(parent);
        s.setNickname(nickname);
        s.setGradeLevel(grade);
        return students.saveAndFlush(s);
    }
}
