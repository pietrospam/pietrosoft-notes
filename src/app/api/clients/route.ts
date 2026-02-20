import { NextResponse } from 'next/server';
import { listClients, createClient } from '@/lib/repositories/clients-repo';
import { ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import type { CreateClientInput } from '@/lib/types';

// GET /api/clients - List all clients
export async function GET(request: Request) {
  try {
    await ensureWorkspaceDirectories();
    
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    
    const clients = await listClients(includeDisabled);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error listing clients:', error);
    return NextResponse.json(
      { error: 'Failed to list clients' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: Request) {
  try {
    await ensureWorkspaceDirectories();
    
    const body = await request.json() as CreateClientInput;
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    if (!body.icon || typeof body.icon !== 'string') {
      return NextResponse.json(
        { error: 'Icon is required' },
        { status: 400 }
      );
    }
    
    const client = await createClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
