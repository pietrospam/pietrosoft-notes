# SPEC-004: Attachments & Image Paste

## Overview
Enable file attachments and clipboard image paste in notes. Attachments are stored in `/data/attachments` and referenced via API endpoints.

## Acceptance Criteria

### AC-1: Upload API
- [x] POST `/api/attachments` accepts multipart/form-data with `file` and `noteId`
- [x] Returns `{ id, filename, originalName, mimeType, size, createdAt, url }`
- [x] File saved to `/data/attachments/{id}-{sanitized-name}`

### AC-2: Download/View API
- [x] GET `/api/attachments/[id]` streams the file with correct Content-Type
- [x] GET `/api/attachments/[id]?download=true` forces download (Content-Disposition)

### AC-3: Delete API
- [x] DELETE `/api/attachments/[id]` removes file and returns 204
- [x] Note's `attachments` array is updated to remove reference

### AC-4: Clipboard Image Paste
- [x] TipTap intercepts paste event with image data
- [x] Image blob uploaded to attachments API
- [x] Inline image node inserted with `/api/attachments/{id}` URL

### AC-5: Attachments Panel
- [x] EditorPanel shows list of attachments for current note
- [x] Each attachment shows name, size, download and delete buttons
- [x] File upload button to add new attachments

### AC-6: Note Attachment Sync
- [x] When attachment uploaded, note's `attachments[]` is updated
- [x] When attachment deleted, note's `attachments[]` is updated
- [ ] Orphan cleanup: attachments without note reference can be deleted

## Technical Notes
- Use `formidable` or native FormData for file parsing
- Store files with UUID prefix to avoid collisions
- Derive mime-type from file extension or uploaded type
- Max file size: 10MB (configurable)

## Status: COMPLETED
