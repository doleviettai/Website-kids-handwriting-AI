package com.example.backend.service;

import com.example.backend.dto.DatabaseHealthResponse;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DatabaseHealthService {
    private final JdbcTemplate jdbcTemplate;
    private final Flyway flyway;

    @Transactional(readOnly = true)
    public DatabaseHealthResponse check() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("lessons", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM lessons", Long.class));
        counts.put("writingItems", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM writing_items", Long.class));
        counts.put("errorTypes", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM error_types", Long.class));
        counts.put("registeredModels", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ai_models", Long.class));
        return new DatabaseHealthResponse("UP",
                jdbcTemplate.queryForObject("SELECT DATABASE()", String.class),
                jdbcTemplate.queryForObject("SELECT VERSION()", String.class),
                Arrays.stream(flyway.info().applied()).map(migration -> migration.getVersion().getVersion()).toList(),
                counts, true);
    }
}
