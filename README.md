# Pietrosoft Notes — Prototype

A local-first note-taking app with WYSIWYG editor, task management, time tracking, and connection credentials storage.

## Quick Start

### Development (local)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Docker

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000)

### Load Sample Data

```bash
# Local development
./scripts/load-sample-data.sh

# Or manually copy
cp data/sample/clients.json data/clients.json
cp data/sample/projects.json data/projects.json
cp data/sample/notes/*.json data/notes/
```

## Features

- **Rich Text Editor**: TipTap-powered WYSIWYG with formatting, lists, code blocks
- **Image Paste**: Paste screenshots directly into notes (auto-uploaded as attachments)
- **File Attachments**: Upload and manage files per note
- **Task Management**: Track tasks with status, priority, due dates, and budget hours
- **Connection Storage**: Store credentials with copy buttons
- **Time Tracking**: Log hours against tasks, export to CSV
- **Search**: Full-text search across all notes
- **Multi-view Navigation**: All / General / Tasks / Connections / TimeSheet views

## Project Structure

```
├── docs/                    # Project documentation
│   ├── BACKLOG.md          # Detailed backlog with tasks
│   ├── EXECUTION_PLAN.md   # Phase-by-phase plan
│   └── PROTOTYPE_CONTEXT.md # Functional requirements
├── specs/                   # Technical specifications
│   └── SPEC-001-*.md       # Storage & Docker spec
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── api/            # REST API routes
│   │   ├── components/     # React components
│   │   └── context/        # App state management
│   └── lib/
│       ├── repositories/   # Data access layer
│       ├── storage/        # File system utilities
│       └── types/          # TypeScript domain types
├── data/                   # Local workspace (git-ignored)
│   ├── clients.json
│   ├── projects.json
│   ├── notes/
│   ├── attachments/
│   └── sample/             # Sample seed data
├── scripts/
│   └── load-sample-data.sh # Script to load sample data
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/clients` | GET, POST | List/create clients |
| `/api/clients/[id]` | GET, PUT, DELETE | Client CRUD |
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/[id]` | GET, PUT, DELETE | Project CRUD |
| `/api/notes` | GET, POST | List/create notes |
| `/api/notes/[id]` | GET, PUT, DELETE | Note CRUD |
| `/api/attachments` | POST | Upload attachment |
| `/api/attachments/[id]` | GET, DELETE | Download/delete attachment |
| `/api/export/timesheets` | GET | Export timesheets (JSON/CSV) |

## Tech Stack

- **Framework:** Next.js 14 + TypeScript
- **Editor:** TipTap with extensions (Image, Link, Placeholder)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Storage:** File-based JSON (no database)
- **Runtime:** Docker with volume mount

## Data Model

- **Client:** Organization/customer with icon
- **Project:** Belongs to a client
- **Note Types:**
  - General: Free-form notes
  - Task: Project tasks with status/priority
  - Connection: Credentials with copy buttons
  - TimeSheet: Hour tracking linked to tasks

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_PATH` | `./data` | Path to workspace storage directory |

## Known Limitations (Prototype)

- Single user only
- No data encryption (passwords stored in plain text)
- Local storage only (no cloud sync)
- No concurrent access protection
- No authentication

## License

Private / Internal Use
