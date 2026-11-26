package com.example.backend.entity;

import com.example.backend.entity.enums.JoinRequestStatus;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "classroom_join_requests")
@Getter @Setter @NoArgsConstructor
public class ClassroomJoinRequest extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parent_id", nullable = false)
    private User parent;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(length = 300)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JoinRequestStatus status = JoinRequestStatus.PENDING;

    @Column(name = "reviewed_at", columnDefinition = "datetime")
    private LocalDateTime reviewedAt;

    @PrePersist @PreUpdate
    private void normalize() {
        if (message != null) message = VietnameseText.nfc(message).trim();
    }
}
