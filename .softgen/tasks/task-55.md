---
title: Rebuild Staff Management Page
status: in_progress
priority: urgent
type: bug
tags: [staff, rebuild, critical]
created_by: agent
created_at: 2026-05-31T14:03:00Z
position: 1
---

## Notes
Complete rebuild of staff management page to fix:
- Availability constraint violations (wrong type values sent to DB)
- Silent staff creation failures (schema mismatch)
- Missing error handling
- TypeScript `as any` bypasses

## Checklist
- [x] Create clean staff page with proper TypeScript types
- [ ] Fix availability type mapping (rest/holiday/sick lowercase)
- [ ] Add comprehensive error handling with toast notifications
- [ ] Remove all `as any` type bypasses
- [ ] Test staff creation end-to-end
- [ ] Test availability updates (rest/holiday/sick)

## Acceptance
- Staff creation shows clear error messages on failure
- Availability updates work for rest/holiday/sick without constraint errors
- All TypeScript types are properly defined (no `as any`)