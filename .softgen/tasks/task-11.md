---
title: Staff Availability Management & Excel Import
status: in_progress
priority: high
type: feature
tags: [availability, import, excel, rest-days]
created_by: agent
created_at: 2026-05-16T04:45:00Z
position: 11
---

## Notes
Complete staff availability system showing rest days, holidays, and sickness. Support Excel import for year-long availability data and manual calendar input. Integrate with rota generation algorithm.

## Checklist
- [x] Create availability calendar UI with day-type marking (rest/holiday/sick)
- [x] Add Excel/CSV import for availability data
- [x] Build manual date picker for individual entries
- [x] Store availability data per staff member
- [x] Integrate availability into rota generation algorithm
- [ ] Show availability conflicts/alerts
- [ ] Add availability overview dashboard

## Acceptance
- Can import Excel spreadsheet with year-long availability
- Can manually mark individual days as rest/holiday/sick
- Rota generation respects all availability constraints
- Conflicts are visible when insufficient staff available