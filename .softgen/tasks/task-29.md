---
title: Task Rotation Fairness Metrics
status: done
priority: high
type: feature
tags: [analytics, fairness, metrics]
created_by: agent
created_at: 2026-05-17T20:52:23Z
position: 29
---

## Notes
Add analytics dashboard showing task rotation fairness metrics to help identify imbalanced assignments and ensure fair distribution of tasks among staff.

Display metrics:
- Total assignments per staff member across all tasks
- Task-specific assignment counts (how many times each person did Frozen, Milk, etc.)
- Fairness score/indicator (standard deviation from mean)
- Visual representation (bar charts, heatmaps)
- Color-coded alerts for imbalanced distributions

## Checklist
- [ ] Create Analytics page component with fairness metrics section
- [ ] Calculate total assignments per staff member
- [ ] Calculate task-specific assignment counts (breakdown by task type)
- [ ] Implement fairness score algorithm (standard deviation from mean)
- [ ] Add visual charts/bars showing distribution
- [ ] Color-code staff with too many/too few assignments
- [ ] Show recommended actions to balance workload

## Acceptance
- Analytics page shows clear breakdown of who's assigned which tasks
- Fairness indicators highlight imbalanced distributions
- Visual charts make it easy to spot over/under-utilized staff