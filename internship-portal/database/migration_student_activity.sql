-- ============================================================
-- Migration: Student Activity & Internship ERP System
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- 1. Extend the Attendance Table
ALTER TABLE attendance
ADD COLUMN check_in_time TIME DEFAULT NULL AFTER status,
ADD COLUMN check_out_time TIME DEFAULT NULL AFTER check_in_time,
ADD COLUMN working_hours DECIMAL(4,2) DEFAULT NULL AFTER check_out_time,
ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER working_hours,
ADD COLUMN leave_reason TEXT DEFAULT NULL AFTER remarks,
ADD COLUMN leave_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL AFTER leave_reason;

-- Adjust constraints and defaults on attendance status
ALTER TABLE attendance MODIFY COLUMN status ENUM('present', 'absent', 'leave') DEFAULT 'present';

-- 2. Extend the Weekly Reports Table
ALTER TABLE weekly_reports
MODIFY COLUMN report_content TEXT DEFAULT NULL,
ADD COLUMN date_range VARCHAR(100) DEFAULT NULL AFTER week_number,
ADD COLUMN skills_learned TEXT DEFAULT NULL AFTER report_content,
ADD COLUMN problems_faced TEXT DEFAULT NULL AFTER skills_learned,
ADD COLUMN hours_worked DECIMAL(5,2) DEFAULT NULL AFTER problems_faced,
ADD COLUMN achievements TEXT DEFAULT NULL AFTER hours_worked,
ADD COLUMN future_plan TEXT DEFAULT NULL AFTER achievements,
ADD COLUMN mentor_remarks TEXT DEFAULT NULL AFTER future_plan,
ADD COLUMN faculty_remarks TEXT DEFAULT NULL AFTER mentor_remarks;

-- Modify status enum to include 'draft' and make it the default
ALTER TABLE weekly_reports MODIFY COLUMN status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected') DEFAULT 'draft';

-- 3. Create Daily Logs Table (Missing)
CREATE TABLE IF NOT EXISTS daily_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    internship_id INT NOT NULL,
    date DATE NOT NULL,
    tasks_completed TEXT NOT NULL,
    hours_worked DECIMAL(4,2) NOT NULL,
    technology_used VARCHAR(255) DEFAULT NULL,
    problems_faced TEXT DEFAULT NULL,
    learning_outcome TEXT DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_daily_logs_student_date (student_id, date),
    INDEX idx_daily_logs_date (date),

    CONSTRAINT fk_daily_logs_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_logs_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Create Student Documents Table (Missing)
CREATE TABLE IF NOT EXISTS student_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    document_type ENUM('resume', 'offer_letter', 'noc', 'weekly_report_pdf', 'presentation', 'final_report', 'certificate', 'other') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_student_documents_student (student_id),
    INDEX idx_student_documents_type (document_type),

    CONSTRAINT fk_student_documents_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Create Timeline Events Table (Missing)
CREATE TABLE IF NOT EXISTS timeline_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    event_type ENUM('application', 'offer_letter', 'faculty_approval', 'internship_started', 'attendance', 'weekly_reports', 'mentor_feedback', 'completion') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    event_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_timeline_events_student (student_id),
    INDEX idx_timeline_events_date (event_date),

    CONSTRAINT fk_timeline_events_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
