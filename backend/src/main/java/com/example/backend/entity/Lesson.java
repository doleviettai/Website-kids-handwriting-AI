package com.example.backend.entity;

import com.example.backend.entity.enums.GradeLevel;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "lessons")
@Getter @Setter @NoArgsConstructor
public class Lesson {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING) @Column(name = "grade_level", nullable = false)
    private GradeLevel gradeLevel;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @PrePersist @PreUpdate
    private void normalize() { title = VietnameseText.nfc(title); }
}
