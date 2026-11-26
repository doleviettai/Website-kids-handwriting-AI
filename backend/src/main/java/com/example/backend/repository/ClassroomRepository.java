package com.example.backend.repository;

import com.example.backend.entity.Classroom;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findByTeacher_IdOrderByCreatedAtDescIdDesc(Long teacherId);
    Optional<Classroom> findByIdAndTeacher_Id(Long id, Long teacherId);
    Optional<Classroom> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);

    @Query("select c from Classroom c join fetch c.teacher order by c.createdAt desc, c.id desc")
    List<Classroom> findAllWithTeacher();
}
