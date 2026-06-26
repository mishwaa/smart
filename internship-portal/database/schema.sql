-- ============================================================
-- Internship Portal - Database Schema
-- Database: MySQL 8.x / MariaDB 10.x
-- Engine:   InnoDB | Charset: utf8mb4
-- Created:  2026-06-26
-- ============================================================

CREATE DATABASE IF NOT EXISTS internship_portal;
USE internship_portal;

-- ============================================================
-- DROP TABLES (reverse dependency order — children first)
-- ============================================================

DROP TABLE IF EXISTS certificates;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS weekly_reports;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS internships;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       ENUM('admin', 'student', 'faculty', 'company') NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_role  (role),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE students (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    roll_number   VARCHAR(50) UNIQUE NOT NULL,
    department    VARCHAR(100),
    semester      INT,
    phone         VARCHAR(20),
    address       TEXT,
    cgpa          DECIMAL(4,2),
    resume_path   VARCHAR(500),
    profile_image VARCHAR(500),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_students_department  (department),
    INDEX idx_students_roll_number (roll_number),

    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: faculty
-- ============================================================
CREATE TABLE faculty (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    employee_id   VARCHAR(50) UNIQUE NOT NULL,
    department    VARCHAR(100),
    designation   VARCHAR(100),
    phone         VARCHAR(20),
    profile_image VARCHAR(500),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_faculty_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: companies
-- ============================================================
CREATE TABLE companies (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    company_name   VARCHAR(255) NOT NULL,
    industry       VARCHAR(100),
    website        VARCHAR(255),
    contact_person VARCHAR(200),
    contact_email  VARCHAR(255),
    contact_phone  VARCHAR(20),
    address        TEXT,
    description    TEXT,
    logo_path      VARCHAR(500),
    is_verified    BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_companies_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: internships
-- ============================================================
CREATE TABLE internships (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    company_id   INT NOT NULL,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    requirements TEXT,
    location     VARCHAR(200),
    duration     VARCHAR(100),
    stipend      DECIMAL(10,2),
    positions    INT DEFAULT 1,
    start_date   DATE,
    end_date     DATE,
    status       ENUM('open', 'closed', 'filled') DEFAULT 'open',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_internships_status     (status),
    INDEX idx_internships_company_id (company_id),

    CONSTRAINT fk_internships_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: applications
-- ============================================================
CREATE TABLE applications (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    student_id     INT NOT NULL,
    internship_id  INT NOT NULL,
    status         ENUM('pending', 'shortlisted', 'accepted', 'rejected') DEFAULT 'pending',
    cover_letter   TEXT,
    applied_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_applications_student_internship (student_id, internship_id),
    INDEX idx_applications_status (status),

    CONSTRAINT fk_applications_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE attendance (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    student_id     INT NOT NULL,
    internship_id  INT NOT NULL,
    date           DATE NOT NULL,
    status         ENUM('present', 'absent', 'leave') NOT NULL,
    remarks        TEXT,
    marked_by      INT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_attendance_student_internship_date (student_id, internship_id, date),

    CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_marked_by
        FOREIGN KEY (marked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: weekly_reports
-- ============================================================
CREATE TABLE weekly_reports (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    student_id         INT NOT NULL,
    internship_id      INT NOT NULL,
    week_number        INT NOT NULL,
    report_content     TEXT NOT NULL,
    file_path          VARCHAR(500),
    supervisor_remarks TEXT,
    status             ENUM('submitted', 'reviewed', 'approved', 'rejected') DEFAULT 'submitted',
    submitted_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at        TIMESTAMP NULL,

    UNIQUE KEY uk_weekly_reports_student_internship_week (student_id, internship_id, week_number),

    CONSTRAINT fk_weekly_reports_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_weekly_reports_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: documents
-- ============================================================
CREATE TABLE documents (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    document_type  ENUM('resume', 'offer_letter', 'completion_certificate', 'report', 'other') NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    file_path      VARCHAR(500) NOT NULL,
    file_size      INT,
    uploaded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_documents_user_id       (user_id),
    INDEX idx_documents_document_type (document_type),

    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: feedback
-- ============================================================
CREATE TABLE feedback (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id   INT NOT NULL,
    to_user_id     INT NOT NULL,
    internship_id  INT,
    rating         INT CHECK (rating >= 1 AND rating <= 5),
    comments       TEXT,
    feedback_type  ENUM('student_to_company', 'company_to_student', 'faculty_review') NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_from_user
        FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_to_user
        FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: certificates
-- ============================================================
CREATE TABLE certificates (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    student_id          INT NOT NULL,
    internship_id       INT NOT NULL,
    certificate_number  VARCHAR(100) UNIQUE NOT NULL,
    issued_date         DATE NOT NULL,
    file_path           VARCHAR(500),
    issued_by           INT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_certificates_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_certificates_internship
        FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE CASCADE,
    CONSTRAINT fk_certificates_issued_by
        FOREIGN KEY (issued_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
