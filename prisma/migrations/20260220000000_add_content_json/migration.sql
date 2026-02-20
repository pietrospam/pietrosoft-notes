-- Add content_json column for storing TipTap editor JSON
ALTER TABLE notes ADD COLUMN content_json JSONB;
