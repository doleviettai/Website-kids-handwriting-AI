package com.example.backend.entity;

import com.example.backend.entity.enums.GradeLevel;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "students")
@Getter @Setter @NoArgsConstructor
public class Student extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parent_id", nullable = false)
    private User parent;

    @Column(nullable = false, length = 50)
    private String nickname;

    @Column(name = "birth_year")
    private Short birthYear;

    @Enumerated(EnumType.STRING) @Column(name = "grade_level", nullable = false)
    private GradeLevel gradeLevel;

    @PrePersist @PreUpdate
    private void normalize() { nickname = VietnameseText.nfc(nickname); }
}
