# Admin Operational Role - Example Responses

## Example API Responses

---

## 1. GET /admin/complaints

### Request
```http
GET /admin/complaints?status=Submitted&priority=High
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (Success)
```json
{
  "success": true,
  "complaints": [
    {
      "id": 1,
      "complaint_id": "COMP-0001",
      "category": "Garbage",
      "description": "Garbage bins in the area are overflowing and have not been cleared for the past three days. The smell is spreading, and stray animals are scattering waste across the road.",
      "location": "Street No. 5, Near Community Park, Narsapur",
      "status": "Submitted",
      "priority": "High",
      "summary": "Garbage bins overflowing for three days causing odor and animal scattering waste",
      "tags": ["garbage", "overflow", "sanitation", "waste", "cleaning"],
      "ai_suggested_priority": "High",
      "proof_url": null,
      "assigned_admin_id": 5,
      "created_at": "2026-02-22T10:00:00.000Z",
      "updated_at": "2026-02-22T10:00:00.000Z",
      "submitter_name": "John Doe",
      "submitter_email": "john@example.com"
    },
    {
      "id": 3,
      "complaint_id": "COMP-0003",
      "category": "Water",
      "description": "Water pipe burst near school junction causing flooding",
      "location": "Main Street, Near School",
      "status": "Submitted",
      "priority": "High",
      "summary": "Water pipe burst near school causing flooding and water supply disruption",
      "tags": ["water", "pipe", "burst", "school", "flooding"],
      "ai_suggested_priority": "Critical",
      "proof_url": null,
      "assigned_admin_id": 5,
      "created_at": "2026-02-22T09:30:00.000Z",
      "updated_at": "2026-02-22T09:30:00.000Z",
      "submitter_name": "Jane Smith",
      "submitter_email": "jane@example.com"
    }
  ],
  "count": 2,
  "filters": {
    "status": "Submitted",
    "priority": "High",
    "category": null
  }
}
```

### Response (No Complaints)
```json
{
  "success": true,
  "complaints": [],
  "count": 0,
  "filters": {
    "status": null,
    "priority": null,
    "category": null
  }
}
```

---

## 2. PUT /admin/complaints/:id/status

### Request
```http
PUT /admin/complaints/1/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "In Progress"
}
```

### Response (Success)
```json
{
  "success": true,
  "complaint": {
    "id": 1,
    "complaint_id": "COMP-0001",
    "category": "Garbage",
    "description": "Garbage bins overflowing...",
    "location": "Street No. 5, Near Community Park, Narsapur",
    "status": "In Progress",
    "priority": "High",
    "assigned_admin_id": 5,
    "created_at": "2026-02-22T10:00:00.000Z",
    "updated_at": "2026-02-22T11:15:00.000Z"
  },
  "message": "Complaint status updated to \"In Progress\"."
}
```

### Response (Invalid Transition)
```json
{
  "success": false,
  "message": "Invalid status transition: Submitted → Resolved. Allowed transitions: In Progress"
}
```

### Response (Not Assigned)
```json
{
  "success": false,
  "message": "Complaint is not assigned to you"
}
```

---

## 3. POST /admin/complaints/:id/remark

### Request
```http
POST /admin/complaints/1/remark
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "remark_text": "Contacted maintenance team. Expected resolution within 24 hours. Team dispatched to location."
}
```

### Response (Success)
```json
{
  "success": true,
  "remark": {
    "id": 1,
    "complaint_id": 1,
    "admin_id": 5,
    "remark_text": "Contacted maintenance team. Expected resolution within 24 hours. Team dispatched to location.",
    "created_at": "2026-02-22T11:20:00.000Z"
  },
  "message": "Remark added successfully."
}
```

### Response (Missing Field)
```json
{
  "success": false,
  "message": "remark_text is required and must be a non-empty string."
}
```

---

## 4. GET /admin/complaints/:id/remarks

### Request
```http
GET /admin/complaints/1/remarks
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (Success)
```json
{
  "success": true,
  "remarks": [
    {
      "id": 2,
      "complaint_id": 1,
      "admin_id": 5,
      "remark_text": "Issue resolved. Proof uploaded.",
      "created_at": "2026-02-22T12:00:00.000Z",
      "admin_name": "Admin User"
    },
    {
      "id": 1,
      "complaint_id": 1,
      "admin_id": 5,
      "remark_text": "Contacted maintenance team. Expected resolution within 24 hours.",
      "created_at": "2026-02-22T11:20:00.000Z",
      "admin_name": "Admin User"
    }
  ],
  "count": 2
}
```

**Note:** Remarks are sorted by `created_at DESC` (newest first).

---

## 5. POST /admin/complaints/:id/resolve-proof

### Request
```http
POST /admin/complaints/1/resolve-proof
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "proof_url": "https://example.com/images/resolve-proof-123.jpg"
}
```

### Response (Success)
```json
{
  "success": true,
  "complaint": {
    "id": 1,
    "complaint_id": "COMP-0001",
    "category": "Garbage",
    "description": "Garbage bins overflowing...",
    "location": "Street No. 5, Near Community Park, Narsapur",
    "status": "In Progress",
    "priority": "High",
    "proof_url": "https://example.com/images/resolve-proof-123.jpg",
    "assigned_admin_id": 5,
    "created_at": "2026-02-22T10:00:00.000Z",
    "updated_at": "2026-02-22T12:30:00.000Z"
  },
  "message": "Resolve proof uploaded successfully."
}
```

### Response (Invalid URL)
```json
{
  "success": false,
  "message": "Invalid URL format for proof_url."
}
```

---

## 6. GET /admin/dashboard

### Request
```http
GET /admin/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (Success)
```json
{
  "success": true,
  "dashboard": {
    "total_assigned": 25,
    "pending_count": 10,
    "in_progress_count": 8,
    "resolved_count": 7,
    "critical_count": 5,
    "average_resolution_time": 48.5
  }
}
```

**Statistics Explanation:**
- `total_assigned`: 25 complaints assigned to this admin
- `pending_count`: 10 complaints with status "Submitted"
- `in_progress_count`: 8 complaints with status "In Progress"
- `resolved_count`: 7 complaints with status "Resolved"
- `critical_count`: 5 complaints with priority "High"
- `average_resolution_time`: 48.5 hours (average time from creation to resolution)

### Response (No Resolved Complaints)
```json
{
  "success": true,
  "dashboard": {
    "total_assigned": 5,
    "pending_count": 3,
    "in_progress_count": 2,
    "resolved_count": 0,
    "critical_count": 2,
    "average_resolution_time": null
  }
}
```

**Note:** `average_resolution_time` is `null` when there are no resolved complaints.

---

## Error Responses

### 401 Unauthorized (Missing/Invalid Token)
```json
{
  "success": false,
  "message": "Missing or invalid token."
}
```

### 403 Forbidden (Insufficient Role)
```json
{
  "success": false,
  "message": "Forbidden: This endpoint requires one of the following roles: admin. Your role: citizen."
}
```

### 403 Forbidden (Complaint Not Assigned)
```json
{
  "success": false,
  "message": "Complaint is not assigned to you"
}
```

### 400 Bad Request (Invalid Status)
```json
{
  "success": false,
  "message": "Invalid status: InvalidStatus. Valid statuses: Submitted, In Progress, Resolved"
}
```

### 400 Bad Request (Invalid Transition)
```json
{
  "success": false,
  "message": "Invalid status transition: Resolved → In Progress. Allowed transitions: none"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error."
}
```

---

## Complete Workflow Example

### Step 1: Admin Logs In
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@scrs.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "name": "Admin User",
    "email": "admin@scrs.com",
    "role": "admin"
  }
}
```

### Step 2: Get Assigned Complaints
```http
GET /admin/complaints
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** (See Example 1 above)

### Step 3: Update Status to "In Progress"
```http
PUT /admin/complaints/1/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "In Progress"
}
```

**Response:** (See Example 2 above)

### Step 4: Add Remark
```http
POST /admin/complaints/1/remark
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "remark_text": "Team dispatched. Expected completion by end of day."
}
```

**Response:** (See Example 3 above)

### Step 5: Upload Resolve Proof
```http
POST /admin/complaints/1/resolve-proof
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "proof_url": "https://example.com/proof/after-cleanup.jpg"
}
```

**Response:** (See Example 5 above)

### Step 6: Update Status to "Resolved"
```http
PUT /admin/complaints/1/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "Resolved"
}
```

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": 1,
    "status": "Resolved",
    "proof_url": "https://example.com/proof/after-cleanup.jpg",
    ...
  },
  "message": "Complaint status updated to \"Resolved\"."
}
```

### Step 7: Check Dashboard
```http
GET /admin/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** (See Example 6 above)

---

## Database State After Workflow

### Complaints Table
```sql
SELECT id, complaint_id, status, assigned_admin_id, proof_url, updated_at
FROM complaints
WHERE id = 1;
```

**Result:**
```
id: 1
complaint_id: COMP-0001
status: Resolved
assigned_admin_id: 5
proof_url: https://example.com/proof/after-cleanup.jpg
updated_at: 2026-02-22 12:30:00
```

### Complaint History Table
```sql
SELECT id, complaint_id, changed_by, old_status, new_status, note, created_at
FROM complaint_history
WHERE complaint_id = 1
ORDER BY created_at;
```

**Result:**
```
id: 1 | complaint_id: 1 | changed_by: NULL | old_status: NULL | new_status: NULL | note: "REPORT: Citizen submitted complaint" | created_at: 2026-02-22 10:00:00
id: 2 | complaint_id: 1 | changed_by: 5 | old_status: Submitted | new_status: In Progress | note: "Status changed from \"Submitted\" to \"In Progress\" by admin" | created_at: 2026-02-22 11:15:00
id: 3 | complaint_id: 1 | changed_by: 5 | old_status: In Progress | new_status: Resolved | note: "Status changed from \"In Progress\" to \"Resolved\" by admin" | created_at: 2026-02-22 12:30:00
```

### Complaint Remarks Table
```sql
SELECT id, complaint_id, admin_id, remark_text, created_at
FROM complaint_remarks
WHERE complaint_id = 1
ORDER BY created_at DESC;
```

**Result:**
```
id: 2 | complaint_id: 1 | admin_id: 5 | remark_text: "Issue resolved. Proof uploaded." | created_at: 2026-02-22 12:00:00
id: 1 | complaint_id: 1 | admin_id: 5 | remark_text: "Team dispatched. Expected completion by end of day." | created_at: 2026-02-22 11:20:00
```
