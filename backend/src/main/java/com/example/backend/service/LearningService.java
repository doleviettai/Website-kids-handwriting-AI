package com.example.backend.service;

import com.example.backend.dto.LearningDtos.*;
import com.example.backend.entity.Lesson;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class LearningService {
    private final LessonRepository lessons;
    private final WritingItemRepository items;

    @Transactional(readOnly = true)
    public List<LessonResponse> list() {
        return lessons.findAllByOrderBySortOrderAscIdAsc().stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public LessonResponse detail(long id) {
        return response(lessons.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Bài học này chưa có trong thư viện.")));
    }

    private LessonResponse response(Lesson lesson) {
        var content = items.findByLesson_IdOrderBySortOrderAscIdAsc(lesson.getId()).stream()
                .map(item -> new ItemResponse(item.getId(), item.getItemType(), item.getTextValue(), item.getDifficulty(), item.getSortOrder(), item.getTemplateJson())).toList();
        return new LessonResponse(lesson.getId(), lesson.getTitle(), lesson.getGradeLevel(), lesson.getSortOrder(), content);
    }
}
