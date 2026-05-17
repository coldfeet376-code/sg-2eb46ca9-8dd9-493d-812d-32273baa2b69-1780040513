---
title: Fairness Score Distribution Metric
status: done
priority: medium
type: feature
tags: [analytics, algorithm]
created_by: agent
created_at: 2026-05-17T23:31:00Z
position: 2
---

## Notes
Calculate and display 0-100 fairness score based on standard deviation of workload distribution. Shows on main rota page and detailed analytics page.

## Checklist
- [x] Create fairnessCalculator.ts with metric calculation
- [x] Add Fairness Score card to main rota page stats
- [x] Add detailed fairness breakdown to analytics page
- [x] Include workload distribution chart per staff
- [x] Color-code score (green >=90, blue >=70, amber <70)

## Acceptance
- Fairness score displays as 0-100 number
- Score updates when rota regenerated
- Analytics page shows detailed breakdown