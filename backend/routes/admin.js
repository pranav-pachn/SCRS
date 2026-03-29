/**
 * Admin Operational Routes
 * 
 * All routes require 'admin' role authentication.
 * Handles complaint management operations for admins.
 */

const express = require('express');
const router = express.Router();
const xss = require('xss');
const requireRole = require('../middleware/requireRole');
const validateRequest = require('../middleware/validateRequest');
const complaintSchemas = require('../validators/complaintValidator');
const complaintService = require('../services/complaintService');
const notificationService = require('../services/notificationService');

// Middleware to get dbConnection from app locals
// This assumes dbConnection is set in server.js via app.locals.dbConnection
function getDbConnection(req) {
  return req.app.locals.dbConnection || global.dbConnection;
}

/**
 * GET /admin/complaints
 * Get all complaints assigned to the logged-in admin
 * 
 * Query parameters:
 * - status: Filter by status (Submitted, In Progress, Resolved)
 * - priority: Filter by priority (Low, Medium, High)
 * - category: Filter by category
 */
router.get('/complaints', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 8));
    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      category: req.query.category || null
    };

    console.log(`\n📋 Admin ${adminId} fetching assigned complaints with filters:`, filters);

    const allComplaints = await complaintService.getAssignedComplaints(dbConnection, adminId, filters);
    const total = allComplaints.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * perPage;
    const endIndex = startIndex + perPage;
    const complaints = allComplaints.slice(startIndex, endIndex);
    const from = total === 0 ? 0 : startIndex + 1;
    const to = total === 0 ? 0 : Math.min(endIndex, total);

    console.log(`✅ Found ${complaints.length} complaints assigned to admin ${adminId}`);

    return res.json({
      success: true,
      complaints,
      count: complaints.length,
      pagination: {
        page: safePage,
        currentPage: safePage,
        perPage,
        total,
        totalPages,
        from,
        to,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      },
      filters
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/complaints/:id
 * Get a single complaint by ID with full details
 */
router.get('/complaints/:id', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID.'
      });
    }

    console.log(`\n📋 Admin ${adminId} fetching complaint ${complaintId} details`);

    const complaint = await complaintService.getComplaintById(dbConnection, complaintId, adminId);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found or not assigned to you.'
      });
    }

    // Also fetch remarks and complaint-level history for this complaint
    const remarks = await complaintService.getComplaintRemarks(dbConnection, complaintId, adminId);
    const history = await complaintService.getComplaintHistory(dbConnection, complaintId, adminId, 50);

    console.log(`✅ Complaint ${complaintId} details retrieved`);

    return res.json({
      success: true,
      complaint,
      remarks,
      history,
      message: 'Complaint details retrieved successfully.'
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/complaints/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * PUT /admin/complaints/:id/status
 * Update complaint status
 * 
 * Body:
 * - status: New status (Submitted, In Progress, Resolved)
 */
router.put('/complaints/:id/status', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const adminId = req.user.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required in request body.'
      });
    }

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID.'
      });
    }

    console.log(`\n🔄 Admin ${adminId} updating complaint ${complaintId} status to "${status}"`);

    const updatedComplaint = await complaintService.updateComplaintStatus(
      dbConnection,
      complaintId,
      status,
      adminId
    );

    if (updatedComplaint.status === 'Resolved' && updatedComplaint.user_id) {
      await notificationService.createNotification(dbConnection, {
        userId: updatedComplaint.user_id,
        title: `Complaint #${complaintId} Resolved`,
        message: 'Your complaint has been marked as resolved. Please review the resolution proof in your dashboard.',
        type: 'resolved',
        relatedComplaintId: complaintId,
        metadata: {
          resolvedAt: updatedComplaint.resolved_at,
          byAdminId: adminId
        }
      });
    }

    console.log(`✅ Complaint ${complaintId} status updated successfully`);

    return res.json({
      success: true,
      complaint: updatedComplaint,
      message: `Complaint status updated to "${status}".`
    });
  } catch (error) {
    console.error('❌ Error in PUT /admin/complaints/:id/status:', error);

    if (error.message.includes('not found') || error.message.includes('not assigned')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (
      error.message.includes('Invalid status') ||
      error.message.includes('Invalid status transition') ||
      error.message.includes('Cannot mark complaint as Resolved without')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * POST /admin/complaints/:id/remark
 * Add an internal remark to a complaint
 * 
 * Body:
 * - remark_text: The remark content
 */
router.post('/complaints/:id/remark', requireRole('admin'), validateRequest(complaintSchemas.addRemark), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const { remark_text } = req.body;
    const adminId = req.user.id;

    if (!remark_text || typeof remark_text !== 'string' || remark_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'remark_text is required and must be a non-empty string.'
      });
    }

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID.'
      });
    }

    console.log(`\n💬 Admin ${adminId} adding remark to complaint ${complaintId}`);

    const safeRemarkText = xss(remark_text.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    }).slice(0, 2000);

    const remark = await complaintService.addComplaintRemark(
      dbConnection,
      complaintId,
      safeRemarkText,
      adminId
    );

    console.log(`✅ Remark added successfully (ID: ${remark.id})`);

    return res.status(201).json({
      success: true,
      remark,
      message: 'Remark added successfully.'
    });
  } catch (error) {
    console.error('❌ Error in POST /admin/complaints/:id/remark:', error);

    if (error.message.includes('not found') || error.message.includes('not assigned')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/complaints/:id/remarks
 * Get all remarks for a complaint
 */
router.get('/complaints/:id/remarks', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID.'
      });
    }

    console.log(`\n📝 Admin ${adminId} fetching remarks for complaint ${complaintId}`);

    const remarks = await complaintService.getComplaintRemarks(dbConnection, complaintId, adminId);

    console.log(`✅ Found ${remarks.length} remarks`);

    return res.json({
      success: true,
      remarks,
      count: remarks.length
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/complaints/:id/remarks:', error);

    if (error.message.includes('not found') || error.message.includes('not assigned')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * POST /admin/complaints/:id/resolve-proof
 * Upload resolve proof (image URL)
 * 
 * Body:
 * - proof_url: URL of the proof image
 */
router.post('/complaints/:id/resolve-proof', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const { proof_url, resolution_note } = req.body;
    const adminId = req.user.id;

    const hasProofUrl = typeof proof_url === 'string' && proof_url.trim().length > 0;
    const hasResolutionNote = typeof resolution_note === 'string' && resolution_note.trim().length > 0;

    if (!hasProofUrl && !hasResolutionNote) {
      return res.status(400).json({
        success: false,
        message: 'Provide either proof_url or resolution_note.'
      });
    }

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID.'
      });
    }

    if (hasProofUrl) {
      // Basic URL validation
      try {
        new URL(proof_url);
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL format for proof_url.'
        });
      }
    }

    console.log(`\n📸 Admin ${adminId} uploading resolve proof for complaint ${complaintId}`);

    let updatedComplaint = null;
    if (hasProofUrl) {
      updatedComplaint = await complaintService.uploadResolveProof(
        dbConnection,
        complaintId,
        proof_url.trim(),
        adminId
      );
    } else {
      const complaint = await complaintService.getComplaintById(dbConnection, complaintId, adminId);
      if (!complaint) {
        throw new Error('Complaint not found or not assigned to you');
      }
      await dbConnection.execute(
        `INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note)
         VALUES (?, ?, ?, ?, ?)`,
        [
          complaintId,
          adminId,
          complaint.status,
          complaint.status,
          `Resolution Note: ${String(resolution_note).trim().slice(0, 1800)}`
        ]
      );
      updatedComplaint = complaint;
    }

    console.log(`✅ Resolve proof uploaded successfully`);

    return res.json({
      success: true,
      complaint: updatedComplaint,
      message: hasProofUrl
        ? 'Resolve proof uploaded successfully.'
        : 'Resolution note saved successfully.'
    });
  } catch (error) {
    console.error('❌ Error in POST /admin/complaints/:id/resolve-proof:', error);

    if (error.message.includes('not found') || error.message.includes('not assigned')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/dashboard
 * Get admin dashboard statistics
 */
router.get('/dashboard', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;

    console.log(`\n📊 Admin ${adminId} fetching dashboard statistics`);

    const stats = await complaintService.getAdminDashboardStats(dbConnection, adminId);

    console.log(`✅ Dashboard stats retrieved`);

    return res.json({
      success: true,
      dashboard: stats
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/statistics/trends
 * Get statistics trends for the past 30 days
 */
router.get('/statistics/trends', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;

    console.log(`\n📈 Admin ${adminId} fetching statistics trends`);

    const trends = await complaintService.getStatisticsTrends(dbConnection, adminId);

    console.log(`✅ Statistics trends retrieved`);

    return res.json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/statistics/trends:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/statistics/monthly-trends
 * Get monthly chart data for admin assigned complaints
 */
router.get('/statistics/monthly-trends', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;

    console.log(`\n📆 Admin ${adminId} fetching monthly trends`);

    const trends = await complaintService.getAdminMonthlyTrends(dbConnection, adminId);

    console.log(`✅ Monthly trends retrieved (${trends.length} months)`);

    return res.json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/statistics/monthly-trends:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/activity-feed
 * Get recent activity feed (status changes + remarks)
 * Query parameters:
 * - limit: Maximum number of items to return (default: 20, max: 50)
 */
router.get('/activity-feed', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    console.log(`\n📰 Admin ${adminId} fetching activity feed (limit: ${limit})`);

    const activities = await complaintService.getAdminActivityFeed(dbConnection, adminId, limit);

    console.log(`✅ Found ${activities.length} activities`);

    return res.json({
      success: true,
      activities,
      count: activities.length
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/activity-feed:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /admin/statistics/category-distribution
 * Category counts for analytics panel.
 */
router.get('/statistics/category-distribution', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const categories = await complaintService.getAdminCategoryDistribution(dbConnection, adminId);
    return res.json({ success: true, categories });
  } catch (error) {
    console.error('❌ Error in GET /admin/statistics/category-distribution:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * GET /admin/performance
 * Personal KPI summary for admin analytics.
 */
router.get('/performance', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const performance = await complaintService.getAdminPerformanceStats(dbConnection, adminId);
    return res.json({ success: true, performance });
  } catch (error) {
    console.error('❌ Error in GET /admin/performance:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * GET /admin/complaints/:id/history
 * Fetch complaint history timeline for dedicated detail views.
 */
router.get('/complaints/:id/history', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = parseInt(req.params.id, 10);
    const adminId = req.user.id;
    const limit = Number(req.query.limit) || 50;

    if (isNaN(complaintId)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });
    }

    const history = await complaintService.getComplaintHistory(dbConnection, complaintId, adminId, limit);
    return res.json({ success: true, history, count: history.length });
  } catch (error) {
    console.error('❌ Error in GET /admin/complaints/:id/history:', error);
    if (error.message.includes('not found') || error.message.includes('not assigned')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * GET /admin/notifications
 * Polling endpoint for admin notifications.
 */
router.get('/notifications', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const limit = Number(req.query.limit) || 25;
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
    const payload = await notificationService.listNotifications(dbConnection, adminId, { limit, unreadOnly });
    return res.json({
      success: true,
      notifications: payload.notifications,
      unread_count: payload.unreadCount
    });
  } catch (error) {
    console.error('❌ Error in GET /admin/notifications:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * PATCH /admin/notifications/:id/read
 * Mark one notification as read.
 */
router.patch('/notifications/:id/read', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const notificationId = Number(req.params.id);
    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Invalid notification id.' });
    }
    const updated = await notificationService.markNotificationRead(dbConnection, adminId, notificationId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('❌ Error in PATCH /admin/notifications/:id/read:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * PATCH /admin/notifications/read-all
 * Mark all notifications as read.
 */
router.patch('/notifications/read-all', requireRole('admin'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const adminId = req.user.id;
    const updatedCount = await notificationService.markAllNotificationsRead(dbConnection, adminId);
    return res.json({ success: true, updated_count: updatedCount });
  } catch (error) {
    console.error('❌ Error in PATCH /admin/notifications/read-all:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// =====================================================================
// 7. PUT /admin/complaints/:id/escalate - Manually escalate complaint priority
// =====================================================================
router.put('/complaints/:id/escalate', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;

  console.log(`📈 PUT /admin/complaints/${id}/escalate called by admin ${adminId}`);

  try {
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required.'
      });
    }

    const dbConnection = getDbConnection(req);

    // Check if complaint exists and is assigned to this admin
    const [complaints] = await dbConnection.execute(
      'SELECT id, assigned_admin_id, priority FROM complaints WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.'
      });
    }

    const complaint = complaints[0];

    if (complaint.assigned_admin_id !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to escalate this complaint.'
      });
    }

    // Update priority to High (or Critical if already High) and set manual override
    const newPriority = complaint.priority === 'High' ? 'Critical' : 'High';

    await dbConnection.execute(
      'UPDATE complaints SET priority = ?, manual_priority_override = 1, updated_at = NOW() WHERE id = ?',
      [newPriority, id]
    );

    // Log the escalation in complaint_history
    await dbConnection.execute(
      `INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, ?, ?, ?)`,
      [id, adminId, complaint.priority, newPriority, `Escalation Reason: ${reason.trim().slice(0, 1800)}`]
    );

    // Notify the admin who escalated for activity visibility.
    await notificationService.createNotification(dbConnection, {
      userId: adminId,
      title: `Complaint #${id} escalated`,
      message: `Priority changed from ${complaint.priority} to ${newPriority}`,
      type: 'escalation',
      relatedComplaintId: Number(id),
      metadata: {
        oldPriority: complaint.priority,
        newPriority,
        reason: reason.trim().slice(0, 500)
      }
    });

    console.log(`✅ Complaint ${id} escalated from ${complaint.priority} to ${newPriority}`);

    res.json({
      success: true,
      message: `Complaint priority escalated to ${newPriority}.`,
      data: {
        complaint_id: parseInt(id),
        old_priority: complaint.priority,
        new_priority: newPriority
      }
    });
  } catch (error) {
    console.error('❌ Error in PUT /admin/complaints/:id/escalate:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

module.exports = router;
