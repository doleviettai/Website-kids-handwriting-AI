package com.example.backend.repository;

import com.example.backend.entity.ClassroomInvitation;
import com.example.backend.entity.enums.InvitationStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassroomInvitationRepository extends JpaRepository<ClassroomInvitation, Long> {
    @Query("select i from ClassroomInvitation i join fetch i.classroom c join fetch c.teacher where i.parentEmail = :email and i.status = :status order by i.createdAt desc")
    List<ClassroomInvitation> findByParentEmailAndStatusWithClassroom(@Param("email") String email, @Param("status") InvitationStatus status);

    List<ClassroomInvitation> findByClassroom_IdOrderByCreatedAtDescIdDesc(Long classroomId);

    Optional<ClassroomInvitation> findByIdAndParentEmail(Long id, String parentEmail);

    boolean existsByClassroom_IdAndParentEmailAndStatus(Long classroomId, String parentEmail, InvitationStatus status);
}
