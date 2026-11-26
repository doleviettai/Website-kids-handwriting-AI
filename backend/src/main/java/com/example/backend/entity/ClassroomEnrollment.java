package com.example.backend.entity;

import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "classroom_enrollments")
@Getter @Setter @NoArgsConstructor
public class ClassroomEnrollment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(name = "birth_year")
    private Short birthYear;

    @Column(name = "parent_name_note", length = 100)
    private String parentNameNote;

    @Column(name = "parent_phone", length = 30)
    private String parentPhone;

    @Column(name = "teacher_note", length = 300)
    private String teacherNote;

    @Column(name = "joined_at", columnDefinition = "datetime")
    private LocalDateTime joinedAt;

    @PrePersist
    private void init() {
        normalize();
        if (joinedAt == null) joinedAt = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @PreUpdate
    private void normalize() {
        displayName = VietnameseText.nfc(displayName);
        if (parentNameNote != null) parentNameNote = VietnameseText.nfc(parentNameNote);
        if (parentPhone != null) parentPhone = VietnameseText.nfc(parentPhone);
        if (teacherNote != null) teacherNote = VietnameseText.nfc(teacherNote);
    }
}
