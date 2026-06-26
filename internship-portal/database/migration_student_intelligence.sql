-- ============================================================
-- Migration: Student Intelligence & Analytics
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- Add is_read column to timeline_events safely to support Notification Center
ALTER TABLE timeline_events
ADD COLUMN is_read BOOLEAN DEFAULT FALSE AFTER event_date;
