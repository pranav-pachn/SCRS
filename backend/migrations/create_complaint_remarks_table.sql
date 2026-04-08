-- Migration: Create Complaint Remarks Table
-- Date: 2026-02-22
-- Purpose: Store internal admin remarks for complaints (not visible to citizens)



-- Create complaint_remarks table
CREATE TABLE IF NOT EXISTS complaint_remarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  admin_id INT NOT NULL,
  remark_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_remarks_complaint 
ON complaint_remarks(complaint_id);

CREATE INDEX idx_remarks_admin 
ON complaint_remarks(admin_id);

CREATE INDEX idx_remarks_created 
ON complaint_remarks(created_at DESC);

-- Verify table was created
SHOW TABLES LIKE 'complaint_remarks';

-- Show table structure
DESCRIBE complaint_remarks;
