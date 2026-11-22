package com.example.backend.service;

import com.example.backend.dto.LearningDtos.*;
import com.example.backend.repository.StudentProgressRepository;
import com.example.backend.repository.SubmissionRepository;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class StudentOverviewService {
    private final StudentService students;
    private final StudentProgressRepository progress;
    private final SubmissionRepository submissions;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public StudentOverview overview(long parentId, long studentId) {
        students.requireOwned(parentId, studentId);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE student_id=?", Long.class, studentId);
        long practiced = jdbc.queryForObject("SELECT COUNT(DISTINCT item_id) FROM submissions WHERE student_id=?", Long.class, studentId);
        Double average = jdbc.queryForObject("SELECT AVG(total_score) FROM submissions WHERE student_id=?", Double.class, studentId);
        var itemProgress = progress.findByStudent_IdAndStudent_Parent_Id(studentId, parentId).stream()
                .map(row -> new ItemProgress(row.getId().getItemId(), row.getAttempts(), row.getBestScore(), row.getLastScore(), row.getIsMastered())).toList();
        LocalDate start = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(6);
        List<DayActivity> activity = jdbc.query("""
                SELECT DATE(created_at) AS day, COUNT(*) AS attempts, AVG(total_score) AS average_score
                FROM submissions WHERE student_id=? AND created_at>=? GROUP BY DATE(created_at) ORDER BY day
                """, (rs, row) -> new DayActivity(rs.getDate("day").toString(), rs.getLong("attempts"),
                rs.getObject("average_score") == null ? null : rs.getDouble("average_score")), studentId, Date.valueOf(start));
        return new StudentOverview(total, practiced, itemProgress.stream().filter(row -> Boolean.TRUE.equals(row.mastered())).count(), average, itemProgress, activity);
    }

    @Transactional(readOnly = true)
    public SubmissionPage history(long parentId, long studentId, int page) {
        students.requireOwned(parentId, studentId);
        var result = submissions.findByStudent_IdAndStudent_Parent_Id(studentId, parentId,
                PageRequest.of(page, 10, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        var rows = result.getContent().stream().map(row -> new SubmissionResponse(row.getId(), row.getItem().getId(),
                row.getItem().getTextValue(), row.getSource(), row.getPredictedText(), row.getTotalScore(), row.getStars(), row.getFeedbackText(), row.getCreatedAt())).toList();
        return new SubmissionPage(rows, page, result.getTotalPages(), result.getTotalElements());
    }
}
