package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.entity.value.StrokePoint;
import com.example.backend.entity.value.WritingTemplate;
import com.example.backend.repository.*;
import com.example.backend.service.DatabaseHealthService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/** Real MySQL integration tests. Test rows are rolled back after each test. */
@SpringBootTest(properties = {"debug=false", "logging.level.org.hibernate.engine.jdbc.spi.SqlExceptionHelper=OFF"})
@Transactional
class BackendApplicationTests {
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired LessonRepository lessons;
    @Autowired WritingItemRepository items;
    @Autowired AiModelRepository models;
    @Autowired ErrorTypeRepository errors;
    @Autowired SubmissionRepository submissions;
    @Autowired SubmissionErrorRepository submissionErrors;
    @Autowired StudentProgressRepository progress;
    @Autowired DatabaseHealthService health;
    @Autowired PasswordEncoder encoder;
    @Autowired Environment environment;
    @Autowired Flyway flyway;
    @Autowired EntityManager entityManager;

    @Test
    void migrationsSeedVietnameseContentAndBCryptAdminWithoutRunningModels() {
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).hasSize(3);
        // Lessons and items are editable, including deletion with their history.
        // The health endpoint must reflect current data, not the original seed counts.
        assertThat(health.check().learningContent().get("lessons")).isEqualTo(lessons.count());
        assertThat(health.check().learningContent().get("writingItems")).isEqualTo(items.count());
        assertThat(errors.count()).isEqualTo(11);
        assertThat(models.count()).isEqualTo(3);
        for (ModelTask task : ModelTask.values()) {
            assertThat(models.findByTaskAndIsActiveTrueOrderByIdAsc(task)).hasSize(1);
        }
        assertThat(models.findAll()).allMatch(model -> model.getModelPath() != null);
        User admin = users.findByEmail(environment.getRequiredProperty("app.bootstrap.admin.email")).orElseThrow();
        assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(encoder.matches(environment.getRequiredProperty("app.bootstrap.admin.password"), admin.getPasswordHash())).isTrue();
        assertThat(health.check().status()).isEqualTo("UP");
        assertThat(health.check().database()).isEqualTo("kids_handwriting");
        assertThat(health.check().aiEnabled()).isTrue();
    }

    @Test
    void accentSensitiveUniqueIndexKeepsVietnameseLettersDistinct() {
        var ids = List.of("a", "ă", "â", "o", "ô", "ơ").stream()
                .map(text -> testItem(ItemType.LETTER, text).getId()).toList();
        assertThat(ids).doesNotHaveDuplicates();
        // Exercise JSON mapping with a rollback-only fixture rather than assuming
        // the administrator has kept an original seed item/template unchanged.
        var example = testItem(ItemType.WORD, "Mẫu kiểm thử " + UUID.randomUUID());
        example.setTemplateJson(new WritingTemplate(900,420,List.of(List.of(new StrokePoint(10,20,null)))));
        Long exampleId = items.saveAndFlush(example).getId();
        entityManager.clear();
        var template = items.findById(exampleId).orElseThrow().getTemplateJson();
        assertThat(template.width()).isEqualTo(900);
        assertThat(template.strokes().getFirst()).hasSize(1);
    }

    @Test
    void writingItemsAreNormalizedToNfcBeforeDatabaseSave() {
        WritingItem item = new WritingItem();
        item.setItemType(ItemType.WORD);
        String expected = "bé kiểm thử " + UUID.randomUUID();
        item.setTextValue(Normalizer.normalize(expected, Normalizer.Form.NFD));
        item.setTemplateJson(new WritingTemplate(900, 420, List.of(List.of(new StrokePoint(10, 20, null)))));
        Long id = items.saveAndFlush(item).getId();
        entityManager.clear();
        WritingItem restored = items.findById(id).orElseThrow();
        assertThat(restored.getTextValue()).isEqualTo(expected);
        assertThat(restored.getTemplateJson().strokes().getFirst().getFirst().x()).isEqualTo(10);
    }

    @Test
    void duplicateItemTypeAndTextIsRejectedByMySql() {
        testItem(ItemType.LETTER, "ă");
        WritingItem duplicate = new WritingItem();
        duplicate.setItemType(ItemType.LETTER);
        duplicate.setTextValue("ă");
        assertThatThrownBy(() -> items.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void jsonStrokesAndSegmentsRoundTripAndOwnershipQueriesExcludeOtherParent() {
        User parent = parent();
        User other = parent();
        Student child = child(parent);
        WritingItem item = testItem(ItemType.LETTER, "a");
        Submission submission = new Submission();
        submission.setStudent(child);
        submission.setItem(item);
        submission.setSource(SubmissionSource.TOUCH);
        submission.setStrokeData(List.of(List.of(new StrokePoint(10, 20, 1000L), new StrokePoint(20, 30, 1010L))));
        submission.setSegmentsJson(List.of(Map.of("index", 0, "expected", "a", "predicted", "a", "bbox", List.of(10, 20, 30, 40))));
        submission.setConfidence(new BigDecimal("0.9750"));
        Long id = submissions.saveAndFlush(submission).getId();
        SubmissionError error = new SubmissionError();
        error.setSubmission(submission);
        error.setErrorType(errors.findByCode("TOO_SMALL").orElseThrow());
        submissionErrors.saveAndFlush(error);
        entityManager.clear();
        Submission restored = submissions.findByIdAndStudent_Parent_Id(id, parent.getId()).orElseThrow();
        assertThat(restored.getStrokeData().getFirst().getLast().t()).isEqualTo(1010L);
        assertThat(restored.getSegmentsJson().getFirst().get("expected")).isEqualTo("a");
        assertThat(restored.getConfidence()).isEqualByComparingTo("0.9750");
        assertThat(restored.getTotalScore()).isNull();
        assertThat(submissions.findByIdAndStudent_Parent_Id(id, other.getId())).isEmpty();
        assertThat(students.findByIdAndParent_Id(child.getId(), other.getId())).isEmpty();
        assertThat(submissions.findByStudent_IdAndStudent_Parent_Id(child.getId(), other.getId(), PageRequest.of(0, 10))).isEmpty();
        assertThat(submissionErrors.findBySubmission_IdAndSubmission_Student_Parent_Id(id, other.getId())).isEmpty();
    }

    @Test
    void compositeProgressKeyCanBePersistedAndRead() {
        Student child = child(parent());
        WritingItem item = testItem(ItemType.DIGIT, "1");
        StudentProgress record = new StudentProgress();
        record.setStudent(child);
        record.setItem(item);
        record.setAttempts(3);
        record.setBestScore((byte) 85);
        record.setLastScore((byte) 82);
        record.setIsMastered(true);
        progress.saveAndFlush(record);
        entityManager.clear();
        StudentProgress restored = progress.findById(new StudentProgressId(child.getId(), item.getId())).orElseThrow();
        assertThat(restored.getAttempts()).isEqualTo(3);
        assertThat(restored.getBestScore()).isEqualTo((byte) 85);
        assertThat(progress.countByStudent_IdAndIsMasteredTrue(child.getId())).isEqualTo(1);
    }

    @Test
    void cameraSubmissionCannotPersistDirectionOrStrokeOrderScore() {
        Submission submission = new Submission();
        submission.setStudent(child(parent()));
        submission.setItem(testItem(ItemType.LETTER, "o"));
        submission.setSource(SubmissionSource.CAMERA);
        submission.setDirectionScore((byte) 90);
        assertThatThrownBy(() -> submissions.saveAndFlush(submission))
                .hasRootCauseInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CAMERA");
    }

    private WritingItem testItem(ItemType type, String text) {
        return items.findByItemTypeAndTextValue(type,text).orElseGet(() -> {
            WritingItem fixture = new WritingItem(); fixture.setItemType(type); fixture.setTextValue(text);
            return items.saveAndFlush(fixture);
        });
    }

    private User parent() {
        User parent = new User();
        parent.setEmail("integration-" + UUID.randomUUID() + "@example.test");
        parent.setPasswordHash(encoder.encode("integration-test-only"));
        return users.saveAndFlush(parent);
    }

    private Student child(User parent) {
        Student child = new Student();
        child.setParent(parent);
        child.setNickname("Bé kiểm thử");
        child.setBirthYear((short) 2021);
        child.setGradeLevel(GradeLevel.MAU_GIAO);
        return students.saveAndFlush(child);
    }
}
