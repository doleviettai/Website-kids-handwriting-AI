package com.example.backend.controller;

import com.example.backend.dto.TeacherDtos.*;
import com.example.backend.service.TeacherService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
public class TeacherController {
    private final TeacherService teacherService;

    @GetMapping("/classrooms")
    public List<ClassroomSummary> listClassrooms(@AuthenticationPrincipal Jwt jwt) {
        return teacherService.listClassrooms(teacherId(jwt));
    }

    @PostMapping("/classrooms")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomSummary createClassroom(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ClassroomRequest request) {
        return teacherService.createClassroom(teacherId(jwt), request);
    }

    @PutMapping("/classrooms/{id}")
    public ClassroomSummary updateClassroom(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody ClassroomRequest request) {
        return teacherService.updateClassroom(teacherId(jwt), id, request);
    }

    @DeleteMapping("/classrooms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClassroom(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        teacherService.deleteClassroom(teacherId(jwt), id);
    }

    @GetMapping("/classrooms/{id}")
    public ClassroomDetail classroomDetail(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return teacherService.classroomDetail(teacherId(jwt), id);
    }

    @PostMapping("/classrooms/{id}/enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentResponse addEnrollment(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody EnrollmentRequest request) {
        return teacherService.addEnrollment(teacherId(jwt), id, request);
    }

    @PostMapping("/classrooms/{id}/enrollments/import")
    @ResponseStatus(HttpStatus.CREATED)
    public List<EnrollmentResponse> importEnrollments(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody EnrollmentImportRequest request) {
        return teacherService.importEnrollments(teacherId(jwt), id, request);
    }

    @DeleteMapping("/classrooms/{id}/enrollments/{enrollmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEnrollment(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long enrollmentId) {
        teacherService.deleteEnrollment(teacherId(jwt), id, enrollmentId);
    }

    @PostMapping("/classrooms/{id}/batches")
    @ResponseStatus(HttpStatus.CREATED)
    public BatchSummary createBatch(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody BatchRequest request) {
        return teacherService.createBatch(teacherId(jwt), id, request);
    }

    @DeleteMapping("/classrooms/{id}/batches/{batchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBatch(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long batchId) {
        teacherService.deleteBatch(teacherId(jwt), id, batchId);
    }

    @GetMapping("/batches/{batchId}/evaluations")
    public BatchSheet batchSheet(@AuthenticationPrincipal Jwt jwt, @PathVariable long batchId) {
        return teacherService.batchSheet(teacherId(jwt), batchId);
    }

    @PutMapping("/batches/{batchId}/evaluations/{enrollmentId}")
    public EvaluationRow saveEvaluation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long batchId,
            @PathVariable long enrollmentId,
            @Valid @RequestBody EvaluationRequest request
    ) {
        return teacherService.saveEvaluation(teacherId(jwt), batchId, enrollmentId, request);
    }

    @PostMapping("/batches/{batchId}/send-reports")
    public SendReportsResponse sendReports(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long batchId,
            @RequestBody(required = false) SendReportsRequest request
    ) {
        return teacherService.sendReports(teacherId(jwt), batchId, request == null ? null : request.enrollmentId());
    }

    @GetMapping(value = "/batches/{batchId}/export.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> exportCsv(@AuthenticationPrincipal Jwt jwt, @PathVariable long batchId) {
        String csv = teacherService.exportBatchCsv(teacherId(jwt), batchId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"bao-cao-lop-" + batchId + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    private long teacherId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
