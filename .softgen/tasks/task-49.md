---
title: Production Readiness - Critical Fixes
status: in_progress
priority: urgent
type: feature
tags: [security, performance, production]
created_by: agent
created_at: 2026-05-27T03:27:51Z
position: 49
---

## Notes

Production-critical improvements before going live:

1. **Security:** Fix RLS policies to require authentication
2. **Performance:** Add pagination to prevent 6-month slowdown
3. **Data Integrity:** Add optimistic locking with version columns
4. **Reliability:** Add transaction wrappers for bulk operations
5. **UX:** Larger touch targets (48px) and better error messages

User confirmed:
- YES to requiring authentication (lock down RLS)
- Option C for conflicts (last write wins, no UI prompt)
- SKIP offline mode (WiFi reliable)

## Checklist

- [x] Create migration to add version columns (assignments, rotas, staff, managers, manager_duties)
- [x] Create migration to fix RLS policies (require auth.uid() IS NOT NULL)
- [x] Add pagination indexes for date-range queries
- [x] Update useSupabaseQueries to load only 12 weeks of availability
- [x] Update useSupabaseQueries to load only selected week + adjacent weeks for assignments
- [ ] Add optimistic locking logic in rotaService (check version before save)
- [ ] Add transaction wrapper for bulk staff operations
- [ ] Add transaction wrapper for rota generation
- [ ] Increase button sizes to 48px on mobile/tablet
- [ ] Add better error messages with retry buttons
- [ ] Test all changes don't break existing functionality
- [ ] Run check_for_errors to validate

## Acceptance

- Login required to access any data (unauthenticated API calls fail)
- Page loads in <500ms even with 12 months of data
- Bulk operations rollback cleanly on failure
- Touch targets meet 48px accessibility standard
