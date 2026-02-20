# SPEC-002: UI Skeleton & Navigation

**Status:** Completed  
**Epic:** D (UI shell & navigation) + F (Notes core)  
**Priority:** High  
**Depends on:** SPEC-001 (completed)

---

## 1. Overview

This specification covers the main UI shell including:
- Three-panel layout (sidebar, list, editor)
- Navigation between views
- Notes list with selection
- TipTap editor integration
- Basic autosave functionality

---

## 2. Goals

- **G1:** Responsive three-panel layout matching design spec
- **G2:** Navigation between All/General/Tasks/Connections/TimeSheet/Config views
- **G3:** Notes list with real-time filtering by type
- **G4:** Rich text editor with autosave
- **G5:** Global search input functional

---

## 3. Non-Goals

- Full CRUD screens for Clients/Projects (SPEC-003)
- Attachment uploads (SPEC-004)
- Export functionality

---

## 4. Technical Design

### 4.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Top Bar: Search input + "New Note" button                       │
├──────────┬──────────────────┬───────────────────────────────────┤
│ Sidebar  │ Notes List       │ Editor Panel                      │
│          │                  │                                   │
│ □ All    │ [Note 1]         │ Title input                       │
│ □ General│ [Note 2] ←active │ ─────────────────────             │
│ □ Tasks  │ [Note 3]         │ TipTap editor                     │
│ □ Connect│                  │                                   │
│ □ Time   │                  │                                   │
│ ─────    │                  │                                   │
│ ⚙ Config │                  │ [Type-specific panel]             │
└──────────┴──────────────────┴───────────────────────────────────┘
```

### 4.2 Component Hierarchy

```
<AppShell>
  <TopBar>
    <SearchInput />
    <NewNoteButton />
  </TopBar>
  <MainContent>
    <Sidebar>
      <NavItem view="all" />
      <NavItem view="general" />
      <NavItem view="task" />
      <NavItem view="connection" />
      <NavItem view="timesheet" />
      <Divider />
      <NavItem view="config" />
    </Sidebar>
    <NotesList>
      <NoteItem />
    </NotesList>
    <EditorPanel>
      <TitleInput />
      <TipTapEditor />
      <TypeSpecificPanel />
    </EditorPanel>
  </MainContent>
</AppShell>
```

### 4.3 State Management

Using React Context for:
- `currentView`: 'all' | 'general' | 'task' | 'connection' | 'timesheet' | 'config'
- `selectedNoteId`: string | null
- `notes`: Note[]
- `searchQuery`: string

### 4.4 TipTap Configuration

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    Image,
    Link,
  ],
  onUpdate: debounce(handleAutoSave, 1000),
});
```

---

## 5. Acceptance Criteria

- [x] **AC1:** Three-panel layout renders correctly
- [x] **AC2:** Clicking sidebar items filters notes list by type
- [x] **AC3:** Clicking a note in list opens it in editor
- [x] **AC4:** TipTap editor allows basic formatting (bold, italic, lists)
- [x] **AC5:** Changes auto-save after 1 second of inactivity
- [x] **AC6:** "New Note" creates a note of current view type
- [x] **AC7:** Search input filters notes by title/content

---

## 6. Dependencies

- @tiptap/react
- @tiptap/starter-kit
- @tiptap/extension-placeholder
- @tiptap/extension-image
- @tiptap/extension-link
- lucide-react (icons)

---

## 7. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-19 | Agent | Initial draft |
| 2026-02-19 | Agent | Implementation complete - all AC verified |
