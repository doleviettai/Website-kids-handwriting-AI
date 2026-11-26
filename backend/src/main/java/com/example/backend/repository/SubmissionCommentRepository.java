package com.example.backend.repository;

import com.example.backend.entity.SubmissionComment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubmissionCommentRepository extends JpaRepository<SubmissionComment, Long> {
    @Query("select c from SubmissionComment c join fetch c.author where c.submission.id = :submissionId order by c.createdAt asc, c.id asc")
    List<SubmissionComment> findBySubmissionIdWithAuthor(@Param("submissionId") Long submissionId);
}
