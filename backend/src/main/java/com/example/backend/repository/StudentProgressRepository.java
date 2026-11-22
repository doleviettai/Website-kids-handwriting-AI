package com.example.backend.repository;

import com.example.backend.entity.StudentProgress;
import com.example.backend.entity.StudentProgressId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentProgressRepository extends JpaRepository<StudentProgress, StudentProgressId> {
    List<StudentProgress> findByStudent_IdAndStudent_Parent_Id(Long studentId, Long parentId);
    long countByStudent_IdAndIsMasteredTrue(Long studentId);
}
