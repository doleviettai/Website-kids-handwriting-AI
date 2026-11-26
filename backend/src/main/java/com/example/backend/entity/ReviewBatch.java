package com.example.backend.entity;

import com.example.backend.entity.enums.Subject;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "review_batches")
@Getter @Setter @NoArgsConstructor
public class ReviewBatch extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @Column(nullable = false, length = 150)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Subject subject = Subject.TIENG_VIET;

    @Column(name = "is_homework", nullable = false)
    private Boolean isHomework = false;

    @Column(name = "batch_date", nullable = false)
    private LocalDate batchDate;

    @Column(length = 500)
    private String notes;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "due_at", columnDefinition = "datetime")
    private LocalDateTime dueAt;

    @Column(name = "required_pages", nullable = false)
    private Byte requiredPages = 1;

    @PrePersist @PreUpdate
    private void normalize() {
        title = VietnameseText.nfc(title);
        if (notes != null) notes = VietnameseText.nfc(notes);
        if (description != null) description = VietnameseText.nfc(description);
    }
}
