/**
 * Authority API Test Examples
 * Quick reference for testing all authority endpoints
 * 
 * Replace AUTHORITY_ID with actual authority user ID
 * Replace COMPLAINT_ID with actual complaint ID
 * Replace ADMIN_ID with actual admin user ID
 * Replace YOUR_TOKEN with actual JWT token
 */

// ================================================================
// How to get JWT Token for Authority User
// ================================================================

/*
1. First, create an authority user in the database:

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Government Officer',
  'authority@scrs.gov',
  '$2a$10$YOixf.H5XRPvLCJ9e9.8n.Nj6lCKE6F8RJkKIVVE5z9WLKr5KL2gu',
  'authority'
);

2. Get token via login:

POST /login
Body: 
{
  "email": "authority@scrs.gov",
  "password": "password"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

3. Use token in all authority requests:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
*/

// ================================================================
// TEST 1: Get All Complaints (with filters)
// ================================================================

/*
GET /authority/complaints?status=In%20Progress&priority=High

Response:
{
  "success": true,
  "complaints": [
    {
      "id": 1,
      "complaint_id": "COMP-0001",
      "user_id": 10,
      "category": "Water",
      "description": "Water pipe burst in sector 5, affecting 200+ residents",
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
    },
    {
      "id": 2,
      "complaint_id": "COMP-0002",
      "user_id": 11,
      "category": "Electricity",
      "description": "Power outage affecting entire sector",
      "location": "Sector 8, Delhi",
      "status": "In Progress",
      "priority": "High",
      "ai_suggested_priority": "Critical",
      "manual_priority_override": false,
      "assigned_admin_id": 7,
      "admin_name": "Priya Sharma",
      "admin_email": "priya.sharma@scrs.gov",
      "submitter_name": "Amit Desai",
      "submitter_email": "amit@example.com",
      "created_at": "2026-02-16T09:15:00Z",
      "updated_at": "2026-02-16T11:00:00Z",
      "resolved_at": null,
      "is_escalated": true
    }
  ],
  "count": 2,
  "filters": {
    "status": "In Progress",
    "priority": "High",
    "category": null,
    "location": null,
    "assigned_admin_id": null
  }
}
*/

// ================================================================
// TEST 2: Assign Complaint to Admin
// ================================================================

/*
PUT /authority/complaints/1/assign

Request Body:
{
  "admin_id": 8
}

Response:
{
  "success": true,
  "message": "Complaint reassigned successfully.",
  "complaint": {
    "id": 1,
    "complaint_id": "COMP-0001",
    "category": "Water",
    "location": "Sector 5, Delhi",
    "status": "In Progress",
    "priority": "High",
    "ai_suggested_priority": "High",
    "manual_priority_override": false,
    "assigned_admin_id": 8,
    "admin_name": "Amit Patel",
    "created_at": "2026-02-15T10:30:00Z",
    "updated_at": "2026-02-17T10:45:00Z",
    "resolved_at": null
  }
}

Audit Trail Created:
INSERT INTO complaint_history VALUES (
  147,
  1,
  3,           // authority_id
  'Reassigned',
  'authority',
  'assigned_admin_id',
  '5',
  '8',
  NULL,
  NULL,
  2026-02-17 10:45:00
);
*/

// ================================================================
// TEST 3: Override Complaint Priority
// ================================================================

/*
PUT /authority/complaints/1/priority

Request Body:
{
  "new_priority": "Critical"
}

Response:
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
    "assigned_admin_id": 8,
    "created_at": "2026-02-15T10:30:00Z",
    "updated_at": "2026-02-17T11:30:00Z",
    "resolved_at": null
  }
}

Important: ai_suggested_priority remains "High" (unchanged)
Only priority and manual_priority_override are updated

Audit Trail Created:
INSERT INTO complaint_history VALUES (
  148,
  1,
  3,           // authority_id
  'PriorityOverride',
  'authority',
  'priority',
  'High',
  'Critical',
  'AI Suggested: High',
  NULL,
  2026-02-17 11:30:00
);
*/

// ================================================================
// TEST 4: Get Dashboard Analytics
// ================================================================

/*
GET /authority/dashboard

Response:
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
*/

// ================================================================
// TEST 5: Get Admin Performance
// ================================================================

/*
GET /authority/admin-performance

Response:
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
*/

// ================================================================
// TEST 6: Get Monthly Trends
// ================================================================

/*
GET /authority/monthly-trends

Response:
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
*/

// ================================================================
// TEST 7: Export Complaints as CSV
// ================================================================

/*
GET /authority/export

Response:
Content-Type: text/csv
Content-Disposition: attachment; filename="complaints_export.csv"

id,category,location,priority,status,assigned_admin,created_at,resolved_at
COMP-0001,Water,Sector 5,High,Resolved,Raj Kumar,2026-02-15T10:30:00Z,2026-02-16T14:20:00Z
COMP-0002,Electricity,Sector 8,Critical,In Progress,Priya Sharma,2026-02-16T09:15:00Z,
COMP-0003,Roads,Sector 3,High,Resolved,Amit Patel,2026-02-14T16:45:00Z,2026-02-15T11:30:00Z
COMP-0004,Water,Sector 5,Medium,Submitted,Raj Kumar,2026-02-17T08:20:00Z,
COMP-0005,Sanitation,Sector 7,Low,Resolved,Priya Sharma,2026-02-17T09:10:00Z,2026-02-17T10:50:00Z
*/

// ================================================================
// ERROR HANDLING EXAMPLES
// ================================================================

/*
1. Invalid Priority Value
   Request: PUT /authority/complaints/1/priority
   Body: {"new_priority": "Urgent"}
   
   Response (400):
   {
     "success": false,
     "message": "Invalid new_priority. Allowed values: Low, Medium, High, Critical."
   }

2. Complaint Not Found
   Request: PUT /authority/complaints/99999/assign
   Body: {"admin_id": 5}
   
   Response (404):
   {
     "success": false,
     "message": "Complaint not found or has been deleted."
   }

3. Invalid Admin
   Request: PUT /authority/complaints/1/assign
   Body: {"admin_id": 10}  // user_id 10 is a citizen, not admin
   
   Response (400):
   {
     "success": false,
     "message": "Target user is not an admin."
   }

4. Missing Required Field
   Request: PUT /authority/complaints/1/assign
   Body: {}  // admin_id missing
   
   Response (400):
   {
     "success": false,
     "message": "admin_id is required in request body."
   }

5. Database Not Connected
   Response (503):
   {
     "success": false,
     "message": "Service unavailable: database not connected."
   }

6. Insufficient Permissions (not authority role)
   Request: GET /authority/complaints
   Token: admin_user_token
   
   Response (403):
   {
     "success": false,
     "message": "Forbidden: This endpoint requires one of the following roles: authority. Your role: admin."
   }

7. Missing/Invalid Token
   Request: GET /authority/complaints
   Headers: {} // no Authorization header
   
   Response (401):
   {
     "success": false,
     "message": "Missing or invalid token."
   }
*/
