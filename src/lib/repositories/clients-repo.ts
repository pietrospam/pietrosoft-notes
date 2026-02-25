import prisma from '../db';
import type { Client, CreateClientInput, UpdateClientInput } from '../types';
import { getNextAvailableColor } from '../colorPalette';

// ============================================================================
// Clients Repository (Prisma)
// ============================================================================

// Helper to convert Prisma model to domain type
function toClient(prismaClient: {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Client {
  return {
    id: prismaClient.id,
    name: prismaClient.name,
    description: prismaClient.description ?? undefined,
    icon: 'Building2', // Default icon since DB doesn't store it
    color: prismaClient.color ?? undefined,
    disabled: !prismaClient.active, // Invert: active=true -> disabled=false
    createdAt: prismaClient.createdAt.toISOString(),
    updatedAt: prismaClient.updatedAt.toISOString(),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listClients(includeDisabled = false): Promise<Client[]> {
  const clients = await prisma.client.findMany({
    where: includeDisabled ? {} : { active: true },
    orderBy: { name: 'asc' },
  });
  return clients.map(toClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const client = await prisma.client.findUnique({ where: { id } });
  return client ? toClient(client) : null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // REQ-008.3: Get used colors and auto-assign an available one
  const existingClients = await prisma.client.findMany({ select: { color: true } });
  const usedColors = existingClients.map(c => c.color);
  const autoColor = (input as { color?: string }).color || getNextAvailableColor(usedColors);
  
  // Create client and default "General" project in a transaction
  const [client] = await prisma.$transaction([
    prisma.client.create({
      data: {
        id: clientId,
        name: input.name,
        description: input.description,
        color: autoColor,
        active: input.disabled !== true,
      },
    }),
    prisma.project.create({
      data: {
        id: projectId,
        clientId: clientId,
        name: 'General',
        description: 'Proyecto por defecto',
      },
    }),
  ]);
  
  return toClient(client);
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client | null> {
  try {
    const data: { name?: string; description?: string | null; color?: string | null; active?: boolean } = {};
    
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if ((input as { color?: string }).color !== undefined) data.color = (input as { color?: string }).color;
    if (input.disabled !== undefined) data.active = !input.disabled; // Invert

    const client = await prisma.client.update({
      where: { id },
      data,
    });
    return toClient(client);
  } catch {
    return null;
  }
}

export async function disableClient(id: string): Promise<Client | null> {
  return updateClient(id, { disabled: true });
}

export async function enableClient(id: string): Promise<Client | null> {
  return updateClient(id, { disabled: false });
}
