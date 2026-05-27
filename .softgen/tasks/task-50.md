---
title: Rebuild Staff Availability & Rota System
status: in_progress
priority: urgent
type: feature
tags: [staff, rota, availability, core-feature]
created_by: agent
created_at: 2026-05-27
position: 0
---

## Notes

The staff availability and rota generation system has data flow issues. Complete rebuild to ensure:
- Staff availability (rest days, holidays, sick leave) saves correctly to database
- Calendar UI allows setting individual dates properly
- Rota generator respects all availability constraints
- No duplicate assignments
- Clear visual feedback showing availability status

Root causes identified:
- Availability data not saving/loading consistently
- Date format mismatches between UI/database/generator
- Duplicate availability entries in database
- Complex availability checking logic with edge cases

## Checklist

- [x] Review and fix database schema (availability table, constraints, indexes)
- [x] Rebuild availability service layer - clean save/load/delete operations
- [x] Rebuild rota generator - simple, bulletproof availability checking
- [ ] Rebuild staff availability UI - clean date picker for individual dates
- [ ] Add visual availability calendar to staff cards
- [ ] Test full flow: set rest day → save → generate rota → verify excluded
- [ ] Add data validation and error handling throughout

## Acceptance

- User can click a date on staff card, mark as rest/holiday/sick, and see immediate visual confirmation
- Generating a rota respects all marked availability - staff with rest days do NOT appear on those days
- Calendar shows clear visual indicators (badges, colors) for rest days, holidays, sick leave