---
title: Multi-User Role System
status: done
priority: low
type: feature
tags: [auth, roles, permissions]
created_by: agent
created_at: 2026-05-16T04:53:00Z
position: 23
---

## Notes
Basic role-based access control with three roles: manager (full access), supervisor (view + limited edit), staff (view own schedule only). Navigation filtering based on role.

## Checklist
- [x] Add role field to StaffMember type
- [x] Implement role-based navigation filtering
- [x] Store user role in localStorage
- [x] Apply access controls in Layout

## Acceptance
- Different users see appropriate views
- Actions restricted by role
- Staff see only their schedules