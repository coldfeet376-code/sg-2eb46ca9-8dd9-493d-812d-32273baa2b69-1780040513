---
title: Color-coded Task Type Indicators
status: done
priority: high
type: feature
tags: [ui, visual-design]
created_by: agent
created_at: 2026-05-17T23:31:00Z
position: 0
---

## Notes
Visual coding for task types (Frozen=blue, Milk=purple, TWI=red, Inbound=green, Outbound=amber, Marshaling=purple) with color legend displayed above rota table.

## Checklist
- [x] Define task color CSS variables in globals.css
- [x] Register colors in tailwind.config.ts as utilities
- [x] Add getTaskColor() helper function
- [x] Update rota table cells with color-coded backgrounds
- [x] Add color legend above rota table
- [x] Ensure WCAG AA contrast compliance

## Acceptance
- Each task type displays with distinct color
- Color legend is visible on the rota page
- Text remains readable on all colored backgrounds