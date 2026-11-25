package com.example.backend.service;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.exception.ApiException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class ReviewService {
    private final JdbcTemplate jdbc;
    private final StudentService students;

    public List<Attention> attention(long parentId,long studentId) {
        students.requireOwned(parentId,studentId);
        return jdbc.query("""
                SELECT e.code,e.name_vi,e.feedback_template_vi,COUNT(DISTINCT se.submission_id) AS occurrences
                FROM submission_errors se JOIN error_types e ON e.id=se.error_type_id
                JOIN submissions s ON s.id=se.submission_id WHERE s.student_id=?
                GROUP BY e.id,e.code,e.name_vi,e.feedback_template_vi ORDER BY occurrences DESC,e.code LIMIT 20
                """,(rs,row)->new Attention(rs.getString("code"),rs.getString("name_vi"),rs.getString("feedback_template_vi"),rs.getLong("occurrences")),studentId);
    }
    public ReviewPage reviews(int page, boolean onlyErrors) {
        if(page<0 || page>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"Số trang không hợp lệ.");
        String where=onlyErrors?" WHERE EXISTS (SELECT 1 FROM submission_errors e WHERE e.submission_id=s.id)":"";
        long count=jdbc.queryForObject("SELECT COUNT(*) FROM submissions s"+where,Long.class);
        var rows=jdbc.query("""
                SELECT s.id,s.student_id,st.nickname,w.text_value,s.predicted_text,s.total_score,s.confidence,s.created_at,
                (SELECT COUNT(*) FROM submission_errors se WHERE se.submission_id=s.id) AS error_count
                FROM submissions s JOIN students st ON st.id=s.student_id JOIN writing_items w ON w.id=s.item_id
                """+where+" ORDER BY s.created_at DESC,s.id DESC LIMIT 20 OFFSET ?",(rs,row)->new ReviewRow(rs.getLong("id"),rs.getLong("student_id"),rs.getString("nickname"),
                rs.getString("text_value"),rs.getString("predicted_text"),rs.getObject("total_score")==null?null:rs.getByte("total_score"),rs.getBigDecimal("confidence"),rs.getTimestamp("created_at").toLocalDateTime(),rs.getLong("error_count")),page*20);
        return new ReviewPage(rows,page,(int)Math.ceil(count/20.),count);
    }
}
