package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.JwtService;
import com.example.backend.service.AdminContentService;
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

@SpringBootTest(properties = "debug=false") @Transactional
class AdminContentApiTests {
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminContentService content;
    MockMvc mvc;
    String admin;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = "Bearer " + tokens.issue(users.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst().orElseThrow());
    }

    @Test void lessonAndItemCrudPersistsTemplateAndNfc() throws Exception {
        long lessonId = createLesson();
        var template = Map.of("width", 900, "height", 420, "strokes", List.of(List.of(Map.of("x", 20, "y", 40, "t", 1), Map.of("x", 30, "y", 50, "t", 2))));
        var item = item(lessonId, "WORD", "Từ thử " + UUID.randomUUID(), template);
        String created = mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.template.strokes[0][1].x").value(30)).andReturn().getResponse().getContentAsString();
        var saved = json.readTree(created);
        long id = saved.get("id").asLong();
        assertThat(saved.get("textValue").asString()).startsWith("Từ thử");
        mvc.perform(get("/api/lessons/" + lessonId).header("Authorization", admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].template.width").value(900));
        mvc.perform(put("/api/admin/lessons/" + lessonId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", "Bài đã sửa", "gradeLevel", "LOP_1", "sortOrder", 7))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Bài đã sửa"));
        item.put("textValue", "Nội dung mới " + UUID.randomUUID()); item.put("template", null); item.put("difficulty", 3);
        mvc.perform(put("/api/admin/items/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.template").isEmpty()).andExpect(jsonPath("$.difficulty").value(3));
        mvc.perform(delete("/api/admin/items/" + id).header("Authorization", admin)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/lessons/" + lessonId).header("Authorization", admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/lessons/" + lessonId).header("Authorization", admin)).andExpect(status().isNotFound());
    }

    @Test void itemValidationRejectsDuplicateNfcInvalidDigitAndOutOfBoundsTemplates() throws Exception {
        long lesson = createLesson();
        mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "LETTER", "ă", null))))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "DIGIT", "12", null))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "LETTER", "ab", null))))
                .andExpect(status().isBadRequest());
        var badTemplate = Map.of("width", 900, "height", 420, "strokes", List.of(List.of(Map.of("x", 950, "y", 20))));
        mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "WORD", "kiểm tra ngoài khung", badTemplate))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/items").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(item(lesson, "WORD", "kiểm tra mẫu rỗng", Map.of("width", 900, "height", 420, "strokes", List.of())))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/lessons").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", " ", "gradeLevel", "MAU_GIAO", "sortOrder", -1))))
                .andExpect(status().isBadRequest());
    }

    @Test void deletingLessonRemovesAllDependentHistoryAndPreservesOtherLessonsAndProfiles() throws Exception {
        long targetLesson = createLesson();
        long otherLesson = createLesson();
        long targetItem = createWordItem(targetLesson);
        long unusedItem = createWordItem(targetLesson);
        long otherItem = createWordItem(otherLesson);
        User parent = new User();
        parent.setEmail("cascade-" + UUID.randomUUID() + "@example.test"); parent.setPasswordHash("test-only");
        users.saveAndFlush(parent);
        jdbc.update("INSERT INTO students(parent_id,nickname,grade_level) VALUES (?, 'Bé thử xóa', 'MAU_GIAO')", parent.getId());
        long student = jdbc.queryForObject("SELECT id FROM students WHERE parent_id=?", Long.class, parent.getId());
        int errorType = jdbc.queryForObject("SELECT id FROM error_types WHERE code='TOO_SMALL'", Integer.class);
        jdbc.update("INSERT INTO submissions(student_id,item_id,source) VALUES (?,?,'TOUCH'),(?,?,'TOUCH'),(?,?,'TOUCH')",
                student, targetItem, student, targetItem, student, otherItem);
        jdbc.update("INSERT INTO submission_errors(submission_id,error_type_id) SELECT id,? FROM submissions WHERE student_id=?", errorType, student);
        jdbc.update("INSERT INTO student_progress(student_id,item_id,attempts,best_score) VALUES (?,?,2,75),(?,?,1,85)", student,targetItem,student,otherItem);
        String parentAuth = "Bearer " + tokens.issue(parent);
        mvc.perform(delete("/api/admin/lessons/" + targetLesson).header("Authorization", parentAuth)).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE item_id=?", Long.class,targetItem)).isEqualTo(2);
        // The service must use the same database transaction for every delete.
        // Rolling that transaction back restores the entire populated lesson.
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            var savepoint = connection.setSavepoint();
            content.deleteLesson(targetLesson);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM lessons WHERE id=?", Long.class,targetLesson)).isZero();
            connection.rollback(savepoint);
            connection.releaseSavepoint(savepoint);
            return null;
        });
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM lessons WHERE id=?", Long.class,targetLesson)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM writing_items WHERE lesson_id=?", Long.class,targetLesson)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE item_id=?", Long.class,targetItem)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_progress WHERE item_id=?", Long.class,targetItem)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submission_errors se JOIN submissions s ON s.id=se.submission_id WHERE s.item_id=?", Long.class,targetItem)).isEqualTo(2);
        mvc.perform(delete("/api/admin/lessons/" + targetLesson).header("Authorization", admin)).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM lessons WHERE id=?", Long.class,targetLesson)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM writing_items WHERE id IN (?,?)", Long.class,targetItem,unusedItem)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE item_id=?", Long.class,targetItem)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_progress WHERE item_id=?", Long.class,targetItem)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submission_errors se JOIN submissions s ON s.id=se.submission_id WHERE s.student_id=?", Long.class,student)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM lessons WHERE id=?", Long.class,otherLesson)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM writing_items WHERE id=?", Long.class,otherItem)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE item_id=?", Long.class,otherItem)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT attempts FROM student_progress WHERE student_id=? AND item_id=?", Integer.class,student,otherItem)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM students WHERE id=?", Long.class,student)).isEqualTo(1);
        assertThat(users.findById(parent.getId())).isPresent();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM error_types WHERE id=?", Long.class,errorType)).isEqualTo(1);
        mvc.perform(get("/api/lessons/" + targetLesson).header("Authorization", admin)).andExpect(status().isNotFound());
        mvc.perform(get("/api/students/" + student + "/overview").header("Authorization",parentAuth)).andExpect(status().isOk())
                .andExpect(jsonPath("$.submissions").value(1)).andExpect(jsonPath("$.practicedItems").value(1));
        mvc.perform(delete("/api/admin/lessons/" + targetLesson).header("Authorization", admin)).andExpect(status().isNotFound());
    }

    private long createWordItem(long lessonId) throws Exception {
        String body = mvc.perform(post("/api/admin/items").header("Authorization",admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(item(lessonId,"WORD","Từ thử " + UUID.randomUUID(),null))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }

    @Test void errorCrudValidatesCodesAndDuplicateCodes() throws Exception {
        String code = "TEST_" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
        var request = Map.of("code", code, "nameVi", "Khoảng cách", "feedbackTemplateVi", "Bé thử viết đều hơn nhé!");
        String created = mvc.perform(post("/api/admin/error-types").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(post("/api/admin/error-types").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/error-types/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", code, "nameVi", "Tên mới", "feedbackTemplateVi", "Cố gắng của bé rất đáng khen!"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.feedbackTemplateVi").value("Cố gắng của bé rất đáng khen!"));
        mvc.perform(post("/api/admin/error-types").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", "bad-code", "nameVi", "Tên", "feedbackTemplateVi", "Mẫu")))).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/admin/error-types/" + id).header("Authorization", admin)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/error-types/" + id).header("Authorization", admin)).andExpect(status().isNotFound());
    }

    @Test void usedContentAndErrorCodesAreProtectedButTemplateAndFeedbackCanBeEdited() throws Exception {
        User parent = new User(); parent.setEmail("history-" + UUID.randomUUID() + "@example.test"); parent.setPasswordHash("test-only"); users.saveAndFlush(parent);
        jdbc.update("INSERT INTO students(parent_id,nickname,grade_level) VALUES (?, 'Bé thử', 'MAU_GIAO')", parent.getId());
        long child = jdbc.queryForObject("SELECT id FROM students WHERE parent_id=?", Long.class, parent.getId());
        long itemId = jdbc.queryForObject("SELECT id FROM writing_items WHERE item_type='LETTER' AND text_value='a'", Long.class);
        jdbc.update("INSERT INTO submissions(student_id,item_id,source) VALUES (?,?,'TOUCH')", child, itemId);
        long submission = jdbc.queryForObject("SELECT id FROM submissions WHERE student_id=?", Long.class, child);
        int errorId = jdbc.queryForObject("SELECT id FROM error_types WHERE code='TOO_SMALL'", Integer.class);
        jdbc.update("INSERT INTO submission_errors(submission_id,error_type_id) VALUES (?,?)", submission, errorId);
        mvc.perform(delete("/api/admin/items/" + itemId).header("Authorization", admin)).andExpect(status().isConflict());
        Long lesson = jdbc.queryForObject("SELECT lesson_id FROM writing_items WHERE id=?", Long.class, itemId);
        mvc.perform(put("/api/admin/items/" + itemId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "LETTER", "A", null))))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/admin/items/" + itemId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item(lesson, "LETTER", "a", null))))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/admin/error-types/" + errorId).header("Authorization", admin)).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/error-types/" + errorId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", "OTHER_CODE", "nameVi", "Tên", "feedbackTemplateVi", "Góp ý")))).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/error-types/" + errorId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", "TOO_SMALL", "nameVi", "Tên mới", "feedbackTemplateVi", "Góp ý mới")))).andExpect(status().isOk());
    }

    @Test void parentCannotWriteAdminContentOrChooseAnotherOwnerForNewChild() throws Exception {
        User parent = new User(); parent.setEmail("access-" + UUID.randomUUID() + "@example.test"); parent.setPasswordHash("test-only"); users.saveAndFlush(parent);
        String auth = "Bearer " + tokens.issue(parent);
        for (String path : List.of("/api/admin/lessons", "/api/admin/items", "/api/admin/error-types")) {
            mvc.perform(get(path).header("Authorization", auth)).andExpect(status().isForbidden());
            mvc.perform(post(path).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
            mvc.perform(put(path + "/1").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
            mvc.perform(delete(path + "/1").header("Authorization", auth)).andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/students").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("nickname", "Em bé", "birthYear", 2021, "gradeLevel", "MAU_GIAO", "parentId", 999999))))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("SELECT parent_id FROM students WHERE parent_id=?", Long.class, parent.getId())).isEqualTo(parent.getId());
    }

    private long createLesson() throws Exception {
        String body = mvc.perform(post("/api/admin/lessons").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", "Bài kiểm thử " + UUID.randomUUID(), "gradeLevel", "MAU_GIAO", "sortOrder", 99))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
    private Map<String, Object> item(Long lesson, String type, String text, Object template) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("lessonId", lesson); request.put("itemType", type); request.put("textValue", text);
        request.put("difficulty", 1); request.put("sortOrder", 0); request.put("template", template);
        return request;
    }
}
