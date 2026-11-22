package com.example.backend.controller;

import com.example.backend.dto.LearningDtos.*;
import com.example.backend.service.StudentService;
import com.example.backend.service.StudentOverviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/students") @RequiredArgsConstructor
public class StudentController {
    private final StudentService students;
    private final StudentOverviewService overview;

    @GetMapping
    public List<StudentResponse> list(@AuthenticationPrincipal Jwt jwt) { return students.list(parent(jwt)); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody StudentRequest request) { return students.create(parent(jwt), request); }

    @PutMapping("/{id}")
    public StudentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody StudentRequest request) { return students.update(parent(jwt), id, request); }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) { students.delete(parent(jwt), id); }

    @GetMapping("/{id}/overview")
    public StudentOverview overview(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) { return overview.overview(parent(jwt), id); }

    @GetMapping("/{id}/submissions")
    public SubmissionPage submissions(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @RequestParam(defaultValue = "0") @Min(0) int page) {
        return overview.history(parent(jwt), id, page);
    }

    private long parent(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }
}
