package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.repository.*;
import com.example.backend.service.AiClient;
import com.example.backend.service.JwtService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "debug=false")
@Transactional
class NotificationApiTests {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired LessonRepository lessons;
    @Autowired WritingItemRepository items;
    @Autowired NotificationRepository notifications;
    @Autowired SubmissionCommentRepository comments;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @MockitoBean AiClient ai;

    MockMvc mvc;
    User parent;
    User otherParent;
    User admin;
    Student child;
    WritingItem item;
    String parentToken;
    String otherToken;
    String adminToken;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        parent = new User();
        parent.setEmail("notif-" + UUID.randomUUID() + "@example.test");
        parent.setPasswordHash("test-only");
        users.saveAndFlush(parent);

        otherParent = new User();
        otherParent.setEmail("notif-other-" + UUID.randomUUID() + "@example.test");
        otherParent.setPasswordHash("test-only");
        users.saveAndFlush(otherParent);

        admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();

        child = new Student();
        child.setNickname("Bé Tí");
        child.setParent(parent);
        child.setGradeLevel(GradeLevel.MAU_GIAO);
        students.saveAndFlush(child);

        item = items.findByItemTypeAndTextValue(ItemType.LETTER, "o").orElseThrow();

        parentToken = "Bearer " + jwt.issue(parent);
        otherToken = "Bearer " + jwt.issue(otherParent);
        adminToken = "Bearer " + jwt.issue(admin);
    }

    @Test
    void lowConfidenceCreatesNotificationsAndSupportsReadFlow() throws Exception {
        long adminUnreadBefore = notifications.countByRecipient_IdAndReadAtIsNull(admin.getId());

        when(ai.analyze(any())).thenReturn(new AiResult(
                ModelTask.SINGLE_CHAR, "v1", "model/don/best.keras", "a",
                new BigDecimal("0.35"), BigDecimal.ZERO,
                null, null, null, null, List.of(),
                List.of(new Finding("LOW_CONFIDENCE", null, null)),
                "TEXT_ACCURACY"
        ));

        String created = mvc.perform(post("/api/submissions").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload(item.getId())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long submissionId = json.readTree(created).get("id").asLong();

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        assertThat(notifications.countByRecipient_IdAndReadAtIsNull(admin.getId())).isEqualTo(adminUnreadBefore + 1);

        String listJson = mvc.perform(get("/api/notifications?unreadOnly=true").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].type").value("NEEDS_REVIEW"))
                .andExpect(jsonPath("$.items[0].submissionId").value(submissionId))
                .andReturn().getResponse().getContentAsString();
        long noticeId = json.readTree(listJson).get("items").get(0).get("id").asLong();

        // Other user cannot mark someone else's notification read
        mvc.perform(post("/api/notifications/" + noticeId + "/read").header("Authorization", otherToken))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/notifications/" + noticeId + "/read").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void cleanSubmissionDoesNotNotifyAndAdminCommentNotifiesParent() throws Exception {
        when(ai.analyze(any())).thenReturn(new AiResult(
                ModelTask.SINGLE_CHAR, "v1", "model/don/best.keras", "o",
                new BigDecimal("0.92"), BigDecimal.ONE,
                null, null, null, null, List.of(), List.of(), "TEXT_ACCURACY"
        ));

        String created = mvc.perform(post("/api/submissions").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload(item.getId())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long submissionId = json.readTree(created).get("id").asLong();

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        // Parent cannot post admin comment
        mvc.perform(post("/api/admin/submissions/" + submissionId + "/comments").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Tốt lắm\"}"))
                .andExpect(status().isForbidden());

        // Admin posts comment -> notifies parent
        mvc.perform(post("/api/admin/submissions/" + submissionId + "/comments").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Bé viết tròn nét lắm!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Bé viết tròn nét lắm!"));

        mvc.perform(get("/api/submissions/" + submissionId + "/comments").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mvc.perform(get("/api/submissions/" + submissionId + "/comments").header("Authorization", otherToken))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        mvc.perform(post("/api/notifications/read-all").header("Authorization", parentToken))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", parentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void deleteLessonCascadesCommentsNotificationsAndPlanItems() throws Exception {
        Lesson tempLesson = new Lesson();
        tempLesson.setTitle("Bài tạm cascade");
        tempLesson.setGradeLevel(GradeLevel.MAU_GIAO);
        tempLesson.setSortOrder(99);
        lessons.saveAndFlush(tempLesson);

        WritingItem tempItem = new WritingItem();
        tempItem.setLesson(tempLesson);
        tempItem.setItemType(ItemType.WORD);
        tempItem.setTextValue("tạm-" + UUID.randomUUID().toString().substring(0, 6));
        tempItem.setDifficulty((byte) 1);
        items.saveAndFlush(tempItem);

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        String planBody = json.writeValueAsString(Map.of(
                "title", "Kế hoạch tạm",
                "startDate", today.toString(),
                "endDate", today.toString(),
                "items", List.of(Map.of("itemId", tempItem.getId(), "repetitions", 1))
        ));
        mvc.perform(post("/api/students/" + child.getId() + "/plans").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(planBody))
                .andExpect(status().isCreated());

        when(ai.analyze(any())).thenReturn(new AiResult(
                ModelTask.PARAGRAPH, "v1", "model/word/word_best.keras", "khác",
                new BigDecimal("0.4"), BigDecimal.ZERO,
                null, null, null, null, List.of(),
                List.of(new Finding("WRONG_TEXT", null, null)),
                "TEXT_ACCURACY"
        ));
        String created = mvc.perform(post("/api/submissions").header("Authorization", parentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(payload(tempItem.getId())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long submissionId = json.readTree(created).get("id").asLong();

        mvc.perform(post("/api/admin/submissions/" + submissionId + "/comments").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Cần luyện thêm\"}"))
                .andExpect(status().isCreated());

        mvc.perform(delete("/api/admin/lessons/" + tempLesson.getId()).header("Authorization", adminToken))
                .andExpect(status().isNoContent());

        assertThat(lessons.findById(tempLesson.getId())).isEmpty();
        assertThat(comments.findBySubmissionIdWithAuthor(submissionId)).isEmpty();
    }

    private String payload(long itemId) throws Exception {
        return json.writeValueAsString(Map.of(
                "studentId", child.getId(),
                "itemId", itemId,
                "width", 900,
                "height", 420,
                "strokes", List.of(List.of(Map.of("x", 10, "y", 20, "t", 1000), Map.of("x", 30, "y", 40, "t", 1010))),
                "wordEnds", List.of()
        ));
    }
}
