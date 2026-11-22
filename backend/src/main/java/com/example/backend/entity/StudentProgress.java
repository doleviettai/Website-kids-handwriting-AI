package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "student_progress")
@Getter @Setter @NoArgsConstructor
public class StudentProgress {
    @EmbeddedId
    private StudentProgressId id = new StudentProgressId();

    @MapsId("studentId") @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @MapsId("itemId") @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private WritingItem item;

    private Integer attempts = 0;

    @Column(name = "best_score")
    private Byte bestScore;

    @Column(name = "last_score")
    private Byte lastScore;

    @Column(name = "is_mastered")
    private Boolean isMastered = false;

    @Column(name = "last_attempt_at", columnDefinition = "datetime")
    private LocalDateTime lastAttemptAt;
}
