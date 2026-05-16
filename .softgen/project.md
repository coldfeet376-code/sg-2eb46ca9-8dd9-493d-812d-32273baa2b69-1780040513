# Warehouse Work Rota System

## Vision
Fair distribution work rotation system for warehouse operations managing staff assignments across frozen, milk, twi, inbound, outbound, and marshaling tasks with constraint-based scheduling.

## Design
Industrial-Utility aesthetic inspired by warehouse dispatch boards and terminal interfaces.

**Colors:**
- `--background: 220 15% 96%` (cool light grey)
- `--foreground: 220 20% 15%` (dark graphite)
- `--primary: 205 70% 45%` (steel blue)
- `--accent: 190 85% 45%` (cyan)
- `--muted: 220 15% 88%` (light muted grey)
- `--destructive: 0 70% 50%` (alert red)
- `--warning: 38 92% 50%` (amber)
- `--border: 220 15% 85%` (subtle border)

**Typography:**
- Headings: IBM Plex Sans Condensed (600, 700)
- Body: IBM Plex Sans (400, 500)
- Data/Tables: IBM Plex Mono (400, 500) with tabular-nums

**Style:** Dense information display, tabular layouts, functional color coding, precise execution.

## Features
- Staff management with bulk import and training assignments
- Day-specific task requirements configuration
- Constraint-based rotation algorithm (no consecutive same tasks, fair distribution, training-aware randomization)
- Weekly view (Sun-Sat) with annual calendar
- Rest days, absence, and holiday management
- PDF export for display
- CSV/Excel import for initial setup