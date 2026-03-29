-- Migration: Add Admin Operational Fields
-- Date: 2026-02-22
-- Purpose: Add assigned_admin_id and proof_url columns for admin operational role

USE scrs;

-- Add assigned_admin_id column (nullable, initially NULL)
-- This tracks which admin is assigned to handle the complaint
ALTER TABLE complaints 
ADD COLUMN assigned_admin_id INT NULL 
AFTER priority;

-- Add foreign key constraint
ALTER TABLE complaints
ADD CONSTRAINT fk_complaints_assigned_admin
FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add proof_url column for resolve proof images
ALTER TABLE complaints
ADD COLUMN proof_url VARCHAR(2083) NULL
AFTER updated_at;

-- Add index on assigned_admin_id for faster queries
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_admin 
ON complaints(assigned_admin_id);

-- Add composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_status 
ON complaints(assigned_admin_id, status);

-- Verify columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'scrs' 
  AND TABLE_NAME = 'complaints'
  AND COLUMN_NAME IN ('assigned_admin_id', 'proof_url')
ORDER BY ORDINAL_POSITION;
