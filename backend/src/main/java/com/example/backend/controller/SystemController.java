package com.example.backend.controller;

import com.example.backend.dto.DatabaseHealthResponse;
import com.example.backend.service.DatabaseHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {
    private final DatabaseHealthService databaseHealthService;

    @GetMapping("/health")
    public DatabaseHealthResponse health() {
        return databaseHealthService.check();
    }
}
