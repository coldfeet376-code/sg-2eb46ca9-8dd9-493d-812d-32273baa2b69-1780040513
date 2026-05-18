---
title: Supabase Manager System with Duty Restrictions
status: in_progress
priority: high
type: feature
tags: [managers, database, supabase]
created_by: agent
created_at: 2026-05-18T07:04:42Z
position: 36
---

## Notes
Store managers in Supabase with configurable duty training and shift preferences. Each manager has flags for which duties they can perform (Intake, Out-loading, Admin, Floor) and preferred shift times (6am/8am). Rota generator respects these restrictions when assigning duties.

## Checklist
- [ ] Get database schema
- [ ] Create managers table with duty training columns
- [ ] Create managerService.ts for CRUD operations
- [ ] Add "Manage Managers" UI section to managers page
- [ ] Update rota generator to respect duty restrictions
- [ ] Add RLS policies for managers table
- [ ] Test CRUD operations and rota generation

## Acceptance
- Managers stored in Supabase with duty training flags
- UI allows adding/editing managers and their trained duties
- Rota generator only assigns managers to duties they're trained for