---
title: Automatic Rota Backup System
status: in_progress
priority: medium
type: feature
tags: [database, automation]
created_by: agent
created_at: 2026-05-17T23:29:29Z
position: 34
---

## Notes
Implement automatic backup system that saves historical rotas to Supabase for data retention and recovery.

## Checklist
- [ ] Create rota_backups table in Supabase
- [ ] Implement auto-save on rota generation
- [ ] Add manual backup button
- [ ] Create restore from backup functionality
- [ ] Add backup history viewer
- [ ] Auto-cleanup old backups (keep last 12 weeks)

## Acceptance
- Rotas automatically backed up when generated
- Can view list of all backed up rotas
- Can restore previous rota versions