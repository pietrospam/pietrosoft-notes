# SPEC-006: PostgreSQL Database Migration

**Status:** Draft  
**Epic:** B (Database Storage Engine)  
**Priority:** Critical  

---

## 1. Overview

Migrate the Pietrosoft Notes application from file-based JSON storage to PostgreSQL database. This provides:
- ACID compliance for data operations
- Proper foreign key constraints
- Better query capabilities for search and filtering
- Standard database backup/restore tools

---

## 2. Goals

- **G1:** All structured data (clients, projects, notes) stored in PostgreSQL
- **G2:** Attachments remain on filesystem (efficient binary storage)
- **G3:** Zero data loss during migration
- **G4:** Docker Compose manages both app and database services
- **G5:** Prisma ORM for type-safe database access

---

## 3. Non-Goals

- Data migration from existing JSON files (fresh start)
- Multi-database support
- Read replicas or clustering
- Production-grade backup strategies

---

## 4. Technical Design

### 4.1 Docker Compose Architecture

```yaml
services:
  app:
    build: .
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/pietrosoft_notes
      - WORKSPACE_PATH=/data
    volumes:
      - ./data:/data
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=pietrosoft_notes
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  adminer:
    image: adminer:latest
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=postgres
    depends_on:
      - postgres

volumes:
  postgres_data:
```

**Adminer (Database Admin UI):**
- Accessible at http://localhost:8080
- Login: System=PostgreSQL, Server=postgres, User=postgres, Password=postgres, Database=pietrosoft_notes
- Lightweight alternative to pgAdmin
- Supports SQL queries, table browsing, data export/import

### 4.2 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Client {
  id          String    @id @default(uuid())
  name        String
  description String?
  icon        String    @default("Building2")
  disabled    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  projects    Project[]
  notes       Note[]    @relation("ClientNotes")
}

model Project {
  id          String    @id @default(uuid())
  clientId    String
  client      Client    @relation(fields: [clientId], references: [id])
  name        String
  code        String?
  description String?
  disabled    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  notes       Note[]    @relation("ProjectNotes")
  
  @@index([clientId])
}

model Note {
  id              String    @id @default(uuid())
  type            NoteType
  title           String    @default("")
  contentJson     Json?
  contentText     String    @default("")
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  archivedAt      DateTime?
  
  // Optional relations (General notes)
  clientId        String?
  client          Client?   @relation("ClientNotes", fields: [clientId], references: [id])
  projectId       String?
  project         Project?  @relation("ProjectNotes", fields: [projectId], references: [id])
  
  // Task fields (when type = TASK)
  ticketPhaseCode   String?
  shortDescription  String?
  budgetHours       Decimal?  @db.Decimal(10, 2)
  status            TaskStatus?
  priority          TaskPriority?
  dueDate           DateTime?
  
  // Connection fields (when type = CONNECTION)
  url               String?
  username          String?
  password          String?
  
  // TimeSheet fields (when type = TIMESHEET)
  taskId            String?
  task              Note?     @relation("TaskTimesheets", fields: [taskId], references: [id])
  timesheets        Note[]    @relation("TaskTimesheets")
  workDate          DateTime?
  hoursWorked       Decimal?  @db.Decimal(10, 2)
  timesheetDescription String?
  timesheetState    TimesheetState?
  
  // Attachments stored as JSON array
  attachments       Json      @default("[]")
  
  @@index([type])
  @@index([clientId])
  @@index([projectId])
  @@index([taskId])
  @@index([deletedAt])
  @@index([archivedAt])
}

enum NoteType {
  GENERAL
  TASK
  CONNECTION
  TIMESHEET
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  BLOCKED
  CANCELED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TimesheetState {
  PENDING
  IMPUTED
}
```

### 4.3 Repository Layer Changes

Current file-based pattern:
```typescript
// OLD: File-based
export async function listClients(): Promise<Client[]> {
  const data = await fs.readFile(CLIENTS_FILE, 'utf-8');
  return JSON.parse(data);
}
```

New Prisma pattern:
```typescript
// NEW: Prisma
import { prisma } from '@/lib/db';

export async function listClients(): Promise<Client[]> {
  return prisma.client.findMany({
    where: { disabled: false },
    orderBy: { name: 'asc' }
  });
}
```

### 4.4 Migration Strategy

1. **Phase 1:** Add PostgreSQL to docker-compose
2. **Phase 2:** Install Prisma and create schema
3. **Phase 3:** Generate Prisma client
4. **Phase 4:** Replace file-based repos with Prisma calls
5. **Phase 5:** Update API routes to use new repos
6. **Phase 6:** Test all flows
7. **Phase 7:** Remove old file-based code

### 4.5 Backup/Restore Changes

**Export:**
```bash
# Database dump
pg_dump -U postgres pietrosoft_notes > backup.sql

# Attachments
tar -czvf attachments.tar.gz /data/attachments
```

**Import:**
```bash
# Database restore
psql -U postgres pietrosoft_notes < backup.sql

# Attachments restore
tar -xzvf attachments.tar.gz -C /data
```

API endpoints will be updated to use `pg_dump` instead of zipping JSON files.

---

## 5. Acceptance Criteria

- [ ] **AC1:** PostgreSQL container starts via docker-compose
- [ ] **AC2:** Prisma migrations run on container startup
- [ ] **AC3:** Creating a client persists to PostgreSQL
- [ ] **AC4:** Creating a project validates clientId via FK constraint
- [ ] **AC5:** All note types (general, task, connection, timesheet) work with DB
- [ ] **AC6:** Search queries use PostgreSQL full-text or LIKE
- [ ] **AC7:** Attachments upload/download still work (filesystem)
- [ ] **AC8:** Backup exports database + attachments
- [ ] **AC9:** App survives database restart (reconnects)

---

## 6. API Routes (No Changes to Interface)

The API route signatures remain the same. Only the internal implementation changes from file-based to Prisma.

| Method | Route | Internal Change |
|--------|-------|-----------------|
| GET/POST | /api/clients | `fileStorage` → `prisma.client` |
| GET/POST | /api/projects | `fileStorage` → `prisma.project` |
| GET/POST | /api/notes | `fileStorage` → `prisma.note` |
| GET/POST | /api/attachments | No change (filesystem) |
| GET/POST | /api/workspace/export | JSON zip → pg_dump + tar |
| POST | /api/workspace/import | JSON unzip → psql restore |

---

## 7. Dependencies

**New:**
- `prisma` (devDependency)
- `@prisma/client` (dependency)

**Docker:**
- `postgres:16-alpine` image

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Database connection loss | Prisma auto-reconnect; healthcheck in docker-compose |
| Migration failures | Run migrations in init script with retry logic |
| Data type mismatches | Use Prisma's type-safe client |
| Performance regression | Add indexes on frequently queried fields |

---

## 9. Open Questions

1. Should we implement database seeding via Prisma?
2. Do we need connection pooling for this single-user app?
3. Should backup/restore use Prisma's capabilities or raw pg_dump?

---

## 10. Implementation Order

1. Update docker-compose.yml with postgres service
2. Install prisma dependencies
3. Create prisma/schema.prisma
4. Run `prisma generate` and `prisma migrate dev`
5. Create `src/lib/db.ts` (Prisma client singleton)
6. Update `src/lib/repositories/` to use Prisma
7. Update API routes (minimal changes expected)
8. Update backup/restore endpoints
9. Test all functionality
10. Deploy to server

---

## 11. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-19 | System | Initial draft |
