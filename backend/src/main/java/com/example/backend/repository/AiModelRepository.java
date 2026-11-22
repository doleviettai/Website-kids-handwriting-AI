package com.example.backend.repository;

import com.example.backend.entity.AiModel;
import com.example.backend.entity.enums.ModelTask;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiModelRepository extends JpaRepository<AiModel, Integer> {
    List<AiModel> findByTaskAndIsActiveTrueOrderByIdAsc(ModelTask task);
    boolean existsByTaskAndVersion(ModelTask task, String version);
}
