package com.example.backend.repository;

import com.example.backend.entity.ErrorType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ErrorTypeRepository extends JpaRepository<ErrorType, Integer> {
    Optional<ErrorType> findByCode(String code);
}
