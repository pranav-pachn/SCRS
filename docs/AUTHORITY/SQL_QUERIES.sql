/**
 * Authority Role - SQL Reference Queries
 * 
 * Use these queries for direct database analysis and reporting
 * Execute with parameterized queries to prevent SQL injection
 */

-- ================================================================
-- 1. AUDIT TRAIL - All Authority Actions on a Complaint
-- ================================================================

SELECT 
  h.id as audit_id,
  h.complaint_id,
  c.complaint_id as complaint_ref,
  u.name as authority_name,
  u.email as authority_email,
  h.action,
  h.field_changed,
  h.old_value,
  h.new_value,
  h.note,
  h.created_at as action_timestamp,
  TIMESTAMPDIFF(MINUTE, h.created_at, NOW()) as minutes_ago
FROM complaint_history h
LEFT JOIN users u ON h.changed_by = u.id
LEFT JOIN complaints c ON h.complaint_id = c.id
WHERE h.complaint_id = ?  -- COMPLAINT_ID
  AND h.role = 'authority'
ORDER BY h.created_at DESC;

-- Example Output:
/*
audit_id | complaint_ref | authority_name | action            | field_changed      | old_value | new_value
---------|---------------|----------------|-------------------|-------------------|-----------|----------
148      | COMP-0001     | Officer Singh  | PriorityOverride  | priority          | High      | Critical
147      | COMP-0001     | Officer Singh  | Reassigned        | assigned_admin_id | 5         | 8
*/

-- ================================================================
-- 2. PRIORITY OVERRIDE ANALYSIS - Compare AI vs Manual
-- ================================================================

SELECT 
  c.id,
  c.complaint_id,
  c.category,
  c.location,
  c.ai_suggested_priority,
  c.priority AS current_priority,
  c.manual_priority_override,
  CASE 
    WHEN c.manual_priority_override = TRUE 
    THEN 'AUTHORITY OVERRIDE'
    ELSE 'AI SUGGESTION'
  END as priority_source,
  c.assigned_admin_id,
  u.name as admin_name,
  c.status,
  c.created_at,
  DATEDIFF(NOW(), c.created_at) as days_open
FROM complaints c
LEFT JOIN users u ON c.assigned_admin_id = u.id
WHERE c.is_deleted = FALSE
  AND c.manual_priority_override = TRUE
ORDER BY c.priority DESC, c.created_at DESC;

-- Example Output:
/*
complaint_id | category    | ai_suggested | current | override | admin_name   | status
------------|-------------|-------------|---------|----------|-------------|----------
COMP-0001  | Water       | High        | Critical| YES      | Amit Patel  | Resolved
COMP-0042  | Electricity | Medium      | High    | YES      | Raj Kumar   | In Progress
COMP-0058  | Roads       | Low         | Medium  | YES      | Priya Sharma| Submitted
*/

-- ================================================================
-- 3. ADMIN WORKLOAD DISTRIBUTION
-- ================================================================

SELECT 
  u.id as admin_id,
  u.name as admin_name,
  u.email as admin_email,
  COUNT(c.id) as total_assigned,
  SUM(CASE WHEN c.status = 'Submitted' THEN 1 ELSE 0 END) as submitted_count,
  SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count,
  ROUND(
    100 * SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) / COUNT(c.id),
    2
  ) as resolution_percentage,
  COUNT(DISTINCT c.category) as categories_handled,
  COUNT(DISTINCT c.location) as locations_covered
FROM users u
LEFT JOIN complaints c ON u.id = c.assigned_admin_id AND c.is_deleted = FALSE
WHERE u.role = 'admin'
GROUP BY u.id, u.name, u.email
ORDER BY total_assigned DESC, resolution_percentage DESC;

-- Example Output:
/*
admin_name    | total | submitted | in_progress | resolved | resolution% | categories
--------------|-------|-----------|-------------|----------|-------------|----------
Raj Kumar     | 45    | 2         | 7           | 36       | 80.00%      | 5
Priya Sharma  | 42    | 3         | 9           | 30       | 71.43%      | 4
Amit Patel    | 38    | 1         | 9           | 28       | 73.68%      | 6
*/

-- ================================================================
-- 4. RESOLUTION TIME ANALYSIS BY ADMIN
-- ================================================================

SELECT 
  u.name as admin_name,
  COUNT(c.id) as resolved_complaints,
  ROUND(AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)), 1) as avg_hours,
  ROUND(AVG(TIMESTAMPDIFF(DAY, c.created_at, c.resolved_at)), 2) as avg_days,
  MIN(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) as min_hours,
  MAX(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) as max_hours,
  ROUND(
    STDDEV_POP(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)),
    1
  ) as std_dev_hours
FROM users u
LEFT JOIN complaints c 
  ON u.id = c.assigned_admin_id 
  AND c.is_deleted = FALSE 
  AND c.status = 'Resolved' 
  AND c.resolved_at IS NOT NULL
WHERE u.role = 'admin'
GROUP BY u.id, u.name
HAVING resolved_complaints > 0
ORDER BY avg_hours ASC;

-- Example Output:
/*
admin_name    | resolved | avg_hours | avg_days | min_hours | max_hours | std_dev
--------------|----------|-----------|----------|-----------|-----------|-------
Raj Kumar     | 36       | 22.5      | 0.94     | 4         | 120       | 18.2
Priya Sharma  | 30       | 26.3      | 1.10     | 6         | 156       | 22.1
Amit Patel    | 28       | 31.2      | 1.30     | 8         | 180       | 25.3
*/

-- ================================================================
-- 5. REASSIGNMENT ANALYSIS - Track Admin Changes
-- ================================================================

SELECT 
  c.id,
  c.complaint_id,
  c.category,
  COUNT(DISTINCT h.id) as reassignment_count,
  GROUP_CONCAT(
    DISTINCT CONCAT(
      DATE_FORMAT(h.created_at, '%Y-%m-%d %H:%i'), 
      ' -> ', 
      h.new_value
    )
  ) as reassignment_history,
  c.status,
  c.created_at as complaint_created,
  MAX(h.created_at) as last_reassignment
FROM complaints c
LEFT JOIN complaint_history h 
  ON c.id = h.complaint_id 
  AND h.action = 'Reassigned'
  AND h.role = 'authority'
WHERE c.is_deleted = FALSE
GROUP BY c.id, c.complaint_id, c.category, c.status, c.created_at
HAVING COUNT(DISTINCT h.id) > 0
ORDER BY reassignment_count DESC, complaint_created DESC;

-- Example Output:
/*
complaint_id | category | reassignments | history                      | status
------------|----------|---------------|------------------------------|----------
COMP-0015   | Water    | 3             | 2026-02-15 10:30 -> 5        | Resolved
             |          |               | 2026-02-16 14:20 -> 8        |
             |          |               | 2026-02-17 09:15 -> 7        |
COMP-0042   | Electric | 2             | 2026-02-16 09:15 -> 5        | In Progress
             |          |               | 2026-02-16 11:00 -> 8        |
*/

-- ================================================================
-- 6. ESCALATION TRACKING
-- ================================================================

SELECT 
  c.id,
  c.complaint_id,
  c.category,
  c.location,
  c.priority,
  c.status,
  c.is_escalated,
  u_submitter.name as submitter_name,
  u_admin.name as assigned_admin,
  c.created_at,
  h.created_at as escalation_time,
  TIMESTAMPDIFF(HOUR, c.created_at, h.created_at) as hours_to_escalation
FROM complaints c
LEFT JOIN users u_submitter ON c.user_id = u_submitter.id
LEFT JOIN users u_admin ON c.assigned_admin_id = u_admin.id
LEFT JOIN complaint_history h 
  ON c.id = h.complaint_id 
  AND h.action = 'Escalated'
  AND h.role = 'authority'
WHERE c.is_escalated = TRUE
  AND c.is_deleted = FALSE
ORDER BY h.created_at DESC;

-- Example Output:
/*
complaint_id | category | priority | status | escalation_time    | hours_to_escalation
------------|----------|----------|--------|-------------------|-------------------
COMP-0002   | Electric | Critical | In Prog| 2026-02-16 11:00  | 2
COMP-0025   | Water    | High     | In Prog| 2026-02-17 08:30  | 48
*/

-- ================================================================
-- 7. MONTHLY PERFORMANCE TRENDS
-- ================================================================

SELECT 
  DATE_FORMAT(c.created_at, '%Y-%m') as month,
  COUNT(*) as total_complaints,
  SUM(CASE WHEN c.status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
  SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
  ROUND(
    100 * SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as resolution_rate,
  COUNT(DISTINCT c.assigned_admin_id) as active_admins,
  AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) as avg_resolution_hours
FROM complaints c
WHERE c.is_deleted = FALSE
GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
ORDER BY month DESC;

-- Example Output:
/*
month   | total | submitted | in_progress | resolved | resolution_rate | active_admins | avg_resolution_hours
--------|-------|-----------|-------------|----------|-----------------|---------------|--------------------
2026-02 | 119   | 10        | 24          | 85       | 71.43%          | 3             | 24.5
2026-01 | 92    | 9         | 18          | 65       | 70.65%          | 3             | 22.8
2025-12 | 45    | 2         | 5           | 38       | 84.44%          | 3             | 20.2
*/

-- ================================================================
-- 8. COMPLAINT CATEGORY ANALYSIS
-- ================================================================

SELECT 
  c.category,
  COUNT(*) as total_complaints,
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
  ROUND(
    100 * SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as resolution_rate,
  AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) as avg_resolution_hours,
  SUM(CASE WHEN c.priority = 'Critical' THEN 1 ELSE 0 END) as critical_count,
  SUM(CASE WHEN c.manual_priority_override = TRUE THEN 1 ELSE 0 END) as overridden_count
FROM complaints c
WHERE c.is_deleted = FALSE
GROUP BY c.category
ORDER BY total_complaints DESC;

-- Example Output:
/*
category    | total | resolved | resolution_rate | avg_hours | critical | overridden
------------|-------|----------|-----------------|-----------|----------|----------
Water       | 85    | 72       | 84.71%          | 22.5      | 3        | 2
Electricity | 62    | 48       | 77.42%          | 28.3      | 5        | 4
Roads       | 54    | 41       | 75.93%          | 31.2      | 2        | 1
Sanitation  | 38    | 34       | 89.47%          | 18.5      | 0        | 0
*/

-- ================================================================
-- 9. LOCATION-BASED PERFORMANCE
-- ================================================================

SELECT 
  c.location,
  COUNT(*) as complaints,
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
  SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
  SUM(CASE WHEN c.status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
  SUM(CASE WHEN c.priority = 'Critical' THEN 1 ELSE 0 END) as critical_count,
  COUNT(DISTINCT c.category) as unique_categories
FROM complaints c
WHERE c.is_deleted = FALSE
GROUP BY c.location
ORDER BY complaints DESC
LIMIT 10;

-- Example Output:
/*
location | complaints | resolved | in_progress | submitted | critical | categories
---------|-----------|----------|-------------|-----------|----------|----------
Sector 5 | 34        | 28       | 4           | 2         | 2        | 4
Sector 8 | 28        | 22       | 4           | 2         | 1        | 3
Sector 12| 23        | 19       | 3           | 1         | 1        | 3
Sector 3 | 19        | 15       | 3           | 1         | 0        | 2
Sector 7 | 18        | 14       | 2           | 2         | 1        | 3
*/

-- ================================================================
-- 10. AUTHORITY ACTION FREQUENCY
-- ================================================================

SELECT 
  u.name as authority_name,
  COUNT(*) as total_actions,
  SUM(CASE WHEN h.action = 'Reassigned' THEN 1 ELSE 0 END) as reassignments,
  SUM(CASE WHEN h.action = 'PriorityOverride' THEN 1 ELSE 0 END) as priority_overrides,
  SUM(CASE WHEN h.action = 'Escalated' THEN 1 ELSE 0 END) as escalations,
  MIN(h.created_at) as first_action,
  MAX(h.created_at) as last_action,
  DATEDIFF(MAX(h.created_at), MIN(h.created_at)) as days_active
FROM complaint_history h
LEFT JOIN users u ON h.changed_by = u.id
WHERE h.role = 'authority'
GROUP BY u.id, u.name
ORDER BY total_actions DESC;

-- Example Output:
/*
authority_name | total_actions | reassignments | overrides | escalations | days_active
---------------|---------------|---------------|-----------|-------------|----------
Officer Singh  | 36            | 18            | 12        | 8           | 30
Officer Verma  | 15            | 7             | 5         | 3           | 20
*/

-- ================================================================
-- 11. SYSTEM HEALTH CHECK
-- ================================================================

SELECT 
  'Total System Complaints' as metric,
  COUNT(*) as value
FROM complaints
WHERE is_deleted = FALSE

UNION ALL

SELECT 'Unassigned Complaints', COUNT(*)
FROM complaints
WHERE assigned_admin_id IS NULL AND is_deleted = FALSE

UNION ALL

SELECT 'Escalated Complaints', COUNT(*)
FROM complaints
WHERE is_escalated = TRUE AND is_deleted = FALSE

UNION ALL

SELECT 'Priority Overrides', COUNT(*)
FROM complaints
WHERE manual_priority_override = TRUE AND is_deleted = FALSE

UNION ALL

SELECT 'Critical Priority', COUNT(*)
FROM complaints
WHERE priority = 'Critical' AND is_deleted = FALSE

UNION ALL

SELECT 'Overdue (>72 hours)', COUNT(*)
FROM complaints
WHERE is_deleted = FALSE 
  AND status != 'Resolved'
  AND TIMESTAMPDIFF(HOUR, created_at, NOW()) > 72

UNION ALL

SELECT 'Active Admins', COUNT(DISTINCT assigned_admin_id)
FROM complaints
WHERE is_deleted = FALSE AND assigned_admin_id IS NOT NULL

UNION ALL

SELECT 'Authority Actions (24h)', COUNT(*)
FROM complaint_history
WHERE role = 'authority' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Example Output:
/*
metric                        | value
------------------------------|-------
Total System Complaints       | 256
Unassigned Complaints         | 12
Escalated Complaints          | 3
Priority Overrides            | 8
Critical Priority             | 8
Overdue (>72 hours)           | 5
Active Admins                 | 3
Authority Actions (24h)       | 8
*/

-- ================================================================
-- 12. AUTHORITY ACTION REPORT (Last 7 Days)
-- ================================================================

SELECT 
  DATE(h.created_at) as action_date,
  COUNT(*) as total_actions,
  SUM(CASE WHEN h.action = 'Reassigned' THEN 1 ELSE 0 END) as reassignments,
  SUM(CASE WHEN h.action = 'PriorityOverride' THEN 1 ELSE 0 END) as priority_changes,
  SUM(CASE WHEN h.action = 'Escalated' THEN 1 ELSE 0 END) as escalations,
  COUNT(DISTINCT h.complaint_id) as complaints_affected,
  COUNT(DISTINCT h.changed_by) as authority_users_active
FROM complaint_history h
WHERE h.role = 'authority'
  AND h.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(h.created_at)
ORDER BY action_date DESC;

-- Example Output:
/*
action_date | total | reassignments | priority_changes | escalations | affected
------------|-------|---------------|------------------|-------------|--------
2026-02-17  | 8     | 4             | 3                | 1           | 6
2026-02-16  | 12    | 6             | 4                | 2           | 8
2026-02-15  | 5     | 2             | 2                | 1           | 4
*/
