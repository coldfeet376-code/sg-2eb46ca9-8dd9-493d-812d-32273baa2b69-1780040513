---
title: Professional PDF Weekly Reports
status: done
priority: high
type: feature
tags: [pdf, reports, export]
created_by: agent
created_at: 2026-05-23T08:33:45Z
position: 0
---

## Notes
Implemented comprehensive PDF generation for both staff rotas and manager duty schedules with professional formatting, branding, and detailed metrics.

## Checklist
- [x] Install jsPDF and jspdf-autotable libraries
- [x] Create pdfGenerator.ts with staff and manager report functions
- [x] Add branded headers with GIST warehouse branding
- [x] Implement weekly assignment tables with proper formatting
- [x] Add metrics summary boxes (fairness, coverage, shift counts)
- [x] Include staff contact list and manager assignment summaries
- [x] Add generation timestamps and page numbers
- [x] Integrate with Export PDF buttons on both pages
- [x] Add toast notifications on successful download

## Acceptance
- Clicking "Export PDF" on Rota page downloads professional staff rota PDF
- Clicking "Export PDF" on Managers page downloads manager duties PDF
- PDFs include all week data, metrics, and are print-ready
- Filename format: staff-rota-YYYY-MM-DD.pdf and manager-duties-YYYY-MM-DD.pdf
- Reports display correctly on multiple pages if needed