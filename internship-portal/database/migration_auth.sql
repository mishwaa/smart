-- ============================================================
-- Migration: Add Authentication Columns to Users Table
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- Add name and must_change_password columns safely if they do not exist
ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '' AFTER id;
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER is_active;
