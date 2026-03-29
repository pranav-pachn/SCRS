# Authority Supervisory Role - Implementation Guide

## Overview

The Authority Supervisory Role provides high-level complaint management and oversight capabilities. Authority users have elevated privileges compared to admins but **CANNOT directly resolve complaints**.

### Key Privileges
- ✅ View ALL complaints system-wide
- ✅ Reassign complaints between admins
- ✅ Override complaint priority levels
- ✅ View system-wide analytics and performance metrics
- ✅ Export complaint data as CSV
- ✅ Monitor admin performance
- ❌ Cannot mark complaints as resolved
- ❌ Cannot edit complaint descriptions

---

## Role Hierarchy

```
CITIZEN → ADMIN → AUTHORITY
```

Users are assigned roles:
- `citizen`: Can submit complaints
- `admin`: Can work on assigned complaints
- `authority`: Can oversee and manage all complaints

---

## Database Schema

### New Columns Added

#### complaints table
```sql
manual_priority_override BOOLEAN DEFAULT FALSE
is_escalated BOOLEAN DEFAULT FALSE
```

#### complaint_history table
```sql
action VARCHAR(50)                           -- e.g., 'Reassigned', 'PriorityOverride'
role ENUM('citizen','admin','authority')     -- Who made the change
old_value VARCHAR(255)                       -- Previous value
new_value VARCHAR(255)                       -- New value
field_changed VARCHAR(100)                   -- Which field was modified
```

### Indexes Created
- `idx_manual_priority_override` - For filtering overridden priorities
- `idx_is_escalated` - For escalation tracking
- `idx_complaint_history_role` - For audit filtering
- `idx_complaint_history_action` - For action tracking
- `idx_complaint_history_created` - For timeline queries

---

## API Endpoints

### 1. GET /authority/complaints
**View all complaints with filters and sorting**

#### Request
```javascript
GET /authority/complaints?status=In Progress&priority=High&category=Water&location=Sector&assigned_admin_id=5

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

#### Query Parameters
| Parameter | Type | Optional | Values |
|-----------|------|----------|--------|
| status | string | Yes | Submitted, In Progress, Resolved |
| priority | string | Yes | Low, Medium, High, Critical |
| category | string | Yes | Any complaint category |
| location | string | Yes | Any location (partial match) |
| assigned_admin_id | number | Yes | Admin user ID |

#### Response (200 OK)
```json
{
  "success": true,
  "complaints": [
    {
      "id": 1,
      "complaint_id": "COMP-0001",
      "user_id": 10,
      "category": "Water",
      "description": "Water pipe burst in sector 5",
      "location": "Sector 5, Delhi",
      "status": "In Progress",
      "priority": "High",
      "ai_suggested_priority": "High",
      "manual_priority_override": false,
      "assigned_admin_id": 5,
      "admin_name": "Raj Kumar",
      "admin_email": "raj.kumar@scrs.gov",
      "submitter_name": "Pranav Singh",
      "submitter_email": "pranav@example.com",
      "created_at": "2026-02-15T10:30:00Z",
      "updated_at": "2026-02-16T14:20:00Z",
      "resolved_at": null,
      "is_escalated": false
    }
  ],
  "count": 1,
  "filters": {
    "status": "In Progress",
    "priority": "High",
    "category": "Water",
    "location": "Sector",
    "assigned_admin_id": 5
  }
}
```

---

### 2. PUT /authority/complaints/:id/assign
**Reassign complaint to a different admin**

#### Request
```javascript
PUT /authority/complaints/1/assign

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body:
{
  "admin_id": 7
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Complaint reassigned successfully.",
  "complaint": {
    "id": 1,
    "complaint_id": "COMP-0001",
    "category": "Water",
    "location": "Sector 5, Delhi",
    "status": "Submitted",
    "priority": "High",
    "ai_suggested_priority": "High",
    "manual_priority_override": false,
    "assigned_admin_id": 7,
    "admin_name": "Priya Sharma",
    "created_at": "2026-02-15T10:30:00Z",
    "updated_at": "2026-02-17T09:15:00Z",
    "resolved_at": null
  }
}
```

#### Audit Log Entry
```json
{
  "complaint_id": 1,
  "changed_by": 3,    // Authority user ID
  "action": "Reassigned",
  "role": "authority",
  "field_changed": "assigned_admin_id",
  "old_value": "5",
  "new_value": "7",
  "created_at": "2026-02-17T09:15:00Z"
}
```

#### Error Responses
```json
// 400 - Invalid admin_id
{
  "success": false,
  "message": "admin_id is required in request body."
}

// 404 - Complaint not found
{
  "success": false,
  "message": "Complaint not found or has been deleted."
}

// 400 - Invalid admin
{
  "success": false,
  "message": "Target user is not an admin."
}
```

---

### 3. PUT /authority/complaints/:id/priority
**Override complaint priority manually**

#### Request
```javascript
PUT /authority/complaints/1/priority

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body:
{
  "new_priority": "Critical"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Priority overridden to \"Critical\".",
  "complaint": {
    "id": 1,
    "complaint_id": "COMP-0001",
    "category": "Water",
    "location": "Sector 5, Delhi",
    "status": "In Progress",
    "priority": "Critical",
    "ai_suggested_priority": "High",
    "manual_priority_override": true,
    "assigned_admin_id": 5,
    "created_at": "2026-02-15T10:30:00Z",
    "updated_at": "2026-02-17T11:45:00Z",
    "resolved_at": null
  }
}
```

**Important Notes:**
- `ai_suggested_priority` remains unchanged (preserved for audit)
- `manual_priority_override` flag is set to `TRUE`
- Original priority from AI is always retained in history

#### Audit Log Entry
```json
{
  "complaint_id": 1,
  "changed_by": 3,    // Authority user ID
  "action": "PriorityOverride",
  "role": "authority",
  "field_changed": "priority",
  "old_value": "High",
  "new_value": "Critical",
  "note": "AI Suggested: High",
  "created_at": "2026-02-17T11:45:00Z"
}
```

#### Allowed Priority Values
- `Low`
- `Medium`
- `High`
- `Critical`

---

### 4. GET /authority/dashboard
**Get system-wide analytics and Key Performance Indicators**

#### Request
```javascript
GET /authority/dashboard

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

#### Response (200 OK)
```json
{
  "success": true,
  "dashboard": {
    "total_complaints": 256,
    "submitted_count": 45,
    "in_progress_count": 78,
    "resolved_count": 133,
    "critical_count": 8,
    "average_resolution_hours": 24.5,
    "escalation_count": 3,
    "top_categories": [
      {
        "category": "Water",
        "total": 85
      },
      {
        "category": "Electricity",
        "total": 62
      },
      {
        "category": "Roads",
        "total": 54
      },
      {
        "category": "Sanitation",
        "total": 38
      },
      {
        "category": "Other",
        "total": 17
      }
    ],
    "top_locations": [
      {
        "location": "Sector 5",
        "total": 34
      },
      {
        "location": "Sector 8",
        "total": 28
      },
      {
        "location": "Sector 12",
        "total": 23
      },
      {
        "location": "Sector 3",
        "total": 19
      },
      {
        "location": "Sector 7",
        "total": 18
      }
    ]
  }
}
```

#### Key Metrics Explained
| Metric | Meaning |
|--------|---------|
| `total_complaints` | All non-deleted complaints |
| `submitted_count` | Complaints in 'Submitted' status |
| `in_progress_count` | Complaints in 'In Progress' status |
| `resolved_count` | Complaints in 'Resolved' status |
| `critical_count` | Complaints with 'Critical' priority |
| `average_resolution_hours` | Avg time from creation to resolution |
| `escalation_count` | Complaints marked as escalated |
| `top_categories` | Most common complaint categories |
| `top_locations` | Areas with most complaints |

---

### 5. GET /authority/admin-performance
**Monitor admin performance metrics**

#### Request
```javascript
GET /authority/admin-performance

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

#### Response (200 OK)
```json
{
  "success": true,
  "admins": [
    {
      "admin_id": 5,
      "admin_name": "Raj Kumar",
      "admin_email": "raj.kumar@scrs.gov",
      "total_assigned": 45,
      "resolved_count": 38,
      "pending_count": 7,
      "avg_resolution_time": 22.5,
      "categories_handled": 5
    },
    {
      "admin_id": 7,
      "admin_name": "Priya Sharma",
      "admin_email": "priya.sharma@scrs.gov",
      "total_assigned": 42,
      "resolved_count": 35,
      "pending_count": 7,
      "avg_resolution_time": 26.3,
      "categories_handled": 4
    },
    {
      "admin_id": 8,
      "admin_name": "Amit Patel",
      "admin_email": "amit.patel@scrs.gov",
      "total_assigned": 38,
      "resolved_count": 29,
      "pending_count": 9,
      "avg_resolution_time": 31.2,
      "categories_handled": 6
    }
  ]
}
```

#### Performance Metric Insights
| Metric | Purpose |
|--------|---------|
| `total_assigned` | Workload distribution |
| `resolved_count` | Productivity |
| `pending_count` | Current workload |
| `avg_resolution_time` | Efficiency (hours) |
| `categories_handled` | Versatility |

**Use Cases:**
- Identify admins needing support
- Balance workload distribution
- Recognize high performers
- Plan training needs

---

### 6. GET /authority/monthly-trends
**View complaint volume trends over months**

#### Request
```javascript
GET /authority/monthly-trends

Headers:
  Authorization: Bearer <JWT_TOKEN>
```

#### Response (200 OK)
```json
{
  "success": true,
  "trends": [
    {
      "month": "2025-12",
      "total": 45,
      "resolved": 38,
      "in_progress": 5,
      "submitted": 2
    },
    {
      "month": "2026-01",
      "total": 92,
      "resolved": 65,
      "in_progress": 18,
      "submitted": 9
    },
    {
      "month": "2026-02",
      "total": 119,
      "resolved": 85,
      "in_progress": 24,
      "submitted": 10
    }
  ]
}
```

#### Trend Analysis
```
Month    | Total | Status Breakdown
---------|-------|------------------
2025-12  | 45    | ████████░░░░░░░░░░░░ (84% resolved)
2026-01  | 92    | ██████████████░░░░░░░░ (71% resolved)
2026-02  | 119   | ███████████████░░░░░░░░ (71% resolved)
```

**Insight:** Increasing complaint volume but good resolution rate maintained.

---

### 7. GET /authority/export
**Export all complaints as CSV**

#### Request
```javascript
GET /authority/export

Headers:
  Authorization: Bearer <JWT_TOKEN>

// Optional query parameters for filtering
GET /authority/export?status=Resolved&priority=Critical
```

#### Response (200 OK)
```
Content-Type: text/csv
Content-Disposition: attachment; filename="complaints_export.csv"

id,category,location,priority,status,assigned_admin,created_at,resolved_at
COMP-0001,Water,Sector 5,High,Resolved,Raj Kumar,2026-02-15T10:30:00Z,2026-02-16T14:20:00Z
COMP-0002,Electricity,Sector 8,Medium,In Progress,Priya Sharma,2026-02-16T09:15:00Z,
COMP-0003,Roads,Sector 3,Critical,Resolved,Amit Patel,2026-02-14T16:45:00Z,2026-02-15T11:30:00Z
...
```

#### CSV Columns
1. **id** - Complaint identifier (COMP-XXXX)
2. **category** - Issue category
3. **location** - Geographic location
4. **priority** - Current priority level
5. **status** - Resolution status
6. **assigned_admin** - Name of assigned admin
7. **created_at** - ISO timestamp when created
8. **resolved_at** - ISO timestamp when resolved (or empty)

#### Use Cases
- Audit reports for government
- Data analysis for trends
- Performance reviews
- Historical records
- Third-party analysis

---

## Audit Trail & Logging

Every authority action is logged in `complaint_history` table for complete audit trail:

### Example: Authority Reassigns Complaint
```json
{
  "id": 145,
  "complaint_id": 1,
  "changed_by": 3,
  "action": "Reassigned",
  "role": "authority",
  "field_changed": "assigned_admin_id",
  "old_value": "5",
  "new_value": "7",
  "old_status": null,
  "new_status": null,
  "note": null,
  "created_at": "2026-02-17T09:15:00Z"
}
```

### Example: Authority Overrides Priority
```json
{
  "id": 146,
  "complaint_id": 1,
  "changed_by": 3,
  "action": "PriorityOverride",
  "role": "authority",
  "field_changed": "priority",
  "old_value": "High",
  "new_value": "Critical",
  "note": "AI Suggested: High",
  "created_at": "2026-02-17T11:45:00Z"
}
```

---

## Security Rules

### Access Control
- ✅ Authority can view **ALL** complaints
- ✅ Authority can reassign complaints
- ✅ Authority can override priorities
- ✅ Authority can export data
- ✅ Authority can view analytics
- ❌ Authority **cannot** mark as resolved
- ❌ Authority **cannot** edit descriptions

### Input Validation
- All numeric IDs validated as positive integers
- Priority values white-listed to 4 allowed options
- Status transitions validated
- User IDs verified against database
- All inputs parameterized (no SQL injection)

### Audit Requirements
- All changes logged with timestamp
- Admin ID captured for each change
- Previous and new values stored
- Field names recorded
- Action types classified
- Role documented (authority)

---

## SQL Reference Queries

### Get All Authority Actions on Complaint
```sql
SELECT 
  h.id,
  h.action,
  u.name as authority_name,
  h.field_changed,
  h.old_value,
  h.new_value,
  h.note,
  h.created_at
FROM complaint_history h
LEFT JOIN users u ON h.changed_by = u.id
WHERE h.complaint_id = :complaint_id 
  AND h.role = 'authority'
ORDER BY h.created_at DESC;
```

### Compare AI vs Manual Priority
```sql
SELECT 
  c.id,
  c.complaint_id,
  c.ai_suggested_priority,
  c.priority AS manual_priority,
  c.manual_priority_override,
  CASE 
    WHEN c.manual_priority_override = TRUE THEN 'OVERRIDDEN'
    ELSE 'AI_SUGGESTION_USED'
  END as priority_source
FROM complaints c
WHERE c.ai_suggested_priority != c.priority
  AND c.is_deleted = FALSE;
```

### Admin Performance Rankings
```sql
SELECT 
  admin.name,
  COUNT(c.id) as total_complaints,
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
  ROUND(
    100 * SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) / COUNT(c.id), 
    2
  ) as resolution_rate,
  ROUND(AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)), 1) as avg_hours
FROM users admin
LEFT JOIN complaints c ON admin.id = c.assigned_admin_id AND c.is_deleted = FALSE
WHERE admin.role = 'admin'
GROUP BY admin.id, admin.name
ORDER BY resolved DESC;
```

---

## Integration Example (JavaScript/Node.js)

```javascript
// Authority Dashboard Application
const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const AUTHORITY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const authorityAPI = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${AUTHORITY_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// 1. Fetch all critical complaints
async function getCriticalComplaints() {
  const response = await authorityAPI.get('/authority/complaints', {
    params: { priority: 'Critical' }
  });
  return response.data.complaints;
}

// 2. Reassign complaint to different admin
async function reassignComplaint(complaintId, newAdminId) {
  const response = await authorityAPI.put(
    `/authority/complaints/${complaintId}/assign`,
    { admin_id: newAdminId }
  );
  return response.data.complaint;
}

// 3. Escalate complaint priority
async function escalateComplaint(complaintId) {
  const response = await authorityAPI.put(
    `/authority/complaints/${complaintId}/priority`,
    { new_priority: 'Critical' }
  );
  return response.data.complaint;
}

// 4. Get dashboard metrics
async function getDashboard() {
  const response = await authorityAPI.get('/authority/dashboard');
  return response.data.dashboard;
}

// 5. Get admin performance
async function getAdminPerformance() {
  const response = await authorityAPI.get('/authority/admin-performance');
  return response.data.admins;
}

// 6. Download CSV export
async function exportComplaints() {
  const response = await authorityAPI.get('/authority/export', {
    responseType: 'blob'
  });
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('complaints_export.csv', response.data);
}

// Example usage
(async () => {
  try {
    const dashboard = await getDashboard();
    console.log('Dashboard:', dashboard);
    
    const critical = await getCriticalComplaints();
    console.log(`Critical complaints: ${critical.length}`);
    
    if (critical.length > 0) {
      // Escalate first critical complaint to best performer
      const admins = await getAdminPerformance();
      const bestAdmin = admins[0]; // Highest performer
      
      await reassignComplaint(critical[0].id, bestAdmin.admin_id);
      console.log(`Reassigned to ${bestAdmin.admin_name}`);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
})();
```

---

## Testing the Authority Role

### 1. Create an Authority User (SQL)
```sql
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Government Officer',
  'authority@scrs.gov',
  -- bcrypt hashed password for "password"
  '$2a$10$YOixf.H5XRPvLCJ9e9.8n.Nj6lCKE6F8RJkKIVVE5z9WLKr5KL2gu',
  'authority'
);
```

### 2. Get JWT Token
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"authority@scrs.gov","password":"password"}'
```

### 3. Test Endpoints
```bash
# View all complaints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/authority/complaints

# Override priority
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_priority":"Critical"}' \
  http://localhost:3000/authority/complaints/1/priority

# Get dashboard
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/authority/dashboard
```

---

## Performance Considerations

### Indexes Created
All authority queries benefit from these indexes:
- Status, Priority, Category filters
- Admin assignment lookups
- History audit trail searches

### Recommended Batch Operations
- Export complaints in batches > 1000
- Monitor dashboard queries (heavy aggregations)
- Cache performance metrics (refresh every hour)

---

## Troubleshooting

### "Complaint not found" error
- Verify complaint ID is numeric
- Check if complaint was soft-deleted
- Ensure authority user exists

### "Target user is not an admin" error
- Verify admin_id points to user with role='admin'
- Check user record in database

### CSV export not working
- Check file permissions
- Verify no active transactions blocking
- Validate complaint_id format

### Audit trail missing
- Ensure complaint_history table has new columns
- Run migration: `node runAuthorityMigration.js`
- Check that `role` column is properly indexed

---

## Summary

The Authority Supervisory Role provides a complete oversight mechanism for the SCRS system with:
- ✅ View all complaints globally
- ✅ Dynamic reassignment capabilities
- ✅ Priority override controls
- ✅ Comprehensive analytics
- ✅ Full audit trail
- ✅ CSV export functionality
- ✅ Admin performance tracking
- ✅ Zero direct resolution capability (security)
