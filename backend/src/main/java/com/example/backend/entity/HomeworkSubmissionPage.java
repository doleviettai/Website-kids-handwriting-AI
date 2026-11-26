package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "homework_submission_pages")
@Getter @Setter @NoArgsConstructor
public class HomeworkSubmissionPage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluation_id", nullable = false)
    private StudentEvaluation evaluation;

    @Column(name = "page_number", nullable = false)
    private Byte pageNumber;

    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "uploaded_at", columnDefinition = "datetime")
    private LocalDateTime uploadedAt;

    @PrePersist
    private void init() {
        if (uploadedAt == null) uploadedAt = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }
}
