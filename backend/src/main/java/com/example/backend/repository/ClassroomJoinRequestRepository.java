package com.example.backend.repository;

import com.example.backend.entity.ClassroomJoinRequest;
import com.example.backend.entity.enums.JoinRequestStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassroomJoinRequestRepository extends JpaRepository<ClassroomJoinRequest, Long> {
    @Query("select r from ClassroomJoinRequest r join fetch r.parent join fetch r.student where r.classroom.id = :classroomId and r.status = :status order by r.createdAt desc")
    List<ClassroomJoinRequest> findByClassroomAndStatus(@Param("classroomId") Long classroomId, @Param("status") JoinRequestStatus status);

    @Query("select r from ClassroomJoinRequest r join fetch r.classroom c join fetch c.teacher join fetch r.student where r.parent.id = :parentId order by r.createdAt desc")
    List<ClassroomJoinRequest> findByParentWithDetails(@Param("parentId") Long parentId);

    Optional<ClassroomJoinRequest> findByIdAndClassroom_Id(Long id, Long classroomId);

    boolean existsByClassroom_IdAndStudent_IdAndStatus(Long classroomId, Long studentId, JoinRequestStatus status);
}
