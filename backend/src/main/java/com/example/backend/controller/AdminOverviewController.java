package com.example.backend.controller;

import com.example.backend.dto.AccountDtos.AccountResponse;
import com.example.backend.repository.*;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin") @RequiredArgsConstructor
public class AdminOverviewController {
    private final UserRepository users;
    private final StudentRepository students;
    private final SubmissionRepository submissions;
    private final LessonRepository lessons;
    private final JdbcTemplate jdbc;

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        var result = new java.util.LinkedHashMap<String, Object>();
        result.put("users", users.count()); result.put("students", students.count());
        result.put("submissions", submissions.count()); result.put("lessons", lessons.count());
        result.put("averageScore", jdbc.queryForObject("SELECT AVG(total_score) FROM submissions", Double.class));
        return result;
    }

    @GetMapping("/users")
    public Map<String, Object> users(@RequestParam(defaultValue = "0") int page) {
        if (page < 0) throw new com.example.backend.exception.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Số trang không hợp lệ.");
        var result = users.findAll(PageRequest.of(page, 20, Sort.by("id")));
        return Map.of("content", result.getContent().stream().map(AccountResponse::from).toList(), "totalPages", result.getTotalPages(), "page", page);
    }
}
