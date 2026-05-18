---
title: Manager Duties Password-Protected Tab
status: done
priority: high
type: feature
tags: [managers, authentication, rota]
created_by: agent
created_at: 2026-05-18T06:41:42Z
position: 35
---

## Notes
Create a password-protected tab for manager duty rotation with simplified rota system. Duties are Intake, Out-loading, Admin, Floor. Shift starts are 6am and 8am only. Once generated, rota locks and requires password to unlock.

## Checklist
- [x] Add manager types to types/index.ts (ManagerDuty, ManagerAssignment, ManagerShiftStart)
- [x] Create src/pages/managers.tsx with password gate
- [x] Add "Managers" link to Layout navigation
- [x] Implement shift card layout matching main rota style
- [x] Add generate & lock functionality with password protection
- [x] Test password gate and lock/unlock flow

## Acceptance
- Manager tab requires password to access
- Shift cards show 6am/8am duties (Intake, Out-loading, Admin, Floor)
- Generated rota locks and requires password to unlock