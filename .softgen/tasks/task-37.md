---
title: Manager Availability Tracking (Rest/Holiday/Sick)
status: done
priority: high
type: feature
tags: [managers, availability]
created_by: agent
created_at: 2026-05-18T07:15:00Z
position: 37
---

## Notes
Add rest day, holiday, and sick leave tracking for managers. Each manager needs availability status per day (available/rest/holiday/sick) that displays on shift cards. When a manager is unavailable, the shift card shows their status instead of a duty assignment.

## Checklist
- [x] Add manager_availability table to Supabase
- [x] Update managerService with availability CRUD operations
- [x] Add availability management UI to managers page
- [x] Update shift cards to display availability status
- [x] Update rota generator to skip unavailable managers
- [x] Test availability tracking and card display

## Acceptance
- Managers can have rest/holiday/sick status set per day
- Shift cards show availability status instead of duty when unavailable
- Rota generator skips unavailable managers