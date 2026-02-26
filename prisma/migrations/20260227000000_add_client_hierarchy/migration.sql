-- REQ-010: Add parent_client_id for client hierarchy
ALTER TABLE clients ADD COLUMN parent_client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_parent ON clients(parent_client_id);
