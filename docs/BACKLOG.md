# Prototype Backlog (Detailed Tasks)

## EPIC A — Project bootstrap & Docker
A1. Create Next.js + TypeScript project
- AC: App builds and runs locally

A2. Add docker-compose + Dockerfile (single container)
- AC: `docker compose up` serves the app on localhost
- AC: `/data` volume mounted and writable

A3. Add workspace env config
- AC: `WORKSPACE_PATH` controls storage location

---

## EPIC B — File-based storage engine
B1. Define domain models (types/interfaces)
- Client, Project, Note, TaskFields, ConnectionFields, TimeSheetFields, AttachmentMeta
- AC: Types compile and are used across API/UI

B2. Implement atomic JSON write helper
- Write to temp file then rename
- AC: No partial files on crash (best effort)

B3. Implement repositories
- ClientsRepo: list/get/create/update/disable
- ProjectsRepo: list/get/create/update/disable (validate clientId)
- NotesRepo: list/get/create/update/softDelete/archive
- AC: Unit-testable functions, deterministic output

B4. Implement ID generator (UUID)
- AC: IDs unique and stable

B5. Implement derived fields
- contentText extraction from TipTap JSON
- updatedAt handling
- AC: contentText updates on save

---

## EPIC C — Attachments & inline images
C1. Attachment storage folder management
- Ensure `/data/attachments` exists
- AC: auto-create folders at startup

C2. API: upload attachment (multipart)
- Returns attachment metadata + attachmentId
- AC: works for images and other files

C3. API: download/stream attachment by id
- AC: browser can view inline images and download files

C4. Note-attachment linking
- Store metadata inside the note JSON
- AC: attachments list is stable after reload

C5. TipTap clipboard image paste
- Detect image in clipboard
- Upload blob
- Insert image node with local URL
- AC: Ctrl+V screenshot persists after reload

---

## EPIC D — UI shell & navigation
D1. Main layout: sidebar + list + editor
- AC: UI structure matches: left sidebar, center list, right editor/panel

D2. Routing / views scaffold
- All / General / Tasks / Connections / TimeSheet / Config
- AC: switching views updates list

D3. Top bar with global search input + "New"
- AC: typing in search filters visible list

---

## EPIC E — Config screens (Clients & Projects)
E1. Clients CRUD screen
- Create/edit/disable
- Icon picker (simple: icon key string)
- AC: Client appears in selectors and lists with icon

E2. Projects CRUD screen
- Create/edit/disable
- Must select client
- AC: cannot save project without client

E3. "Create new…" inside selectors
- In client selector and project selector
- AC: user can create client/project from the note form without leaving the screen
- Dependency: E1/E2

E4. Project selector filtered by client
- AC: only projects for selected client are shown

---

## EPIC F — Notes core (General + common)
F1. Notes list + note open behavior
- AC: click note loads editor and structured panel

F2. Create new note flow
- Select type then create
- AC: new note appears in list immediately

F3. Autosave with status indicator
- debounce saving
- AC: shows saving/saved/error

F4. Soft delete / archive / restore
- AC: note moves between views and persists

---

## EPIC G — Task Note
G1. Task fields panel + validations
- Required: projectId, ticketPhaseCode, shortDescription
- budgetHours nullable numeric
- AC: cannot save invalid task

G2. Task views
- By Category: Client → Project → Tasks
- By Status: TODO / IN_PROGRESS / etc.
- AC: views match functional context

G3. Ticket/Phase uniqueness check (prototype)
- Recommended: enforce unique per project (soft rule)
- AC: warn user on duplicates (hard-block optional)

---

## EPIC H — Connection Note
H1. Connection fields panel
- client optional
- url/username/password optional
- AC: fields persist

H2. Copy icons behavior
- Show copy icon only when field has value
- Click copies value and shows feedback toast
- AC: copy works reliably

H3. Security disclaimer / masking
- Mask password field in UI
- (Optional) store plainly in prototype with warning banner
- AC: user understands prototype limitations

H4. Connections view by Client
- Connections → then Client → list
- AC: navigation exists and filters correctly

---

## EPIC I — TimeSheet
I1. TimeSheet entry form + validations
- Required: taskId, workDate, hoursWorked, description, state
- AC: cannot save invalid entry

I2. Add timesheet instantly from Task view
- "Add timesheet" button in Task panel
- AC: creates entry and links to task

I3. TimeSheet views
- By day/week/month
- Totals by client/project/task
- AC: totals correct and update instantly

I4. CSV export
- Columns: date, client, project, ticket, hours, state, description
- AC: export downloads valid CSV

---

## EPIC J — Search & filtering
J1. Global search implementation
- Search title + contentText + ticketPhaseCode + timesheet descriptions
- AC: results update live

J2. Filter controls per view
- Tasks: status, client, project
- TimeSheet: date range, state, client/project/task
- AC: filters combine correctly

---

## EPIC K — Polish & documentation
K1. Seed sample data
- a few clients/projects/tasks/connections/timesheets
- AC: first-run looks usable

K2. Prototype README
- run instructions
- known limitations
- workspace folder explanation
- AC: another developer can run it quickly

K3. Export/import workspace (optional but very useful)
- Export: zip `/data`
- Import: replace `/data`
- AC: user can backup/restore easily
