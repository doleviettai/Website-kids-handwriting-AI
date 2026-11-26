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
import java.time.ZoneId;
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
class PlanningApiTests {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired WritingItemRepository items;
    @Autowired SubmissionRepository submissions;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;

    MockMvc mvc;
    User parent;
    User otherParent;
    User admin;
    Student child;
    WritingItem itemA;
    WritingItem itemB;
    String token;
    String otherToken;
    String adminToken;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        parent = new User();
        parent.setEmail("plan-" + UUID.randomUUID() + "@example.test");
        parent.setPasswordHash("test-only");
        users.saveAndFlush(parent);

        otherParent = new User();
        otherParent.setEmail("other-plan-" + UUID.randomUUID() + "@example.test");
        otherParent.setPasswordHash("test-only");
        users.saveAndFlush(otherParent);

        admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();

        child = new Student();
        child.setNickname("Bé Na");
        child.setParent(parent);
        child.setGradeLevel(GradeLevel.MAU_GIAO);
        students.saveAndFlush(child);

        List<WritingItem> all = items.findAll();
        itemA = all.get(0);
        itemB = all.get(1);

        token = "Bearer " + jwt.issue(parent);
        otherToken = "Bearer " + jwt.issue(otherParent);
        adminToken = "Bearer " + jwt.issue(admin);
    }

    @Test
    void goalCrudValidationAndOwnership() throws Exception {
        mvc.perform(get("/api/students/" + child.getId() + "/goal").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyTarget").isEmpty());

        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"dailyTarget\":0}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"dailyTarget\":31}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"dailyTarget\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyTarget").value(5));

        mvc.perform(get("/api/students/" + child.getId() + "/goal").header("Authorization", otherToken))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/students/" + child.getId() + "/goal").header("Authorization", adminToken))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/students/" + child.getId() + "/goal").header("Authorization", token))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/students/" + child.getId() + "/goal").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyTarget").isEmpty());
    }

    @Test
    void plansCrudTodayMergeAndStudentDeleteCascade() throws Exception {
        LocalDate today = LocalDate.now(VN);
        String invalidRange = json.writeValueAsString(Map.of(
                "title", "Quá dài",
                "startDate", today.toString(),
                "endDate", today.plusDays(31).toString(),
                "items", List.of(Map.of("itemId", itemA.getId(), "repetitions", 2))
        ));
        mvc.perform(post("/api/students/" + child.getId() + "/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(invalidRange))
                .andExpect(status().isBadRequest());

        String plan1Body = json.writeValueAsString(Map.of(
                "title", "Kế hoạch 1",
                "startDate", today.toString(),
                "endDate", today.plusDays(2).toString(),
                "items", List.of(
                        Map.of("itemId", itemA.getId(), "repetitions", 2),
                        Map.of("itemId", itemB.getId(), "repetitions", 1)
                )
        ));
        String created1 = mvc.perform(post("/api/students/" + child.getId() + "/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(plan1Body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        long plan1Id = json.readTree(created1).get("id").asLong();

        // Second overlapping active plan with itemA -> repetitions should merge (2 + 3 = 5)
        String plan2Body = json.writeValueAsString(Map.of(
                "title", "Kế hoạch 2",
                "startDate", today.toString(),
                "endDate", today.toString(),
                "items", List.of(Map.of("itemId", itemA.getId(), "repetitions", 3))
        ));
        mvc.perform(post("/api/students/" + child.getId() + "/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(plan2Body))
                .andExpect(status().isCreated());

        // Inactive future plan should not appear in today
        String futureBody = json.writeValueAsString(Map.of(
                "title", "Tuần sau",
                "startDate", today.plusDays(5).toString(),
                "endDate", today.plusDays(7).toString(),
                "items", List.of(Map.of("itemId", itemB.getId(), "repetitions", 4))
        ));
        mvc.perform(post("/api/students/" + child.getId() + "/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(futureBody))
                .andExpect(status().isCreated());

        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"dailyTarget\":2}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/students/" + child.getId() + "/today").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyTarget").value(2))
                .andExpect(jsonPath("$.doneToday").value(0))
                .andExpect(jsonPath("$.goalReached").value(false))
                .andExpect(jsonPath("$.planItems.length()").value(2))
                .andExpect(jsonPath("$.planItems[0].repetitions").value(5))
                .andExpect(jsonPath("$.planItems[1].repetitions").value(1));

        // Update plan1
        String updated = json.writeValueAsString(Map.of(
                "title", "Kế hoạch 1 sửa",
                "startDate", today.toString(),
                "endDate", today.plusDays(1).toString(),
                "items", List.of(Map.of("itemId", itemB.getId(), "repetitions", 2))
        ));
        mvc.perform(put("/api/students/" + child.getId() + "/plans/" + plan1Id).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(updated))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Kế hoạch 1 sửa"))
                .andExpect(jsonPath("$.items.length()").value(1));

        // Ownership enforced
        mvc.perform(get("/api/students/" + child.getId() + "/plans").header("Authorization", otherToken))
                .andExpect(status().isNotFound());

        // Delete student without history should succeed and cascade goal + plans
        mvc.perform(delete("/api/students/" + child.getId()).header("Authorization", token))
                .andExpect(status().isNoContent());
        assertThat(students.findById(child.getId())).isEmpty();
    }

    @Test
    void todayCountsSubmissionsAndReachesGoal() throws Exception {
        mvc.perform(put("/api/students/" + child.getId() + "/goal").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"dailyTarget\":1}"))
                .andExpect(status().isOk());

        Submission s = new Submission();
        s.setStudent(child);
        s.setItem(itemA);
        s.setSource(SubmissionSource.TOUCH);
        s.setPredictedText(itemA.getTextValue());
        s.setTotalScore((byte) 85);
        submissions.saveAndFlush(s);

        mvc.perform(get("/api/students/" + child.getId() + "/today").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doneToday").value(1))
                .andExpect(jsonPath("$.goalReached").value(true));
    }
}
