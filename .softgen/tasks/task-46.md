---
title: Multi-User Real-Time Collaboration
status: in_progress
priority: high
type: feature
tags: [realtime, collaboration, supabase]
created_by: agent
created_at: 2026-05-23T18:55:00Z
position: 0
---

## Notes
Implement real-time collaboration features so multiple warehouse managers can work together without conflicts or stale data.

## Checklist
- [ ] Move rota storage from localStorage to Supabase database
- [ ] Add real-time subscriptions for staff, rotas, managers, and availability
- [ ] Create audit trail table tracking who made each change
- [ ] Add user identification (track logged-in user email/name)
- [ ] Add "Recent Changes" panel showing who did what and when
- [ ] Add real-time notifications when colleagues make changes
- [ ] Handle subscription cleanup on component unmount
- [ ] Test concurrent editing scenarios

## Acceptance
- Changes made by User A appear instantly on User B's screen
- Audit log shows exact user who made each change with timestamp
- No need to manually refresh to see colleagues' updates
- Recent changes panel displays activity from all users