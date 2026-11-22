package com.example.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
public abstract class CreatedEntity {
    @Column(name = "created_at", columnDefinition = "datetime", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void initializeCreatedAt() {
        if (createdAt == null) createdAt = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }
}
