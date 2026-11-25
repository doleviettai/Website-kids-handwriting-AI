package com.example.backend.repository;

import com.example.backend.entity.SubmissionError;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionErrorRepository extends JpaRepository<SubmissionError, Long> {
    List<SubmissionError> findBySubmission_Id(Long submissionId);
    List<SubmissionError> findBySubmission_IdAndSubmission_Student_Parent_Id(Long submissionId, Long parentId);
}
