package com.example.backend.service;

import com.example.backend.dto.PlanningDtos.*;
import com.example.backend.entity.*;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanningService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final StudentService students;
    private final StudentGoalRepository goals;
    private final PracticePlanRepository plans;
    private final PracticePlanItemRepository planItems;
    private final WritingItemRepository writingItems;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public GoalResponse getGoal(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        return goals.findById(studentId)
                .map(g -> new GoalResponse((int) g.getDailyTarget(), g.getUpdatedAt()))
                .orElse(new GoalResponse(null, null));
    }

    @Transactional
    public GoalResponse putGoal(long parentId, long studentId, GoalRequest request) {
        Student student = students.requireOwned(parentId, studentId);
        StudentGoal goal = goals.findById(studentId).orElseGet(() -> {
            StudentGoal created = new StudentGoal();
            created.setStudent(student);
            return created;
        });
        goal.setDailyTarget((byte) request.dailyTarget());
        StudentGoal saved = goals.saveAndFlush(goal);
        return new GoalResponse((int) saved.getDailyTarget(), saved.getUpdatedAt());
    }

    @Transactional
    public void deleteGoal(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        goals.findById(studentId).ifPresent(goals::delete);
    }

    @Transactional(readOnly = true)
    public List<PlanResponse> listPlans(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        List<PracticePlan> list = plans.findByStudent_IdOrderByStartDateDescIdDesc(studentId);
        if (list.isEmpty()) return List.of();
        List<Long> ids = list.stream().map(PracticePlan::getId).toList();
        Map<Long, List<PlanItemResponse>> grouped = planItems.findWithItemByPlanIds(ids).stream()
                .collect(Collectors.groupingBy(
                        pi -> pi.getPlan().getId(),
                        LinkedHashMap::new,
                        Collectors.mapping(this::toPlanItemResponse, Collectors.toList())
                ));
        return list.stream()
                .map(p -> toPlanResponse(p, grouped.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    @Transactional
    public PlanResponse createPlan(long parentId, long studentId, PlanRequest request) {
        Student student = students.requireOwned(parentId, studentId);
        Map<Long, WritingItem> resolved = validatePlanRequest(request);
        PracticePlan plan = new PracticePlan();
        plan.setStudent(student);
        applyPlanHeader(plan, request);
        PracticePlan saved = plans.saveAndFlush(plan);
        List<PlanItemResponse> savedItems = savePlanItems(saved, request.items(), resolved);
        return toPlanResponse(saved, savedItems);
    }

    @Transactional
    public PlanResponse updatePlan(long parentId, long studentId, long planId, PlanRequest request) {
        students.requireOwned(parentId, studentId);
        PracticePlan plan = plans.findByIdAndStudent_Id(planId, studentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy kế hoạch luyện tập."));
        Map<Long, WritingItem> resolved = validatePlanRequest(request);
        applyPlanHeader(plan, request);
        PracticePlan saved = plans.saveAndFlush(plan);
        planItems.deleteByPlan_Id(saved.getId());
        planItems.flush();
        List<PlanItemResponse> savedItems = savePlanItems(saved, request.items(), resolved);
        return toPlanResponse(saved, savedItems);
    }

    @Transactional
    public void deletePlan(long parentId, long studentId, long planId) {
        students.requireOwned(parentId, studentId);
        PracticePlan plan = plans.findByIdAndStudent_Id(planId, studentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy kế hoạch luyện tập."));
        planItems.deleteByPlan_Id(plan.getId());
        planItems.flush();
        plans.delete(plan);
        plans.flush();
    }

    @Transactional(readOnly = true)
    public TodayResponse today(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        LocalDate today = LocalDate.now(VN);
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        Timestamp startTs = Timestamp.valueOf(start);
        Timestamp endTs = Timestamp.valueOf(end);

        Long doneObj = jdbc.queryForObject(
                "SELECT COUNT(*) FROM submissions WHERE student_id=? AND created_at>=? AND created_at<?",
                Long.class, studentId, startTs, endTs);
        long doneToday = doneObj == null ? 0L : doneObj;
        Integer dailyTarget = goals.findById(studentId).map(g -> (int) g.getDailyTarget()).orElse(null);
        boolean goalReached = dailyTarget != null && doneToday >= dailyTarget;

        List<PracticePlan> activePlans = plans.findActiveOn(studentId, today);
        if (activePlans.isEmpty()) {
            return new TodayResponse(today.toString(), dailyTarget, doneToday, goalReached, List.of());
        }

        Map<Long, Long> doneByItem = new HashMap<>();
        jdbc.query(
                "SELECT item_id, COUNT(*) AS cnt FROM submissions WHERE student_id=? AND created_at>=? AND created_at<? GROUP BY item_id",
                rs -> { doneByItem.put(rs.getLong("item_id"), rs.getLong("cnt")); },
                studentId, startTs, endTs);

        List<Long> planIds = activePlans.stream().map(PracticePlan::getId).toList();
        List<PracticePlanItem> activeItems = planItems.findWithItemByPlanIds(planIds);

        Map<Long, MergedTodayItem> merged = new LinkedHashMap<>();
        for (PracticePlanItem pi : activeItems) {
            WritingItem item = pi.getItem();
            long itemId = item.getId();
            MergedTodayItem existing = merged.get(itemId);
            if (existing == null) {
                merged.put(itemId, new MergedTodayItem(
                        itemId,
                        item.getLesson() == null ? null : item.getLesson().getId(),
                        item.getItemType(),
                        item.getTextValue(),
                        pi.getRepetitions(),
                        doneByItem.getOrDefault(itemId, 0L)
                ));
            } else {
                existing.repetitions += pi.getRepetitions();
            }
        }
        List<TodayItem> todayItems = merged.values().stream()
                .map(m -> new TodayItem(m.itemId, m.lessonId, m.itemType, m.textValue, m.repetitions, m.doneToday))
                .toList();
        return new TodayResponse(today.toString(), dailyTarget, doneToday, goalReached, todayItems);
    }

    private void applyPlanHeader(PracticePlan plan, PlanRequest request) {
        String title = VietnameseText.nfc(request.title()).trim();
        if (title.isEmpty() || title.codePoints().anyMatch(Character::isISOControl)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên kế hoạch không hợp lệ.");
        }
        plan.setTitle(title);
        plan.setStartDate(request.startDate());
        plan.setEndDate(request.endDate());
    }

    private Map<Long, WritingItem> validatePlanRequest(PlanRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
        }
        if (ChronoUnit.DAYS.between(request.startDate(), request.endDate()) > 30) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Một kế hoạch tối đa 31 ngày.");
        }
        Set<Long> seen = new LinkedHashSet<>();
        for (PlanItemRequest item : request.items()) {
            if (!seen.add(item.itemId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Không chọn trùng nội dung trong cùng kế hoạch.");
            }
        }
        Map<Long, WritingItem> resolved = writingItems.findAllById(seen).stream()
                .collect(Collectors.toMap(WritingItem::getId, Function.identity()));
        if (resolved.size() != seen.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Có nội dung không tồn tại trong thư viện.");
        }
        return resolved;
    }

    private List<PlanItemResponse> savePlanItems(PracticePlan plan, List<PlanItemRequest> reqItems, Map<Long, WritingItem> resolved) {
        List<PlanItemResponse> out = new ArrayList<>(reqItems.size());
        for (int i = 0; i < reqItems.size(); i++) {
            PlanItemRequest req = reqItems.get(i);
            WritingItem item = resolved.get(req.itemId());
            PracticePlanItem pi = new PracticePlanItem();
            pi.setId(new PracticePlanItemId(plan.getId(), item.getId()));
            pi.setPlan(plan);
            pi.setItem(item);
            pi.setRepetitions((byte) req.repetitions());
            pi.setSortOrder(i);
            planItems.save(pi);
            out.add(toPlanItemResponse(pi));
        }
        planItems.flush();
        return out;
    }

    private PlanItemResponse toPlanItemResponse(PracticePlanItem pi) {
        WritingItem item = pi.getItem();
        return new PlanItemResponse(
                item.getId(),
                item.getLesson() == null ? null : item.getLesson().getId(),
                item.getItemType(),
                item.getTextValue(),
                pi.getRepetitions(),
                pi.getSortOrder() == null ? 0 : pi.getSortOrder()
        );
    }

    private PlanResponse toPlanResponse(PracticePlan p, List<PlanItemResponse> items) {
        return new PlanResponse(p.getId(), p.getStudent().getId(), p.getTitle(), p.getStartDate(), p.getEndDate(), items, p.getCreatedAt());
    }

    private static final class MergedTodayItem {
        final long itemId;
        final Long lessonId;
        final com.example.backend.entity.enums.ItemType itemType;
        final String textValue;
        int repetitions;
        final long doneToday;

        MergedTodayItem(long itemId, Long lessonId, com.example.backend.entity.enums.ItemType itemType, String textValue, int repetitions, long doneToday) {
            this.itemId = itemId;
            this.lessonId = lessonId;
            this.itemType = itemType;
            this.textValue = textValue;
            this.repetitions = repetitions;
            this.doneToday = doneToday;
        }
    }
}
