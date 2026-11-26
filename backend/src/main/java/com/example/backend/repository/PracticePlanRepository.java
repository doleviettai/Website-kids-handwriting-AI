package com.example.backend.repository;

import com.example.backend.entity.PracticePlan;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PracticePlanRepository extends JpaRepository<PracticePlan, Long> {
    List<PracticePlan> findByStudent_IdOrderByStartDateDescIdDesc(Long studentId);
    Optional<PracticePlan> findByIdAndStudent_Id(Long id, Long studentId);

    @Query("select p from PracticePlan p where p.student.id = :studentId and p.startDate <= :date and p.endDate >= :date order by p.startDate asc, p.id asc")
    List<PracticePlan> findActiveOn(@Param("studentId") Long studentId, @Param("date") LocalDate date);
}
