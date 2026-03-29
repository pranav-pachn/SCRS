-- =========================================================
-- Migration: Add admin operational fields to complaints
-- =========================================================

-- Add assigned_admin_id for complaint assignment
ALTER TABLE complaints ADD COLUMN assigned_admin_id INT NULL;
ALTER TABLE complaints ADD FOREIGN KEY (assigned_admin_id) REFERENCES users(id);

-- Add resolved_at timestamp to track resolution time
ALTER TABLE complaints ADD COLUMN resolved_at DATETIME NULL;

-- Create complaint_remarks table for internal admin remarks
CREATE TABLE IF NOT EXISTS complaint_remarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    admin_id INT NOT NULL,
    remark_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id),
    FOREIGN KEY (admin_id) REFERENCES users(id),
    INDEX idx_complaint_id (complaint_id),
    INDEX idx_admin_id (admin_id),
    INDEX idx_created_at (created_at)
);

-- Add proof_url to complaints for resolution proof
ALTER TABLE complaints ADD COLUMN proof_url VARCHAR(500) NULL;

-- Create index on assigned_admin_id for faster queries
CREATE INDEX idx_assigned_admin_id ON complaints(assigned_admin_id);
CREATE INDEX idx_status_priority ON complaints(status, priority);
