package com.example.backend.entity;

import com.example.backend.entity.enums.UserRole;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import java.util.Locale;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
@Getter @Setter @NoArgsConstructor
public class User extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private UserRole role = UserRole.PARENT;

    @PrePersist @PreUpdate
    private void normalize() {
        if (email != null) email = VietnameseText.nfc(email).trim().toLowerCase(Locale.ROOT);
        fullName = VietnameseText.nfc(fullName);
    }
}
