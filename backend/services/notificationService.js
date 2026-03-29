/**
 * Notification Service
 *
 * Provides lightweight persisted notifications for admin/citizen polling flows.
 */

async function ensureNotificationTable(dbConnection) {
  await dbConnection.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(180) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('assignment','escalation','reassignment','resolved','system') NOT NULL DEFAULT 'system',
      related_complaint_id INT NULL,
      metadata_json JSON NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      INDEX idx_notifications_user_created (user_id, created_at DESC),
      INDEX idx_notifications_user_read (user_id, is_read),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_notifications_complaint FOREIGN KEY (related_complaint_id) REFERENCES complaints(id) ON DELETE SET NULL
    )
  `);
}

async function createNotification(dbConnection, payload) {
  const {
    userId,
    title,
    message,
    type = 'system',
    relatedComplaintId = null,
    metadata = null
  } = payload || {};

  if (!userId || !title || !message) {
    throw new Error('userId, title and message are required to create a notification');
  }

  await ensureNotificationTable(dbConnection);

  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const [result] = await dbConnection.execute(
    `INSERT INTO notifications (user_id, title, message, type, related_complaint_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, message, type, relatedComplaintId, metadataJson]
  );

  const [rows] = await dbConnection.execute(
    `SELECT id, user_id, title, message, type, related_complaint_id, metadata_json, is_read, created_at, read_at
     FROM notifications
     WHERE id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0] || null;
}

async function listNotifications(dbConnection, userId, options = {}) {
  if (!userId) {
    throw new Error('userId is required');
  }

  await ensureNotificationTable(dbConnection);

  const limit = Math.max(1, Math.min(Number(options.limit) || 25, 100));
  const unreadOnly = Boolean(options.unreadOnly);

  const params = [userId];
  let query = `
    SELECT id, user_id, title, message, type, related_complaint_id, metadata_json, is_read, created_at, read_at
    FROM notifications
    WHERE user_id = ?
  `;

  if (unreadOnly) {
    query += ' AND is_read = FALSE';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const [rows] = await dbConnection.execute(query, params);

  const [countRows] = await dbConnection.execute(
    'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  return {
    notifications: rows,
    unreadCount: Number(countRows[0]?.unread_count || 0)
  };
}

async function markNotificationRead(dbConnection, userId, notificationId) {
  if (!userId || !notificationId) {
    throw new Error('userId and notificationId are required');
  }

  await ensureNotificationTable(dbConnection);

  const [result] = await dbConnection.execute(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );

  return result.affectedRows > 0;
}

async function markAllNotificationsRead(dbConnection, userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  await ensureNotificationTable(dbConnection);

  const [result] = await dbConnection.execute(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );

  return Number(result.affectedRows || 0);
}

module.exports = {
  ensureNotificationTable,
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
