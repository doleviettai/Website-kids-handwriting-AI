package com.example.backend.controller;

import com.example.backend.dto.LearningDtos.LessonResponse;
import com.example.backend.service.LearningService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/lessons") @RequiredArgsConstructor
public class LessonController {
    private final LearningService learning;
    @GetMapping public List<LessonResponse> list() { return learning.list(); }
    @GetMapping("/{id}") public LessonResponse detail(@PathVariable long id) { return learning.detail(id); }
}
