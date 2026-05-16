---
title: Printer-Friendly Layout
status: done
priority: medium
type: feature
tags: [print, css, ui]
created_by: agent
created_at: 2026-05-16T04:40:00Z
position: 10
---

## Notes
Add CSS print styles so users can print schedules directly from the browser using Ctrl+P / Cmd+P. Optimize layout for standard paper sizes with proper page breaks and formatting.

## Checklist
- [x] Add @media print styles to globals.css
- [x] Create print-optimized layouts for rota tables
- [x] Add page break controls for multi-page schedules
- [x] Hide navigation and non-essential UI elements in print
- [x] Optimize typography and spacing for paper
- [x] Add print button to trigger window.print()
- [x] Test landscape and portrait orientations

## Acceptance
- Pressing Ctrl+P / Cmd+P produces clean, readable schedules
- Page breaks work correctly for long tables
- Navigation, buttons, and UI chrome hidden in print view
- Typography readable at standard paper sizes