---
title: Notification System
status: done
priority: medium
type: feature
tags: [notifications, alerts, ux]
created_by: agent
created_at: 2026-05-16T04:28:00Z
position: 7
---

## Notes
In-app notification system to alert staff when new rotas are generated or updated. Includes notification center, badge counts, and staff-specific assignment alerts.

## Checklist
- [x] Create notification context/hook for state management
- [x] Add notification bell icon to header with badge count
- [x] Build notifications panel with list of recent alerts
- [x] Generate notifications when rotas are created/regenerated
- [x] Create staff-specific assignment notifications
- [x] Add notification preferences (mock for now)
- [x] Persist notifications to localStorage
- [x] Mark notifications as read functionality

## Acceptance
- Bell icon shows unread notification count
- Clicking bell opens notification panel
- New rotas generate notifications for all assigned staff
- Notifications persist across page refreshes
- Can mark individual or all notifications as read