package com.example.backend.repository;

import com.example.backend.entity.ClassroomEnrollment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassroomEnrollmentRepository extends JpaRepository<ClassroomEnrollment, Long> {
    @Query("select e from ClassroomEnrollment e left join fetch e.student s left join fetch s.parent where e.classroom.id = :classroomId order by e.displayName asc, e.id asc")
    List<ClassroomEnrollment> findByClassroomIdWithStudent(@Param("classroomId") Long classroomId);

    Optional<ClassroomEnrollment> findByIdAndClassroom_Id(Long id, Long classroomId);
    Optional<ClassroomEnrollment> findByClassroom_IdAndStudent_Id(Long classroomId, Long studentId);

    @Query("select e from ClassroomEnrollment e join fetch e.classroom c join fetch c.teacher where e.student.id = :studentId order by e.joinedAt desc")
    List<ClassroomEnrollment> findByStudentIdWithClassroom(@Param("studentId") Long studentId);

    boolean existsByClassroom_Teacher_IdAndStudent_Id(Long teacherId, Long studentId);
}
