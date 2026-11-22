package com.example.backend.dto;

import java.util.List;
import java.util.Map;

public record DatabaseHealthResponse(
        String status,
        String database,
        String databaseVersion,
        List<String> migrations,
        Map<String, Long> learningContent,
        boolean aiEnabled) { }
