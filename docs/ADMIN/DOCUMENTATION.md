# Admin Operational Role - Implementation Documentation

## Overview

This module implements a fully functional **Admin Operational Role** with Role-Based Access Control (RBAC) for the Smart Complaint Resolution System (SCRS). Admins can manage complaints assigned to them, update statuses, add remarks, and upload resolve proofs.

---

## Architecture

### Folder Structure

```
backend/
├── middleware/
│   └── requireRole.js          # RBAC middleware
├── routes/
│   └── admin.js                # Admin routes
├── services/
│   └── complaintService.js    # Business logic layer
├── migrations/
│   ├── add_admin_operational_fields.sql
│   └── create_complaint_remarks_table.sql
└── server.js                   # Main server (updated)
```

---

## Database Schema Changes

### 1. Complaints Table Updates

**New Columns:**
- `assigned_admin_id` (INT, NULL) - Foreign key to users.id
- `proof_url` (VARCHAR(2083), NULL) - URL for resolve proof image

**Migration:** `migrations/add_admin_operational_fields.sql`

### 2. Complaint Remarks Table (New)

**Purpose:** Store internal admin remarks (not visible to citizens)

**Columns:**
- `id` (INT, PRIMARY KEY)
- `complaint_id` (INT, FK → complaints.id)
- `admin_id` (INT, FK → users.id)
- `remark_text` (TEXT)
- `created_at` (DATETIME)

**Migration:** `migrations/create_complaint_remarks_table.sql`

---

## API Endpoints

### Base Path: `/admin`

All endpoints require:
1. **Authentication:** Valid JWT token (`Authorization: Bearer <token>`)
2. **Authorization:** User role must be `'admin'`

---

### 1. GET /admin/complaints

**Description:** Get all complaints assigned to the logged-in admin

**Query Parameters:**
- `status` (optional) - Filter by status: `Submitted`, `In Progress`, `Resolved`
- `priority` (optional) - Filter by priority: `Low`, `Medium`, `High`
- `category` (optional) - Filter by category

**Response:**
```json
{
  "success": true,
  "complaints": [
    {
      "id": 1,
      "complaint_id": "COMP-0001",
      "category": "Garbage",
      "description": "Bins overflowing...",
      "location": "Main Street",
      "status": "Submitted",
      "priority": "High",
      "summary": "AI-generated summary",
      "tags": ["garbage", "overflow"],
      "ai_suggested_priority": "High",
      "proof_url": null,
      "assigned_admin_id": 5,
      "created_at": "2026-02-22T10:00:00.000Z",
      "updated_at": "2026-02-22T10:00:00.000Z",
      "submitter_name": "John Doe",
      "submitter_email": "john@example.com"
    }
  ],
  "count": 1,
  "filters": {
    "status": null,
    "priority": null,
    "category": null
  }
}
```

**Sorting:** Results sorted by priority DESC (High → Medium → Low), then created_at ASC

---

### 2. PUT /admin/complaints/:id/status

**Description:** Update complaint status with validation

**Request Body:**
```json
{
  "status": "In Progress"
}
```

**Valid Status Transitions:**
- `Submitted` → `In Progress`
- `In Progress` → `Resolved`
- `Resolved` → (no transitions allowed, unless reopening is added)

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": 1,
    "status": "In Progress",
    ...
  },
  "message": "Complaint status updated to \"In Progress\"."
}
```

**Error Responses:**
- `400` - Invalid status or invalid transition
- `403` - Complaint not assigned to admin
- `500` - Internal server error

**Note:** Status change is logged in `complaint_history` table automatically.

---

### 3. POST /admin/complaints/:id/remark

**Description:** Add an internal remark to a complaint (not visible to citizens)

**Request Body:**
```json
{
  "remark_text": "Contacted maintenance team. Expected resolution in 24 hours."
}
```

**Response:**
```json
{
  "success": true,
  "remark": {
    "id": 1,
    "complaint_id": 5,
    "admin_id": 3,
    "remark_text": "Contacted maintenance team...",
    "created_at": "2026-02-22T11:00:00.000Z"
  },
  "message": "Remark added successfully."
}
```

**Error Responses:**
- `400` - Missing or invalid remark_text
- `403` - Complaint not assigned to admin
- `500` - Internal server error

---

### 4. GET /admin/complaints/:id/remarks

**Description:** Get all remarks for a complaint

**Response:**
```json
{
  "success": true,
  "remarks": [
    {
      "id": 1,
      "complaint_id": 5,
      "admin_id": 3,
      "remark_text": "First remark...",
      "created_at": "2026-02-22T11:00:00.000Z",
      "admin_name": "Admin User"
    }
  ],
  "count": 1
}
```

---

### 5. POST /admin/complaints/:id/resolve-proof

**Description:** Upload resolve proof (image URL)

**Request Body:**
```json
{
  "proof_url": "https://example.com/images/resolve-proof-123.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": 5,
    "proof_url": "https://example.com/images/resolve-proof-123.jpg",
    ...
  },
  "message": "Resolve proof uploaded successfully."
}
```

**Note:** Proof URL must be a valid URL format.

---

### 6. GET /admin/dashboard

**Description:** Get admin dashboard statistics

**Response:**
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

**Statistics Explained:**
- `total_assigned` - Total complaints assigned to this admin
- `pending_count` - Complaints with status "Submitted"
- `in_progress_count` - Complaints with status "In Progress"
- `resolved_count` - Complaints with status "Resolved"
- `critical_count` - Complaints with priority "High"
- `average_resolution_time` - Average hours to resolve (calculated from created_at to updated_at when status = "Resolved")

---

## Security Rules

### 1. Role-Based Access Control (RBAC)

- All admin endpoints require `requireRole('admin')` middleware
- Users with role `'citizen'` or `'authority'` cannot access admin endpoints
- Returns `403 Forbidden` if role mismatch

### 2. Assignment-Based Access

- Admins can **ONLY** access complaints assigned to them (`assigned_admin_id = admin.id`)
- If complaint is not assigned (`assigned_admin_id IS NULL`), admin cannot access it
- Returns `403 Forbidden` if complaint not assigned

### 3. Status Transition Validation

- Only valid status transitions are allowed
- Invalid transitions return `400 Bad Request` with error message
- Status changes are logged in `complaint_history` for audit trail

### 4. SQL Injection Prevention

- All database queries use parameterized queries (prepared statements)
- User input is validated before database operations
- No raw SQL string concatenation

---

## Installation & Setup

### Step 1: Run Database Migrations

```bash
# Add admin operational fields
mysql -u root -p scrs < backend/migrations/add_admin_operational_fields.sql

# Create complaint remarks table
mysql -u root -p scrs < backend/migrations/create_complaint_remarks_table.sql
```

### Step 2: Verify Database Changes

```sql
-- Check complaints table
DESCRIBE complaints;

-- Check complaint_remarks table
DESCRIBE complaint_remarks;

-- Verify indexes
SHOW INDEXES FROM complaints WHERE Key_name LIKE '%assigned%';
```

### Step 3: Create Admin User

```sql
-- Register via API or insert directly:
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Admin User',
  'admin@scrs.com',
  '$2a$10$...', -- bcrypt hash of password
  'admin'
);
```

### Step 4: Assign Complaints to Admin

```sql
-- Assign a complaint to admin (ID = 5)
UPDATE complaints 
SET assigned_admin_id = 5 
WHERE id = 1;
```

---

## Usage Examples

### Example 1: Get Assigned Complaints

```bash
curl -X GET "http://localhost:3000/admin/complaints?status=Submitted&priority=High" \
  -H "Authorization: Bearer <admin_jwt_token>"
```

### Example 2: Update Status

```bash
curl -X PUT "http://localhost:3000/admin/complaints/1/status" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress"}'
```

### Example 3: Add Remark

```bash
curl -X POST "http://localhost:3000/admin/complaints/1/remark" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"remark_text": "Investigated issue. Found root cause."}'
```

### Example 4: Upload Resolve Proof

```bash
curl -X POST "http://localhost:3000/admin/complaints/1/resolve-proof" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"proof_url": "https://example.com/proof.jpg"}'
```

### Example 5: Get Dashboard Stats

```bash
curl -X GET "http://localhost:3000/admin/dashboard" \
  -H "Authorization: Bearer <admin_jwt_token>"
```

---

## Status Transition Rules

### Valid Transitions

| Current Status | Allowed Next Status |
|----------------|---------------------|
| Submitted | In Progress |
| In Progress | Resolved |
| Resolved | (none - endpoint closed) |

### Invalid Transitions (Rejected)

- `Submitted` → `Resolved` (must go through "In Progress" first)
- `In Progress` → `Submitted` (cannot go backwards)
- `Resolved` → `In Progress` (unless reopening is implemented)

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Missing or invalid token."
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Complaint is not assigned to you"
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Invalid status transition: Submitted → Resolved. Allowed transitions: In Progress"
}
```

---

## Testing Checklist

- [ ] Admin can view assigned complaints
- [ ] Admin cannot view unassigned complaints
- [ ] Admin can update status with valid transitions
- [ ] Admin cannot update status with invalid transitions
- [ ] Admin can add remarks
- [ ] Admin can view remarks
- [ ] Admin can upload resolve proof
- [ ] Dashboard shows correct statistics
- [ ] Non-admin users get 403 Forbidden
- [ ] Status changes are logged in complaint_history

---

## Future Enhancements

1. **Complaint Assignment API** - Allow admins/authorities to assign complaints
2. **Auto-Assignment** - Automatically assign complaints to least-loaded admin
3. **Reopening** - Allow reopening resolved complaints
4. **Bulk Operations** - Update multiple complaints at once
5. **Admin Notifications** - Notify admins of new assignments
6. **Performance Metrics** - Track admin performance and resolution times

---

## Notes

- **Complaint Assignment:** Currently, complaints must be manually assigned via SQL. Future enhancement: Add assignment API endpoint.
- **Proof Requirement:** The system stores proof_url but doesn't enforce it for resolution. This can be added as a business rule.
- **Remarks Visibility:** Remarks are internal-only. Citizens cannot see admin remarks through the API.

---

## Support

For issues or questions:
1. Check error logs in console output
2. Verify database migrations were run successfully
3. Ensure admin user has correct role
4. Verify complaints are assigned to admin (`assigned_admin_id`)
