---
title: User Authentication and Auto-Lock
status: in_progress
priority: high
type: feature
tags: [auth, security, ux]
created_by: agent
created_at: 2026-05-23T18:52:00Z
position: 0
---

## Notes
Add user authentication requiring name and password on first access, with "remember me" functionality and automatic locking of all assignments after rota generation.

## Checklist
- [ ] Update login page with name field and improved UX
- [ ] Add "Remember Me" checkbox with localStorage persistence
- [ ] Implement auto-redirect to login if not authenticated
- [ ] Auto-lock all assignments after rota generation
- [ ] Update authService to handle session persistence
- [ ] Add user display name tracking in audit log
- [ ] Test multi-user flow with authentication

## Acceptance
- Users prompted for name and password on first visit
- "Remember Me" keeps users logged in across browser sessions
- Generated rotas automatically lock all assignments
- Audit log shows user display names
- Users don't need to re-login if "Remember Me" checked