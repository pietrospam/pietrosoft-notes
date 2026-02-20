import { PATHS, readJson, atomicWriteJson, generateId, nowISO } from '../storage/file-storage';
import { getClient } from './clients-repo';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types';

// ============================================================================
// Projects Repository
// ============================================================================

interface ProjectsStore {
  projects: Project[];
}

async function readProjectsStore(): Promise<ProjectsStore> {
  return readJson<ProjectsStore>(PATHS.projects(), { projects: [] });
}

async function writeProjectsStore(store: ProjectsStore): Promise<void> {
  await atomicWriteJson(PATHS.projects(), store);
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listProjects(options?: { 
  includeDisabled?: boolean;
  clientId?: string;
}): Promise<Project[]> {
  const store = await readProjectsStore();
  let projects = store.projects;
  
  if (!options?.includeDisabled) {
    projects = projects.filter(p => !p.disabled);
  }
  
  if (options?.clientId) {
    projects = projects.filter(p => p.clientId === options.clientId);
  }
  
  return projects;
}

export async function getProject(id: string): Promise<Project | null> {
  const store = await readProjectsStore();
  return store.projects.find(p => p.id === id) || null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  // Validate that client exists
  const client = await getClient(input.clientId);
  if (!client) {
    throw new Error(`Client with id ${input.clientId} not found`);
  }
  
  const store = await readProjectsStore();
  const now = nowISO();
  
  const project: Project = {
    id: generateId(),
    clientId: input.clientId,
    name: input.name,
    code: input.code,
    description: input.description,
    disabled: input.disabled ?? false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.projects.push(project);
  await writeProjectsStore(store);
  
  return project;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  // If clientId is being updated, validate it exists
  if (input.clientId) {
    const client = await getClient(input.clientId);
    if (!client) {
      throw new Error(`Client with id ${input.clientId} not found`);
    }
  }
  
  const store = await readProjectsStore();
  const index = store.projects.findIndex(p => p.id === id);
  
  if (index === -1) {
    return null;
  }
  
  const existing = store.projects[index];
  const updated: Project = {
    ...existing,
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nowISO(),
  };
  
  store.projects[index] = updated;
  await writeProjectsStore(store);
  
  return updated;
}

export async function disableProject(id: string): Promise<Project | null> {
  return updateProject(id, { disabled: true });
}

export async function enableProject(id: string): Promise<Project | null> {
  return updateProject(id, { disabled: false });
}
