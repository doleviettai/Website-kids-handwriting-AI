package com.example.backend.repository;

import com.example.backend.entity.StudentEvaluation;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentEvaluationRepository extends JpaRepository<StudentEvaluation, Long> {
    List<StudentEvaluation> findByBatch_Id(Long batchId);
    Optional<StudentEvaluation> findByBatch_IdAndEnrollment_Id(Long batchId, Long enrollmentId);

    @Query("""
            select ev from StudentEvaluation ev
            join fetch ev.batch b
            join fetch b.classroom c
            join fetch c.teacher
            join fetch ev.enrollment e
            where e.student.id = :studentId and ev.sentToParentAt is not null
            order by ev.sentToParentAt desc, ev.id desc
            """)
    List<StudentEvaluation> findSentReportsForStudent(@Param("studentId") Long studentId);

    @Query("""
            select ev from StudentEvaluation ev
            join fetch ev.batch b
            join fetch b.classroom c
            join fetch c.teacher
            join fetch ev.enrollment e
            left join fetch e.student s
            left join fetch s.parent
            where ev.sentToParentAt is null and ev.scheduledSendAt is not null and ev.scheduledSendAt <= :now
            """)
    List<StudentEvaluation> findDueScheduled(@Param("now") LocalDateTime now);

    @Query("select ev from StudentEvaluation ev where ev.batch.id in :batchIds")
    List<StudentEvaluation> findByBatchIds(@Param("batchIds") Collection<Long> batchIds);
}
