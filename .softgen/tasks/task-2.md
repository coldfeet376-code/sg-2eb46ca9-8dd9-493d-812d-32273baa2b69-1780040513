---
title: Staff Management Interface
status: done
priority: high
type: feature
tags: [staff, crud]
created_by: agent
created_at: 2026-05-16T04:13:03Z
position: 2
---

## Notes
CRUD interface for managing warehouse staff, their training certifications, and availability. Supports individual entry and bulk CSV-style import for rapid setup.

## Checklist
- [x] Create staff list view with name and trained tasks
- [x] Add individual staff form with task checkboxes
- [x] Implement bulk import textarea (format: Name, Task1, Task2)
- [x] Add delete functionality
- [x] Persist staff data to localStorage
- [x] Show training badges for each staff member
- [x] Create availability calendar placeholder (functional implementation in separate task)

## Acceptance
- Staff can be added individually or in bulk
- Training assignments persist correctly
- Availability calendar shows current rest days and absences