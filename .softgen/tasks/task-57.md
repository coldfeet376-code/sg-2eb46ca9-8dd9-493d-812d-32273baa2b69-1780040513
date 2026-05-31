---
title: Complete Clean Rebuild - All Core Pages
status: in_progress
priority: urgent
type: feature
tags: [rebuild, staff, rota, managers]
created_by: agent
created_at: 2026-05-31T15:02:26Z
position: 57
---

## Notes
Complete clean rebuild of all core pages from scratch. Previous rebuild approach failed - user was right that clean slate is faster.

Delete and rebuild:
- src/pages/staff.tsx (1477 → ~300 lines)
- src/pages/managers.tsx (1065 → ~400 lines)  
- src/pages/index.tsx (2004 → ~600 lines)
- src/hooks/useSupabaseQueries.ts (348 → clean typed mutations)

Keep intact:
- Database schema (correct)
- All user data
- Supabase connection
- UI components

## Checklist
- [x] Create rebuild task
- [x] Delete staff.tsx and rebuild minimal working version
- [ ] Test staff CRUD operations
- [ ] Delete managers.tsx and rebuild minimal working version
- [ ] Test manager operations
- [ ] Rebuild useSupabaseQueries with proper types
- [ ] Delete index.tsx and rebuild minimal rota view
- [ ] Test rota generation and display
- [ ] Verify all navigation works
- [ ] Verify admin access works

## Acceptance
- All pages load without errors
- Staff CRUD works (add, edit, delete)
- Availability can be set without constraint errors
- Rota displays correctly
- Admin navigation appears for admin users