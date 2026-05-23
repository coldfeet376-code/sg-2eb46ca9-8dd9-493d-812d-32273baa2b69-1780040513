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
Implement secure invitation system where admin users can invite new users to join the warehouse rota system via email with one-time invitation tokens. Also created one-click admin setup page for initial admin account creation.

## Checklist
- [x] Create `invitations` table in Supabase for tracking invites
- [x] Add invite functions to authService (send, validate, accept)
- [x] Create admin invites page UI at `/admin/invites`
- [x] Show list of sent invitations with status
- [x] Allow admins to send new invitations
- [x] Update signup flow to require valid invitation token
- [x] Add admin check utility function
- [x] Add invitation acceptance flow
- [x] Create one-click admin setup page at `/admin/setup`
- [x] Disable email confirmation globally
- [x] Set coldfeet376@gmail.com as admin with Pass456word

## Acceptance
- Admin users can access `/admin/invites` page
- Admins can send email invitations to new users
- Invited users receive email with signup link containing invite token
- Signup requires valid, unused invitation token
- Invitation table tracks status (pending, accepted, expired)
- Admin can use `/admin/setup` for instant account creation
- No email verification required for any accounts