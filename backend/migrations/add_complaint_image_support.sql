-- Migration: Add Image Upload Support for Complaints
-- Date: 2026-03-03
-- Purpose: Add image_url column to store user-uploaded images with complaints



-- Add image_url column to store base64 image data URLs or external image URLs
-- MEDIUMTEXT type to handle large base64 strings (up to 16MB)
ALTER TABLE complaints 
ADD COLUMN image_url MEDIUMTEXT NULL 
AFTER location;

-- Verify column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'scrs' 
  AND TABLE_NAME = 'complaints'
  AND COLUMN_NAME = 'image_url'
ORDER BY ORDINAL_POSITION;
