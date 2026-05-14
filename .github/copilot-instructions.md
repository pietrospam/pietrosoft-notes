# Copilot Instructions — Pietrosoft Notes

## Project Overview

**Pietrosoft Notes** is a local-first note-taking application with WYSIWYG editor, task management, time tracking, and connection credentials storage. It runs as a single-user Docker deployment with PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, @tailwindcss/typography |
| Editor | TipTap (ProseMirror-based WYSIWYG) |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Icons | Lucide React |
| Deployment | Docker Compose |

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes (Next.js App Router)
│   ├── components/    # React components
│   ├── context/       # React Context (AppContext)
│   └── page.tsx       # Main entry point
├── lib/
│   ├── repositories/  # Data access layer
│   ├── storage/       # File storage utilities
│   └── types/         # TypeScript type definitions
prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migrations
specs/                 # Technical specifications
docs/                  # Project documentation & requirements
```

## Domain Model

### Core Entities
- **Client** - Organization/customer with icon and optional color
- **Project** - Belongs to a Client, groups related work
- **Note** - Base entity with types: `general`, `task`, `connection`
- **TaskNote** - Extends Note with status, priority, ticketPhaseCode, timesheet entries
- **ConnectionNote** - Extends Note with host, port, credentials
- **TimeSheet** - Time tracking entries linked to tasks

### Common Note Fields
- `id`, `type`, `title`, `contentJson` (TipTap), `contentText` (search)
- `attachments[]`, `isFavorite`, timestamps

## Code Conventions

### TypeScript
- Use strict typing; avoid `any`
- Define interfaces in `src/lib/types/`
- Use type guards for note type narrowing

### React Components
- Functional components with hooks
- Place in `src/app/components/`
- Export via `components/index.ts`

### API Routes
- Use Next.js App Router (`app/api/`)
- Return JSON responses
- Handle errors with appropriate status codes

### Styling
- Tailwind utility classes
- Dark theme (bg-gray-950, text-white)
- Consistent spacing and colors

### State Management
- Global state via `AppContext`
- Local state with `useState`/`useReducer`
- Optimistic updates for better UX

## Development Workflow

### Spec-Driven Development
1. Write/update specs first (in `/specs`) with acceptance criteria
2. Implement code
3. Update documentation

### Creating New Features
1. Check if a REQ-XXX file exists in `/docs`
2. Create/update spec in `/specs` if needed
3. Implement following existing patterns

### Issues & Requirements
- Issues: Add to `docs/issues.md`
- Requirements: Create `docs/REQ-XXX-Name.md`

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Main context | `docs/PROTOTYPE_CONTEXT.md` |
| Backlog | `docs/BACKLOG.md` |
| Execution plan | `docs/EXECUTION_PLAN.md` |
| Requirements | `docs/REQ-*.md` |
| Specs | `specs/SPEC-*.md` |
| Specs index | `specs/README.md` |
| Types | `src/lib/types/` |
| Components | `src/app/components/` |
| API routes | `src/app/api/` |

## Deployment

- **Local dev:** `npm run dev` (port 3000)
- **Docker local:** `docker compose up`
- **Production:** `npm run web` (deploys to 192.168.100.113:3001)

## Important Patterns

### Auto-save
- Tasks auto-save after 2s of inactivity when enabled
- Use `trackChange()` to register pending changes

### Attachments
- Uploaded to `/api/attachments`
- Stored on disk in `/data/attachments/`
- Metadata in PostgreSQL

### Search
- Full-text search across title, content, ticket codes
- Real-time filtering in sidebar
