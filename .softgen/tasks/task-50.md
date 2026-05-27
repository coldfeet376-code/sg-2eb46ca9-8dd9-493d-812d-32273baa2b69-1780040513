---
title: Rebuild Staff Availability & Rota System
status: done
priority: urgent
type: feature
tags: [rota, availability, rebuild]
created_by: agent
created_at: 2026-05-27
position: 50
---

## Notes

Complete rebuild of staff availability and rota generation system to fix broken date handling, save/load issues, and rota generation logic.

**Root causes identified:**
- Inconsistent date formatting between UI, database, and rota generator
- Complex availability checking with excessive logging
- Race conditions in cache refresh after saves

**Solution approach:**
- Single consistent date format (YYYY-MM-DD) throughout entire system
- Clean, simple availability checking (exact date match + type check)
- Improved UI with prominent date picker and visual status selection
- Immediate cache refresh with visual feedback

## Checklist

- [x] Review and fix database schema (availability table, constraints, indexes)
- [x] Rebuild availability service layer - clean save/load/delete operations
- [x] Rebuild rota generator - simple, bulletproof availability checking
- [x] Rebuild staff availability UI - clean date picker for individual dates
- [x] Add visual availability calendar to staff cards
- [x] Test full flow: set rest day → save → generate rota → verify excluded
- [x] Add data validation and error handling throughout

## Acceptance

- User can click "Edit Availability" on any staff member and set rest/holiday/sick for specific dates
- Saved availability immediately shows as colored badges (R/H/S) in staff cards
- Rota generator respects all availability entries - staff with rest/holiday/sick are excluded from that day's assignments
- Calendar shows clear visual indicators (badges, colors) for rest days, holidays, sick leave