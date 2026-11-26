-- V7: Dữ liệu mẫu khởi tạo sẵn cho môi trường phát triển & demo
-- - 5 tài khoản giáo viên (gv01..gv05@netxinh.local)
-- - 5 lớp học (3 Mầm non + 2 Lớp 1, môn Tiếng Việt)
-- - 50 tài khoản phụ huynh (ph01..ph50@netxinh.local)
-- - 67 học sinh (36 phụ huynh x 1 con + 11 phụ huynh x 2 con + 3 phụ huynh x 3 con)
-- - Toàn bộ 67 học sinh được ghi danh vào 5 lớp kèm liên kết phụ huynh
-- - 5 bài tập về nhà Tiếng Việt mẫu (1 bài/lớp) + điểm đánh giá mẫu
-- Mật khẩu chung của các tài khoản mẫu: NetXinh2026!

-- 1. 5 tài khoản giáo viên
INSERT IGNORE INTO users (email, password_hash, full_name, role) VALUES
('gv01@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Cô Nguyễn Thị Lan',  'TEACHER'),
('gv02@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Cô Trần Tuyết Mai',  'TEACHER'),
('gv03@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Cô Lê Hồng Nhung',   'TEACHER'),
('gv04@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Cô Phạm Minh Hằng',  'TEACHER'),
('gv05@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Thầy Vũ Đức Anh',    'TEACHER');

-- 2. 5 lớp học (3 Mầm non + 2 Lớp 1)
INSERT IGNORE INTO classrooms (teacher_id, name, school_year, grade_level, join_code)
SELECT u.id, c.name, '2026-2027', c.grade_level, c.join_code
FROM (
    SELECT 'gv01@netxinh.local' AS email, 'Lớp Mầm Non Chồi 1'       AS name, 'MAU_GIAO' AS grade_level, 'MNCHOI01' AS join_code UNION ALL
    SELECT 'gv02@netxinh.local',          'Lớp Mầm Non Lá 1',                  'MAU_GIAO',                'MNLA0102'              UNION ALL
    SELECT 'gv03@netxinh.local',          'Lớp Mầm Non Lá 2',                  'MAU_GIAO',                'MNLA0203'              UNION ALL
    SELECT 'gv04@netxinh.local',          'Lớp 1A - Hoa Hướng Dương',          'LOP_1',                   'LOP1A004'              UNION ALL
    SELECT 'gv05@netxinh.local',          'Lớp 1B - Sao Mai',                  'LOP_1',                   'LOP1B005'
) c
JOIN users u ON u.email = c.email;

-- 3. 50 tài khoản phụ huynh
INSERT IGNORE INTO users (email, password_hash, full_name, role) VALUES
('ph01@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Nguyễn Thị Hoa',    'PARENT'),
('ph02@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Trần Văn Hùng',     'PARENT'),
('ph03@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lê Thị Thu Hà',     'PARENT'),
('ph04@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Phạm Minh Đức',     'PARENT'),
('ph05@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Hoàng Ngọc Anh',    'PARENT'),
('ph06@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Vũ Quốc Tuấn',      'PARENT'),
('ph07@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đặng Thị Mai',      'PARENT'),
('ph08@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Bùi Quang Huy',     'PARENT'),
('ph09@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đỗ Thị Thanh Tâm',  'PARENT'),
('ph10@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Hồ Văn Nam',        'PARENT'),
('ph11@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Ngô Phương Thảo',   'PARENT'),
('ph12@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Dương Đình Long',   'PARENT'),
('ph13@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lý Thị Kim Ngân',   'PARENT'),
('ph14@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Võ Thành Công',     'PARENT'),
('ph15@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Trương Mỹ Linh',    'PARENT'),
('ph16@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Phan Anh Khoa',     'PARENT'),
('ph17@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Tạ Thị Bích Ngọc',  'PARENT'),
('ph18@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Trịnh Xuân Trường', 'PARENT'),
('ph19@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lương Thị Hạnh',    'PARENT'),
('ph20@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Cao Minh Nhật',     'PARENT'),
('ph21@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Nguyễn Hồng Vân',   'PARENT'),
('ph22@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Trần Quốc Bảo',     'PARENT'),
('ph23@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lê Bảo Trâm',       'PARENT'),
('ph24@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Phạm Gia Khánh',    'PARENT'),
('ph25@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Hoàng Thị Yến',     'PARENT'),
('ph26@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Vũ Tiến Dũng',      'PARENT'),
('ph27@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đặng Thùy Dương',   'PARENT'),
('ph28@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Bùi Hải Đăng',      'PARENT'),
('ph29@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đỗ Khánh Ly',       'PARENT'),
('ph30@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Hồ Trung Kiên',     'PARENT'),
('ph31@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Ngô Thị Quỳnh',     'PARENT'),
('ph32@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Dương Hoàng Việt',  'PARENT'),
('ph33@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lý Ngọc Diệp',      'PARENT'),
('ph34@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Võ Nhật Minh',      'PARENT'),
('ph35@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Trương Thảo Vy',    'PARENT'),
('ph36@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Phan Văn Thắng',    'PARENT'),
('ph37@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Nguyễn Thị Dung',   'PARENT'),
('ph38@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Trần Mạnh Cường',   'PARENT'),
('ph39@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Lê Thị Hương',      'PARENT'),
('ph40@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Phạm Văn Tùng',     'PARENT'),
('ph41@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Hoàng Thanh Trúc',  'PARENT'),
('ph42@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Vũ Hoàng Sơn',      'PARENT'),
('ph43@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đặng Mỹ Hạnh',      'PARENT'),
('ph44@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Bùi Xuân Bắc',      'PARENT'),
('ph45@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Đỗ Thu Trang',      'PARENT'),
('ph46@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Hồ Đức Thịnh',      'PARENT'),
('ph47@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Ngô Minh Châu',     'PARENT'),
('ph48@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Nguyễn Quang Vinh', 'PARENT'),
('ph49@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Chị Trần Thị Kim Oanh', 'PARENT'),
('ph50@netxinh.local', '$2a$10$77PEvTxALCjy.Vvan3bfZ.AiFjCbW5DeuE5n4YwUfhiKbVl6Pqhhq', 'Anh Lê Thành Đạt',      'PARENT');

-- 4. 67 học sinh (36 phụ huynh x 1 con = 36; 11 phụ huynh x 2 con = 22; 3 phụ huynh x 3 con = 9)
-- Phân bổ đúng độ tuổi & lớp: 40 bé Mầm non (MAU_GIAO) + 27 bé Lớp 1 (LOP_1)
CREATE TEMPORARY TABLE tmp_seed_students (
    parent_email VARCHAR(255) NOT NULL,
    nickname     VARCHAR(50)  NOT NULL,
    birth_year   SMALLINT     NOT NULL,
    grade_level  VARCHAR(20)  NOT NULL,
    join_code    VARCHAR(16)  NOT NULL,
    parent_phone VARCHAR(30)  NOT NULL
);

INSERT INTO tmp_seed_students (parent_email, nickname, birth_year, grade_level, join_code, parent_phone) VALUES
-- 36 phụ huynh có 1 con (ph01..ph36)
('ph01@netxinh.local', 'Bé Na',         2022, 'MAU_GIAO', 'MNCHOI01', '0901000001'),
('ph02@netxinh.local', 'Bé Bi',         2022, 'MAU_GIAO', 'MNCHOI01', '0901000002'),
('ph03@netxinh.local', 'Bé Bống',       2022, 'MAU_GIAO', 'MNCHOI01', '0901000003'),
('ph04@netxinh.local', 'Bé Sóc',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000004'),
('ph05@netxinh.local', 'Bé Mít',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000005'),
('ph06@netxinh.local', 'Bé Tôm',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000006'),
('ph07@netxinh.local', 'Bé Su',         2022, 'MAU_GIAO', 'MNCHOI01', '0901000007'),
('ph08@netxinh.local', 'Bé Kem',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000008'),
('ph09@netxinh.local', 'Bé Cún',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000009'),
('ph10@netxinh.local', 'Bé Gấu',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000010'),
('ph11@netxinh.local', 'Bé Thỏ',        2021, 'MAU_GIAO', 'MNLA0102', '0901000011'),
('ph12@netxinh.local', 'Bé Nhím',       2021, 'MAU_GIAO', 'MNLA0102', '0901000012'),
('ph13@netxinh.local', 'Bé Mây',        2021, 'MAU_GIAO', 'MNLA0102', '0901000013'),
('ph14@netxinh.local', 'Bé Bắp',        2021, 'MAU_GIAO', 'MNLA0102', '0901000014'),
('ph15@netxinh.local', 'Bé Dâu',        2021, 'MAU_GIAO', 'MNLA0102', '0901000015'),
('ph16@netxinh.local', 'Bé Xoài',       2021, 'MAU_GIAO', 'MNLA0102', '0901000016'),
('ph17@netxinh.local', 'Bé Cà Rốt',     2021, 'MAU_GIAO', 'MNLA0102', '0901000017'),
('ph18@netxinh.local', 'Bé Khoai',      2021, 'MAU_GIAO', 'MNLA0102', '0901000018'),
('ph19@netxinh.local', 'Bé Nấm',        2021, 'MAU_GIAO', 'MNLA0102', '0901000019'),
('ph20@netxinh.local', 'Bé Đậu',        2021, 'MAU_GIAO', 'MNLA0203', '0901000020'),
('ph21@netxinh.local', 'Bé Chip',       2021, 'MAU_GIAO', 'MNLA0203', '0901000021'),
('ph22@netxinh.local', 'Bé Bo',         2021, 'MAU_GIAO', 'MNLA0203', '0901000022'),
('ph23@netxinh.local', 'Bé Mun',        2021, 'MAU_GIAO', 'MNLA0203', '0901000023'),
('ph24@netxinh.local', 'Bé Bin',        2021, 'MAU_GIAO', 'MNLA0203', '0901000024'),
('ph25@netxinh.local', 'Bé Sam',        2021, 'MAU_GIAO', 'MNLA0203', '0901000025'),
('ph26@netxinh.local', 'Bé Tít',        2021, 'MAU_GIAO', 'MNLA0203', '0901000026'),
('ph27@netxinh.local', 'Bé Bơ',         2020, 'LOP_1',    'LOP1A004', '0901000027'),
('ph28@netxinh.local', 'Nguyễn Minh An',2020, 'LOP_1',    'LOP1A004', '0901000028'),
('ph29@netxinh.local', 'Trần Gia Huy',  2020, 'LOP_1',    'LOP1A004', '0901000029'),
('ph30@netxinh.local', 'Lê Bảo Ngọc',   2020, 'LOP_1',    'LOP1A004', '0901000030'),
('ph31@netxinh.local', 'Phạm Đức Anh',  2020, 'LOP_1',    'LOP1A004', '0901000031'),
('ph32@netxinh.local', 'Hoàng Thảo Nhi',2020, 'LOP_1',    'LOP1A004', '0901000032'),
('ph33@netxinh.local', 'Vũ Hoàng Lâm',  2020, 'LOP_1',    'LOP1B005', '0901000033'),
('ph34@netxinh.local', 'Đặng Khánh An', 2020, 'LOP_1',    'LOP1B005', '0901000034'),
('ph35@netxinh.local', 'Bùi Minh Quân', 2020, 'LOP_1',    'LOP1B005', '0901000035'),
('ph36@netxinh.local', 'Đỗ Tuệ Nhi',    2020, 'LOP_1',    'LOP1B005', '0901000036'),

-- 11 phụ huynh có 2 con (ph37..ph47 -> 22 học sinh)
('ph37@netxinh.local', 'Bé Bông',       2022, 'MAU_GIAO', 'MNCHOI01', '0901000037'),
('ph37@netxinh.local', 'Nguyễn Gia Hân',2020, 'LOP_1',    'LOP1A004', '0901000037'),
('ph38@netxinh.local', 'Bé Sữa',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000038'),
('ph38@netxinh.local', 'Trần Minh Khôi',2020, 'LOP_1',    'LOP1A004', '0901000038'),
('ph39@netxinh.local', 'Bé Cốm',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000039'),
('ph39@netxinh.local', 'Lê Ngọc Hân',   2020, 'LOP_1',    'LOP1A004', '0901000039'),
('ph40@netxinh.local', 'Bé Mèo',        2021, 'MAU_GIAO', 'MNLA0102', '0901000040'),
('ph40@netxinh.local', 'Phạm Tuấn Kiệt',2020, 'LOP_1',    'LOP1A004', '0901000040'),
('ph41@netxinh.local', 'Bé Cáo',        2021, 'MAU_GIAO', 'MNLA0102', '0901000041'),
('ph41@netxinh.local', 'Hoàng An Nhiên',2020, 'LOP_1',    'LOP1A004', '0901000041'),
('ph42@netxinh.local', 'Bé Voi',        2021, 'MAU_GIAO', 'MNLA0102', '0901000042'),
('ph42@netxinh.local', 'Vũ Bảo Nam',    2020, 'LOP_1',    'LOP1A004', '0901000042'),
('ph43@netxinh.local', 'Bé Gạo',        2021, 'MAU_GIAO', 'MNLA0203', '0901000043'),
('ph43@netxinh.local', 'Đặng Hà My',    2020, 'LOP_1',    'LOP1B005', '0901000043'),
('ph44@netxinh.local', 'Bé Bún',        2021, 'MAU_GIAO', 'MNLA0203', '0901000044'),
('ph44@netxinh.local', 'Bùi Gia Bảo',   2020, 'LOP_1',    'LOP1B005', '0901000044'),
('ph45@netxinh.local', 'Bé Sâu',        2021, 'MAU_GIAO', 'MNLA0203', '0901000045'),
('ph45@netxinh.local', 'Đỗ Minh Châu',  2020, 'LOP_1',    'LOP1B005', '0901000045'),
('ph46@netxinh.local', 'Bé Táo',        2021, 'MAU_GIAO', 'MNLA0203', '0901000046'),
('ph46@netxinh.local', 'Hồ Nhật Quang', 2020, 'LOP_1',    'LOP1B005', '0901000046'),
('ph47@netxinh.local', 'Bé Ổi',         2021, 'MAU_GIAO', 'MNLA0203', '0901000047'),
('ph47@netxinh.local', 'Ngô Thanh Hà',  2020, 'LOP_1',    'LOP1B005', '0901000047'),

-- 3 phụ huynh có 3 con (ph48..ph50 -> 9 học sinh)
('ph48@netxinh.local', 'Bé Cam',        2022, 'MAU_GIAO', 'MNCHOI01', '0901000048'),
('ph48@netxinh.local', 'Bé Quýt',       2021, 'MAU_GIAO', 'MNLA0102', '0901000048'),
('ph48@netxinh.local', 'Nguyễn Bảo An', 2020, 'LOP_1',    'LOP1A004', '0901000048'),
('ph49@netxinh.local', 'Bé Chanh',      2021, 'MAU_GIAO', 'MNLA0203', '0901000049'),
('ph49@netxinh.local', 'Trần Ngọc Diệp',2020, 'LOP_1',    'LOP1A004', '0901000049'),
('ph49@netxinh.local', 'Trần Quốc Huy', 2020, 'LOP_1',    'LOP1B005', '0901000049'),
('ph50@netxinh.local', 'Lê Minh Thư',   2020, 'LOP_1',    'LOP1B005', '0901000050'),
('ph50@netxinh.local', 'Lê Anh Tuấn',   2020, 'LOP_1',    'LOP1B005', '0901000050'),
('ph50@netxinh.local', 'Lê Phương Anh', 2020, 'LOP_1',    'LOP1B005', '0901000050');

-- Chèn 67 học sinh (tránh trùng lặp nếu đã tồn tại)
INSERT INTO students (parent_id, nickname, birth_year, grade_level)
SELECT u.id, t.nickname, t.birth_year, t.grade_level
FROM tmp_seed_students t
JOIN users u ON u.email = t.parent_email
WHERE NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.parent_id = u.id AND s.nickname = t.nickname
);

-- 5. Ghi danh toàn bộ 67 học sinh vào 5 lớp tương ứng (có liên kết phụ huynh)
INSERT IGNORE INTO classroom_enrollments
    (classroom_id, student_id, display_name, birth_year, parent_name_note, parent_phone, teacher_note)
SELECT
    c.id,
    s.id,
    s.nickname,
    s.birth_year,
    u.full_name,
    t.parent_phone,
    CASE
        WHEN t.grade_level = 'MAU_GIAO' THEN 'Bé làm quen nét cơ bản và cầm bút đúng tư thế'
        ELSE 'Bé luyện viết chữ đều nét trên vở ô ly'
    END
FROM tmp_seed_students t
JOIN users u      ON u.email = t.parent_email
JOIN students s   ON s.parent_id = u.id AND s.nickname = t.nickname
JOIN classrooms c ON c.join_code = t.join_code;

DROP TEMPORARY TABLE tmp_seed_students;

-- 6. Tạo 5 bài tập về nhà Tiếng Việt mẫu (1 bài cho mỗi lớp)
INSERT INTO review_batches
    (classroom_id, title, subject, is_homework, batch_date, notes, description, due_at, required_pages)
SELECT
    c.id,
    b.title,
    'TIENG_VIET',
    TRUE,
    CURDATE(),
    b.notes,
    b.description,
    DATE_ADD(NOW(), INTERVAL 3 DAY),
    b.required_pages
FROM (
    SELECT 'MNCHOI01' AS join_code,
           'Bài tập Tiếng Việt tuần 1: Tô nét cong và chữ o, ô, ơ' AS title,
           'Dùng bút chì 2B, ba mẹ hướng dẫn bé cầm bút đúng' AS notes,
           'Các con tô 2 dòng nét cong kín và 2 dòng chữ o, ô, ơ. Ba mẹ chụp 1 trang vở gửi cô nhé.' AS description,
           1 AS required_pages
    UNION ALL
    SELECT 'MNLA0102',
           'Bài tập Tiếng Việt tuần 1: Tập tô nhóm chữ a, ă, â',
           'Giữ vở sạch đẹp, không tẩy xóa nhiều',
           'Các con tập tô chữ a, ă, â vào vở tập tô. Ba mẹ chụp rõ 1 trang nộp cho cô.',
           1
    UNION ALL
    SELECT 'MNLA0203',
           'Bài tập Tiếng Việt tuần 1: Tập tô chữ cái b, c, d, đ',
           'Chú ý độ cao nét khuyết trên của chữ b',
           'Các con tô đều tay nhóm chữ b, c, d, đ. Ba mẹ chụp 1 trang nộp trước hạn nhé.',
           1
    UNION ALL
    SELECT 'LOP1A004',
           'Bài tập Tiếng Việt tuần 5: Luyện viết chữ ghép ch, nh, th',
           'Viết vở ô ly 4 dòng, giữ khoảng cách giữa các chữ',
           'Các con viết 2 dòng chữ ch, 2 dòng chữ nh, 2 dòng chữ th và câu "Bé đi học". Ba mẹ chụp 2 trang nộp cho cô.',
           2
    UNION ALL
    SELECT 'LOP1B005',
           'Bài tập Tiếng Việt tuần 5: Tập chép câu ngắn vở ô ly',
           'Chú ý đặt dấu thanh đúng vị trí',
           'Các con chép 4 dòng câu "Mẹ đưa bé tới trường" vào vở ô ly. Ba mẹ chụp 2 trang nộp cho cô.',
           2
) b
JOIN classrooms c ON c.join_code = b.join_code
WHERE NOT EXISTS (
    SELECT 1 FROM review_batches rb
    WHERE rb.classroom_id = c.id AND rb.title = b.title
);

-- 7. Tạo sẵn bản ghi đánh giá cho học sinh trong các bài tập trên
-- (3 học sinh đầu mỗi lớp có điểm mẫu đã gửi phụ huynh để dễ xem sổ điểm & trang phụ huynh)
INSERT IGNORE INTO student_evaluations
    (batch_id, enrollment_id, rating, score, grading_mode, teacher_comment, needs_attention, sent_to_parent_at)
SELECT
    rb.id,
    ce.id,
    CASE
        WHEN rn = 1 THEN 'HOAN_THANH_TOT'
        WHEN rn = 2 THEN 'HOAN_THANH'
        WHEN rn = 3 THEN 'CAN_CO_GANG'
        ELSE NULL
    END,
    CASE
        WHEN rn = 1 THEN 9.50
        WHEN rn = 2 THEN 8.50
        WHEN rn = 3 THEN 6.50
        ELSE NULL
    END,
    'MANUAL',
    CASE
        WHEN rn = 1 THEN 'Bé viết rất đều nét, trình bày vở sạch đẹp!'
        WHEN rn = 2 THEN 'Con hoàn thành đủ bài, chú ý giữ khoảng cách chữ đều hơn.'
        WHEN rn = 3 THEN 'Con cần luyện thêm nét cong và đặt bút đúng dòng kẻ nhé.'
        ELSE NULL
    END,
    CASE WHEN rn = 3 THEN TRUE ELSE FALSE END,
    CASE WHEN rn <= 3 THEN NOW() ELSE NULL END
FROM (
    SELECT
        ce.id,
        ce.classroom_id,
        ROW_NUMBER() OVER (PARTITION BY ce.classroom_id ORDER BY ce.id) AS rn
    FROM classroom_enrollments ce
    JOIN classrooms c ON c.id = ce.classroom_id
    WHERE c.join_code IN ('MNCHOI01', 'MNLA0102', 'MNLA0203', 'LOP1A004', 'LOP1B005')
) ce
JOIN review_batches rb ON rb.classroom_id = ce.classroom_id AND rb.is_homework = TRUE;
