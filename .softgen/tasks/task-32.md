---
title: Shift Patterns (Early/Late)
status: in_progress
priority: high
type: feature
tags: [database, scheduling]
created_by: agent
created_at: 2026-05-17T23:29:29Z
position: 32
---

## Notes
Support multiple shift patterns (Early/Late) to accommodate warehouse operations running different shifts throughout the day.

## Checklist
- [ ] Add shift_pattern column to assignments table
- [ ] Update task configuration to support shift-specific requirements
- [ ] Modify rota generator to handle shift patterns
- [ ] Add shift selector to UI (Early/Late toggle)
- [ ] Display shift indicator in rota grid
- [ ] Update analytics to show shift distribution

## Acceptance
- Can configure tasks for Early/Late shifts separately
- Rota generation respects shift patterns
- Staff can see which shift they're assigned to