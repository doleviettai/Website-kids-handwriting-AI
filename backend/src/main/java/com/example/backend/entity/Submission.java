package com.example.backend.entity;

import com.example.backend.entity.enums.SubmissionSource;
import com.example.backend.entity.value.StrokePoint;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "submissions", indexes = @Index(name = "ix_submissions_student_item_created",
        columnList = "student_id,item_id,created_at"))
@Getter @Setter @NoArgsConstructor
public class Submission extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private WritingItem item;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id")
    private AiModel model;

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private SubmissionSource source;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "stroke_data", columnDefinition = "json")
    private List<List<StrokePoint>> strokeData;

    @Column(name = "predicted_text", length = 500)
    private String predictedText;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "text_accuracy", precision = 5, scale = 4)
    private BigDecimal textAccuracy;

    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "segments_json", columnDefinition = "json")
    private List<Map<String, Object>> segmentsJson;

    @Column(name = "shape_score")
    private Byte shapeScore;

    @Column(name = "similarity_score")
    private Byte similarityScore;

    @Column(name = "direction_score")
    private Byte directionScore;

    @Column(name = "stroke_order_score")
    private Byte strokeOrderScore;

    @Column(name = "total_score")
    private Byte totalScore;

    private Byte stars;

    @Column(name = "feedback_text", columnDefinition = "text")
    private String feedbackText;

    @PrePersist @PreUpdate
    private void normalizeAndValidateSource() {
        predictedText = VietnameseText.nfc(predictedText);
        feedbackText = VietnameseText.nfc(feedbackText);
        if (source == SubmissionSource.CAMERA && (directionScore != null || strokeOrderScore != null)) {
            throw new IllegalStateException("Bài CAMERA không có điểm hướng nét hoặc thứ tự nét.");
        }
    }
}
