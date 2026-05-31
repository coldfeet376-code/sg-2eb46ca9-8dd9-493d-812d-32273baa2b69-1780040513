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
- src/pages/staff.tsx (1477 → 393 lines) ✅
- src/pages/managers.tsx (1065 → 347 lines) ✅  
- src/pages/index.tsx (2004 → minimal rota view)
- src/hooks/useSupabaseQueries.ts (already clean) ✅

Keep intact:
- Database schema (correct)
- All user data
- Supabase connection
- UI components

## Checklist
- [x] Create rebuild task
- [x] Delete staff.tsx and rebuild minimal working version
- [x] Delete managers.tsx and rebuild minimal working version
- [ ] Delete index.tsx and rebuild minimal rota view
- [ ] Test rota generation and display
- [ ] Verify all navigation works
- [ ] Final validation

## Acceptance
- All pages load without errors
- Staff CRUD works (add, edit, delete)
- Manager CRUD works
- Rota displays correctly
- Admin navigation appears for admin users