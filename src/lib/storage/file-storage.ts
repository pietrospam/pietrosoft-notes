import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

export const WORKSPACE_PATH = process.env.WORKSPACE_PATH || './data';

export const PATHS = {
  meta: () => path.join(WORKSPACE_PATH, 'meta.json'),
  clients: () => path.join(WORKSPACE_PATH, 'clients.json'),
  projects: () => path.join(WORKSPACE_PATH, 'projects.json'),
  notesDir: () => path.join(WORKSPACE_PATH, 'notes'),
  note: (id: string) => path.join(WORKSPACE_PATH, 'notes', `${id}.json`),
  attachmentsDir: () => path.join(WORKSPACE_PATH, 'attachments'),
  attachment: (filename: string) => path.join(WORKSPACE_PATH, 'attachments', filename),
};

// ============================================================================
// ID Generation
// ============================================================================

export function generateId(): string {
  return randomUUID();
}

// ============================================================================
// Atomic Write
// ============================================================================

/**
 * Writes data to a file atomically by writing to a temp file first,
 * then renaming to the target path.
 */
export async function atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const content = JSON.stringify(data, null, 2);
  
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Reads and parses a JSON file, returns default value if file doesn't exist.
 */
export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    if (!existsSync(filePath)) {
      return defaultValue;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensures attachments directory exists (notes dir no longer needed - using PostgreSQL).
 */
export async function ensureWorkspaceDirectories(): Promise<void> {
  const dirs = [
    WORKSPACE_PATH,
    PATHS.attachmentsDir(),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Lists all files in a directory with a specific extension.
 */
export async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
}

// ============================================================================
// Timestamps
// ============================================================================

export function nowISO(): string {
  return new Date().toISOString();
}
