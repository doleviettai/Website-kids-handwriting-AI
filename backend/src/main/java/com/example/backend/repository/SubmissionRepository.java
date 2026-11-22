package com.example.backend.repository;

import com.example.backend.entity.Submission;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    Page<Submission> findByStudent_IdAndStudent_Parent_Id(Long studentId, Long parentId, Pageable pageable);
    Optional<Submission> findByIdAndStudent_Parent_Id(Long id, Long parentId);
}
