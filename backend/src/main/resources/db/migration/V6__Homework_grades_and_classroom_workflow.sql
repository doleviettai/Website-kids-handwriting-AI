-- 1. Expand grade levels from Kindergarten to Grade 5
ALTER TABLE students
    MODIFY COLUMN grade_level ENUM('MAU_GIAO','LOP_1','LOP_2','LOP_3','LOP_4','LOP_5') NOT NULL;
ALTER TABLE lessons
    MODIFY COLUMN grade_level ENUM('MAU_GIAO','LOP_1','LOP_2','LOP_3','LOP_4','LOP_5') NOT NULL;
ALTER TABLE classrooms
    MODIFY COLUMN grade_level ENUM('MAU_GIAO','LOP_1','LOP_2','LOP_3','LOP_4','LOP_5') NOT NULL;

-- 2. Expand notification types
ALTER TABLE notifications
    MODIFY COLUMN type ENUM(
        'NEEDS_REVIEW','NEW_COMMENT','TEACHER_REPORT',
        'CLASS_INVITATION','JOIN_REQUEST','HOMEWORK_ASSIGNED','HOMEWORK_GRADED'
    ) NOT NULL;

-- 3. Classroom-scoped parent contact/notes on enrollment (without touching original user/student records)
ALTER TABLE classroom_enrollments
    ADD COLUMN parent_name_note VARCHAR(100) NULL AFTER birth_year,
    ADD COLUMN parent_phone VARCHAR(30) NULL AFTER parent_name_note,
    ADD COLUMN teacher_note VARCHAR(300) NULL AFTER parent_phone;

-- 4. Extend review_batches for homework assignments (Tieng Viet & Toan)
ALTER TABLE review_batches
    ADD COLUMN subject ENUM('TIENG_VIET','TOAN') NOT NULL DEFAULT 'TIENG_VIET' AFTER title,
    ADD COLUMN is_homework BOOLEAN NOT NULL DEFAULT FALSE AFTER subject,
    ADD COLUMN description TEXT NULL AFTER notes,
    ADD COLUMN due_at DATETIME NULL AFTER description,
    ADD COLUMN required_pages TINYINT NOT NULL DEFAULT 1 AFTER due_at;

-- 5. Extend student_evaluations for numeric score, grading mode, submission timestamp & scheduled send
ALTER TABLE student_evaluations
    ADD COLUMN score DECIMAL(4,2) NULL AFTER rating,
    ADD COLUMN grading_mode ENUM('MANUAL','AI_ASSISTED') NOT NULL DEFAULT 'MANUAL' AFTER score,
    ADD COLUMN submitted_at DATETIME NULL AFTER ai_metrics_json,
    ADD COLUMN scheduled_send_at DATETIME NULL AFTER sent_to_parent_at,
    ADD INDEX ix_evaluations_scheduled_send (sent_to_parent_at, scheduled_send_at);

-- 6. Classroom invitations from teacher to parent email
CREATE TABLE classroom_invitations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    classroom_id BIGINT NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    invited_by BIGINT NOT NULL,
    status ENUM('PENDING','ACCEPTED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX ix_invitations_email_status (parent_email, status),
    INDEX ix_invitations_classroom (classroom_id, status),
    CONSTRAINT fk_invitations_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- 7. Parent join requests when searching public classrooms
CREATE TABLE classroom_join_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    classroom_id BIGINT NOT NULL,
    parent_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    message VARCHAR(300) NULL,
    status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX ix_join_req_classroom_status (classroom_id, status),
    INDEX ix_join_req_parent (parent_id, status),
    CONSTRAINT fk_join_req_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_join_req_parent FOREIGN KEY (parent_id) REFERENCES users(id),
    CONSTRAINT fk_join_req_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- 8. Multi-page homework photo uploads
CREATE TABLE homework_submission_pages (
    id BIGINT NOT NULL AUTO_INCREMENT,
    evaluation_id BIGINT NOT NULL,
    page_number TINYINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_hw_pages_eval (evaluation_id, page_number),
    CONSTRAINT fk_hw_pages_eval FOREIGN KEY (evaluation_id) REFERENCES student_evaluations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
