package com.example.backend.controller;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api")
public class SubmissionController {
    private final SubmissionService submissions;
    private final ReviewService reviews;
    private final AiClient ai;

    @PostMapping("/submissions") @ResponseStatus(HttpStatus.CREATED)
    public SubmissionDetail submit(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody SubmitRequest input) {
        long parent=Long.parseLong(jwt.getSubject());return submissions.detail(parent,submissions.submit(parent,input));
    }
    @GetMapping("/submissions/{id}")
    public SubmissionDetail detail(@AuthenticationPrincipal Jwt jwt,@PathVariable long id) {return submissions.detail(Long.parseLong(jwt.getSubject()),id);}
    @PostMapping("/recognition/preview")
    public RecognitionResult preview(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody SubmitRequest input) {
        return submissions.preview(Long.parseLong(jwt.getSubject()), input);
    }
    @GetMapping("/ai/status") public Map<String,Object> status() {return ai.status();}
    @GetMapping("/students/{id}/attention") public List<Attention> attention(@AuthenticationPrincipal Jwt jwt,@PathVariable long id) {return reviews.attention(Long.parseLong(jwt.getSubject()),id);}
    @GetMapping("/admin/reviews") public ReviewPage reviews(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="true") boolean onlyErrors) {return reviews.reviews(page,onlyErrors);}
}
