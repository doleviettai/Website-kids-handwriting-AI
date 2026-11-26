package com.example.backend.repository;

import com.example.backend.entity.HomeworkSubmissionPage;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HomeworkSubmissionPageRepository extends JpaRepository<HomeworkSubmissionPage, Long> {
    List<HomeworkSubmissionPage> findByEvaluation_IdOrderByPageNumberAscIdAsc(Long evaluationId);

    @Query("select p from HomeworkSubmissionPage p where p.evaluation.id in :evalIds order by p.evaluation.id asc, p.pageNumber asc, p.id asc")
    List<HomeworkSubmissionPage> findByEvaluationIds(@Param("evalIds") Collection<Long> evalIds);

    @Query("select p from HomeworkSubmissionPage p join fetch p.evaluation ev join fetch ev.batch b join fetch b.classroom c join fetch c.teacher join fetch ev.enrollment e left join fetch e.student s left join fetch s.parent where p.id = :id")
    Optional<HomeworkSubmissionPage> findByIdWithAccessGraph(@Param("id") Long id);
}
