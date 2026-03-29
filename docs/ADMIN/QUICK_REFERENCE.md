# Admin RBAC System - Quick Reference Guide

## 🎯 Quick Start (5 Minutes)

### 1️⃣ Admin User Credentials
```
Email: admin@scrs.local
Password: Admin@2796
Role: admin
```

### 2️⃣ Get JWT Token
```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@scrs.local","password":"Admin@2796"}' | jq '.token'
```

### 3️⃣ Test Any Endpoint (Replace TOKEN)
```bash
export TOKEN="your_jwt_token_here"

curl http://localhost:3000/admin/complaints \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📋 All Admin Endpoints (Copy-Paste Ready)

### List Assigned Complaints
```bash
curl http://localhost:3000/admin/complaints \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Filter by Status
```bash
curl 'http://localhost:3000/admin/complaints?status=In%20Progress' \
  -H "Authorization: Bearer $TOKEN"
```

### Update Status (Submitted → In Progress)
```bash
curl -X PUT http://localhost:3000/admin/complaints/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"In Progress"}'
```

### Update Status (In Progress → Resolved)
```bash
curl -X PUT http://localhost:3000/admin/complaints/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Resolved"}'
```

### Add Remark
```bash
curl -X POST http://localhost:3000/admin/complaints/1/remark \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"remark_text":"Your remark here"}'
```

### Get Remarks
```bash
curl http://localhost:3000/admin/complaints/1/remarks \
  -H "Authorization: Bearer $TOKEN"
```

### Upload Proof
```bash
curl -X POST http://localhost:3000/admin/complaints/1/resolve-proof \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"proof_url":"https://example.com/proof.jpg"}'
```

### View Dashboard
```bash
curl http://localhost:3000/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🗄️ Core Files

| File | Purpose |
|------|---------|
| `middleware/requireRole.js` | Role-based access control |
| `routes/admin.js` | All admin endpoints |
| `services/complaintService.js` | Business logic |
| `migrations/add_admin_fields.sql` | Database schema |
| `setupAdminUser.js` | Create admin user |
| `docs/ADMIN/API_EXAMPLES.js` | API testing examples |

---

## 🔒 Status Transitions

```
Submitted ──┐
            ├─→ In Progress ──┐
                              ├─→ Resolved
                              (No further transitions)
```

**Invalid:**
- ✗ Submitted → Resolved (must go through In Progress)
- ✗ Resolved → In Progress (can't reopen)

---

## 🚨 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | No/invalid token | Login again: use `setupAdminUser.js` |
| 403 Forbidden | Not admin role | Login with admin account |
| 403 Forbidden (assignment) | Complaint not assigned | Update: `UPDATE complaints SET assigned_admin_id=3 WHERE id=1` |
| 400 Bad Request (status) | Invalid transition | Check valid transitions above |
| 500 Internal Server Error | Server issue | Check: `node server.js` logs |

---

## 💾 Database Quick Queries

### Check Admin User
```sql
SELECT * FROM users WHERE role = 'admin';
```

### View Assigned Complaints
```sql
SELECT id, status, priority FROM complaints WHERE assigned_admin_id = 3;
```

### See Status Changes
```sql
SELECT * FROM complaint_history ORDER BY created_at DESC LIMIT 10;
```

### View Remarks
```sql
SELECT r.*, u.name FROM complaint_remarks r
LEFT JOIN users u ON r.admin_id = u.id;
```

### Calculate Avg Resolution Time
```sql
SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours
FROM complaints WHERE status = 'Resolved' AND assigned_admin_id = 3;
```

---

## 🔧 Development Commands

### Start Server
```bash
cd backend
npm install  # if needed
node server.js
```

### Setup Admin User
```bash
node setupAdminUser.js
```

### Run Tests
```bash
# Use curl examples from docs/ADMIN/API_EXAMPLES.js
```

### Database Migration
```bash
node -e "const sql = require('fs').readFileSync('./migrations/add_admin_fields.sql', 'utf8'); \
const mysql = require('mysql2/promise'); \
(async () => { \
  const conn = await mysql.createConnection({...}); \
  const stmts = sql.split(';').filter(s => s.trim()); \
  for (const stmt of stmts) { await conn.query(stmt); } \
  await conn.end(); \
})()"
```

---

## 📊 Expected Dashboard Response

```json
{
  "success": true,
  "dashboard": {
    "total_assigned": 5,
    "pending_count": 3,
    "in_progress_count": 0,
    "resolved_count": 2,
    "critical_count": 0,
    "average_resolution_time": 445.5
  }
}
```

---

## 🛡️ Security Checklist

- [ ] Admin password changed (Don't use default)
- [ ] JWT_SECRET configured in .env (Not default 'scrs_dev_secret')
- [ ] Database password set securely
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] SQL injection prevention (all queries parameterized) ✅
- [ ] Authentication required on all endpoints ✅
- [ ] Authorization checks in place ✅
- [ ] Audit trail enabled ✅

---

## 📱 Postman Collection

Save this as `SCRS_Admin.postman_collection.json`:

```json
{
  "info": {
    "name": "SCRS Admin API",
    "version": "1.0.0"
  },
  "request": [
    {
      "name": "Login Admin",
      "method": "POST",
      "url": "http://localhost:3000/auth/login",
      "body": {
        "email": "admin@scrs.local",
        "password": "Admin@2796"
      }
    },
    {
      "name": "Get Complaints",
      "method": "GET",
      "url": "http://localhost:3000/admin/complaints",
      "header": {
        "Authorization": "Bearer {{token}}"
      }
    }
  ]
}
```

---

## 🎓 Learning Path

1. **Read:** `ADMIN_RBAC_DOCUMENTATION.md` (Full reference)
2. **Setup:** Run `setupAdminUser.js`
3. **Test:** Use commands in this guide
4. **Explore:** Try filtering, adding remarks, changing status
5. **Study:** Look at `services/complaintService.js` (business logic)
6. **Extend:** Add new endpoints using same pattern

---

## 📈 Monitoring

### Check Log Output
```bash
# From server console
# Look for lines like:
# 📋 Admin 3 fetching assigned complaints
# ✅ Complaint 1 status updated successfully
# ❌ Error (if any)
```

### Monitor Database
```sql
-- Check recent complaints
SELECT id, status, assigned_admin_id, updated_at FROM complaints ORDER BY updated_at DESC LIMIT 5;

-- Watch for new remarks
SELECT COUNT(*) as new_remarks FROM complaint_remarks WHERE DATE(created_at) = CURDATE();

-- Monitor resolution rate
SELECT COUNT(*) / (SELECT COUNT(*) FROM complaints) * 100 as resolution_percent
FROM complaints WHERE status = 'Resolved' AND assigned_admin_id = 3;
```

---

## 🚀 Deployment Steps

```bash
# 1. Install dependencies
npm install

# 2. Setup database
node setupAdminUser.js

# 3. Run server
NODE_ENV=production node server.js

# 4. Test endpoints
curl http://localhost:3000/admin/complaints -H "Authorization: Bearer $TOKEN"

# 5. Monitor
tail -f server.log
```

---

## 🤝 Support Resources

- **Full Docs:** `ADMIN_RBAC_DOCUMENTATION.md`
- **Examples:** `docs/ADMIN/API_EXAMPLES.js`
- **Implementation:** `ADMIN_RBAC_IMPLEMENTATION_SUMMARY.md`
- **Code:** `routes/admin.js`, `services/complaintService.js`
- **Database:** `migrations/add_admin_fields.sql`

---

**Last Updated:** February 22, 2026 | **Status:** ✅ Production Ready
