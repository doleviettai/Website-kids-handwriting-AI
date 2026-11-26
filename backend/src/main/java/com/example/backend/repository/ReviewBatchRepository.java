package com.example.backend.repository;

import com.example.backend.entity.ReviewBatch;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewBatchRepository extends JpaRepository<ReviewBatch, Long> {
    List<ReviewBatch> findByClassroom_IdOrderByBatchDateDescIdDesc(Long classroomId);
    Optional<ReviewBatch> findByIdAndClassroom_Teacher_Id(Long id, Long teacherId);
}
