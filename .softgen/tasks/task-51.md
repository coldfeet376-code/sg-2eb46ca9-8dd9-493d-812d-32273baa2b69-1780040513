---
title: Tutorial restart icon in header
status: done
priority: medium
type: feature
tags: [ui, tutorial]
created_by: agent
created_at: 2026-05-27T18:31:24Z
position: 51
---

## Notes
Add a help/tutorial icon in the main page header that allows users to restart the onboarding tour at any time if they miss something or want to review features.

## Checklist
- [x] Add help icon button to main page header (next to theme toggle)
- [x] Connect button to TourContext resetTour function
- [x] Show tooltip "Restart Tutorial"
- [x] Test: clicking icon restarts tour from step 1

## Acceptance
- Help icon visible in header
- Clicking it restarts the tutorial tour
- Tutorial begins from first step