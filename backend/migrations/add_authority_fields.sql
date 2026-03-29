-- =========================================================
-- Migration: Add Authority Supervisory Role fields
-- =========================================================

-- Add manual_priority_override flag to track authority overrides
ALTER TABLE complaints ADD COLUMN manual_priority_override BOOLEAN DEFAULT FALSE;

-- Add escalation flag for escalated complaints
ALTER TABLE complaints ADD COLUMN is_escalated BOOLEAN DEFAULT FALSE;

-- Create index for authority queries
CREATE INDEX idx_manual_priority_override ON complaints(manual_priority_override);
CREATE INDEX idx_is_escalated ON complaints(is_escalated);

-- Enhance complaint_history table to store more detailed change information
-- Add 'action' column to track what type of change was made
ALTER TABLE complaint_history ADD COLUMN action VARCHAR(50);

-- Add 'role' column to track which role made the change
ALTER TABLE complaint_history ADD COLUMN role ENUM('citizen','admin','authority') DEFAULT 'admin';

-- Add 'old_value' and 'new_value' for generic field changes
ALTER TABLE complaint_history ADD COLUMN old_value VARCHAR(255);
ALTER TABLE complaint_history ADD COLUMN new_value VARCHAR(255);

-- Add 'field_changed' to track which field was modified
ALTER TABLE complaint_history ADD COLUMN field_changed VARCHAR(100);

-- Create indexes for better complaint_history queries
CREATE INDEX idx_complaint_history_role ON complaint_history(role);
CREATE INDEX idx_complaint_history_action ON complaint_history(action);
CREATE INDEX idx_complaint_history_created ON complaint_history(created_at);
