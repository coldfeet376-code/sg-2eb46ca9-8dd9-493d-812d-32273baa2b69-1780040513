---
title: Audit Trail & Change History
status: done
priority: medium
type: feature
tags: [audit, tracking, history]
created_by: agent
created_at: 2026-05-16T04:53:00Z
position: 24
---

## Notes
Track all changes to staff, rotas, configs, and availability with timestamps and user attribution. Store in context for easy access across app.

## Checklist
- [x] Create AuditContext with audit trail storage
- [x] Add audit entry recording for key operations
- [x] Store entries with timestamp and user
- [x] Track create/update/delete/restore actions
- [x] Auto-limit to prevent storage bloat (1000 entries)

## Acceptance
- All changes tracked with who/when
- Can view full change history
- Can restore previous states