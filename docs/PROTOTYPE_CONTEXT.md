# Pietrosoft Notes — Prototype Functional Context (Localhost / No-DB)

## 0) Purpose of this prototype
Build a **Proof of Concept** to validate UX, data model, and workflows before implementing a real DB.
This prototype must run **100% on localhost**, with **no external database**.

Primary goals:
- Validate the core UX: sidebar → list → editor → structured panels
- Validate domain entities: Client / Project / Task / Connection / TimeSheet
- Validate WYSIWYG editing + image paste + attachments
- Validate search and the required views

Non-goals:
- Multi-user
- Cloud sync
- Production-grade security
- Performance optimization beyond "feels fast"

---

## 1) Key constraints (No-DB / Local-only)
- No Postgres/MySQL/etc.
- Persistence must be local:
  - Preferred: **file-based storage** (JSON files) under a local workspace folder mounted as Docker volume
  - Attachments stored on disk in that workspace folder
- Single-user, single-instance (no concurrency guarantees required)

---

## 2) Recommended architecture (prototype)
### 2.1 App stack (prototype)
- Next.js + TypeScript (single app)
- TipTap editor (ProseMirror)
- Minimal API routes (local) to read/write files
- Storage engine: file-based JSON + uploads folder

### 2.2 Workspace layout on disk
All data is stored under a single directory (Docker volume), e.g. `/data`.

Proposed structure:
- `/data/meta.json` (workspace metadata, schema version)
- `/data/clients.json`
- `/data/projects.json`
- `/data/notes/` (one JSON per note) OR `/data/notes.json` (single file)
- `/data/attachments/` (binary files)
- `/data/index.json` (optional derived search index)

Prototype must use **atomic writes** (write temp + rename) to avoid corruption.

---

## 3) Domain categories (configurable)
When a category selector is shown, it must include an option to **"Create new…" on the fly** (modal or inline).

### 3.1 Client
A configurable category assignable to a note, task, project, or connection.

Attributes:
- `id`
- `name` (required)
- `description` (optional)
- `icon` (required: icon key/name)

Rules:
- CRUD: create/edit/disable
- Client icon appears in lists and headers

### 3.2 Project
A configurable entity that **must belong to a Client**.

Attributes:
- `id`
- `clientId` (required)
- `name` (required)
- `code` (optional)
- `description` (optional)

Rules:
- Cannot exist without a client
- Projects used by tasks (mandatory)

---

## 4) Note types (everything is a Note)
Common note fields:
- `id`, `type`
- `title`
- `contentJson` (TipTap)
- `contentText` (derived, for search)
- timestamps: `createdAt`, `updatedAt`, `deletedAt?`, `archivedAt?`, `lastOpenedAt?`
- attachments: files and inline images

### 4.1 General Note
- Optional `clientId`
- Optional `projectId`
Rules:
- If `projectId` set, client is implied via project's client

### 4.2 Task Note
A Task must have a Project (thus implies Client).

Attributes:
- `projectId` (required)
- `ticketPhaseCode` (required, alphanumeric)
- `shortDescription` (required)
- `budgetHours` (nullable numeric; allow decimals)
- `status`: NONE | TODO | IN_PROGRESS | DONE | BLOCKED | CANCELED
- `priority`: LOW | MEDIUM | HIGH | URGENT
- `dueDate` (optional)
- WYSIWYG body + attachments

Views required:
- By Category (Client → Project → Tasks)
- By Status (TODO, IN_PROGRESS, etc.)

### 4.3 Connection Note
Structured fields with copy icons:
- `clientId` (optional)
- `url` (optional)
- `username` (optional)
- `password` (optional)

Behavior:
- If a field has a value, show a **copy icon** next to it; click copies the value.
Security:
- In prototype, encryption is optional; if not implemented, store plainly but mark as "prototype only".

Views required:
- By Category (Connections → then Client → connections/notes)

### 4.4 TimeSheet Note (Entry)
Log of worked hours on a Task (implies project + client).

Attributes:
- `taskId` (required)
- `workDate` (required)
- `hoursWorked` (required, decimals allowed)
- `description` (required)
- `state`: NONE | PENDING | IMPUTED

Behavior:
- From a Task view, user can add a timesheet record instantly.

Views required:
- By day/week/month
- Totals aggregation by client/project/task
Export:
- CSV export (date, client, project, ticket, hours, state, description)

---

## 5) Editor + Attachments requirements (prototype)
### 5.1 WYSIWYG
- Basic formatting: bold/italic/underline, headings, lists, links, code, quote
- Autosave indicator (saving/saved/error)

### 5.2 Paste image from clipboard
- Ctrl+V of screenshot/image inserts image into the editor
- Image is persisted in workspace attachments
- Editor content references the image via local URL (served by the app)

### 5.3 File attachments
- Upload file, list attachments, download, delete
- Attachment metadata stored in note JSON

---

## 6) Search (prototype)
- Global search across:
  - title
  - contentText
  - ticketPhaseCode
  - timesheet description
- Filters:
  - type
  - client
  - project
  - task status
  - timesheet state
- Sorting default: updatedAt DESC

---

## 7) UX layout (prototype)
- Sidebar: All / General / Tasks / Connections / TimeSheet + Config (Clients, Projects)
- Top bar: search + New button
- Middle: list
- Right: editor + structured panel depending on note type

Key UX expectations:
- Client icon visible in lists
- "Create new…" inside selectors for clients/projects
- Copy icons in Connection fields
- Fast timesheet entry from Task view

---

## 8) Prototype acceptance criteria
1) Create/edit/delete notes; persistence survives reload.
2) Create clients with icons; visible in selectors and lists.
3) Create projects linked to clients; cannot save without client.
4) Create tasks linked to projects; cannot save without project; budgetHours nullable.
5) Create connections with copy icons; password stored (prototype-grade).
6) Create timesheets linked to tasks; totals views; CSV export.
7) Paste images into editor; persists and reloads correctly.
