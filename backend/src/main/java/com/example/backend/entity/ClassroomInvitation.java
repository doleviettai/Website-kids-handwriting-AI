package com.example.backend.entity;

import com.example.backend.entity.enums.InvitationStatus;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "classroom_invitations")
@Getter @Setter @NoArgsConstructor
public class ClassroomInvitation extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @Column(name = "parent_email", nullable = false, length = 255)
    private String parentEmail;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_by", nullable = false)
    private User invitedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvitationStatus status = InvitationStatus.PENDING;

    @Column(name = "responded_at", columnDefinition = "datetime")
    private LocalDateTime respondedAt;

    @PrePersist @PreUpdate
    private void normalize() {
        if (parentEmail != null) parentEmail = VietnameseText.nfc(parentEmail).trim().toLowerCase(Locale.ROOT);
    }
}
