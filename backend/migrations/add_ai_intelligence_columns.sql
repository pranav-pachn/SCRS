-- Migration: Add AI Intelligence columns to complaints table
-- Date: 2026-02-22
-- Purpose: Add summary, tags, and ai_suggested_priority columns for AI Complaint Intelligence Module



-- Add summary column (TEXT, nullable)
-- Note: MySQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- If column already exists, this will fail - that's okay, just skip it
ALTER TABLE complaints 
ADD COLUMN summary TEXT NULL 
AFTER description;

-- Add tags column (TEXT, nullable - MySQL 5.5 compatible fallback for JSON)
ALTER TABLE complaints 
ADD COLUMN tags TEXT NULL 
AFTER summary;

-- Add ai_suggested_priority column (ENUM, nullable)
-- Note: Using ENUM('Low','Medium','High','Critical') as specified
ALTER TABLE complaints 
ADD COLUMN ai_suggested_priority ENUM('Low','Medium','High','Critical') NULL 
AFTER priority;

-- Add index on ai_suggested_priority for filtering/sorting
CREATE INDEX idx_complaints_ai_suggested_priority 
ON complaints(ai_suggested_priority);

-- Verify columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'scrs' 
  AND TABLE_NAME = 'complaints'
  AND COLUMN_NAME IN ('summary', 'tags', 'ai_suggested_priority')
ORDER BY ORDINAL_POSITION;
