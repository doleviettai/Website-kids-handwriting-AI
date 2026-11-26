package com.example.backend.controller;

import com.example.backend.dto.PlanningDtos.*;
import com.example.backend.service.PlanningService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students/{studentId}")
@RequiredArgsConstructor
public class PlanningController {
    private final PlanningService planning;

    @GetMapping("/goal")
    public GoalResponse getGoal(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId) {
        return planning.getGoal(parent(jwt), studentId);
    }

    @PutMapping("/goal")
    public GoalResponse putGoal(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId, @Valid @RequestBody GoalRequest request) {
        return planning.putGoal(parent(jwt), studentId, request);
    }

    @DeleteMapping("/goal")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGoal(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId) {
        planning.deleteGoal(parent(jwt), studentId);
    }

    @GetMapping("/today")
    public TodayResponse today(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId) {
        return planning.today(parent(jwt), studentId);
    }

    @GetMapping("/plans")
    public List<PlanResponse> listPlans(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId) {
        return planning.listPlans(parent(jwt), studentId);
    }

    @PostMapping("/plans")
    @ResponseStatus(HttpStatus.CREATED)
    public PlanResponse createPlan(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId, @Valid @RequestBody PlanRequest request) {
        return planning.createPlan(parent(jwt), studentId, request);
    }

    @PutMapping("/plans/{planId}")
    public PlanResponse updatePlan(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId, @PathVariable long planId, @Valid @RequestBody PlanRequest request) {
        return planning.updatePlan(parent(jwt), studentId, planId, request);
    }

    @DeleteMapping("/plans/{planId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlan(@AuthenticationPrincipal Jwt jwt, @PathVariable long studentId, @PathVariable long planId) {
        planning.deletePlan(parent(jwt), studentId, planId);
    }

    private long parent(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
