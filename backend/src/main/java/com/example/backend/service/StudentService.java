package com.example.backend.service;

import com.example.backend.dto.LearningDtos.*;
import com.example.backend.entity.Student;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import java.time.Year;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class StudentService {
    private final StudentRepository students;
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public List<StudentResponse> list(long parentId) {
        return students.findByParent_IdOrderByCreatedAtAsc(parentId).stream().map(this::response).toList();
    }

    @Transactional
    public StudentResponse create(long parentId, StudentRequest request) {
        Student student = new Student();
        student.setParent(users.findById(parentId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại.")));
        apply(student, request);
        return response(students.saveAndFlush(student));
    }

    @Transactional
    public StudentResponse update(long parentId, long id, StudentRequest request) {
        Student student = requireOwned(parentId, id);
        apply(student, request);
        return response(students.saveAndFlush(student));
    }

    @Transactional
    public void delete(long parentId, long id) {
        Student student = requireOwned(parentId, id);
        Long history = jdbc.queryForObject("SELECT COUNT(*) FROM submissions WHERE student_id=?", Long.class, id);
        Long progress = jdbc.queryForObject("SELECT COUNT(*) FROM student_progress WHERE student_id=?", Long.class, id);
        if (history > 0 || progress > 0)
            throw new ApiException(HttpStatus.CONFLICT, "Hồ sơ đã có lịch sử học. Ba mẹ có thể chỉnh sửa để giữ lại quá trình của bé.");
        students.delete(student);
        students.flush();
    }

    @Transactional(readOnly = true)
    public Student requireOwned(long parentId, long id) {
        return students.findByIdAndParent_Id(id, parentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ bé trong tài khoản của ba mẹ."));
    }

    private void apply(Student student, StudentRequest request) {
        if (request.birthYear() > Year.now().getValue()) throw new ApiException(HttpStatus.BAD_REQUEST, "Năm sinh không thể lớn hơn năm hiện tại.");
        student.setNickname(VietnameseText.nfc(request.nickname()).trim());
        student.setBirthYear(request.birthYear());
        student.setGradeLevel(request.gradeLevel());
    }

    private StudentResponse response(Student student) {
        return new StudentResponse(student.getId(), student.getNickname(), student.getBirthYear(), student.getGradeLevel(), student.getCreatedAt());
    }
}
