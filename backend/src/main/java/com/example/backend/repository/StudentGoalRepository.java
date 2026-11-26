package com.example.backend.repository;

import com.example.backend.entity.StudentGoal;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentGoalRepository extends JpaRepository<StudentGoal, Long> {
}
