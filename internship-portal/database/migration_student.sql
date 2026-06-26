-- ============================================================
-- Migration: Add Student Specific Columns to Students Table
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- Add enrollment_number, gender, dob, profile_photo, skills, bio, linkedin, and github columns safely
ALTER TABLE students
ADD COLUMN enrollment_number VARCHAR(100) UNIQUE DEFAULT NULL AFTER roll_number,
ADD COLUMN gender VARCHAR(20) DEFAULT NULL AFTER address,
ADD COLUMN dob DATE DEFAULT NULL AFTER gender,
ADD COLUMN profile_photo VARCHAR(500) DEFAULT NULL AFTER profile_image,
ADD COLUMN skills TEXT DEFAULT NULL AFTER profile_photo,
ADD COLUMN bio TEXT DEFAULT NULL AFTER skills,
ADD COLUMN linkedin VARCHAR(255) DEFAULT NULL AFTER bio,
ADD COLUMN github VARCHAR(255) DEFAULT NULL AFTER linkedin;
