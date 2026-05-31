---
title: Fix Admin Access System
status: todo
priority: urgent
type: bug
tags: [admin, access-control, critical]
created_by: agent
created_at: 2026-05-31T14:03:00Z
position: 2
---

## Notes
Admin panel completely missing from UI despite database flag being set. Need to:
- Add admin navigation to Layout
- Implement proper role check that reads from database
- Show/hide admin menu based on is_admin flag

## Checklist
- [ ] Add admin check to Layout component
- [ ] Show "Admin" navigation link when user is admin
- [ ] Verify admin pages check role on load
- [ ] Test with admin and non-admin accounts

## Acceptance
- Admin users see "Admin" link in navigation
- Non-admin users don't see admin sections
- Admin pages are accessible to admins only