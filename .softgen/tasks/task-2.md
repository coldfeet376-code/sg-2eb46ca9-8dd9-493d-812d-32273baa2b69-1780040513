---
title: Staff Management Interface
status: todo
priority: high
type: feature
tags: [staff, crud]
created_by: agent
created_at: 2026-05-16T04:13:03Z
position: 2
---

## Notes
Staff management with bulk import capability. Each staff member has name, trained tasks (frozen, milk, twi, inbound, outbound, marshaling), and availability tracking (rest days, absences, holidays).

## Checklist
- [ ] Create staff list component with add/edit/delete
- [ ] Build bulk import form (CSV/paste)
- [ ] Implement training assignment checkboxes
- [ ] Add availability calendar for rest days/absences/holidays
- [ ] Store staff data in localStorage

## Acceptance
- Can add multiple staff members quickly via bulk import
- Training assignments persist correctly
- Availability calendar shows current rest days and absences