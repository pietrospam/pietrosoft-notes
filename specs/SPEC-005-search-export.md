# SPEC-005: Search Filters & CSV Export

## Overview
Enhance search functionality with filters and add CSV export for TimeSheets.

## Acceptance Criteria

### AC-1: Enhanced Search
- [x] Search in TopBar filters notes by title and contentText
- [x] Search updates NotesList in real-time (debounced)
- [ ] Highlight search terms in results (optional)

### AC-2: Type Filter
- [x] Sidebar nav already filters by note type (All/General/Tasks/Connections/TimeSheet)
- [x] Search respects current view filter

### AC-3: Status/Priority Filters (Tasks)
- [ ] Filter tasks by status (TODO, IN_PROGRESS, DONE, etc.)
- [ ] Filter tasks by priority
- [ ] Filter by client/project

### AC-4: Date Range Filter (TimeSheets)
- [ ] Filter timesheets by workDate range
- [ ] Filter by client/project

### AC-5: CSV Export
- [x] GET `/api/export/timesheets?format=csv` returns CSV download
- [x] Include: date, client, project, task, hours, description, state
- [x] Support date range query params

### AC-6: Export UI
- [x] Export button in TimeSheet view
- [ ] Optional date range picker before export

## Technical Notes
- Use query params for all filters
- CSV generation can be done server-side
- Consider using `json2csv` or manual string building

## Status: PARTIALLY COMPLETED
Core search and CSV export working. Advanced filters deferred to future iteration.
