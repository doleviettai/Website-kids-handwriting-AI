package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.repository.UserRepository;
import com.example.backend.repository.LessonRepository;
import com.example.backend.repository.WritingItemRepository;
import com.example.backend.service.JwtService;
import java.util.Map;
import java.util.UUID;
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

@SpringBootTest(properties = {"debug=false"})
@Transactional
class FamilyApiTests {
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired LessonRepository lessons;
    @Autowired WritingItemRepository items;
    @Autowired JwtService tokens;
    MockMvc mvc;

    @BeforeEach
    void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); }

    @Test
    void registrationLoginAndLogoutWorkWithRealDatabase() throws Exception {
        String email = "family-test-" + UUID.randomUUID() + "@example.test";
        String token = register(email);
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("PARENT")).andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "test-password-2026", "fullName", "Ba mẹ"))))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "incorrect-password"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email.toUpperCase(), "password", "test-password-2026"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isString());
        mvc.perform(post("/api/auth/logout").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token))).andExpect(status().isUnauthorized());
    }

    @Test
    void parentCanManageOwnProfilesButCannotReadOrChangeAnotherFamily() throws Exception {
        String first = register("parent-a-" + UUID.randomUUID() + "@example.test");
        String second = register("parent-b-" + UUID.randomUUID() + "@example.test");
        String created = mvc.perform(post("/api/students").header("Authorization", bearer(first))
                .contentType(MediaType.APPLICATION_JSON).content(student("Bông", "MAU_GIAO")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.nickname").value("Bông"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(get("/api/students").header("Authorization", bearer(second)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/students/" + id).header("Authorization", bearer(second))
                .contentType(MediaType.APPLICATION_JSON).content(student("Đổi tên", "LOP_1"))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/students/" + id).header("Authorization", bearer(second))).andExpect(status().isNotFound());
        mvc.perform(get("/api/students/" + id + "/overview").header("Authorization", bearer(second))).andExpect(status().isNotFound());
        mvc.perform(get("/api/students/" + id + "/submissions").header("Authorization", bearer(second))).andExpect(status().isNotFound());
        mvc.perform(put("/api/students/" + id).header("Authorization", bearer(first))
                .contentType(MediaType.APPLICATION_JSON).content(student("Sóc", "LOP_1")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("Sóc"));
        mvc.perform(get("/api/students/" + id + "/overview").header("Authorization", bearer(first)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.submissions").value(0)).andExpect(jsonPath("$.averageScore").isEmpty());
        mvc.perform(delete("/api/students/" + id).header("Authorization", bearer(first))).andExpect(status().isNoContent());
    }

    @Test
    void lessonsReadDatabaseAndAdminRoutesEnforceRole() throws Exception {
        String parent = register("content-test-" + UUID.randomUUID() + "@example.test");
        mvc.perform(get("/api/lessons")).andExpect(status().isUnauthorized());
        String body = mvc.perform(get("/api/lessons").header("Authorization", bearer(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var rows = json.readTree(body);
        assertThat((long) rows.size()).isEqualTo(lessons.count());
        int total = 0;
        for (var row : rows) total += row.get("items").size();
        assertThat((long) total).isEqualTo(items.findAll().stream().filter(item -> item.getLesson() != null).count());
        mvc.perform(get("/api/admin/overview").header("Authorization", bearer(parent))).andExpect(status().isForbidden());
        User admin = users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow();
        String adminToken = tokens.issue(admin);
        mvc.perform(get("/api/admin/overview").header("Authorization", bearer(adminToken))).andExpect(status().isOk()).andExpect(jsonPath("$.lessons").value(lessons.count()));
        mvc.perform(get("/api/admin/users").header("Authorization", bearer(adminToken))).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());
    }

    @Test
    void invalidProfilesAndForgedTokensAreRejected() throws Exception {
        String token = register("validation-test-" + UUID.randomUUID() + "@example.test");
        mvc.perform(post("/api/students").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(student("   ", "MAU_GIAO"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/students").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(student("Bé", "INVALID"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students").header("Authorization", bearer("invalid.token.signature"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/users").header("Authorization", bearer(token))).andExpect(status().isForbidden());
    }

    private String register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "test-password-2026", "fullName", "Ba mẹ kiểm thử"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asString();
    }
    private String student(String name, String grade) throws Exception {
        return json.writeValueAsString(Map.of("nickname", name, "birthYear", 2021, "gradeLevel", grade));
    }
    private String bearer(String token) { return "Bearer " + token; }
}
