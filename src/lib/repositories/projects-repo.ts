import prisma from '../db';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types';

// ============================================================================
// Projects Repository (Prisma)
// ============================================================================

// Helper to convert Prisma model to domain type
function toProject(prismaProject: {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    id: prismaProject.id,
    clientId: prismaProject.clientId,
    name: prismaProject.name,
    description: prismaProject.description ?? undefined,
    createdAt: prismaProject.createdAt.toISOString(),
    updatedAt: prismaProject.updatedAt.toISOString(),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listProjects(options?: { 
  includeDisabled?: boolean;
  clientId?: string;
}): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    where: {
      ...(options?.clientId ? { clientId: options.clientId } : {}),
    },
    orderBy: { name: 'asc' },
  });
  return projects.map(toProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({ where: { id } });
  return project ? toProject(project) : null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const project = await prisma.project.create({
    data: {
      id,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
    },
  });
  return toProject(project);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  try {
    const data: { clientId?: string; name?: string; description?: string | null } = {};
    
    if (input.clientId !== undefined) data.clientId = input.clientId;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    const project = await prisma.project.update({
      where: { id },
      data,
    });
    return toProject(project);
  } catch {
    return null;
  }
}

export async function disableProject(id: string): Promise<Project | null> {
  // No-op since projects table doesn't have disabled field
  const project = await prisma.project.findUnique({ where: { id } });
  return project ? toProject(project) : null;
}

export async function enableProject(id: string): Promise<Project | null> {
  // No-op since projects table doesn't have disabled field
  const project = await prisma.project.findUnique({ where: { id } });
  return project ? toProject(project) : null;
}
