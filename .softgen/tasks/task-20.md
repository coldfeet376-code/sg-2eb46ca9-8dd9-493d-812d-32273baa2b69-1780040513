---
title: Staff Preferences System
status: done
priority: medium
type: feature
tags: [staff, preferences, fairness]
created_by: agent
created_at: 2026-05-16T04:53:00Z
position: 20
---

## Notes
Allow staff to mark preferred and avoided tasks. Algorithm uses preferences as tiebreaker when fairness scores are equal, improving staff satisfaction without compromising fairness.

## Checklist
- [x] Add preferences to StaffMember type
- [x] Integrate preferences into fairness scoring
- [x] Use as tiebreaker only (fairness first)

## Acceptance
- Staff can mark preferred tasks
- Algorithm uses preferences as tiebreaker
- Analytics show preference satisfaction