---
title: Admin User Invitation System
status: done
priority: high
type: feature
tags: [admin, security, invites]
created_by: agent
created_at: 2026-05-23T19:12:00Z
position: 0
---

## Notes
Implement secure invitation system where admin users can invite new users to join the warehouse rota system via email with one-time invitation tokens.

## Checklist
- [x] Create `invitations` table in Supabase for tracking invites
- [x] Add invite functions to authService (send, validate, accept)
- [x] Create admin invites page UI at `/admin/invites`
- [x] Show list of sent invitations with status
- [x] Allow admins to send new invitations
- [x] Update signup flow to require valid invitation token
- [x] Add admin check utility function
- [x] Add invitation acceptance flow

## Acceptance
- Admin users can access `/admin/invites` page
- Admins can send email invitations to new users
- Invited users receive email with signup link containing invite token
- Signup requires valid, unused invitation token
- Invitation table tracks status (pending, accepted, expired)