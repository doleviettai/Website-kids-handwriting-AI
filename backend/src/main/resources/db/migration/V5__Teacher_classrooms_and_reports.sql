ALTER TABLE users
    MODIFY COLUMN role ENUM('PARENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'PARENT';

ALTER TABLE notifications
    MODIFY COLUMN type ENUM('NEEDS_REVIEW', 'NEW_COMMENT', 'TEACHER_REPORT') NOT NULL;

CREATE TABLE classrooms (
    id BIGINT NOT NULL AUTO_INCREMENT,
    teacher_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    school_year VARCHAR(30) NOT NULL,
    grade_level ENUM('MAU_GIAO', 'LOP_1') NOT NULL,
    join_code VARCHAR(16) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_classrooms_join_code UNIQUE (join_code),
    INDEX ix_classrooms_teacher (teacher_id),
    CONSTRAINT fk_classrooms_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE classroom_enrollments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    classroom_id BIGINT NOT NULL,
    student_id BIGINT NULL,
    display_name VARCHAR(80) NOT NULL,
    birth_year SMALLINT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_classroom_student UNIQUE (classroom_id, student_id),
    INDEX ix_enrollments_student (student_id),
    CONSTRAINT fk_enrollments_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE review_batches (
    id BIGINT NOT NULL AUTO_INCREMENT,
    classroom_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    batch_date DATE NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_batches_classroom_date (classroom_id, batch_date),
    CONSTRAINT fk_batches_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_evaluations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    rating ENUM('HOAN_THANH_TOT', 'HOAN_THANH', 'CAN_CO_GANG') NULL,
    teacher_comment VARCHAR(1000) NULL,
    needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
    image_url VARCHAR(500) NULL,
    ai_metrics_json JSON NULL,
    sent_to_parent_at DATETIME NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_batch_enrollment UNIQUE (batch_id, enrollment_id),
    CONSTRAINT fk_evaluations_batch FOREIGN KEY (batch_id) REFERENCES review_batches(id),
    CONSTRAINT fk_evaluations_enrollment FOREIGN KEY (enrollment_id) REFERENCES classroom_enrollments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
