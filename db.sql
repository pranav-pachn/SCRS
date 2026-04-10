-- Users table (citizens & admins)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role ENUM('citizen','admin','authority') NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints table (with soft delete support for audit trail)
CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(20),
  user_id INT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  status ENUM('Submitted','In Progress','Resolved') NOT NULL DEFAULT 'Submitted',
  priority ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at DATETIME NULL,
  deleted_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Complaint history for status/log changes
CREATE TABLE IF NOT EXISTS complaint_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  changed_by INT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Attachments for complaints
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(2083) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- ============================================================
-- INDEX STRATEGY FOR PERFORMANCE
-- ============================================================
-- Single-column indexes for WHERE clause filtering
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_created_at ON complaints(created_at);

-- Composite indexes for common query patterns
-- Used for: WHERE category = ? AND location = ? (duplicate detection)
CREATE INDEX idx_complaints_category_location ON complaints(category, location);

-- Used for: WHERE user_id = ? AND is_deleted = FALSE (user's complaints)
CREATE INDEX idx_complaints_user_is_deleted ON complaints(user_id, is_deleted);

-- Used for: WHERE is_deleted = FALSE ORDER BY created_at DESC (pagination)
CREATE INDEX idx_complaints_is_deleted_created ON complaints(is_deleted, created_at DESC);

-- Soft delete support: Filter out deleted records
CREATE INDEX idx_complaints_is_deleted ON complaints(is_deleted);

-- Full-text index disabled for MySQL 5.5 compatibility
-- CREATE FULLTEXT INDEX ft_complaint_description ON complaints(description);

-- =========================
-- Common operations / queries
-- =========================

-- 1) Create a complaint (use prepared statement or parameterized query)
INSERT INTO complaints (user_id, category, description, location, priority)
VALUES (?, ?, ?, ?, ?);

-- 2) Get a complaint by id
SELECT c.*, u.name AS user_name, u.email
FROM complaints c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.id = ?;

-- 3) List complaints for a user with pagination
SELECT * FROM complaints
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- 4) Update status and log in complaint_history (wrap in transaction)
START TRANSACTION;
-- capture old status (optional)
SET @old := (SELECT status FROM complaints WHERE id = ?);
UPDATE complaints SET status = ?, updated_at = NOW() WHERE id = ?;
INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note)
VALUES (?, ?, @old, ?, ?);
COMMIT;

-- 5) Search complaints (FTS + fallback to location)
SELECT *
FROM complaints
WHERE MATCH(description) AGAINST (? IN NATURAL LANGUAGE MODE)
  OR location LIKE CONCAT('%', ?, '%')
ORDER BY created_at DESC
LIMIT 50;

-- 6) Dashboard: counts by status
SELECT status, COUNT(*) AS total FROM complaints GROUP BY status;

-- 7) Dashboard: counts by priority
SELECT priority, COUNT(*) AS total FROM complaints GROUP BY priority;

-- 8) Top categories
SELECT category, COUNT(*) AS total
FROM complaints
GROUP BY category
ORDER BY total DESC
LIMIT 10;

-- 9) Trend (last 30 days)
SELECT DATE(created_at) AS day, COUNT(*) AS total
FROM complaints
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY day;

-- 10) Delete a complaint (attachments & history cascade)
DELETE FROM complaints WHERE id = ?;
