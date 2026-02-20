import { NextResponse } from 'next/server';
import { getClient, updateClient, disableClient } from '@/lib/repositories/clients-repo';
import type { UpdateClientInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

// GET /api/clients/:id - Get a single client
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const client = await getClient(params.id);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(client);
  } catch (error) {
    console.error('Error getting client:', error);
    return NextResponse.json(
      { error: 'Failed to get client' },
      { status: 500 }
    );
  }
}

// PUT /api/clients/:id - Update a client
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json() as UpdateClientInput;
    
    const client = await updateClient(params.id, body);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/:id - Disable a client (soft delete)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const client = await disableClient(params.id);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(client);
  } catch (error) {
    console.error('Error disabling client:', error);
    return NextResponse.json(
      { error: 'Failed to disable client' },
      { status: 500 }
    );
  }
}
