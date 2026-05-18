---
title: Recurring Rest Days for Managers
status: done
priority: high
type: feature
tags: [managers, availability]
created_by: agent
created_at: 2026-05-18T09:12:00Z
position: 38
---

## Notes
Some managers have fixed rest days every week (e.g., always off on Monday, Wednesday, Friday). Add recurring_rest_days field to managers table (array of day numbers 0-6) and update UI to configure these. The rota generator should respect both one-off availability and recurring rest days.

## Checklist
- [x] Add recurring_rest_days column to managers table
- [x] Update managerService types
- [x] Add recurring rest days UI to manager dialog
- [x] Update rota generator to check recurring rest days
- [x] Display recurring rest days in manager list

## Acceptance
- Managers can have recurring rest days set (e.g., every Mon/Wed/Fri)
- Rota generator skips managers on their recurring rest days
- UI shows recurring rest days as badges in manager list