# Prototype Execution Plan

## Phase 0 — Repo & runtime
- Bootstrap Next.js + TS project
- Add Dockerfile + docker-compose (app + postgres services)
- Define workspace path env (`WORKSPACE_PATH=/data`)

Deliverable:
- `docker compose up` runs the app at localhost

---

## Phase 1 — Storage engine (PostgreSQL)
- Set up PostgreSQL in docker-compose
- Implement Prisma schema with migrations
- Implement repository layer using Prisma:
  - clients, projects, notes CRUD
  - proper foreign key constraints
- Implement attachment storage:
  - metadata in DB, files in `/data/attachments`
  - stream for download/view

Deliverable:
- CRUD operations possible via API routes with database persistence

---

## Phase 2 — UI skeleton (layout + routing)
- Sidebar + list + editor layout
- Basic navigation: All / General / Tasks / Connections / TimeSheet / Config

Deliverable:
- Navigable shell with placeholder panels

---

## Phase 3 — Editor integration (TipTap)
- Add TipTap editor with basic formatting
- Autosave (debounced)
- Derive `contentText` for search

Deliverable:
- Edit a note and reload persists content

---

## Phase 4 — Clipboard image paste + inline images
- Intercept paste event in TipTap for image clipboard
- Upload image blob to attachments API
- Insert image node referencing local attachment URL

Deliverable:
- Paste screenshot → appears → reload still works

---

## Phase 5 — Attachments (files)
- Upload file attachments
- List / download / delete
- Attachments panel in note view

Deliverable:
- Attachments fully working

---

## Phase 6 — Domain entities (Clients & Projects) + "Create new…" selectors
- CRUD screens for Clients and Projects
- Selector components with "Create new…" inline modal
- Project selector filtered by client

Deliverable:
- Client/Project flows match the functional context

---

## Phase 7 — Note types: Task / Connection / TimeSheet
- Task panel with required fields + validations
- Connection panel with copy icons
- TimeSheet entry panel + create from Task view
- Views:
  - Tasks by Client→Project and by Status
  - Connections by Client
  - Timesheets by date and aggregation

Deliverable:
- Full workflow end-to-end

---

## Phase 8 — Search + filters + CSV export
- Global search and filters
- Timesheet CSV export

Deliverable:
- Search feels usable; export works

---

## Phase 9 — Polish + sample data + documentation
- Seed sample workspace data
- Final README
- Known limitations documented

---

## Phase 10 — Database Migration (PostgreSQL)
- Add PostgreSQL service to docker-compose
- Install and configure Prisma ORM
- Create database schema (prisma/schema.prisma)
- Migrate existing file-based repositories to Prisma
- Update API routes to use database
- Add database migration scripts
- Update backup/restore to include database dump

Deliverable:
- All data persisted in PostgreSQL
- Attachments still stored on filesystem
- Full ACID compliance for data operations
