package com.example.backend.entity;

import com.example.backend.entity.enums.GradeLevel;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "classrooms")
@Getter @Setter @NoArgsConstructor
public class Classroom extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "school_year", nullable = false, length = 30)
    private String schoolYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "grade_level", nullable = false)
    private GradeLevel gradeLevel;

    @Column(name = "join_code", nullable = false, length = 16, unique = true)
    private String joinCode;

    @PrePersist @PreUpdate
    private void normalize() {
        name = VietnameseText.nfc(name);
        schoolYear = VietnameseText.nfc(schoolYear);
    }
}
