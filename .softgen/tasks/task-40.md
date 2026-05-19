---
title: Absence Pattern Detection ML
status: done
priority: high
type: feature
tags: [ml, analytics, predictions]
created_by: agent
created_at: 2026-05-19T07:37:12Z
position: 1
---

## Notes
Implemented ML-based absence pattern detection identifying which managers have elevated absence rates on specific days of the week.

## Checklist
- [x] Create analyzeAbsencePatterns function in analyticsService
- [x] Implement pattern detection algorithm (day-of-week analysis)
- [x] Add severity classification (low/medium/high)
- [x] Create predictHighRiskPeriods for 4-week forecasting
- [x] Display patterns with manager names, reasons, and probabilities

## Acceptance
- Patterns display specific reasons (e.g., "Chris calls in sick 40% more on Mondays")
- Severity levels shown (low/medium/high) with color coding
- High-risk predictions for next 4 weeks with probability percentages
