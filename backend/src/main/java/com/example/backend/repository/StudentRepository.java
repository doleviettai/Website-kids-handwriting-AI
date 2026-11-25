package com.example.backend.repository;

import com.example.backend.entity.Student;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from Student s where s.id=:id and s.parent.id=:parentId")
    Optional<Student> lockOwned(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("parentId") Long parentId);
    List<Student> findByParent_IdOrderByCreatedAtAsc(Long parentId);
    Optional<Student> findByIdAndParent_Id(Long id, Long parentId);
}
