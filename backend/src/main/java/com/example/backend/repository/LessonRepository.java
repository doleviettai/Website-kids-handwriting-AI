package com.example.backend.repository;

import com.example.backend.entity.Lesson;
import com.example.backend.entity.enums.GradeLevel;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByGradeLevelOrderBySortOrderAscIdAsc(GradeLevel gradeLevel);
    List<Lesson> findAllByOrderBySortOrderAscIdAsc();
}
