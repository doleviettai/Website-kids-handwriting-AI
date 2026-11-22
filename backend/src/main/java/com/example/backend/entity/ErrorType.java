package com.example.backend.entity;

import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "error_types", uniqueConstraints = @UniqueConstraint(name = "uk_error_types_code", columnNames = "code"))
@Getter @Setter @NoArgsConstructor
public class ErrorType {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 150)
    private String nameVi;

    @Column(name = "feedback_template_vi", nullable = false, columnDefinition = "text")
    private String feedbackTemplateVi;

    @PrePersist @PreUpdate
    private void normalize() {
        nameVi = VietnameseText.nfc(nameVi);
        feedbackTemplateVi = VietnameseText.nfc(feedbackTemplateVi);
    }
}
