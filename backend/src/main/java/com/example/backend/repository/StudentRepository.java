package com.example.backend.repository;

import com.example.backend.entity.Student;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, Long> {
    List<Student> findByParent_IdOrderByCreatedAtAsc(Long parentId);
    Optional<Student> findByIdAndParent_Id(Long id, Long parentId);
}
