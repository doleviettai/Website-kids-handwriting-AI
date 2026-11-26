package com.example.backend.entity;

import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "submission_comments")
@Getter @Setter @NoArgsConstructor
public class SubmissionComment extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 1000)
    private String content;

    @PrePersist @PreUpdate
    private void normalize() {
        content = VietnameseText.nfc(content);
    }
}

