# SPEC-003: Config Screens (Clients & Projects)

**Status:** In Progress  
**Epic:** E (Config screens)  
**Priority:** High  
**Depends on:** SPEC-001, SPEC-002

---

## 1. Overview

Implement configuration screens for managing Clients and Projects:
- Clients CRUD with icon selection
- Projects CRUD with client assignment
- Inline creation from selectors in note forms

---

## 2. Goals

- **G1:** Full CRUD for Clients (create, read, update, disable)
- **G2:** Full CRUD for Projects (create, read, update, disable)  
- **G3:** Project must be linked to a Client
- **G4:** Selectors in note forms allow inline entity creation

---

## 3. Technical Design

### 3.1 Config View Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Config                                                          │
├─────────────────┬───────────────────────────────────────────────┤
│ Tabs:           │ Entity List & Edit Form                       │
│ [Clients]       │                                               │
│ [Projects]      │ ┌───────────────────────────────────────────┐ │
│                 │ │ [+ New Client]                            │ │
│                 │ │                                           │ │
│                 │ │ [Client 1] [Edit] [Disable]               │ │
│                 │ │ [Client 2] [Edit] [Disable]               │ │
│                 │ └───────────────────────────────────────────┘ │
└─────────────────┴───────────────────────────────────────────────┘
```

### 3.2 Components

- `ConfigPanel` - Main config view with tabs
- `ClientsManager` - List + form for clients
- `ProjectsManager` - List + form for projects  
- `ClientForm` - Create/edit client form
- `ProjectForm` - Create/edit project form
- `IconPicker` - Simple icon selector component
- `ClientSelector` - Dropdown with "Create new..." option
- `ProjectSelector` - Dropdown filtered by client, with "Create new..."

### 3.3 Icon Set (Simple)

Using Lucide icons with key mapping:
- building, briefcase, code, globe, heart, star, user, users, etc.

---

## 4. Acceptance Criteria

- [ ] **AC1:** Can create/edit/disable clients from Config view
- [ ] **AC2:** Client requires name and icon
- [ ] **AC3:** Can create/edit/disable projects from Config view
- [ ] **AC4:** Project requires name and client selection
- [ ] **AC5:** Client selector shows "Create new..." option
- [ ] **AC6:** Project selector filtered by selected client
- [ ] **AC7:** Disabled entities hidden by default but toggleable

---

## 5. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-19 | Agent | Initial draft |
