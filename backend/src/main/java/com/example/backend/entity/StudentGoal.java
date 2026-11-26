package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "student_goals")
@Getter @Setter @NoArgsConstructor
public class StudentGoal {
    @Id
    @Column(name = "student_id")
    private Long studentId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "daily_target", nullable = false)
    private Byte dailyTarget;

    @Column(name = "updated_at", columnDefinition = "datetime")
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    private void touch() {
        updatedAt = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }
}