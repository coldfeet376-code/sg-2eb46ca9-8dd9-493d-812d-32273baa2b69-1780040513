---
title: Rota Generation Algorithm
status: done
priority: high
type: feature
tags: [algorithm, rotation]
created_by: agent
created_at: 2026-05-16T04:13:03Z
position: 4
---

## Notes
Constraint-based rotation algorithm: no consecutive days on same task, fair distribution across all staff, training-aware randomization, respects availability (rest days, absences, holidays).

## Checklist
- [x] Implement constraint checker (no consecutive same tasks)
- [x] Build fair distribution scorer
- [x] Create randomization with training awareness
- [x] Integrate availability filtering
- [ ] Generate annual rota (52 weeks)
- [ ] Add manual override capability

## Acceptance
- Generated rota respects all constraints
- Staff distribution is balanced over time
- No consecutive same-task assignments
- Algorithm handles availability gaps gracefully