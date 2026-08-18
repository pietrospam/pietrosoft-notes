#!/usr/bin/env npx tsx
/**
 * restore-comments.ts
 *
 * Restaura comentarios de tareas desde archivos JSON de backup.
 * Compara contra la BD y solo crea los que no existen.
 * Reporta qué tareas/notas fueron afectadas con su título.
 *
 * Uso:
 *   npx tsx scripts/restore-comments/restore-comments.ts [--target prod|test] [--url <url>] [directorio]
 *
 *   --target prod  → conecta a 192.168.100.113 (PROD)
 *   --target test  → conecta a 192.168.100.114 (TEST)
 *   --url <url>    → usa la URL de conexión indicada directamente
 *   Sin flags      → usa DATABASE_URL del .env
 *
 * Si no se pasa directorio, usa ./scripts/restore-comments/input/
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Arg parsing ─────────────────────────────────────────────────────────────
const TARGET_URLS: Record<string, string> = {
  prod: 'postgresql://postgres:postgres@192.168.100.113:5432/bitacora',
  test: 'postgresql://postgres:postgres@192.168.100.114:5432/bitacora',
};

function parseArgs() {
  const args = process.argv.slice(2);
  let dir: string | undefined;
  let targetUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      const t = args[++i];
      if (!TARGET_URLS[t]) {
        console.error(`❌ Target inválido: "${t}". Opciones válidas: prod | test`);
        process.exit(1);
      }
      targetUrl = TARGET_URLS[t];
    } else if (args[i] === '--url' && args[i + 1]) {
      targetUrl = args[++i];
    } else if (!args[i].startsWith('--')) {
      dir = args[i];
    }
  }

  return { dir, targetUrl };
}

const { dir: argDir, targetUrl } = parseArgs();

if (targetUrl) {
  process.env.DATABASE_URL = targetUrl;
  console.log(`🎯 Target: ${targetUrl.replace(/:[^:@]+@/, ':***@')}`);
} else {
  const fromEnv = process.env.DATABASE_URL ?? '(desde .env)';
  console.log(`🎯 Target: ${fromEnv.replace(/:[^:@]+@/, ':***@')}`);
}

const prisma = new PrismaClient();

interface CommentJson {
  id: string;
  taskId: string;
  author: string;
  content: unknown;
  createdAt: string;
}

const counts = {
  total: 0,
  alreadyExists: 0,
  created: 0,
  orphaned: 0,
  errors: 0,
};

const orphaned: Array<{ id: string; taskId: string }> = [];
const failed: Array<{ id: string; taskId: string; error: string }> = [];
// taskId -> set of comment ids restored
const affectedTasks = new Map<string, Set<string>>();

async function readJsonFiles(dir: string): Promise<CommentJson[]> {
  const entries = await fs.readdir(dir);
  const jsonFiles = entries.filter(
    (f) => f.endsWith('.json') && !f.startsWith('.')
  );

  if (jsonFiles.length === 0) {
    console.error(`❌ No se encontraron archivos .json en: ${dir}`);
    process.exit(1);
  }

  console.log(`📂 Directorio: ${dir}`);
  console.log(`📄 Archivos encontrados: ${jsonFiles.join(', ')}\n`);

  const allComments = new Map<string, CommentJson>();

  for (const file of jsonFiles) {
    const filePath = path.join(dir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.warn(`⚠️  ${file}: no es un array, se omite.`);
        continue;
      }

      let fileCount = 0;
      let duplicates = 0;
      for (const item of parsed) {
        if (!item.id || !item.taskId) {
          console.warn(`⚠️  ${file}: comentario sin id o taskId, se omite.`);
          continue;
        }
        if (allComments.has(item.id)) {
          duplicates++;
        } else {
          allComments.set(item.id, item as CommentJson);
          fileCount++;
        }
      }
      console.log(
        `   ${file}: ${fileCount} comentarios cargados${duplicates > 0 ? `, ${duplicates} duplicados ignorados` : ''}`
      );
    } catch (err) {
      console.error(`❌ Error leyendo ${file}: ${err}`);
    }
  }

  return Array.from(allComments.values());
}

async function restore(comments: CommentJson[]) {
  counts.total = comments.length;
  console.log(`\n🔍 Procesando ${counts.total} comentarios...\n`);

  for (const comment of comments) {
    // 1. ¿Ya existe en la BD?
    const existing = await prisma.taskComment.findUnique({
      where: { id: comment.id },
    });

    if (existing) {
      counts.alreadyExists++;
      continue;
    }

    // 2. ¿Existe la tarea referenciada?
    const task = await prisma.note.findUnique({
      where: { id: comment.taskId },
      select: { id: true, title: true },
    });

    if (!task) {
      counts.orphaned++;
      orphaned.push({ id: comment.id, taskId: comment.taskId });
      continue;
    }

    // 3. Crear el comentario
    try {
      await prisma.taskComment.create({
        data: {
          id: comment.id,
          taskId: comment.taskId,
          author: comment.author,
          content: comment.content as object,
          createdAt: new Date(comment.createdAt),
        },
      });
      counts.created++;

      if (!affectedTasks.has(comment.taskId)) {
        affectedTasks.set(comment.taskId, new Set());
      }
      affectedTasks.get(comment.taskId)!.add(comment.id);
    } catch (err) {
      counts.errors++;
      failed.push({
        id: comment.id,
        taskId: comment.taskId,
        error: String(err),
      });
    }
  }
}

async function printReport() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('              RESUMEN');
  console.log('═══════════════════════════════════════');
  console.log(`  Total en archivos:          ${counts.total}`);
  console.log(`  Ya existían en BD:          ${counts.alreadyExists}`);
  console.log(`  ✅ Creados:                 ${counts.created}`);
  console.log(`  ⚠️  Huérfanos (sin tarea):   ${counts.orphaned}`);
  console.log(`  ❌ Errores de inserción:    ${counts.errors}`);
  console.log('═══════════════════════════════════════');

  if (affectedTasks.size > 0) {
    console.log('\n📋 TAREAS AFECTADAS (comentarios restaurados):');
    console.log('───────────────────────────────────────');
    for (const [taskId, commentIds] of Array.from(affectedTasks.entries())) {
      const task = await prisma.note.findUnique({
        where: { id: taskId },
        select: { title: true, content: true },
      });
      const title = task?.title ?? '(sin título)';
      const contentStr = typeof task?.content === 'string' ? task.content : JSON.stringify(task?.content ?? '');
      const preview = contentStr ? contentStr.substring(0, 80).replace(/\n/g, ' ').trim() : '';
      console.log(`\n  • Tarea: "${title}"`);
      console.log(`    ID: ${taskId}`);
      if (preview) console.log(`    Descripción: ${preview}${contentStr.length > 80 ? '...' : ''}`);
      console.log(`    Comentarios restaurados: ${commentIds.size}`);
    }
  }

  if (orphaned.length > 0) {
    console.log('\n⚠️  COMENTARIOS HUÉRFANOS (tarea no encontrada en BD):');
    console.log('───────────────────────────────────────');
    for (const o of orphaned) {
      console.log(`  • Comentario ID: ${o.id}`);
      console.log(`    TaskId:         ${o.taskId}`);
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ ERRORES DE INSERCIÓN:');
    console.log('───────────────────────────────────────');
    for (const f of failed) {
      console.log(`  • Comentario ID: ${f.id}`);
      console.log(`    TaskId:         ${f.taskId}`);
      console.log(`    Error:          ${f.error}`);
    }
  }

  console.log('');
}

async function main() {
  const inputDir =
    argDir ??
    path.resolve(__dirname, 'input');

  try {
    await fs.access(inputDir);
  } catch {
    console.error(`❌ El directorio no existe: ${inputDir}`);
    process.exit(1);
  }

  const comments = await readJsonFiles(inputDir);

  if (comments.length === 0) {
    console.log('ℹ️  No hay comentarios para procesar.');
    await prisma.$disconnect();
    return;
  }

  await restore(comments);
  await printReport();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Error fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
