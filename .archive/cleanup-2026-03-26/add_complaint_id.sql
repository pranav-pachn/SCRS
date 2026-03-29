-- Add complaint_id column to existing complaints table
-- This script will add the column and update existing data

-- First, add the complaint_id column as a regular VARCHAR column
ALTER TABLE complaints ADD COLUMN complaint_id VARCHAR(20);

-- Update existing records to have formatted complaint IDs
UPDATE complaints SET complaint_id = CONCAT('COMP-', LPAD(id, 4, '0')) WHERE complaint_id IS NULL;

-- Check the result
SELECT id, complaint_id, category, status FROM complaints LIMIT 5;
