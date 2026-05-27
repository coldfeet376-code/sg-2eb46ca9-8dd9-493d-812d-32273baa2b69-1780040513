---
title: Inbound shift constraint for part-time staff
status: done
priority: high
type: feature
tags: [rota, algorithm, constraint]
created_by: agent
created_at: 2026-05-27T18:31:24Z
position: 53
---

## Notes
Staff working 3 shifts or less per week should only be assigned a maximum of 1 inbound shift per week to balance workload distribution. This constraint needs to be added to the rotation algorithm.

## Checklist
- [x] Track total shifts per staff member during weekly generation
- [x] Identify staff working ≤3 shifts
- [x] Add inbound-specific counter per staff per week
- [x] Enforce max 1 inbound for part-time staff
- [x] Add diagnostic logging for constraint enforcement
- [x] Test with real data to verify constraint works

## Acceptance
- Part-time staff (≤3 shifts/week) get max 1 inbound assignment
- Full-time staff can still get multiple inbound shifts
- Diagnostics show constraint being applied