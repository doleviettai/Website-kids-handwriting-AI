package com.example.backend.dto;

import com.example.backend.entity.enums.ItemType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class PlanningDtos {
    private PlanningDtos() {}

    public record GoalRequest(
            @Min(value = 1, message = "Mục tiêu tối thiểu 1 bài mỗi ngày.")
            @Max(value = 30, message = "Mục tiêu tối đa 30 bài mỗi ngày.")
            int dailyTarget
    ) {}

    public record GoalResponse(
            Integer dailyTarget,
            LocalDateTime updatedAt
    ) {}

    public record PlanItemRequest(
            @NotNull(message = "Cần chọn nội dung.")
            Long itemId,
            @Min(value = 1, message = "Số lượt tối thiểu là 1.")
            @Max(value = 10, message = "Số lượt tối đa là 10.")
            int repetitions
    ) {}

    public record PlanRequest(
            @NotBlank(message = "Tên kế hoạch không được để trống.")
            @Size(max = 100, message = "Tên kế hoạch tối đa 100 ký tự.")
            String title,
            @NotNull(message = "Cần chọn ngày bắt đầu.")
            LocalDate startDate,
            @NotNull(message = "Cần chọn ngày kết thúc.")
            LocalDate endDate,
            @NotEmpty(message = "Cần chọn ít nhất một nội dung luyện tập.")
            @Size(max = 30, message = "Mỗi kế hoạch tối đa 30 nội dung.")
            List<@Valid PlanItemRequest> items
    ) {}

    public record PlanItemResponse(
            long itemId,
            Long lessonId,
            ItemType itemType,
            String textValue,
            int repetitions,
            int sortOrder
    ) {}

    public record PlanResponse(
            long id,
            long studentId,
            String title,
            LocalDate startDate,
            LocalDate endDate,
            List<PlanItemResponse> items,
            LocalDateTime createdAt
    ) {}

    public record TodayItem(
            long itemId,
            Long lessonId,
            ItemType itemType,
            String textValue,
            int repetitions,
            long doneToday
    ) {}

    public record TodayResponse(
            String date,
            Integer dailyTarget,
            long doneToday,
            boolean goalReached,
            List<TodayItem> planItems
    ) {}
}
