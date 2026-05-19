---
title: AI Rota Optimization Engine
status: done
priority: high
type: feature
tags: [ai, optimization, fairness]
created_by: agent
created_at: 2026-05-19T07:37:12Z
position: 2
---

## Notes
Implemented AI optimization engine that generates multiple rota scenarios and scores them on fairness across 4 weighted factors.

## Checklist
- [x] Create optimizationService.ts with scenario generation
- [x] Implement calculateFairnessScore function (4 metrics)
- [x] Generate 3 scenarios with different randomization seeds
- [x] Score scenarios on shift balance, duty balance, weekend balance, difficulty
- [x] Display scenarios with metrics, strengths, weaknesses, recommendations
- [x] Highlight best scenario with star badge

## Acceptance
- Clicking "Generate 3 Optimized Scenarios" creates alternatives
- Each scored on 4 weighted factors with detailed metrics
- Best scenario highlighted with ⭐ badge and "Recommended"
- Strengths and weaknesses listed for each scenario