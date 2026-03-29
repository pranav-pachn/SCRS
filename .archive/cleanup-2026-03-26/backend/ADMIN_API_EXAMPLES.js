/**
 * Complete Admin RBAC System - Example Usage & Testing
 * 
 * This file shows actual working examples of all admin endpoints.
 * Run each example individually against a running SCRS server.
 */

// ============================================================
// SETUP: Save the admin token in a PowerShell variable
// ============================================================

/*
$loginRes = Invoke-RestMethod -Uri 'http://localhost:3000/auth/login' `
  -Method POST `
  -Body '{"email":"admin@scrs.local","password":"Admin@2796"}' `
  -ContentType 'application/json'

$adminToken = $loginRes.token
Write-Host "✅ Admin token saved: $($adminToken.Substring(0, 30))..."
*/

// ============================================================
// 1. LIST ALL ASSIGNED COMPLAINTS
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints' `
  -Method GET `
  -Headers @{'Authorization'="Bearer $adminToken"} | ConvertTo-Json -Depth 3

Expected Response:
{
  "success": true,
  "complaints": [
    {
      "id": 1,
      "complaint_id": "COMP-0001",
      "category": "Streetlight",
      "description": "Street lights have been non-functional...",
      "location": "Street No. 5, Near Community Park",
      "status": "Submitted",
      "priority": "Medium",
      "assigned_admin_id": 3,
      "created_at": "2026-02-03T23:22:38.000Z",
      "submitter_name": null,
      "submitter_email": null
    }
  ],
  "count": 5,
  "filters": {"status": null, "priority": null, "category": null}
}
*/

// ============================================================
// 2. FILTER COMPLAINTS BY STATUS
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints?status=Submitted' `
  -Method GET `
  -Headers @{'Authorization'="Bearer $adminToken"} | ConvertTo-Json -Depth 3

Available Filters:
  - status: "Submitted", "In Progress", "Resolved"
  - priority: "Low", "Medium", "High", "Critical"
  - category: "Road", "Water", "Electricity", "Garbage", "Streetlight", etc.

Example: Get all high-priority pending complaints
  ?status=Submitted&priority=High
*/

// ============================================================
// 3. UPDATE COMPLAINT STATUS
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints/1/status' `
  -Method PUT `
  -Headers @{'Authorization'="Bearer $adminToken"} `
  -ContentType 'application/json' `
  -Body '{"status":"In Progress"}'

Request Body:
{
  "status": "In Progress"
}

Expected Response:
{
  "success": true,
  "complaint": {
    "id": 1,
    "status": "In Progress",
    "updated_at": "2026-02-22T16:00:00Z"
  },
  "message": "Complaint status updated to \"In Progress\"."
}

Valid Transitions:
  - Submitted → In Progress
  - In Progress → Resolved
  - Resolved → (no further transitions)
*/

// ============================================================
// 4. ADD INTERNAL REMARK
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints/1/remark' `
  -Method POST `
  -Headers @{'Authorization'="Bearer $adminToken"} `
  -ContentType 'application/json' `
  -Body '{"remark_text":"Visited the location and confirmed the issue. Will schedule repairs."}'

Request Body:
{
  "remark_text": "Visited the location and confirmed the issue. Will schedule repairs."
}

Expected Response:
{
  "success": true,
  "remark": {
    "id": 1,
    "complaint_id": 1,
    "admin_id": 3,
    "remark_text": "Visited the location and confirmed the issue. Will schedule repairs.",
    "created_at": "2026-02-22T16:05:00Z"
  },
  "message": "Remark added successfully."
}

Note: Remarks are internal and NOT visible to citizens
*/

// ============================================================
// 5. GET ALL REMARKS FOR A COMPLAINT
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints/1/remarks' `
  -Method GET `
  -Headers @{'Authorization'="Bearer $adminToken"} | ConvertTo-Json -Depth 3

Expected Response:
{
  "success": true,
  "remarks": [
    {
      "id": 2,
      "complaint_id": 1,
      "admin_id": 3,
      "remark_text": "Assigned work to maintenance team",
      "created_at": "2026-02-22T16:10:00Z",
      "admin_name": "System Admin"
    },
    {
      "id": 1,
      "complaint_id": 1,
      "admin_id": 3,
      "remark_text": "Visited the location and confirmed the issue.",
      "created_at": "2026-02-22T16:05:00Z",
      "admin_name": "System Admin"
    }
  ],
  "count": 2
}
*/

// ============================================================
// 6. UPLOAD RESOLUTION PROOF
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/complaints/1/resolve-proof' `
  -Method POST `
  -Headers @{'Authorization'="Bearer $adminToken"} `
  -ContentType 'application/json' `
  -Body '{"proof_url":"https://example.com/images/streetlight-repair-2026-02-22.jpg"}'

Request Body:
{
  "proof_url": "https://example.com/images/streetlight-repair-2026-02-22.jpg"
}

Expected Response:
{
  "success": true,
  "complaint": {
    "id": 1,
    "status": "In Progress",
    "proof_url": "https://example.com/images/streetlight-repair-2026-02-22.jpg",
    "updated_at": "2026-02-22T16:15:00Z"
  },
  "message": "Resolve proof uploaded successfully."
}

Note: Proof can be uploaded at any time during the complaint lifecycle
*/

// ============================================================
// 7. VIEW ADMIN DASHBOARD STATISTICS
// ============================================================

/*
PowerShell:
Invoke-RestMethod `
  -Uri 'http://localhost:3000/admin/dashboard' `
  -Method GET `
  -Headers @{'Authorization'="Bearer $adminToken"} | ConvertTo-Json -Depth 3

Expected Response:
{
  "success": true,
  "dashboard": {
    "total_assigned": 5,
    "pending_count": 4,
    "in_progress_count": 0,
    "resolved_count": 1,
    "critical_count": 0,
    "average_resolution_time": 144.5
  }
}

Metrics Explained:
  - total_assigned: Total complaints assigned to this admin
  - pending_count: Complaints still in "Submitted" status
  - in_progress_count: Complaints being actively worked on
  - resolved_count: Completed complaints
  - critical_count: High or Critical priority complaints
  - average_resolution_time: Hours taken to resolve complaints (average)
*/

// ============================================================
// COMPLETE WORKFLOW EXAMPLE
// ============================================================

/*
1. Admin logs in:
   curl -X POST http://localhost:3000/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@scrs.local","password":"Admin@2796"}'

2. Get assigned complaints:
   curl http://localhost:3000/admin/complaints \
     -H 'Authorization: Bearer [TOKEN]'

3. See a high-priority complaint (COMP-0001)

4. Update to "In Progress":
   curl -X PUT http://localhost:3000/admin/complaints/1/status \
     -H 'Authorization: Bearer [TOKEN]' \
     -H 'Content-Type: application/json' \
     -d '{"status":"In Progress"}'

5. Add a remark about the work:
   curl -X POST http://localhost:3000/admin/complaints/1/remark \
     -H 'Authorization: Bearer [TOKEN]' \
     -H 'Content-Type: application/json' \
     -d '{"remark_text":"Team assigned to fix streetlights"}'

6. Upload proof of completion:
   curl -X POST http://localhost:3000/admin/complaints/1/resolve-proof \
     -H 'Authorization: Bearer [TOKEN]' \
     -H 'Content-Type: application/json' \
     -d '{"proof_url":"https://cdn.example.com/proof.jpg"}'

7. Update status to "Resolved":
   curl -X PUT http://localhost:3000/admin/complaints/1/status \
     -H 'Authorization: Bearer [TOKEN]' \
     -H 'Content-Type: application/json' \
     -d '{"status":"Resolved"}'

8. Check dashboard:
   curl http://localhost:3000/admin/dashboard \
     -H 'Authorization: Bearer [TOKEN]'
*/

// ============================================================
// CURL-BASED TESTING COMMANDS
// ============================================================

bash_examples = `
#!/bin/bash

# Set base URL and token
BASE_URL="http://localhost:3000"
TOKEN=""

# 1. Login
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@scrs.local","password":"Admin@2796"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Admin token: $TOKEN"

# 2. Get complaints
echo "=== Assigned Complaints ==="
curl -s $BASE_URL/admin/complaints \
  -H "Authorization: Bearer $TOKEN" | jq '.complaints[0:2]'

# 3. Update status
echo "=== Updating Status ==="
curl -s -X PUT $BASE_URL/admin/complaints/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"In Progress"}' | jq '.'

# 4. Add remark
echo "=== Adding Remark ==="
curl -s -X POST $BASE_URL/admin/complaints/1/remark \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"remark_text":"Working on this issue"}' | jq '.'

# 5. Get remarks
echo "=== Remarks for Complaint 1 ==="
curl -s $BASE_URL/admin/complaints/1/remarks \
  -H "Authorization: Bearer $TOKEN" | jq '.remarks'

# 6. Upload proof
echo "=== Uploading Proof ==="
curl -s -X POST $BASE_URL/admin/complaints/1/resolve-proof \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"proof_url":"https://example.com/proof.jpg"}' | jq '.'

# 7. Dashboard
echo "=== Admin Dashboard ==="
curl -s $BASE_URL/admin/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq '.dashboard'
`;

// ============================================================
// SECURITY FEATURES DEMONSTRATED
// ============================================================

/*
✅ Authentication:
   - All endpoints require valid JWT token
   - Tokens obtained via /auth/login
   - Tokens expire after 2 hours

✅ Authorization:
   - requireRole('admin') middleware checks user role
   - Only users with 'admin' role can access /admin/* endpoints
   - Attempting to access with citizen role returns 403 Forbidden

✅ Data Access Control:
   - Admin can ONLY see complaints assigned to them
   - Trying to access another admin's complaints returns 403
   - Verified in getComplaintById() function

✅ Audit Trail:
   - Every status change logged in complaint_history table
   - Shows: old_status, new_status, changed_by (admin_id), timestamp
   - Used for compliance and reporting

✅ SQL Injection Prevention:
   - All queries use parameterized statements
   - MySQL2 promise API prevents injection attacks

✅ Data Privacy:
   - Remarks stored in separate table, not visible to citizens
   - Proof URLs stored but marked as admin-only data
   - User information protected with NULL for anonymous complaints
*/

// ============================================================
// EXAMPLE API RESPONSES
// ============================================================

// Response when admin successfully updates status:
success_response = {
  "success": true,
  "complaint": {
    "id": 1,
    "user_id": null,
    "category": "Streetlight",
    "description": "Street lights have been non-functional...",
    "summary": null,
    "tags": null,
    "location": "Street No. 5",
    "status": "In Progress",
    "priority": "Medium",
    "is_deleted": false,
    "deleted_at": null,
    "deleted_by": null,
    "ai_suggested_priority": null,
    "created_at": "2026-02-03T23:22:38.000Z",
    "updated_at": "2026-02-22T16:00:00.000Z",
    "assigned_admin_id": 3,
    "resolved_at": null,
    "proof_url": null
  },
  "message": "Complaint status updated to \"In Progress\"."
};

// Response when forbidden (not assigned to admin):
error_response = {
  "success": false,
  "message": "Complaint not found or not assigned to you"
};

// Response when invalid status transition:
invalid_transition = {
  "success": false,
  "message": "Invalid status transition: Resolved → In Progress. Allowed transitions: none"
};

// Response when insufficient permissions:
forbidden_response = {
  "success": false,
  "message": "Forbidden: This endpoint requires one of the following roles: admin. Your role: citizen."
};

// ============================================================
// DATABASE QUERIES FOR MANUAL VERIFICATION
// ============================================================

sql_queries = `
-- Check all complaints assigned to admin (ID: 3)
SELECT * FROM complaints WHERE assigned_admin_id = 3;

-- View complaint status update history
SELECT * FROM complaint_history ORDER BY created_at DESC;

-- See all remarks for a specific complaint
SELECT r.*, u.name as admin_name 
FROM complaint_remarks r
LEFT JOIN users u ON r.admin_id = u.id
WHERE r.complaint_id = 1
ORDER BY r.created_at DESC;

-- Check average resolution time for admin
SELECT 
  COUNT(*) as total,
  AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.updated_at)) as avg_resolution_hours
FROM complaints c
WHERE c.assigned_admin_id = 3 AND c.status = 'Resolved';

-- Get admin users
SELECT id, name, email, role FROM users WHERE role = 'admin';

-- See all updates to a specific complaint
SELECT 
  c.id,
  c.status as current_status,
  h.old_status,
  h.new_status,
  h.created_at,
  u.name as changed_by
FROM complaints c
LEFT JOIN complaint_history h ON c.id = h.complaint_id
LEFT JOIN users u ON h.changed_by = u.id
WHERE c.id = 1
ORDER BY h.created_at DESC;
`;
