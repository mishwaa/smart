-- ============================================================
-- Migration: Faculty Management & ERP System
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- 1. Associate Students with Faculty Supervisors (Assignments)
ALTER TABLE students
ADD COLUMN faculty_id INT DEFAULT NULL AFTER user_id,
ADD CONSTRAINT fk_students_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL;

-- Create index for performance optimization on assigned student lookups
CREATE INDEX idx_students_faculty_id ON students(faculty_id);

-- 2. Add Status and Remarks to Student Documents for Approval Workflow
ALTER TABLE student_documents
ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER file_size,
ADD COLUMN remarks TEXT DEFAULT NULL AFTER status;

-- Create index on document status for dashboard analytics
CREATE INDEX idx_student_documents_status ON student_documents(status);
