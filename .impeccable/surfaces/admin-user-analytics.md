---
version: 1
slug: "admin-user-analytics"
primary_target: "frontend/src/modules/admin/components/UserAnalyticsDashboard.jsx"
related_targets: ["frontend/src/modules/admin/pages/AdminDashboard.jsx"]
---

# Admin Analytics

## Scope and mode

- **Primary surface:** `UserAnalyticsDashboard.jsx`, exposed from `AdminDashboard.jsx` at `/admin/dashboard?tab=analytics`.
- **Visitor mode:** Operate.
- **Audience:** Administrators monitoring learner engagement and platform health.

## Job and task

Help an administrator find active, at-risk, and inactive learners, understand system health, and identify where intervention is needed. The operator selects a reporting interval (7, 30, 90, or 365 days), refreshes backend analytics, reads daily activity and attention signals, then searches, filters, expands, and pages through learner records. Course health closes the workflow with participation, completion, and average-progress context.

## Data truth and states

- All metrics, learner records, engagement classifications, course health, and generation time come from the backend analytics response; do not replace them with illustrative or hard-coded claims.
- Preserve selected-interval context across the pulse metrics, chart, and summary copy.
- Loading skeletons, request errors with retry, inline refresh errors, empty charts, empty learner results, and empty course progress are operational states, not decorative placeholders.

## Direction contract

An indigo **system-pulse band** anchors the page and consolidates health metrics into one recognizable instrument instead of repeated same-size KPI cards. Below it, the daily activity chart and narrow attention rail expose intervention signals. The searchable, status-filterable, expandable learner table is the operational center; course health is the closing read. On mobile, controls wrap, analytical regions stack, the desktop table becomes a legible learner list with expandable detail, and course progress remains scannable without horizontal dependence. Refuse decorative doughnuts and undifferentiated KPI-card grids.

## Finish status

Reviewer disposition: **SHIP**. MF-1 mobile pulse density, MF-2 contract persistence, and MF-3 documentation are resolved. No unresolved surface decisions remain.
