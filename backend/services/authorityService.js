/**
 * Authority Service - Business Logic Layer
 *
 * Handles all database operations for the Authority supervisory role.
 * - View and filter all complaints
 * - Reassign complaints between admins
 * - Manually override complaint priority (without touching AI suggestion)
 * - System-wide analytics and performance dashboards
 * - CSV export for audits
 *
 * All write operations log into complaint_history for audit trail.
 */

/**
 * Internal helper to log authority actions into complaint_history.
 *
 * @param {Object} connection - MySQL connection (from pool.getConnection())
 * @param {number} complaintId
 * @param {string|null} oldValue
 * @param {string|null} newValue
 * @param {number} authorityId
 * @param {string} note
 */
async function logAuthorityHistory(connection, complaintId, oldValue, newValue, authorityId, note) {
  const safeOld = oldValue != null ? String(oldValue) : null;
  const safeNew = newValue != null ? String(newValue) : null;
  const historyNote = `AUTHORITY_ACTION: ${note}`;

  await connection.execute(
    `INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note)
     VALUES (?, ?, ?, ?, ?)`,
    [complaintId, authorityId, safeOld, safeNew, historyNote]
  );
}

/**
 * Get all complaints with optional filters for authority view.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @param {Object} filters
 * @param {string|null} filters.status
 * @param {string|null} filters.priority
 * @param {string|null} filters.category
 * @param {string|null} filters.location
 * @param {number|null} filters.assigned_admin_id
 * @returns {Promise<Array>}
 */
async function getAllComplaints(dbConnection, filters = {}, pagination = null) {
  const validStatuses = ['Submitted', 'In Progress', 'Resolved'];
  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];

  // Build WHERE clause conditions
  let whereConditions = 'c.is_deleted = FALSE';
  const filterParams = [];

  if (filters.status && validStatuses.includes(filters.status)) {
    whereConditions += ' AND c.status = ?';
    filterParams.push(filters.status);
  }

  if (filters.priority && validPriorities.includes(filters.priority)) {
    whereConditions += ' AND c.priority = ?';
    filterParams.push(filters.priority);
  }

  if (filters.category) {
    whereConditions += ' AND c.category = ?';
    filterParams.push(filters.category);
  }

  if (filters.location) {
    whereConditions += ' AND c.location LIKE ?';
    filterParams.push(`%${filters.location}%`);
  }

  if (filters.assigned_admin_id) {
    whereConditions += ' AND c.assigned_admin_id = ?';
    filterParams.push(filters.assigned_admin_id);
  }

  // Get total count for pagination
  let total = 0;
  if (pagination) {
    const countQuery = `SELECT COUNT(*) as count FROM complaints c WHERE ${whereConditions}`;
    const [countRows] = await dbConnection.execute(countQuery, filterParams);
    total = countRows[0].count;
  }

  // Build main query
  let query = `
    SELECT
      c.id,
      CONCAT('COMP-', LPAD(c.id, 4, '0')) AS complaint_id,
      c.category,
      c.description,
      c.location,
      c.status,
      c.priority,
      c.summary,
      c.tags,
      c.ai_suggested_priority,
      c.manual_priority_override,
      c.assigned_admin_id,
      c.created_at,
      c.updated_at,
      c.resolved_at,
      submitter.name AS submitter_name,
      submitter.email AS submitter_email,
      admin.name AS assigned_admin_name
    FROM complaints c
    LEFT JOIN users submitter ON c.user_id = submitter.id
    LEFT JOIN users admin ON c.assigned_admin_id = admin.id
    WHERE ${whereConditions}
  `;

  // Sort by priority DESC (Critical > High > Medium > Low), then created_at ASC
  query += `
    ORDER BY
      FIELD(c.priority, 'Critical', 'High', 'Medium', 'Low') DESC,
      c.created_at ASC
  `;

  // Clone params for main query
  const mainQueryParams = [...filterParams];
  
  // Add pagination if provided
  if (pagination) {
    const limit = parseInt(pagination.limit) || 20;
    const offset = parseInt(pagination.offset) || 0;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
  }

  const [rows] = await dbConnection.execute(query, mainQueryParams);
  
  // Return with pagination metadata if pagination was used
  if (pagination) {
    return { complaints: rows, total };
  }
  
  return rows;
}

/**
 * Get all admin users for assignment dropdown.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getAllAdmins(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT id, name, email
     FROM users
     WHERE role = 'admin'
     ORDER BY name ASC`
  );

  return rows;
}

/**
 * Assign or reassign a complaint to an admin.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId
 * @param {number} adminId - Target admin user ID
 * @param {number} authorityId - Authority user performing the action
 * @returns {Promise<Object>} Updated complaint
 */
async function assignComplaintToAdmin(dbConnection, complaintId, adminId, authorityId) {
  const numericComplaintId = Number(complaintId);
  const numericAdminId = Number(adminId);

  if (!Number.isInteger(numericComplaintId) || numericComplaintId <= 0) {
    throw new Error('Invalid complaint ID.');
  }
  if (!Number.isInteger(numericAdminId) || numericAdminId <= 0) {
    throw new Error('Invalid admin_id. Must be a positive integer.');
  }

  const connection = await dbConnection.getConnection();
  try {
    await connection.beginTransaction();

    // Ensure complaint exists and is not deleted
    const [complaintRows] = await connection.execute(
      `SELECT id, assigned_admin_id, status
       FROM complaints
       WHERE id = ? AND is_deleted = FALSE`,
      [numericComplaintId]
    );

    if (complaintRows.length === 0) {
      throw new Error('Complaint not found or has been deleted.');
    }

    const complaint = complaintRows[0];
    const previousAdminId = complaint.assigned_admin_id || null;

    // Ensure target user exists and is an admin
    const [adminRows] = await connection.execute(
      `SELECT id, name, role
       FROM users
       WHERE id = ?`,
      [numericAdminId]
    );

    if (adminRows.length === 0) {
      throw new Error('Target admin user not found.');
    }

    const targetUser = adminRows[0];
    if (targetUser.role !== 'admin') {
      throw new Error('Target user is not an admin.');
    }

    // Update assignment
    await connection.execute(
      `UPDATE complaints
       SET assigned_admin_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [numericAdminId, numericComplaintId]
    );

    // Log history
    await logAuthorityHistory(
      connection,
      numericComplaintId,
      previousAdminId != null ? `admin_id:${previousAdminId}` : 'admin_id:null',
      `admin_id:${numericAdminId}`,
      authorityId,
      `Reassigned complaint to admin_id=${numericAdminId}`
    );

    await connection.commit();

    // Return updated complaint with minimal fields
    const [updatedRows] = await dbConnection.execute(
      `SELECT
        c.id,
        CONCAT('COMP-', LPAD(c.id, 4, '0')) AS complaint_id,
        c.category,
        c.location,
        c.status,
        c.priority,
        c.summary,
        c.tags,
        c.ai_suggested_priority,
        c.manual_priority_override,
        c.assigned_admin_id,
        c.created_at,
        c.updated_at,
        c.resolved_at,
        admin.name AS assigned_admin_name
       FROM complaints c
       LEFT JOIN users admin ON c.assigned_admin_id = admin.id
       WHERE c.id = ?`,
      [numericComplaintId]
    );

    return updatedRows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Manually override complaint priority.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId
 * @param {string} newPriority - One of: Low, Medium, High, Critical
 * @param {number} authorityId
 * @returns {Promise<Object>} Updated complaint
 */
async function overrideComplaintPriority(dbConnection, complaintId, newPriority, authorityId) {
  const numericComplaintId = Number(complaintId);
  const allowedPriorities = ['Low', 'Medium', 'High', 'Critical'];

  if (!Number.isInteger(numericComplaintId) || numericComplaintId <= 0) {
    throw new Error('Invalid complaint ID.');
  }

  if (!newPriority || !allowedPriorities.includes(newPriority)) {
    throw new Error(`Invalid priority value. Allowed: ${allowedPriorities.join(', ')}`);
  }

  const connection = await dbConnection.getConnection();
  try {
    await connection.beginTransaction();

    const [complaintRows] = await connection.execute(
      `SELECT id, priority, manual_priority_override
       FROM complaints
       WHERE id = ? AND is_deleted = FALSE`,
      [numericComplaintId]
    );

    if (complaintRows.length === 0) {
      throw new Error('Complaint not found or has been deleted.');
    }

    const complaint = complaintRows[0];
    const oldPriority = complaint.priority;

    // Update priority and flag manual override
    await connection.execute(
      `UPDATE complaints
       SET priority = ?, manual_priority_override = TRUE, updated_at = NOW()
       WHERE id = ?`,
      [newPriority, numericComplaintId]
    );

    // Log history (do NOT touch ai_suggested_priority)
    await logAuthorityHistory(
      connection,
      numericComplaintId,
      `priority:${oldPriority}`,
      `priority:${newPriority}`,
      authorityId,
      `Priority override from "${oldPriority}" to "${newPriority}"`
    );

    await connection.commit();

    const [updatedRows] = await dbConnection.execute(
      `SELECT
        c.id,
        CONCAT('COMP-', LPAD(c.id, 4, '0')) AS complaint_id,
        c.category,
        c.location,
        c.status,
        c.priority,
        c.summary,
        c.tags,
        c.ai_suggested_priority,
        c.manual_priority_override,
        c.assigned_admin_id,
        c.created_at,
        c.updated_at,
        c.resolved_at
       FROM complaints c
       WHERE c.id = ?`,
      [numericComplaintId]
    );

    return updatedRows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Overall analytics dashboard for authority.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Object>}
 */
async function getAuthorityDashboardStats(dbConnection) {
  // Counts by status
  const [statusRows] = await dbConnection.execute(
    `SELECT status, COUNT(*) AS count
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY status`
  );

  const countsByStatus = statusRows.reduce((acc, row) => {
    acc[row.status] = Number(row.count) || 0;
    return acc;
  }, {});

  // Critical count (manual or otherwise)
  const [criticalRows] = await dbConnection.execute(
    `SELECT COUNT(*) AS count
     FROM complaints
     WHERE is_deleted = FALSE AND priority = 'Critical'`
  );
  const criticalCount = criticalRows[0] ? Number(criticalRows[0].count) || 0 : 0;

  // Average resolution time in hours (for resolved complaints)
  const [avgRows] = await dbConnection.execute(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) AS avg_hours
     FROM complaints
     WHERE is_deleted = FALSE
       AND status = 'Resolved'
       AND resolved_at IS NOT NULL`
  );
  const averageResolutionTime = avgRows[0] && avgRows[0].avg_hours != null
    ? Math.round(Number(avgRows[0].avg_hours) * 100) / 100
    : null;

  // Top categories
  const [categoryRows] = await dbConnection.execute(
    `SELECT category, COUNT(*) AS total
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY category
     ORDER BY total DESC
     LIMIT 5`
  );

  // Top locations
  const [locationRows] = await dbConnection.execute(
    `SELECT location, COUNT(*) AS total
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY location
     ORDER BY total DESC
     LIMIT 5`
  );

  // Escalation events from complaint_history
  let escalationCount = 0;
  try {
    const [escalationRows] = await dbConnection.execute(
      `SELECT COUNT(*) AS count
       FROM complaint_history
       WHERE note LIKE 'ESCALATION:%'`
    );
    escalationCount = escalationRows[0] ? Number(escalationRows[0].count) || 0 : 0;
  } catch (error) {
    // If history table missing for some reason, treat as zero
    escalationCount = 0;
  }

  const [totalRows] = await dbConnection.execute(
    `SELECT COUNT(*) AS total
     FROM complaints
     WHERE is_deleted = FALSE`
  );
  const totalComplaints = totalRows[0] ? Number(totalRows[0].total) || 0 : 0;

  // Calculate derived metrics
  const submittedCount = countsByStatus['Submitted'] || 0;
  const inProgressCount = countsByStatus['In Progress'] || 0;
  const resolvedCount = countsByStatus['Resolved'] || 0;
  const pendingCount = submittedCount + inProgressCount;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100 * 10) / 10 : 0;

  return {
    total_complaints: totalComplaints,
    submitted_count: submittedCount,
    in_progress_count: inProgressCount,
    resolved_count: resolvedCount,
    pending_count: pendingCount,
    critical_count: criticalCount,
    average_resolution_time: averageResolutionTime,
    average_resolution_hours: averageResolutionTime,
    resolution_rate: resolutionRate,
    top_categories: categoryRows.map(row => ({
      category: row.category,
      total: Number(row.total) || 0
    })),
    top_locations: locationRows.map(row => ({
      location: row.location,
      total: Number(row.total) || 0
    })),
    escalation_count: escalationCount
  };
}

/**
 * Per-admin performance metrics.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getAdminPerformance(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT
       c.assigned_admin_id AS admin_id,
       u.name AS admin_name,
       COUNT(*) AS total_assigned,
       SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
       SUM(CASE WHEN c.status IN ('Submitted', 'In Progress') THEN 1 ELSE 0 END) AS pending_count,
       AVG(
         CASE
           WHEN c.status = 'Resolved' AND c.resolved_at IS NOT NULL
           THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)
           ELSE NULL
         END
       ) AS avg_resolution_time_hours
     FROM complaints c
     JOIN users u ON c.assigned_admin_id = u.id
     WHERE c.is_deleted = FALSE
       AND c.assigned_admin_id IS NOT NULL
     GROUP BY c.assigned_admin_id, u.name
     ORDER BY total_assigned DESC`
  );

  return rows.map(row => {
    const totalAssigned = Number(row.total_assigned) || 0;
    const resolvedCount = Number(row.resolved_count) || 0;
    const performanceScore = totalAssigned > 0 
      ? Math.round((resolvedCount / totalAssigned) * 100)
      : 0;

    return {
      admin_id: row.admin_id,
      admin_name: row.admin_name,
      total_assigned: totalAssigned,
      resolved_count: resolvedCount,
      pending_count: Number(row.pending_count) || 0,
      avg_resolution_time: row.avg_resolution_time_hours != null
        ? Math.round(Number(row.avg_resolution_time_hours) * 100) / 100
        : null,
      performance_score: performanceScore
    };
  });
}

/**
 * Monthly complaint trends grouped by YYYY-MM.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getMonthlyTrends(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT
       DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) AS submitted,
       SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) AS critical,
       SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) AS high,
       SUM(CASE WHEN priority = 'Medium' THEN 1 ELSE 0 END) AS medium,
       SUM(CASE WHEN priority = 'Low' THEN 1 ELSE 0 END) AS low
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`
  );

  return rows.map(row => ({
    month: row.month,
    total: Number(row.total) || 0,
    submitted: Number(row.submitted) || 0,
    in_progress: Number(row.in_progress) || 0,
    resolved: Number(row.resolved) || 0,
    critical: Number(row.critical) || 0,
    high: Number(row.high) || 0,
    medium: Number(row.medium) || 0,
    low: Number(row.low) || 0
  }));
}

/**
 * Export complaint data as CSV.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<string>} CSV content
 */
async function exportComplaintsCsv(dbConnection, filters = {}) {
  const whereClauses = ['c.is_deleted = FALSE'];
  const params = [];

  if (filters.status) {
    whereClauses.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    whereClauses.push('c.priority = ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    whereClauses.push('c.category = ?');
    params.push(filters.category);
  }
  if (filters.location) {
    whereClauses.push('c.location LIKE ?');
    params.push(`%${filters.location}%`);
  }

  const whereClause = whereClauses.join(' AND ');

  const [rows] = await dbConnection.execute(
    `SELECT
       c.id,
       c.category,
       c.location,
       c.priority,
       c.status,
       admin.name AS assigned_admin,
       c.created_at,
       c.resolved_at
     FROM complaints c
     LEFT JOIN users admin ON c.assigned_admin_id = admin.id
     WHERE ${whereClause}
     ORDER BY c.created_at ASC`,
    params
  );

  const headers = [
    'id',
    'category',
    'location',
    'priority',
    'status',
    'assigned_admin',
    'created_at',
    'resolved_at'
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [];
  lines.push(headers.join(','));

  for (const row of rows) {
    const createdAt = row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at;
    const resolvedAt = row.resolved_at instanceof Date
      ? row.resolved_at.toISOString()
      : row.resolved_at;

    const values = [
      row.id,
      row.category,
      row.location,
      row.priority,
      row.status,
      row.assigned_admin || '',
      createdAt || '',
      resolvedAt || ''
    ];

    lines.push(values.map(escapeCsv).join(','));
  }

  return lines.join('\n');
}

/**
 * Export comprehensive Authority report as PDF.
 * Includes: Dashboard stats, complaints list, admin performance, monthly trends
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @param {Object} filters - Filter options for complaints
 * @returns {Promise<Buffer>} PDF buffer
 */
async function exportComplaintsPdf(dbConnection, filters = {}) {
  const PDFDocument = require('pdfkit');
  
  // Fetch all necessary data
  const dashboard = await getAuthorityDashboardStats(dbConnection);
  const complaints = await getAllComplaints(dbConnection, filters);
  const adminPerformance = await getAdminPerformance(dbConnection);
  const trends = await getMonthlyTrends(dbConnection);
  
  // Get actual complaints array (handle pagination response)
  const complaintsList = Array.isArray(complaints) ? complaints : complaints.complaints || [];
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: 'Authority Supervisory Report',
          Author: 'SCRS Authority Dashboard',
          Subject: 'Complaint Resolution System Report',
          Keywords: 'complaints, authority, governance, performance'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // ===== PAGE 1: COVER PAGE =====
      doc.fontSize(32)
         .fillColor('#4c1d95')
         .text('Authority Supervisory Report', 50, 200, { align: 'center' });
      
      doc.fontSize(18)
         .fillColor('#6b21a8')
         .text('Smart Complaint Resolution System', 50, 260, { align: 'center' });
      
      doc.fontSize(12)
         .fillColor('#64748b')
         .text(`Generated on ${dateStr} at ${timeStr}`, 50, 320, { align: 'center' });
      
      doc.fontSize(10)
         .fillColor('#94a3b8')
         .text('This report contains confidential system-wide performance metrics', 50, 700, { align: 'center' })
         .text('and complaint resolution statistics for governance oversight', 50, 715, { align: 'center' });
      
      // ===== PAGE 2: DASHBOARD SUMMARY =====
      doc.addPage();
      doc.fontSize(20)
         .fillColor('#1e293b')
         .text('📊 Dashboard Summary', 50, 50);
      
      drawLine(doc, 80);
      
      let y = 110;
      const stats = [
        { label: 'Total Complaints', value: dashboard.total_complaints || 0, icon: '📋' },
        { label: 'Critical Priority', value: dashboard.critical_count || 0, icon: '🔴' },
        { label: 'Escalated Cases', value: dashboard.escalation_count || 0, icon: '⚠️' },
        { label: 'Resolved Complaints', value: dashboard.resolved_count || 0, icon: '✅' },
        { label: 'Avg Resolution Time', value: `${(dashboard.average_resolution_time || 0).toFixed(1)} hours`, icon: '⏱️' }
      ];
      
      stats.forEach(stat => {
        doc.fontSize(11)
           .fillColor('#475569')
           .text(`${stat.icon} ${stat.label}:`, 70, y);
        doc.fontSize(14)
           .fillColor('#1e293b')
           .text(String(stat.value), 350, y, { width: 150, align: 'right' });
        y += 35;
      });
      
      // ===== PAGE 3+: COMPLAINTS TABLE =====
      doc.addPage();
      doc.fontSize(18)
         .fillColor('#1e293b')
         .text('📋 Complaints Overview', 50, 50);
      
      drawLine(doc, 75);
      
      y = 100;
      
      // Table headers
      doc.fontSize(9)
         .fillColor('#64748b');
      doc.text('ID', 50, y, { width: 50 });
      doc.text('Category', 100, y, { width: 100 });
      doc.text('Location', 200, y, { width: 100 });
      doc.text('Priority', 300, y, { width: 60 });
      doc.text('Status', 360, y, { width: 80 });
      doc.text('Admin', 440, y, { width: 100 });
      
      y += 20;
      drawLine(doc, y);
      y += 10;
      
      // Table rows
      for (const c of complaintsList) {
        // Check if we need a new page
        if (y > 720) {
          doc.addPage();
          y = 50;
          
          // Repeat headers on new page
          doc.fontSize(9).fillColor('#64748b');
          doc.text('ID', 50, y, { width: 50 });
          doc.text('Category', 100, y, { width: 100 });
          doc.text('Location', 200, y, { width: 100 });
          doc.text('Priority', 300, y, { width: 60 });
          doc.text('Status', 360, y, { width: 80 });
          doc.text('Admin', 440, y, { width: 100 });
          y += 20;
          drawLine(doc, y);
          y += 10;
        }
        
        const displayId = c.complaint_id || `COMP-${String(c.id).padStart(4, '0')}`;
        const adminName = c.assigned_admin_name || 'Unassigned';
        
        doc.fontSize(8).fillColor('#1e293b');
        doc.text(displayId, 50, y, { width: 50 });
        doc.text(truncate(c.category, 15), 100, y, { width: 100 });
        doc.text(truncate(c.location || 'N/A', 15), 200, y, { width: 100 });
        doc.text(c.priority || 'Medium', 300, y, { width: 60 });
        doc.text(c.status || 'Submitted', 360, y, { width: 80 });
        doc.text(truncate(adminName, 15), 440, y, { width: 100 });
        
        y += 20;
      }
      
      if (complaintsList.length === 0) {
        doc.fontSize(10)
           .fillColor('#94a3b8')
           .text('No complaints found matching the specified filters', 50, y, { align: 'center' });
      }
      
      // ===== ADMIN PERFORMANCE PAGE =====
      doc.addPage();
      doc.fontSize(18)
         .fillColor('#1e293b')
         .text('👥 Admin Performance Metrics', 50, 50);
      
      drawLine(doc, 75);
      
      y = 100;
      
      if (adminPerformance && adminPerformance.length > 0) {
        adminPerformance.forEach((admin, index) => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
          
          doc.fontSize(12)
             .fillColor('#1e293b')
             .text(`${medal} ${admin.admin_name}`, 70, y);
          
          doc.fontSize(9)
             .fillColor('#64748b')
             .text(`Admin ID: ${admin.admin_id}`, 70, y + 18);
          
          y += 45;
          
          const metrics = [
            `📋 Assigned: ${admin.total_assigned || 0}`,
            `✅ Resolved: ${admin.resolved_count || 0}`,
            `⏳ Pending: ${admin.pending_count || 0}`,
            `⏱️  Avg Time: ${(admin.avg_resolution_time || 0).toFixed(1)}h`
          ];
          
          doc.fontSize(9).fillColor('#475569');
          metrics.forEach((metric, i) => {
            doc.text(metric, 90 + (i * 120), y, { width: 110 });
          });
          
          y += 40;
          
          if (index < adminPerformance.length - 1) {
            doc.moveTo(70, y).lineTo(540, y).strokeColor('#e2e8f0').stroke();
            y += 20;
          }
        });
      } else {
        doc.fontSize(10)
           .fillColor('#94a3b8')
           .text('No admin performance data available', 50, y, { align: 'center' });
      }
      
      // ===== MONTHLY TRENDS PAGE =====
      doc.addPage();
      doc.fontSize(18)
         .fillColor('#1e293b')
         .text('📈 Monthly Complaint Trends', 50, 50);
      
      drawLine(doc, 75);
      
      y = 110;
      
      if (trends && trends.length > 0) {
        // Table header
        doc.fontSize(9).fillColor('#64748b');
        doc.text('Month', 70, y, { width: 80 });
        doc.text('Total', 150, y, { width: 50, align: 'center' });
        doc.text('Submitted', 200, y, { width: 65, align: 'center' });
        doc.text('In Progress', 265, y, { width: 65, align: 'center' });
        doc.text('Resolved', 330, y, { width: 65, align: 'center' });
        doc.text('Critical', 395, y, { width: 50, align: 'center' });
        doc.text('High', 445, y, { width: 50, align: 'center' });
        doc.text('Medium', 495, y, { width: 50, align: 'center' });
        
        y += 20;
        drawLine(doc, y);
        y += 10;
        
        trends.forEach(trend => {
          if (y > 720) {
            doc.addPage();
            y = 50;
          }
          
          doc.fontSize(8).fillColor('#1e293b');
          doc.text(trend.month, 70, y, { width: 80 });
          doc.text(String(trend.total || 0), 150, y, { width: 50, align: 'center' });
          doc.text(String(trend.submitted || 0), 200, y, { width: 65, align: 'center' });
          doc.text(String(trend.in_progress || 0), 265, y, { width: 65, align: 'center' });
          doc.text(String(trend.resolved || 0), 330, y, { width: 65, align: 'center' });
          doc.text(String(trend.critical || 0), 395, y, { width: 50, align: 'center' });
          doc.text(String(trend.high || 0), 445, y, { width: 50, align: 'center' });
          doc.text(String(trend.medium || 0), 495, y, { width: 50, align: 'center' });
          
          y += 18;
        });
      } else {
        doc.fontSize(10)
           .fillColor('#94a3b8')
           .text('No monthly trend data available', 50, y, { align: 'center' });
      }
      
      // ===== FOOTER ON ALL PAGES =====
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#94a3b8')
           .text(
             `Page ${i + 1} of ${pages.count} | Generated: ${dateStr} ${timeStr}`,
             50,
             doc.page.height - 50,
             { align: 'center', width: doc.page.width - 100 }
           );
      }
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Helper functions for PDF generation
function drawLine(doc, y) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

/**
 * Get category distribution for pie chart.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getCategoryDistribution(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT
       category AS name,
       COUNT(*) AS count
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY category
     ORDER BY count DESC`
  );

  return rows.map(row => ({
    name: row.name,
    count: Number(row.count) || 0
  }));
}

/**
 * Get location distribution for location insights chart.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getLocationDistribution(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT
       location AS name,
       COUNT(*) AS count
     FROM complaints
     WHERE is_deleted = FALSE
     GROUP BY location
     ORDER BY count DESC
     LIMIT 10`
  );

  return rows.map(row => ({
    name: row.name,
    count: Number(row.count) || 0
  }));
}

/**
 * Get recent escalation history.
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @returns {Promise<Array>}
 */
async function getEscalations(dbConnection) {
  const [rows] = await dbConnection.execute(
    `SELECT
       ch.complaint_id,
       ch.new_status AS new_priority,
       ch.created_at,
       ch.note
     FROM complaint_history ch
     WHERE ch.note LIKE '%ESCALATE%'
        OR ch.note LIKE '%priority%'
        OR ch.note LIKE '%PRIORITY%'
     ORDER BY ch.created_at DESC
     LIMIT 20`
  );

  return rows.map(row => ({
    complaint_id: row.complaint_id,
    new_priority: row.new_priority || 'High',
    created_at: row.created_at,
    note: row.note
  }));
}

module.exports = {
  getAllComplaints,
  getAllAdmins,
  assignComplaintToAdmin,
  overrideComplaintPriority,
  getAuthorityDashboardStats,
  getAdminPerformance,
  getMonthlyTrends,
  exportComplaintsCsv,
  exportComplaintsPdf,
  getCategoryDistribution,
  getLocationDistribution,
  getEscalations
};

