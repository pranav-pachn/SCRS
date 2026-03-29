# Admin Operational Role Documentation# Admin Operational Role Documentation





















































































































































































































**Status:** Complete & Verified ✅**Last Updated:** February 23, 2026  - ✅ Quick reference guide- ✅ Full documentation- ✅ Role-based access control- ✅ Audit trail logging- ✅ Complete status workflow- ✅ 6 API endpoints implemented## ✅ Implementation Status- **Infrastructure:** [../DATABASE/](../DATABASE/) | [../SYSTEM/](../SYSTEM/)- **Other Roles:** [../AUTHORITY/](../AUTHORITY/) | [../AI_MODULE/](../AI_MODULE/)- **Parent:** [../README.md](../README.md) - Documentation Hub## 🔗 Navigation7. **Upload proof before marking resolved**6. **Add remarks for team communication**5. **Validate complaint ID before operations**4. **Always include authorization header**3. **Review EXAMPLES** for integration code2. **Check DOCUMENTATION** when in doubt1. **Use QUICK_REFERENCE** for everyday operations## 💡 Tips & Best Practices- Categories handled- Average resolution time- Pending count- Resolved count- Total assigned complaintsAdmins can view their personal stats:## 📊 Dashboard Stats- ✅ Cannot escalate privileges- ✅ All actions logged in audit trail- ✅ Role enforcement on all endpoints- ✅ Can only access assigned complaints- ✅ JWT authentication required## 🔐 Security   ```     http://localhost:3000/admin/complaints/1/status     -d '{"status":"Resolved"}' \     -H 'Content-Type: application/json' \   curl -X PUT -H "Authorization: Bearer $TOKEN" \        http://localhost:3000/admin/complaints/1/resolve-proof     -d '{"proof_url":"https://..."}' \     -H 'Content-Type: application/json' \   curl -X POST -H "Authorization: Bearer $TOKEN" \   ```bash4. **Resolution:** Upload proof and mark resolved   ```     http://localhost:3000/admin/complaints/1/status     -d '{"status":"In Progress"}' \     -H 'Content-Type: application/json' \   curl -X PUT -H "Authorization: Bearer $TOKEN" \   ```bash3. **Progress:** Update status   ```     http://localhost:3000/admin/complaints/1/remark     -d '{"remark_text":"Visiting location..."}' \     -H 'Content-Type: application/json' \   curl -X POST -H "Authorization: Bearer $TOKEN" \   ```bash2. **Work:** Add remarks for team coordination   ```     http://localhost:3000/admin/complaints   curl -H "Authorization: Bearer $TOKEN" \   ```bash1. **Morning:** Check assigned complaints## 💼 Typical Workflow- Cannot go backwards or skip steps ✅- In Progress → Resolved ✅- Submitted → In Progress ✅Valid transitions:```  assigned to it      assigned to it     assigned to it  ✅ Only by admin    ✅ Only by admin   ✅ Only by adminSubmitted → In Progress → Resolved```## 🔐 Status Workflow- ❌ View performance metrics- ❌ Access global analytics- ❌ Override priorities- ❌ Reassign complaints- ❌ View complaints assigned to other admins### What Admins Cannot Do- ✅ See personal dashboard stats- ✅ View remark history- ✅ Upload resolve proof (images/documents)- ✅ Add internal remarks for team coordination- ✅ Update complaint status (Submitted → In Progress → Resolved)- ✅ View complaints assigned to them### What Admins Can Do| GET | `/admin/dashboard` | Admin dashboard stats || POST | `/admin/complaints/:id/resolve-proof` | Upload resolve proof || GET | `/admin/complaints/:id/remarks` | View all remarks || POST | `/admin/complaints/:id/remark` | Add internal remark || PUT | `/admin/complaints/:id/status` | Update status || GET | `/admin/complaints` | View assigned complaints ||--------|------|---------|| Method | Path | Purpose |### Endpoints Available## 🎯 Admin Capabilities**For Understanding Permissions:** RBAC_IMPLEMENTATION → SUMMARY**For Detailed API Info:** DOCUMENTATION → EXAMPLES.md**For Quick Operations:** QUICK_REFERENCE → API_EXAMPLES.js## 📚 Reading Order```  http://localhost:3000/admin/complaints/1/remark  -d '{"remark_text":"Repair team dispatched"}' \  -H 'Content-Type: application/json' \curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \```bash### 4. Add a Remark```  http://localhost:3000/admin/complaints/1/status  -d '{"status":"In Progress"}' \  -H 'Content-Type: application/json' \curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \```bash### 3. Update Complaint Status```  http://localhost:3000/admin/complaintscurl -H "Authorization: Bearer YOUR_TOKEN" \```bash### 2. View Your Assigned Complaints```  -d '{"email":"admin@scrs.local","password":"Admin@2796"}'  -H 'Content-Type: application/json' \curl -X POST http://localhost:3000/login \```bash### 1. Get Your Token## 🚀 Quick Start (5 Minutes)- ~400 lines, JavaScript code- Testing examples- Integration templates- Copy-paste ready implementations**JavaScript code samples**### 6. [API_EXAMPLES.js](API_EXAMPLES.js)- ~350 lines, examples- Integration patterns- Error scenarios- Request/response pairs**Practical code examples**### 5. [EXAMPLES.md](EXAMPLES.md)- ~250 lines, overview- Operational guidelines- Workflow overview- What admins cannot do- What admins can do**Feature summary**### 4. [SUMMARY.md](SUMMARY.md)- ~300 lines, security details- Access control rules- Role hierarchy- Security implementation- Admin permissions**Role-based access control details**### 3. [RBAC_IMPLEMENTATION.md](RBAC_IMPLEMENTATION.md)- ~400 lines, full reference- Error handling- Status transitions- Request/response specifications- All admin endpoints**Complete API documentation**### 2. [DOCUMENTATION.md](DOCUMENTATION.md)- ~330 lines, quick start- Error guides- Common operations- Copy-paste ready API commands- Quick authentication**Get started in 5 minutes**### 1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md)## 📋 Documents in This FolderComplete documentation for the Admin role - frontline complaint resolution staff.
Complete documentation for Admin users - staff members who handle complaint resolution.

## 📋 Documents in This Folder

### 1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
**Get started in 5 minutes**
- Quick credentials
- Token retrieval
- Copy-paste ready endpoints
- Filter examples
- Status update commands
- ~330 lines

### 2. [DOCUMENTATION.md](DOCUMENTATION.md)
**Complete API documentation**
- All admin endpoints
- Request/response specs
- Parameter details
- Error handling
- Workflow examples
- ~500 lines

### 3. [RBAC_IMPLEMENTATION.md](RBAC_IMPLEMENTATION.md)
**Role-based access control detailed**
- Admin role definition
- Permission hierarchy
- Security implementation
- Access patterns
- ~400 lines

### 4. [SUMMARY.md](SUMMARY.md)
**Feature summary and capabilities**
- What admins can do
- What admins cannot do
- Workflow overview
- Limitations and constraints
- ~350 lines

### 5. [EXAMPLES.md](EXAMPLES.md)
**Markdown examples and patterns**
- Request/response examples
- Error scenarios
- Common workflows
- Integration patterns
- ~400 lines

### 6. [API_EXAMPLES.js](API_EXAMPLES.js)
**JavaScript/curl code examples**
- Practical code samples
- Integration examples
- Testing templates
- Error handling

## 🚀 Quick Start (3 Minutes)

### 1. Get Token
```bash
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@scrs.local","password":"Admin@2796"}'
```

### 2. View Assigned Complaints
```bash
export TOKEN="your_jwt_token"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/complaints
```

### 3. Update Status
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"In Progress"}' \
  http://localhost:3000/admin/complaints/1/status
```

## 🎯 Admin Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/complaints` | View assigned complaints |
| PUT | `/admin/complaints/:id/status` | Update status |
| POST | `/admin/complaints/:id/remark` | Add internal remark |
| GET | `/admin/complaints/:id/remarks` | View remarks |
| POST | `/admin/complaints/:id/resolve-proof` | Upload resolution proof |
| GET | `/admin/dashboard` | Admin dashboard |

## 🔒 Admin Capabilities

**Can Do:**
- ✅ View complaints assigned to them
- ✅ Change status (Submitted → In Progress → Resolved)
- ✅ Add internal remarks
- ✅ Upload resolution proof
- ✅ View dashboard
- ✅ Filter by status, priority, category

**Cannot Do:**
- ❌ View other admins' complaints
- ❌ Reassign complaints
- ❌ Override priority
- ❌ View all system complaints
- ❌ Access analytics

## 📊 Typical Workflow

1. **Login** → Get JWT token
2. **View Complaints** → GET /admin/complaints
3. **Change Status** → PUT /admin/complaints/:id/status (to "In Progress")
4. **Add Remarks** → POST /admin/complaints/:id/remark
5. **Upload Proof** → POST /admin/complaints/:id/resolve-proof
6. **Resolve** → PUT /admin/complaints/:id/status (to "Resolved")

## 💡 Tips

1. Filter complaints by status and priority
2. Use remarks for internal notes
3. Always upload proof before resolving
4. Check dashboard for performance metrics
5. Respect assigned complaint boundaries

## 🔗 Navigation

- **Parent:** [../README.md](../README.md) - Documentation Hub
- **Higher Role:** [../AUTHORITY/](../AUTHORITY/) - Supervisory access
- **AI Integration:** [../AI_MODULE/](../AI_MODULE/) - Complaint analysis
- **Infrastructure:** [../DATABASE/](../DATABASE/)

## ✅ Implementation Status

- ✅ 6 API endpoints
- ✅ Status workflow management
- ✅ Remark and proof handling
- ✅ Dashboard analytics
- ✅ Complete documentation
- ✅ Production ready

**Last Updated:** February 23, 2026
