---
title: Rebuild Staff Management Page
status: done
priority: urgent
type: bug
tags: [staff, availability, typescript]
created_by: agent
created_at: 2026-05-31T14:07:33Z
position: 55
---

## Notes
Clean rebuild of staff management with proper TypeScript types, correct availability normalization, and real error handling.

Core issues fixed:
- All `as any` bypasses removed
- Availability type constraint (rest/holiday/sick) properly normalized to lowercase
- Error handlers show actual error messages to user
- Detailed logging for debugging constraint violations

## Checklist
- [x] Remove all `as any` type bypasses in staff mutations
- [x] Fix availability type normalization (lowercase: rest, holiday, sick, available)
- [x] Add proper error handlers with user-visible toast messages
- [x] Add detailed console logging for availability updates
- [x] Validate availability types before database insert

## Acceptance
- Staff can be added without TypeScript errors
- Setting rest/holiday/sick without constraint errors
- All TypeScript types are properly defined (no `as any`)