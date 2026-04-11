/**
 * Authority Supervisory Routes
 *
 * All routes require 'authority' role authentication.
 * Authority has higher privileges than Admin but CANNOT:
 * - Directly resolve complaints
 * - Edit complaint description
 *
 * Authority can:
 * - Monitor all complaints
 * - Reassign complaints between admins
 * - Override priority (without changing AI suggestion)
 * - View analytics and performance dashboards
 * - Export complaints as CSV
 */

const express = require('express');
const router = express.Router();
const requireRole = require('../middleware/requireRole');
const authorityService = require('../services/authorityService');
const notificationService = require('../services/notificationService');

// Middleware to get dbConnection from app locals
function getDbConnection(req) {
  return req.app.locals.dbConnection || global.dbConnection;
}

/**
 * GET /authority/complaints
 * View ALL complaints with filters.
 *
 * Query parameters:
 * - status
 * - priority
 * - category
 * - location
 * - assigned_admin_id
 */
router.get('/complaints', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      category: req.query.category || null,
      location: req.query.location || null,
      assigned_admin_id: req.query.assigned_admin_id
        ? Number(req.query.assigned_admin_id)
        : null
    };

    if (filters.assigned_admin_id !== null && (!Number.isInteger(filters.assigned_admin_id) || filters.assigned_admin_id <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'assigned_admin_id must be a positive integer.'
      });
    }

    // Get pagination parameters from query string
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.perPage ? Number(req.query.perPage) : 20;
    const pagination = req.app.locals.getPaginationParams(page, perPage);

    // Get paginated complaints with total count
    const { complaints, total } = await authorityService.getAllComplaints(dbConnection, filters, pagination);

    // Format response with pagination metadata
    const response = req.app.locals.formatPaginatedResponse(pagination, total, complaints);

    return res.json({
      success: true,
      complaints: response.data,
      pagination: response.pagination,
      filters
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/admins
 * Get all admins available for complaint assignment.
 */
router.get('/admins', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const admins = await authorityService.getAllAdmins(dbConnection);
    return res.json({
      success: true,
      admins,
      count: admins.length
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/admins:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * PUT /authority/complaints/:id/assign
 * Assign complaint to an admin.
 *
 * Body:
 * - admin_id
 */
router.put('/complaints/:id/assign', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = req.params.id;
    const { admin_id } = req.body;
    const authorityId = req.user.id;

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        message: 'admin_id is required in request body.'
      });
    }

    const [existingRows] = await dbConnection.execute(
      'SELECT assigned_admin_id FROM complaints WHERE id = ? AND is_deleted = FALSE LIMIT 1',
      [complaintId]
    );
    const previousAdminId = existingRows[0]?.assigned_admin_id || null;

    const updatedComplaint = await authorityService.assignComplaintToAdmin(
      dbConnection,
      complaintId,
      admin_id,
      authorityId
    );

    try {
      await notificationService.createNotification(dbConnection, {
        userId: Number(admin_id),
        title: `New Complaint Assigned (#${complaintId})`,
        message: 'A complaint has been assigned to you by authority.',
        type: previousAdminId ? 'reassignment' : 'assignment',
        relatedComplaintId: Number(complaintId),
        metadata: {
          byAuthorityId: authorityId,
          previousAdminId
        }
      });

      if (previousAdminId && Number(previousAdminId) !== Number(admin_id)) {
        await notificationService.createNotification(dbConnection, {
          userId: Number(previousAdminId),
          title: `Complaint Reassigned (#${complaintId})`,
          message: 'A complaint previously assigned to you was reassigned by authority.',
          type: 'reassignment',
          relatedComplaintId: Number(complaintId),
          metadata: {
            byAuthorityId: authorityId,
            reassignedToAdminId: Number(admin_id)
          }
        });
      }
    } catch (notificationError) {
      console.warn('⚠️ Complaint assignment succeeded, but notification creation failed:', notificationError.message);
    }

    return res.json({
      success: true,
      complaint: updatedComplaint,
      message: 'Complaint reassigned successfully.'
    });
  } catch (error) {
    console.error('❌ Error in PUT /authority/complaints/:id/assign:', error);

    if (error.message.includes('not found') || error.message.includes('deleted')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('not an admin')) {
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
 * PUT /authority/complaints/:id/priority
 * Override priority manually.
 *
 * Body:
 * - new_priority (Low, Medium, High, Critical)
 */
router.put('/complaints/:id/priority', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const complaintId = req.params.id;
    const { new_priority } = req.body;
    const authorityId = req.user.id;

    const allowedPriorities = ['Low', 'Medium', 'High', 'Critical'];

    if (!new_priority || typeof new_priority !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'new_priority is required and must be a string.'
      });
    }

    if (!allowedPriorities.includes(new_priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid new_priority. Allowed values: ${allowedPriorities.join(', ')}.`
      });
    }

    const updatedComplaint = await authorityService.overrideComplaintPriority(
      dbConnection,
      complaintId,
      new_priority,
      authorityId
    );

    if (updatedComplaint.assigned_admin_id) {
      await notificationService.createNotification(dbConnection, {
        userId: Number(updatedComplaint.assigned_admin_id),
        title: `Complaint Escalated (#${complaintId})`,
        message: `Authority updated priority to ${new_priority}.`,
        type: 'escalation',
        relatedComplaintId: Number(complaintId),
        metadata: {
          byAuthorityId: authorityId,
          newPriority: new_priority
        }
      });
    }

    return res.json({
      success: true,
      complaint: updatedComplaint,
      message: `Priority overridden to "${new_priority}".`
    });
  } catch (error) {
    console.error('❌ Error in PUT /authority/complaints/:id/priority:', error);

    if (error.message.includes('not found') || error.message.includes('deleted')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid priority')) {
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
 * GET /authority/dashboard
 * Overall analytics for authority view.
 */
router.get('/dashboard', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const dashboard = await authorityService.getAuthorityDashboardStats(dbConnection);
    return res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/admin-performance
 * Per-admin performance metrics.
 */
router.get('/admin-performance', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const performance = await authorityService.getAdminPerformance(dbConnection);
    return res.json({
      success: true,
      admins: performance
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/admin-performance:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/monthly-trends
 * Complaint counts grouped by month (YYYY-MM).
 */
router.get('/monthly-trends', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const trends = await authorityService.getMonthlyTrends(dbConnection);
    return res.json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/monthly-trends:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/export
 * Export complaints data as CSV with optional filters.
 */
router.get('/export', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const filters = {
      status: req.query.status || '',
      priority: req.query.priority || '',
      category: req.query.category || '',
      location: req.query.location || ''
    };

    const csv = await authorityService.exportComplaintsCsv(dbConnection, filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="complaints_export.csv"');

    return res.status(200).send(csv);
  } catch (error) {
    console.error('❌ Error in GET /authority/export:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/export-pdf
 * Export comprehensive Authority report as PDF.
 * Includes: Dashboard stats, complaints list, admin performance, monthly trends
 */
router.get('/export-pdf', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    // Extract filters (same as complaints endpoint)
    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      category: req.query.category || null,
      location: req.query.location || null,
      assigned_admin_id: req.query.assigned_admin_id
        ? Number(req.query.assigned_admin_id)
        : null
    };

    // Validate assigned_admin_id if provided
    if (filters.assigned_admin_id !== null && (!Number.isInteger(filters.assigned_admin_id) || filters.assigned_admin_id <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'assigned_admin_id must be a positive integer.'
      });
    }

    console.log('📄 Generating PDF report with filters:', filters);

    const pdfBuffer = await authorityService.exportComplaintsPdf(dbConnection, filters);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `authority-report-${timestamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error in GET /authority/export-pdf:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report. Please try again.'
    });
  }
});

/**
 * GET /authority/category-distribution
 * Get complaint counts grouped by category for pie chart.
 */
router.get('/category-distribution', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const categories = await authorityService.getCategoryDistribution(dbConnection);
    return res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/category-distribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/location-distribution
 * Get top 10 locations by complaint count for location insights chart.
 */
router.get('/location-distribution', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const locations = await authorityService.getLocationDistribution(dbConnection);
    return res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/location-distribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/**
 * GET /authority/escalations
 * Get recent escalation history for escalation log widget.
 */
router.get('/escalations', requireRole('authority'), async (req, res) => {
  const dbConnection = getDbConnection(req);

  if (!dbConnection) {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database not connected.'
    });
  }

  try {
    const escalations = await authorityService.getEscalations(dbConnection);
    return res.json({
      success: true,
      escalations
    });
  } catch (error) {
    console.error('❌ Error in GET /authority/escalations:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

module.exports = router;

