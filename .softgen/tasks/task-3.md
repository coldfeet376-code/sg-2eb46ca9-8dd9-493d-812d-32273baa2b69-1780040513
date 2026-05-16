---
title: Task Configuration & Requirements
status: todo
priority: high
type: feature
tags: [tasks, configuration]
created_by: agent
created_at: 2026-05-16T04:13:03Z
position: 3
---

## Notes
Configure day-specific requirements for each task (frozen, milk, twi, inbound, outbound, marshaling). Each day of week can have different staffing needs per task.

## Checklist
- [ ] Create task configuration interface
- [ ] Build day-specific requirement inputs (Sun-Sat for each task)
- [ ] Implement requirement templates for quick setup
- [ ] Store configuration in localStorage

## Acceptance
- Can set different staff requirements per task per day
- Changes persist and reflect in rota generation
- Template system speeds up initial configuration