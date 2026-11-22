package com.example.backend.entity;

import com.example.backend.entity.enums.ModelTask;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ai_models", uniqueConstraints = @UniqueConstraint(
        name = "uk_ai_models_task_version", columnNames = {"task", "version"}))
@Getter @Setter @NoArgsConstructor
public class AiModel extends CreatedEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private ModelTask task;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String version;

    @Column(name = "model_path", length = 255)
    private String modelPath;

    @Column(name = "is_active")
    private Boolean isActive = true;
}
