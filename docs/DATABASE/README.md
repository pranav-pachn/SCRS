# Database - Schema & Engineering

Complete database documentation including schema design, relationships, and optimization.

## 📋 Documents in This Folder

### 1. [ENGINEERING.md](ENGINEERING.md)
**Database engineering and optimization**
- Table schemas with all fields
- Foreign key relationships
- Index strategy
- Query optimization
- ~600 lines, technical deep dive

### 2. [ER_DIAGRAM.md](ER_DIAGRAM.md)
**Entity relationship diagram**
- Visual schema representation
- Table relationships
- Cardinality notation
- Primary/foreign keys
- ~200 lines, visual reference

## 🗄️ Main Tables

### users
- Citizens, admins, and authorities
- 5 fields: id, name, email, password_hash, role
- Roles: citizen, admin, authority

### complaints
- Main complaint records
- 17 fields including status, priority, AI analysis results
- Supports soft delete with `is_deleted` flag
- Tracks assigned admin and resolution
- Contains AI suggestions and manual overrides

### complaint_history
- Audit trail of all changes
- Links to complaints and users
- Tracks action, old/new values
- Records who made changes and when
- Role-tagged entries (citizen, admin, authority)

### complaint_remarks
- Internal comments from admins
- Linked to complaints and admin users
- Timestamps for tracking
- Used for team communication

### attachments
- Supporting documents and images
- Linked to complaints
- Stores URLs/file references
- Timestamps for tracking

## 📊 Key Statistics

| Aspect | Value |
|--------|-------|
| Total Tables | 5 |
| Total Columns | 50+ |
| Primary Keys | 5 |
| Foreign Keys | 10+ |
| Indexes | 20+ |
| Relationships | Fully normalized |

## 🔍 Common Queries

All optimized with proper indexes:
- Get user's complaints
- List assigned complaints
- View complaint history
- Audit trail filtering
- Admin performance metrics
- Monthly trends

## 🔐 Auditability

Every change logged in `complaint_history`:
- Who made the change
- What changed (field names and values)
- When it happened (exact timestamp)
- Why (action type)
- Which role made it (citizen/admin/authority)

## 📈 Performance Optimization

**Indexes on:** 
- Status, priority, category
- User IDs and assignment
- Timestamps for range queries
- Role and action for audit trail

**Benefits:**
- Fast filtering and sorting
- Efficient aggregation queries
- Scalable to 100,000+ complaints
- Sub-second query response

## 🔗 Navigation

- **Parent:** [../README.md](../README.md) - Documentation Hub
- **System:** [../SYSTEM/](../SYSTEM/) - Code structure
- **Operational:** [../AUTHORITY/](../AUTHORITY/) | [../ADMIN/](../ADMIN/)

## ✅ Schema Status

- ✅ Normalized 3rd normal form
- ✅ Foreign key constraints enforced
- ✅ Optimized indexes created
- ✅ Soft delete support
- ✅ Audit trail complete
- ✅ Production ready

**Last Updated:** February 23, 2026  
**Status:** Complete & Optimized ✅
