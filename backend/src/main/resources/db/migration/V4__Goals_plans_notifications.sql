CREATE TABLE student_goals (
    student_id BIGINT NOT NULL,
    daily_target TINYINT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id),
    CONSTRAINT fk_goals_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE practice_plans (
    id BIGINT NOT NULL AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_plans_student_dates (student_id, start_date, end_date),
    CONSTRAINT fk_plans_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE practice_plan_items (
    plan_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    repetitions TINYINT NOT NULL,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (plan_id, item_id),
    CONSTRAINT fk_plan_items_plan FOREIGN KEY (plan_id) REFERENCES practice_plans(id),
    CONSTRAINT fk_plan_items_item FOREIGN KEY (item_id) REFERENCES writing_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE submission_comments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content VARCHAR(1000) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_comments_submission (submission_id, created_at),
    CONSTRAINT fk_comments_submission FOREIGN KEY (submission_id) REFERENCES submissions(id),
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT NOT NULL,
    type ENUM('NEEDS_REVIEW', 'NEW_COMMENT') NOT NULL,
    submission_id BIGINT,
    student_id BIGINT,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(500) NOT NULL,
    read_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_notifications_recipient (recipient_id, read_at, created_at),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
    CONSTRAINT fk_notifications_submission FOREIGN KEY (submission_id) REFERENCES submissions(id),
    CONSTRAINT fk_notifications_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

