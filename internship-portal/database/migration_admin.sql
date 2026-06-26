-- ============================================================
-- Migration: Admin Management & ERP System (Phase 6)
-- Date: 2026-06-26
-- ============================================================

USE internship_portal;

-- 1. Create Audit Logs Table for Administrative tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create System Settings Table for configuration parameters
CREATE TABLE IF NOT EXISTS system_settings (
    `key` VARCHAR(100) NOT NULL PRIMARY KEY,
    `value` TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT NULL,
    CONSTRAINT fk_system_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Seed initial system configuration parameters
INSERT INTO system_settings (`key`, `value`, updated_by) VALUES
('portal_name', 'Smart University Internship Portal', NULL),
('academic_year', '2026', NULL),
('maintenance_mode', 'false', NULL),
('allow_student_registration', 'true', NULL),
('max_file_upload_size_mb', '10', NULL)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create index on action and created_at to optimize administrative search queries
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
