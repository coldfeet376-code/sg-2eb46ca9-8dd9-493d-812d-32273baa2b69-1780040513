---
title: Print Preview Mode for Reports
status: in_progress
priority: high
type: feature
tags: [print, preview, reports]
created_by: agent
created_at: 2026-05-23T08:34:30Z
position: 0
---

## Notes
Add dedicated print preview mode that displays the PDF layout on screen before printing, with print-optimized CSS and one-click print functionality.

## Checklist
- [ ] Create StaffRotaPrintPreview component matching PDF layout
- [ ] Create ManagerDutiesPrintPreview component matching PDF layout
- [ ] Add print-specific CSS with @media print rules
- [ ] Add "Print Preview" buttons to both pages
- [ ] Implement print dialog with full-screen preview
- [ ] Add "Print" button that triggers window.print()
- [ ] Hide non-printable UI elements (navigation, buttons) in print mode
- [ ] Ensure page breaks and formatting match PDF exactly

## Acceptance
- Clicking "Print Preview" opens full-screen preview with PDF layout
- Preview exactly matches the downloaded PDF appearance
- Clicking "Print" in preview triggers browser print dialog
- Printed output matches PDF quality and formatting
- Navigation and UI elements hidden in print mode