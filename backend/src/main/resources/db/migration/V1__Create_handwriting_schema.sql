-- Schema from project-memory/database.dbml. No model calls or mock scores.
-- Case/accent-sensitive text preserves a/ă/â, o/ô/ơ and upper/lowercase.
CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('PARENT', 'ADMIN') NOT NULL DEFAULT 'PARENT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE students (
    id BIGINT NOT NULL AUTO_INCREMENT,
    parent_id BIGINT NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    birth_year SMALLINT,
    grade_level ENUM('MAU_GIAO', 'LOP_1') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_students_parent FOREIGN KEY (parent_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE lessons (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    grade_level ENUM('MAU_GIAO', 'LOP_1') NOT NULL,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE writing_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    lesson_id BIGINT,
    item_type ENUM('LETTER', 'DIGIT', 'DIGRAPH', 'WORD', 'SENTENCE') NOT NULL,
    text_value VARCHAR(255) NOT NULL,
    difficulty TINYINT DEFAULT 1,
    template_json JSON,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_writing_items_type_text UNIQUE (item_type, text_value),
    CONSTRAINT fk_writing_items_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE ai_models (
    id INT NOT NULL AUTO_INCREMENT,
    task ENUM('SINGLE_CHAR', 'COMPOUND', 'PARAGRAPH') NOT NULL,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(30) NOT NULL,
    model_path VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_ai_models_task_version UNIQUE (task, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE submissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    model_id INT,
    source ENUM('TOUCH', 'CAMERA') NOT NULL,
    image_url VARCHAR(500),
    stroke_data JSON,
    predicted_text VARCHAR(500),
    confidence DECIMAL(5,4),
    is_correct BOOLEAN,
    text_accuracy DECIMAL(5,4),
    segments_json JSON,
    shape_score TINYINT,
    similarity_score TINYINT,
    direction_score TINYINT,
    stroke_order_score TINYINT,
    total_score TINYINT,
    stars TINYINT,
    feedback_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_submissions_student_item_created (student_id, item_id, created_at),
    CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_submissions_item FOREIGN KEY (item_id) REFERENCES writing_items(id),
    CONSTRAINT fk_submissions_model FOREIGN KEY (model_id) REFERENCES ai_models(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE error_types (
    id INT NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    feedback_template_vi TEXT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_error_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE submission_errors (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    error_type_id INT NOT NULL,
    segment_index TINYINT,
    stroke_index TINYINT,
    PRIMARY KEY (id),
    CONSTRAINT fk_submission_errors_submission FOREIGN KEY (submission_id) REFERENCES submissions(id),
    CONSTRAINT fk_submission_errors_type FOREIGN KEY (error_type_id) REFERENCES error_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_progress (
    student_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    attempts INT DEFAULT 0,
    best_score TINYINT,
    last_score TINYINT,
    is_mastered BOOLEAN DEFAULT FALSE,
    last_attempt_at DATETIME,
    PRIMARY KEY (student_id, item_id),
    CONSTRAINT fk_progress_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_progress_item FOREIGN KEY (item_id) REFERENCES writing_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
