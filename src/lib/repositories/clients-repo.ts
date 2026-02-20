import { PATHS, readJson, atomicWriteJson, generateId, nowISO } from '../storage/file-storage';
import type { Client, CreateClientInput, UpdateClientInput } from '../types';

// ============================================================================
// Clients Repository
// ============================================================================

interface ClientsStore {
  clients: Client[];
}

async function readClientsStore(): Promise<ClientsStore> {
  return readJson<ClientsStore>(PATHS.clients(), { clients: [] });
}

async function writeClientsStore(store: ClientsStore): Promise<void> {
  await atomicWriteJson(PATHS.clients(), store);
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listClients(includeDisabled = false): Promise<Client[]> {
  const store = await readClientsStore();
  if (includeDisabled) {
    return store.clients;
  }
  return store.clients.filter(c => !c.disabled);
}

export async function getClient(id: string): Promise<Client | null> {
  const store = await readClientsStore();
  return store.clients.find(c => c.id === id) || null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const store = await readClientsStore();
  const now = nowISO();
  
  const client: Client = {
    id: generateId(),
    name: input.name,
    description: input.description,
    icon: input.icon,
    disabled: input.disabled ?? false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.clients.push(client);
  await writeClientsStore(store);
  
  return client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client | null> {
  const store = await readClientsStore();
  const index = store.clients.findIndex(c => c.id === id);
  
  if (index === -1) {
    return null;
  }
  
  const existing = store.clients[index];
  const updated: Client = {
    ...existing,
    ...input,
    id: existing.id, // Preserve ID
    createdAt: existing.createdAt, // Preserve creation time
    updatedAt: nowISO(),
  };
  
  store.clients[index] = updated;
  await writeClientsStore(store);
  
  return updated;
}

export async function disableClient(id: string): Promise<Client | null> {
  return updateClient(id, { disabled: true });
}

export async function enableClient(id: string): Promise<Client | null> {
  return updateClient(id, { disabled: false });
}
