package com.example.backend.entity;

import com.example.backend.entity.enums.EvaluationRating;
import com.example.backend.entity.enums.GradingMode;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "student_evaluations")
@Getter @Setter @NoArgsConstructor
public class StudentEvaluation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private ReviewBatch batch;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    private ClassroomEnrollment enrollment;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating")
    private EvaluationRating rating;

    @Column(precision = 4, scale = 2)
    private BigDecimal score;

    @Enumerated(EnumType.STRING)
    @Column(name = "grading_mode", nullable = false)
    private GradingMode gradingMode = GradingMode.MANUAL;

    @Column(name = "teacher_comment", length = 1000)
    private String teacherComment;

    @Column(name = "needs_attention", nullable = false)
    private Boolean needsAttention = false;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_metrics_json", columnDefinition = "json")
    private String aiMetricsJson;

    @Column(name = "submitted_at", columnDefinition = "datetime")
    private LocalDateTime submittedAt;

    @Column(name = "sent_to_parent_at", columnDefinition = "datetime")
    private LocalDateTime sentToParentAt;

    @Column(name = "scheduled_send_at", columnDefinition = "datetime")
    private LocalDateTime scheduledSendAt;

    @Column(name = "updated_at", columnDefinition = "datetime")
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    private void touch() {
        if (teacherComment != null) teacherComment = VietnameseText.nfc(teacherComment);
        updatedAt = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }
}
