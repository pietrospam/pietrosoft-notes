# SPEC-001: Storage Engine & Docker Setup

**Status:** Superseded by SPEC-006 (PostgreSQL Migration)  
**Epic:** A (Project Bootstrap) + B (File-based Storage Engine)  
**Priority:** Critical  
**Note:** This spec documents the original file-based implementation. See SPEC-006 for PostgreSQL migration.  

---

## 1. Overview

This specification covers the foundational infrastructure for the Pietrosoft Notes prototype:
- Docker containerization with volume-mounted workspace
- File-based JSON storage engine with atomic writes
- Core domain type definitions
- Repository layer for CRUD operations

---

## 2. Goals

- **G1:** App runs via `docker compose up` on localhost:3001 (port 3000 was occupied)
- **G2:** All data persists in `/data` volume (survives container restart)
- **G3:** Atomic writes prevent data corruption
- **G4:** Type-safe domain models used across API and UI

---

## 3. Non-Goals

- Multi-user concurrency
- Real database integration
- Cloud deployment
- Data encryption

---

## 4. Technical Design

### 4.1 Docker Setup

**Dockerfile:**
- Multi-stage build (deps → builder → runner)
- Node.js 18 Alpine base
- Standalone output for minimal image size
- Non-root user (`nextjs:nodejs`)
- Pre-created `/data` directory with correct permissions

**docker-compose.yml:**
- Single `app` service
- Port mapping: 3000:3000
- Volume: `./data:/data`
- Environment: `WORKSPACE_PATH=/data`

### 4.2 Workspace Structure

```
/data/
├── meta.json           # Workspace metadata, schema version
├── clients.json        # All clients
├── projects.json       # All projects
├── notes/              # One JSON per note
│   ├── {uuid}.json
│   └── ...
└── attachments/        # Binary files
    ├── {uuid}-{originalname}
    └── ...
```

### 4.3 Atomic Write Pattern

```typescript
async function atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, filePath);
}
```

**Rationale:** `rename()` is atomic on POSIX systems, preventing partial writes on crash.

### 4.4 Domain Types

| Entity | Key Fields |
|--------|-----------|
| Client | id, name, icon, disabled |
| Project | id, clientId, name, code, disabled |
| Note (base) | id, type, title, contentJson, contentText, timestamps, attachments |
| TaskNote | + projectId, ticketPhaseCode, status, priority, budgetHours |
| ConnectionNote | + clientId, url, username, password |
| TimeSheetNote | + taskId, workDate, hoursWorked, description, state |

---

## 5. Acceptance Criteria

- [x] **AC1:** `docker compose up` starts app at localhost:3001 (port changed due to conflict)
- [x] **AC2:** `./data` directory is created and writable inside container
- [x] **AC3:** Creating a client via API persists to `clients.json`
- [x] **AC4:** Creating a project requires valid clientId (throws error otherwise)
- [x] **AC5:** Notes are stored as individual files in `/data/notes/`
- [x] **AC6:** Crash during write does not corrupt existing data (atomic writes implemented)
- [x] **AC7:** TypeScript types compile without errors

---

## 6. API Routes (Implemented)

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/clients | List all clients |
| POST | /api/clients | Create client |
| PUT | /api/clients/:id | Update client |
| DELETE | /api/clients/:id | Disable client |
| GET | /api/projects | List projects (filter by clientId) |
| POST | /api/projects | Create project |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Disable project |
| GET | /api/notes | List notes (filter by type) |
| POST | /api/notes | Create note |
| GET | /api/notes/:id | Get single note |
| PUT | /api/notes/:id | Update note |
| DELETE | /api/notes/:id | Soft delete note |

---

## 7. Dependencies

- Next.js 14
- TypeScript
- Node.js 18

---

## 8. Open Questions

1. Should we add a schema migration system for `meta.json.schemaVersion`?
2. What's the max file size for attachments?

---

## 9. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-19 | System | Initial draft |
| 2026-02-19 | Agent | Implementation complete - all AC verified |
