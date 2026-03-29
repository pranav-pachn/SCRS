# Product Requirements Document (PRD)

## Product
Smart Complaint Resolution System (SCRS)

## Version
1.0 (Baseline based on current implementation)

## Date
March 26, 2026

## Document Owner
SCRS Product and Engineering Team

---

## 1. Purpose

This PRD defines product requirements for SCRS, a civic complaint management platform that enables citizens to report municipal issues, empowers admins to manage and resolve complaints, and gives authority users system-wide oversight with analytics and assignment controls.

The document serves as a source of truth for:
- Product scope
- User roles and workflows
- Functional requirements
- Non-functional requirements
- Security, reporting, and operational expectations
- Acceptance and release criteria

---

## 2. Problem Statement

Municipal grievance handling is often fragmented, slow, and opaque. Citizens do not get timely visibility into progress, administrators lack workload balancing tools, and supervisory authorities have limited operational analytics.

SCRS addresses this by providing:
- A structured complaint lifecycle from submission to resolution
- Role-based operational workflows (Citizen, Admin, Authority)
- Transparent dashboard statistics
- Priority and escalation intelligence (rule-based + AI-assisted)
- Audit-ready action history

---

## 3. Goals and Objectives

### 3.1 Business Goals
- Improve complaint resolution throughput and accountability.
- Increase trust through transparent public stats.
- Reduce manual triage burden with AI-assisted analysis.
- Enable authority-level governance via assignment and performance analytics.

### 3.2 Product Goals
- Make complaint submission simple and reliable.
- Ensure every complaint is trackable with status and priority.
- Support admin execution with remarks, proof, and notifications.
- Provide authority users full visibility and control over assignments and priority overrides.

### 3.3 Success Metrics (Initial)
- Complaint submission success rate >= 99%.
- Median complaint creation API response time <= 5s (including AI when available).
- Dashboard and list API p95 <= 2s.
- 100% of complaint state changes recorded in history/audit data.
- >= 90% of complaints assigned to an admin within defined SLA window (configurable by operations).

---

## 4. Personas

### 4.1 Citizen
- Reports civic issues with location, category, description, optional image.
- Tracks own complaint progress and resolution updates.
- Expects timely status visibility and clear communication.

### 4.2 Admin (Operational Staff)
- Handles assigned complaints.
- Updates status, adds remarks, uploads resolve proof.
- Requires filtered work queues and workload-focused analytics.

### 4.3 Authority (Supervisor)
- Monitors all complaints across jurisdiction.
- Assigns/reassigns complaints to admins.
- Overrides priority when needed.
- Reviews performance and trend analytics.

### 4.4 System Administrator (Platform Ops)
- Manages platform setup, migrations, service health, and user roles.
- Requires secure configuration and operational observability.

---

## 5. Scope

### 5.1 In Scope
- Authentication (email/password and Google OAuth integration).
- Role-based access control for citizen, admin, authority.
- Complaint submission, tracking, listing, and lifecycle updates.
- AI-assisted complaint summary, tags, and suggested priority.
- Rule-based escalation by repeated complaints.
- Admin and authority dashboards.
- Notifications for assignment/reassignment/resolution/escalation events.
- Export features for supervisory reporting.
- Public transparency stats endpoints.

### 5.2 Out of Scope (Current Version)
- Native mobile applications.
- Multilingual UI and localization framework.
- GIS map visualization and geospatial clustering.
- Automated SLA breach penalty/recovery workflows.
- External ticketing system integration (e.g., ServiceNow/Jira).

---

## 6. User Journeys

### 6.1 Citizen Journey
1. User registers or logs in.
2. User submits complaint with required details.
3. System validates, stores complaint, and enriches with AI outputs (if available).
4. User views complaint in personal list and details page.
5. User receives updates when complaint is resolved or escalated.

### 6.2 Admin Journey
1. Admin logs in and opens assigned complaints queue.
2. Admin filters by status/priority/category.
3. Admin reviews details, remarks, and history.
4. Admin updates status and adds internal remarks.
5. Admin uploads resolution proof before final resolution where required.

### 6.3 Authority Journey
1. Authority logs in to supervisory dashboard.
2. Reviews KPIs, trends, escalations, and admin performance.
3. Reassigns complaints to optimize workload.
4. Overrides priority for urgent cases.
5. Exports data for reporting and governance.

---

## 7. Functional Requirements

### 7.1 Authentication and Identity
- FR-AUTH-1: System shall allow user registration with role-aware account creation.
- FR-AUTH-2: System shall provide JWT-based login with token expiration.
- FR-AUTH-3: System shall support Google OAuth login when configured.
- FR-AUTH-4: System shall provide profile retrieval and profile update endpoints for authenticated users.

### 7.2 Role-Based Access Control
- FR-RBAC-1: Citizen users shall only access citizen-permitted endpoints and UI.
- FR-RBAC-2: Admin users shall access admin operational endpoints only.
- FR-RBAC-3: Authority users shall access authority supervisory endpoints only.
- FR-RBAC-4: Unauthorized role access attempts shall return appropriate 401/403 responses.

### 7.3 Complaint Lifecycle
- FR-CMP-1: Citizen shall create complaint with category, description, and location.
- FR-CMP-2: Complaint creation may include optional image evidence.
- FR-CMP-3: System shall assign a unique complaint identifier and default initial status.
- FR-CMP-4: Admin shall update status using valid transition rules.
- FR-CMP-5: Complaint records shall preserve created/updated timestamps and responsible actor metadata.
- FR-CMP-6: Soft-delete behavior shall be supported for authorized roles where configured.

### 7.4 Duplicate Detection and Escalation
- FR-ESC-1: System shall compare new complaint text against unresolved complaints using text similarity logic.
- FR-ESC-2: Similar complaint clusters shall increment report count.
- FR-ESC-3: System shall auto-escalate priority using threshold rules (e.g., repeat reports at same category/location).
- FR-ESC-4: Escalation and priority changes shall be visible to admin/authority users.

### 7.5 AI Intelligence
- FR-AI-1: System shall attempt AI analysis during complaint creation.
- FR-AI-2: AI output shall include summary, tags, and ai_suggested_priority.
- FR-AI-3: AI failure shall not block complaint creation (graceful degradation).
- FR-AI-4: Operational priority and AI suggested priority shall remain separately stored fields.

### 7.6 Admin Operations
- FR-ADM-1: Admin shall list assigned complaints with pagination and filtering.
- FR-ADM-2: Admin shall view complaint details, remarks, and history.
- FR-ADM-3: Admin shall add internal remarks to complaints.
- FR-ADM-4: Admin shall attach or update resolution proof where required.
- FR-ADM-5: Admin dashboard shall include workload and trend indicators.

### 7.7 Authority Operations
- FR-AUT-1: Authority shall view all complaints with filters and pagination.
- FR-AUT-2: Authority shall list available admins for assignment.
- FR-AUT-3: Authority shall assign/reassign complaints to admins.
- FR-AUT-4: Authority shall override complaint priority.
- FR-AUT-5: Authority dashboard shall include KPIs, trends, escalations, and admin performance.
- FR-AUT-6: Authority shall export complaint data in machine-readable report format.

### 7.8 Notifications and Communication
- FR-NOT-1: System shall create notifications for assignment/reassignment/resolution/escalation events.
- FR-NOT-2: Authenticated users shall retrieve notifications relevant to their role and ownership.
- FR-NOT-3: Notification read state support should be available to reduce repeated alerts.

### 7.9 Public Transparency
- FR-PUB-1: System shall expose public statistics endpoints for category and status distribution.
- FR-PUB-2: Public dashboard shall present aggregate complaint trends without exposing sensitive user data.

### 7.10 Audit and History
- FR-AUD-1: Every material complaint action shall write to history/audit records.
- FR-AUD-2: Admin and authority users shall view complaint-level historical events.
- FR-AUD-3: Audit records shall capture actor, action type, timestamp, and before/after state where applicable.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- NFR-PERF-1: API p95 latency target <= 2s for read endpoints under nominal load.
- NFR-PERF-2: Complaint submission endpoint target <= 5s median with AI enabled.
- NFR-PERF-3: Paged endpoints shall enforce per-page limits to protect service quality.

### 8.2 Reliability
- NFR-REL-1: Service shall remain operational if AI provider is unavailable.
- NFR-REL-2: Database connection pooling and retry behavior shall be in place.
- NFR-REL-3: Error responses shall be structured and user-safe.

### 8.3 Security
- NFR-SEC-1: JWT validation and role checks shall protect non-public endpoints.
- NFR-SEC-2: Input validation and sanitization shall be applied to user-provided text fields.
- NFR-SEC-3: SQL access shall use parameterized queries.
- NFR-SEC-4: Secrets shall be environment-configured, not hardcoded.

### 8.4 Scalability
- NFR-SCL-1: System shall support growth in complaint volume through query optimization and indexes.
- NFR-SCL-2: Queue-based AI job support should be available for burst handling.

### 8.5 Usability and Accessibility
- NFR-UX-1: Core flows shall be responsive on desktop and mobile breakpoints.
- NFR-UX-2: Status, priority, and error states shall be clearly visible.
- NFR-UX-3: Auth and role-restricted pages shall provide clear access feedback.

### 8.6 Maintainability
- NFR-MNT-1: Backend logic shall be modularized by routes/services/middleware.
- NFR-MNT-2: Migrations shall version schema changes and remain re-runnable when safe.
- NFR-MNT-3: Documentation shall remain aligned with endpoint behavior.

---

## 9. Data Requirements

### 9.1 Core Entities
- Users
- Complaints
- Complaint History
- Complaint Remarks
- Notifications
- Attachments / Resolve Proof

### 9.2 Key Complaint Fields
- complaint_id (human-readable ID)
- category
- description
- location
- status
- priority
- ai_suggested_priority
- summary
- tags
- assigned_admin_id
- report_count
- escalation_level
- timestamps (created_at, updated_at, resolved_at)

### 9.3 Data Governance
- Personal user information shall only be visible to authorized roles.
- Public endpoints shall return aggregate data only.
- Deleted complaints should be soft-deleted where configured to preserve auditability.

---

## 10. API and Integration Requirements

### 10.1 API Style
- RESTful JSON API.
- Standard success/error response envelope.
- Authorization header with bearer token for protected routes.

### 10.2 Integrations
- OpenAI and/or Gemini for AI analysis.
- Google OAuth for authentication.
- MySQL as transactional data store.

### 10.3 Backward Compatibility
- API response handling in frontend should tolerate known shape differences in paginated list keys where applicable.

---

## 11. Analytics and Reporting Requirements

### 11.1 Operational KPIs
- Open complaints count by priority and category.
- Mean/median resolution time.
- Escalation count over time.
- Admin assignment load and completion rate.

### 11.2 Dashboard Views
- Citizen: own complaints and status timeline.
- Admin: assigned queue, trends, activity feed.
- Authority: global overview, admin performance, monthly trends, export.

### 11.3 Export
- Authority users shall export filtered complaint data to CSV.
- Exported datasets shall include fields required for governance reporting.

---

## 12. Risks and Mitigations

- Risk: AI provider outage or latency spikes.
  - Mitigation: Graceful fallback, async/queued processing.

- Risk: Sensitive config leakage via source code.
  - Mitigation: Enforce environment-based secrets and secret scanning.

- Risk: Inconsistent API response shapes across modules.
  - Mitigation: Define and enforce shared response contracts and frontend compatibility adapters.

- Risk: Scaling bottlenecks in analytics queries.
  - Mitigation: Add targeted indexes, pagination, and pre-aggregated views if needed.

---

## 13. Assumptions and Dependencies

### Assumptions
- Municipal teams can operationally act on complaints once assigned.
- Role assignment and user onboarding processes are managed by platform admins.
- Required external APIs and credentials are available in target environment.

### Dependencies
- MySQL availability and schema migration health.
- JWT and OAuth configuration correctness.
- AI provider keys and quota.
- Frontend deployment with valid API base URL settings.

---

## 14. Release Acceptance Criteria

The release is accepted when all below are true:
- All critical user flows (citizen submit, admin process, authority supervise) function end-to-end.
- Role protections block unauthorized actions.
- Complaint history and notifications generate for major lifecycle actions.
- Public stats endpoints return valid aggregate data.
- AI enrichment does not block complaint creation when unavailable.
- Dashboards and complaint lists are functional on desktop and mobile.
- Core API endpoints are documented and smoke-tested.

---

## 15. Future Enhancements (Post-1.0)

- SLA policy engine with breach alerts and escalation automation.
- Geospatial map view and hotspot clustering.
- Native push notifications and multi-channel alerts (email/SMS/WhatsApp).
- Multilingual UX and accessibility upgrades (WCAG-focused).
- Advanced fraud/spam complaint detection and trust scoring.

---

## 16. Appendix - Requirement Traceability Snapshot

- Complaint submission and tracking: Implemented in citizen flows and complaint APIs.
- Admin complaint execution and proof workflows: Implemented in admin routes and dashboard.
- Authority reassignment and priority override: Implemented in authority routes and dashboard.
- AI summary/tags/priority suggestion: Implemented with graceful degradation.
- Transparency dashboards and public stats: Implemented via public stats endpoints.

This PRD should be updated whenever endpoint contracts, role responsibilities, or escalation policies change.