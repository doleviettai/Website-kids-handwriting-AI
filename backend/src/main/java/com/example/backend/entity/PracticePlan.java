package com.example.backend.entity;

import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "practice_plans")
@Getter @Setter @NoArgsConstructor
public class PracticePlan extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @PrePersist @PreUpdate
    private void normalize() {
        title = VietnameseText.nfc(title);
    }
}

