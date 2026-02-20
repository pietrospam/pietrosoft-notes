import { NextResponse } from 'next/server';
import { getProject, updateProject, disableProject } from '@/lib/repositories/projects-repo';
import { ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import type { UpdateProjectInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

// GET /api/projects/:id - Get a single project
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await ensureWorkspaceDirectories();
    
    const project = await getProject(params.id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error getting project:', error);
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/:id - Update a project
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await ensureWorkspaceDirectories();
    
    const body = await request.json() as UpdateProjectInput;
    
    const project = await updateProject(params.id, body);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project';
    
    if (message.includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:id - Disable a project (soft delete)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await ensureWorkspaceDirectories();
    
    const project = await disableProject(params.id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error disabling project:', error);
    return NextResponse.json(
      { error: 'Failed to disable project' },
      { status: 500 }
    );
  }
}
