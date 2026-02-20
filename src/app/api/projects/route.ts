import { NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/repositories/projects-repo';
import { ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import type { CreateProjectInput } from '@/lib/types';

// GET /api/projects - List all projects
export async function GET(request: Request) {
  try {
    await ensureWorkspaceDirectories();
    
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    const clientId = searchParams.get('clientId') || undefined;
    
    const projects = await listProjects({ includeDisabled, clientId });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: Request) {
  try {
    await ensureWorkspaceDirectories();
    
    const body = await request.json() as CreateProjectInput;
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    if (!body.clientId || typeof body.clientId !== 'string') {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }
    
    const project = await createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    
    // Check if it's a client not found error
    if (message.includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
