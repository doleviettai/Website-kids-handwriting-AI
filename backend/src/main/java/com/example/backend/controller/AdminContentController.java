package com.example.backend.controller;

import com.example.backend.dto.AdminContentDtos.*;
import com.example.backend.dto.LearningDtos.LessonResponse;
import com.example.backend.service.AdminContentService;
import com.example.backend.service.LearningService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin") @RequiredArgsConstructor
public class AdminContentController {
    private final AdminContentService content;
    private final LearningService learning;

    @GetMapping("/lessons") public List<LessonResponse> lessons() { return learning.list(); }
    @PostMapping("/lessons") @ResponseStatus(HttpStatus.CREATED)
    public LessonResponse createLesson(@Valid @RequestBody LessonRequest request) { return content.createLesson(request); }
    @PutMapping("/lessons/{id}")
    public LessonResponse updateLesson(@PathVariable long id, @Valid @RequestBody LessonRequest request) { return content.updateLesson(id, request); }
    @DeleteMapping("/lessons/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLesson(@PathVariable long id) { content.deleteLesson(id); }

    @GetMapping("/items") public List<ItemResponse> items() { return content.listItems(); }
    @PostMapping("/items") @ResponseStatus(HttpStatus.CREATED)
    public ItemResponse createItem(@Valid @RequestBody ItemRequest request) { return content.createItem(request); }
    @PutMapping("/items/{id}")
    public ItemResponse updateItem(@PathVariable long id, @Valid @RequestBody ItemRequest request) { return content.updateItem(id, request); }
    @DeleteMapping("/items/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable long id) { content.deleteItem(id); }

    @GetMapping("/error-types") public List<ErrorTypeResponse> errors() { return content.listErrors(); }
    @PostMapping("/error-types") @ResponseStatus(HttpStatus.CREATED)
    public ErrorTypeResponse createError(@Valid @RequestBody ErrorTypeRequest request) { return content.createError(request); }
    @PutMapping("/error-types/{id}")
    public ErrorTypeResponse updateError(@PathVariable int id, @Valid @RequestBody ErrorTypeRequest request) { return content.updateError(id, request); }
    @DeleteMapping("/error-types/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteError(@PathVariable int id) { content.deleteError(id); }
}
