# Authority Frontend - Quick Start Guide

## 🚀 Getting Started

### 1. Access Authority Dashboard
```
URL: http://localhost:3000 (or your-domain)/authority.html
Login: authority@scrs.gov | password
```

### 2. Key Features
- **📊 System Dashboard** - View all complaints system-wide
- **👥 Admin Performance** - Monitor admin productivity
- **📈 Monthly Trends** - Visualize complaint patterns
- **🔄 Reassign** - Move complaints between admins
- **⚡ Priority Override** - Manually adjust priorities
- **📥 Export CSV** - Download complaint data

---

## 📁 Files Overview

| File | Purpose | Lines |
|------|---------|-------|
| authority.html | UI dashboard | 450 |
| authority.js | API client & logic | 400 |
| AUTHORITY_FRONTEND_GUIDE.md | Full documentation | 500+ |
| AUTHORITY_IMPLEMENTATION_SUMMARY.md | Complete summary | 500+ |

---

## 🎯 Navigation Updates

All pages now have proper authority navigation:
- ✅ index.html
- ✅ dashboard.html
- ✅ admin.html
- ✅ complaint.html
- ✅ login.html
- ✅ register.html
- ✅ my-complaints.html

**Display Logic:**
- Citizens: No admin/authority links
- Admins: See "Admin Dashboard" only
- Authority: See "Authority Dashboard" only

---

## 🔐 Role Separation

### Admin Dashboard (admin.html)
- Only admin role can access
- Features: Status updates, remarks, proof upload
- Cannot: Reassign, view system analytics

### Authority Dashboard (authority.html)
- Only authority role can access
- Features: Reassign, priority override, analytics
- Cannot: Update status, add remarks

---

## 🛠️ API Endpoints Used

```
GET    /authority/dashboard           System KPIs
GET    /authority/complaints          All complaints (filtered)
PUT    /authority/complaints/:id/assign     Reassign
PUT    /authority/complaints/:id/priority   Override priority
GET    /authority/admin-performance   Per-admin metrics
GET    /authority/monthly-trends      Monthly stats
GET    /authority/export              CSV download
```

---

## 💡 Quick Actions

### Reassign Complaint
```
1. Click "Reassign" button on complaint row
2. Select target admin from dropdown
3. Click "Assign"
4. Refresh updates automatically
```

### Override Priority
```
1. Click "Override Priority" on complaint
2. View AI-suggested priority (FYI)
3. Select new priority
4. Click "Override Priority"
5. Action logged in audit trail
```

### Export Data
```
1. Apply filters (status, priority, category, location)
2. Click "📥 Export CSV" button
3. File downloads: complaints_export_YYYY-MM-DD.csv
4. Open in Excel/Sheets
```

---

## 🎨 Color Coding

### Statistics Cards
- **Purple gradient** - Total complaints
- **Pink gradient** - Critical priority
- **Cyan gradient** - Escalations
- **Green gradient** - Resolved
- **Orange gradient** - Avg resolution time

### Action Buttons
- **Blue** - Reassign action
- **Amber** - Priority override
- **Green** - Export CSV
- **Purple** - Refresh data

---

## 📱 Mobile Responsive

✅ Works on all devices:
- 📱 Mobile phones (stacked layout)
- 📱 Tablets (2-column grid)
- 💻 Desktops (full 4-5 column grid)

---

## 🧪 Testing Checklist

- [x] Login as authority user
- [x] Dashboard loads with statistics
- [x] Complaints table displays
- [x] Filters work (status, priority, category, location)
- [x] Reassign modal opens
- [x] Reassign action completes
- [x] Priority override modal opens
- [x] Priority override completes
- [x] Admin performance tab loads
- [x] Monthly trends tab loads
- [x] CSV export downloads

---

## 🔄 Configuration

### Production Deployment
```javascript
// Update in authority.js:
const API_BASE = 'http://localhost:3000';

// Change to:
const API_BASE = 'https://api.your-domain.com';
```

---

## 📞 Help & Support

### Common Issues

**Q: Page shows "Forbidden"**  
A: Ensure user has `role='authority'` in database

**Q: No complaints showing**  
A: Check database has complaints with `is_deleted=FALSE`

**Q: Export fails**  
A: Verify backend endpoint `/authority/export` is running

**Q: Can't reassign**  
A: Ensure admins exist in database with `role='admin'`

---

## 📚 Full Documentation

See detailed guides:
- [AUTHORITY_FRONTEND_GUIDE.md](./AUTHORITY_FRONTEND_GUIDE.md) - Complete frontend guide
- [AUTHORITY_IMPLEMENTATION_SUMMARY.md](./AUTHORITY_IMPLEMENTATION_SUMMARY.md) - Full implementation summary
- [../docs/AUTHORITY/IMPLEMENTATION_GUIDE.md](../docs/AUTHORITY/IMPLEMENTATION_GUIDE.md) - Backend API reference

---

## ✅ Status

**Frontend Authority Integration:** ✅ COMPLETE  
**Status:** Production Ready  
**Last Updated:** February 23, 2026  

All features implemented, tested, and documented. Ready for deployment! 🎉
