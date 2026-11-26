package com.example.backend.controller;

import com.example.backend.dto.HomeworkDtos.*;
import com.example.backend.dto.TeacherDtos.*;
import com.example.backend.entity.enums.GradeLevel;
import com.example.backend.entity.enums.Subject;
import com.example.backend.service.ClassroomWorkflowService;
import com.example.backend.service.HomeworkService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HomeworkController {
    private final ClassroomWorkflowService workflow;
    private final HomeworkService homework;

    // === TEACHER endpoints ===

    @GetMapping("/teacher/classrooms/{id}/enrollments/detail")
    public List<EnrollmentDetailResponse> listEnrollmentsDetail(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return workflow.listEnrollmentsDetail(uid(jwt), id);
    }

    @PutMapping("/teacher/classrooms/{id}/enrollments/{eid}")
    public EnrollmentDetailResponse updateEnrollment(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long eid,
            @Valid @RequestBody UpdateEnrollmentRequest req) {
        return workflow.updateEnrollment(uid(jwt), id, eid, req);
    }

    @GetMapping("/teacher/classrooms/{id}/invitations")
    public List<InvitationResponse> listInvitations(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return workflow.listClassroomInvitations(uid(jwt), id);
    }

    @PostMapping("/teacher/classrooms/{id}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationResponse inviteParent(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody InviteParentRequest req) {
        return workflow.inviteParent(uid(jwt), id, req);
    }

    @DeleteMapping("/teacher/classrooms/{id}/invitations/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelInvitation(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long invitationId) {
        workflow.cancelInvitation(uid(jwt), id, invitationId);
    }

    @GetMapping("/teacher/classrooms/{id}/join-requests")
    public List<JoinRequestResponse> listJoinRequests(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return workflow.listClassroomJoinRequests(uid(jwt), id);
    }

    @PostMapping("/teacher/classrooms/{id}/join-requests/{rid}/review")
    public JoinRequestResponse reviewJoinRequest(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long rid,
            @RequestBody ReviewJoinRequest req) {
        return workflow.reviewJoinRequest(uid(jwt), id, rid, req);
    }

    @PostMapping("/teacher/classrooms/{id}/homework")
    @ResponseStatus(HttpStatus.CREATED)
    public BatchSummary createHomework(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody HomeworkCreateRequest req) {
        return homework.createHomework(uid(jwt), id, req);
    }

    @GetMapping("/teacher/homework/{batchId}")
    public HomeworkDetailResponse homeworkDetail(@AuthenticationPrincipal Jwt jwt, @PathVariable long batchId) {
        return homework.teacherHomeworkDetail(uid(jwt), batchId);
    }

    @PutMapping("/teacher/homework/{batchId}/enrollments/{eid}/grade")
    public HomeworkSubmissionRow gradeHomework(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long batchId, @PathVariable long eid,
            @Valid @RequestBody GradeHomeworkRequest req) {
        return homework.gradeEvaluation(uid(jwt), batchId, eid, req);
    }

    @PostMapping("/teacher/homework/{batchId}/schedule-send")
    public SendReportsResponse scheduleSend(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long batchId,
            @Valid @RequestBody ScheduleSendRequest req) {
        return homework.scheduleOrSendBatch(uid(jwt), batchId, req);
    }

    @GetMapping("/teacher/classrooms/{id}/gradebook")
    public GradebookResponse gradebook(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id,
            @RequestParam(required = false) Subject subject) {
        return homework.classroomGradebook(uid(jwt), id, subject);
    }

    // === PARENT endpoints ===

    @GetMapping("/parent/classrooms/search")
    public List<PublicClassroomResponse> searchClassrooms(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) GradeLevel grade) {
        return workflow.searchClassrooms(q, grade);
    }

    @PostMapping("/parent/classrooms/{id}/join-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public JoinRequestResponse requestJoin(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody CreateJoinRequest req) {
        return workflow.requestJoin(uid(jwt), id, req);
    }

    @GetMapping("/parent/join-requests")
    public List<JoinRequestResponse> parentJoinRequests(@AuthenticationPrincipal Jwt jwt) {
        return workflow.listParentJoinRequests(uid(jwt));
    }

    @GetMapping("/parent/invitations")
    public List<InvitationResponse> parentInvitations(@AuthenticationPrincipal Jwt jwt) {
        return workflow.listParentInvitations(uid(jwt));
    }

    @PostMapping("/parent/invitations/{id}/respond")
    public ResponseEntity<StudentClassroomResponse> respondInvitation(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id,
            @RequestBody RespondInvitationRequest req) {
        StudentClassroomResponse res = workflow.respondInvitation(uid(jwt), id, req);
        return res == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(res);
    }

    @GetMapping("/parent/students/{studentId}/homework")
    public List<ParentHomeworkItem> parentHomework(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long studentId,
            @RequestParam(required = false) Subject subject) {
        return homework.listParentHomework(uid(jwt), studentId, subject);
    }

    @PostMapping(value = "/parent/homework/{batchId}/enrollments/{eid}/pages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<HomeworkPageResponse> uploadPages(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long batchId, @PathVariable long eid,
            @RequestPart("files") List<MultipartFile> files) {
        return homework.uploadHomeworkPages(uid(jwt), batchId, eid, files);
    }

    @DeleteMapping("/parent/homework/pages/{pageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePage(@AuthenticationPrincipal Jwt jwt, @PathVariable long pageId) {
        homework.deleteHomeworkPage(uid(jwt), pageId);
    }

    // === Shared authorized image streaming (PARENT owner, TEACHER owner, ADMIN) ===

    @GetMapping("/homework/pages/{pageId}/image")
    public ResponseEntity<byte[]> pageImage(@AuthenticationPrincipal Jwt jwt, @PathVariable long pageId) {
        HomeworkService.PageBinary bin = homework.loadPageImage(uid(jwt), pageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(bin.contentType()))
                .cacheControl(CacheControl.noStore())
                .body(bin.bytes());
    }

    private long uid(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
