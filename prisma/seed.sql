-- Seed data for Pietrosoft Notes
-- Run this script via Adminer or psql

-- Clean existing data
DELETE FROM notes;
DELETE FROM projects;
DELETE FROM clients;

-- Insert clients
INSERT INTO clients (id, name, description, active, created_at, updated_at) VALUES
('client-acme', 'ACME Corporation', 'Main enterprise client', true, NOW(), NOW()),
('client-techstart', 'TechStart Inc', 'Startup technology company', true, NOW(), NOW()),
('client-globalbank', 'Global Bank', 'Financial services client', true, NOW(), NOW());

-- Insert projects
INSERT INTO projects (id, name, description, client_id, created_at, updated_at) VALUES
('proj-acme-web', 'Website Redesign', 'Complete redesign of corporate website', 'client-acme', NOW(), NOW()),
('proj-acme-api', 'API Integration', 'REST API for mobile apps', 'client-acme', NOW(), NOW()),
('proj-techstart-mvp', 'MVP Development', 'Minimum viable product for launch', 'client-techstart', NOW(), NOW()),
('proj-bank-portal', 'Customer Portal', 'Online banking portal redesign', 'client-globalbank', NOW(), NOW());

-- Insert notes - General
INSERT INTO notes (id, type, title, content, project_id, client_id, archived, created_at, updated_at) VALUES
('note-general-1', 'GENERAL', 'Meeting Notes - Kickoff', '<p>Discussed project timeline and deliverables.</p><ul><li>Phase 1: Design mockups</li><li>Phase 2: Frontend development</li><li>Phase 3: Backend integration</li></ul><p>Next meeting scheduled for next Monday.</p>', 'proj-acme-web', 'client-acme', false, NOW(), NOW()),
('note-general-2', 'GENERAL', 'Technical Requirements', '<p>Stack decided:</p><ul><li>Next.js 14 with App Router</li><li>PostgreSQL database</li><li>Tailwind CSS for styling</li><li>Deploy on Docker</li></ul>', 'proj-techstart-mvp', 'client-techstart', false, NOW(), NOW());

-- Insert notes - Tasks
INSERT INTO notes (id, type, title, content, project_id, client_id, archived, task_status, task_priority, task_due_date, created_at, updated_at) VALUES
('note-task-1', 'TASK', 'Setup development environment', '<p>Configure local dev environment with Docker and PostgreSQL.</p>', 'proj-acme-web', 'client-acme', false, 'COMPLETED', 'HIGH', '2026-02-15', NOW(), NOW()),
('note-task-2', 'TASK', 'Design homepage mockup', '<p>Create Figma mockup for the new homepage design.</p><p>Include:</p><ul><li>Hero section</li><li>Features grid</li><li>Testimonials</li><li>Footer</li></ul>', 'proj-acme-web', 'client-acme', false, 'IN_PROGRESS', 'HIGH', '2026-02-25', NOW(), NOW()),
('note-task-3', 'TASK', 'Implement authentication', '<p>Add JWT-based authentication with refresh tokens.</p>', 'proj-acme-api', 'client-acme', false, 'PENDING', 'CRITICAL', '2026-03-01', NOW(), NOW()),
('note-task-4', 'TASK', 'Database schema design', '<p>Design and implement the database schema for MVP.</p>', 'proj-techstart-mvp', 'client-techstart', false, 'COMPLETED', 'HIGH', '2026-02-10', NOW(), NOW()),
('note-task-5', 'TASK', 'Security audit preparation', '<p>Prepare documentation for security audit.</p>', 'proj-bank-portal', 'client-globalbank', false, 'PENDING', 'CRITICAL', '2026-03-15', NOW(), NOW());

-- Insert notes - Connections
INSERT INTO notes (id, type, title, content, project_id, client_id, archived, connection_url, connection_credentials, created_at, updated_at) VALUES
('note-conn-1', 'CONNECTION', 'ACME Production Server', '<p>SSH access to production server</p>', 'proj-acme-web', 'client-acme', false, 'ssh://deploy@acme-prod.example.com', 'User: deploy
Key: ~/.ssh/acme_prod_key', NOW(), NOW()),
('note-conn-2', 'CONNECTION', 'ACME Staging Database', '<p>PostgreSQL staging database</p>', 'proj-acme-api', 'client-acme', false, 'postgresql://staging.acme-db.example.com:5432/acme_staging', 'User: acme_staging
Password: staging_pass_2026', NOW(), NOW()),
('note-conn-3', 'CONNECTION', 'TechStart AWS Console', '<p>AWS management console access</p>', 'proj-techstart-mvp', 'client-techstart', false, 'https://techstart.signin.aws.amazon.com/console', 'User: dev@techstart.io
Password: Aws#Dev2026!', NOW(), NOW());

-- Insert notes - Timesheets
INSERT INTO notes (id, type, title, content, project_id, client_id, archived, timesheet_date, timesheet_hours, timesheet_rate, timesheet_state, timesheet_task_id, created_at, updated_at) VALUES
('note-ts-1', 'TIMESHEET', 'Dev environment setup', '<p>Initial setup and configuration</p>', 'proj-acme-web', 'client-acme', false, '2026-02-15', 4, 75, 'FINAL', 'note-task-1', NOW(), NOW()),
('note-ts-2', 'TIMESHEET', 'Homepage design work', '<p>Worked on hero section and feature grid</p>', 'proj-acme-web', 'client-acme', false, '2026-02-18', 6, 75, 'DRAFT', 'note-task-2', NOW(), NOW()),
('note-ts-3', 'TIMESHEET', 'Homepage design continued', '<p>Testimonials and footer sections</p>', 'proj-acme-web', 'client-acme', false, '2026-02-19', 5, 75, 'DRAFT', 'note-task-2', NOW(), NOW()),
('note-ts-4', 'TIMESHEET', 'API planning session', '<p>Architecture review and planning</p>', 'proj-acme-api', 'client-acme', false, '2026-02-17', 3, 85, 'FINAL', 'note-task-3', NOW(), NOW());

-- Summary
SELECT 'Clients' as entity, COUNT(*) as count FROM clients
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Notes', COUNT(*) FROM notes;
