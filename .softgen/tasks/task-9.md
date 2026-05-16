---
title: Rota Version History
status: done
priority: medium
type: feature
tags: [history, versioning, restore]
created_by: agent
created_at: 2026-05-16T04:35:00Z
position: 9
---

## Notes
Track all generated rotas as snapshots with timestamps. Allow browsing historical versions and restoring previous rotas when needed.

## Checklist
- [x] Create history storage system with timestamps
- [x] Save snapshot on each rota generation
- [x] Build history browser UI
- [x] Add restore functionality
- [x] Show diff/comparison between current and historical
- [x] Implement version cleanup/limit

## Acceptance
- Every rota generation creates a snapshot
- Can browse historical rotas by date
- Can restore any previous version
- History persists across sessions