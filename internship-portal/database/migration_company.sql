-- ============================================================
-- Migration: Company Management & ERP System
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- 1. Extend the Feedback Table for Detailed Mentor Evaluations
ALTER TABLE feedback
ADD COLUMN technical_rating INT DEFAULT NULL AFTER rating,
ADD COLUMN communication_rating INT DEFAULT NULL AFTER technical_rating,
ADD COLUMN professionalism_rating INT DEFAULT NULL AFTER communication_rating,
ADD COLUMN punctuality_rating INT DEFAULT NULL AFTER professionalism_rating,
ADD COLUMN recommend_completion BOOLEAN DEFAULT FALSE AFTER comments,
ADD COLUMN recommend_certificate BOOLEAN DEFAULT FALSE AFTER recommend_completion,
ADD COLUMN is_final BOOLEAN DEFAULT FALSE AFTER recommend_certificate;

-- Create index on is_final to easily query final evaluations for certificate releases
CREATE INDEX idx_feedback_is_final ON feedback(is_final);

-- 2. Extend the Daily Logs Table for Mentor Verification Remarks
ALTER TABLE daily_logs
ADD COLUMN verified_by INT DEFAULT NULL AFTER remarks,
ADD COLUMN verified_at TIMESTAMP DEFAULT NULL AFTER verified_by,
ADD CONSTRAINT fk_daily_logs_verified_by
    FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL;
