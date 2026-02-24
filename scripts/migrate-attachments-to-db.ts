#!/usr/bin/env npx ts-node
/**
 * REQ-007: Migration script to move attachments from filesystem to database
 * 
 * Usage: npx ts-node scripts/migrate-attachments-to-db.ts
 * 
 * This script:
 * 1. Reads all notes from the database
 * 2. For each attachment in the JSON field, reads the file from filesystem
 * 3. Inserts the attachment into the attachments table
 * 4. Optionally cleans up filesystem files after successful migration
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();
const ATTACHMENTS_DIR = process.env.WORKSPACE_PATH 
  ? path.join(process.env.WORKSPACE_PATH, 'attachments')
  : './data/attachments';

interface AttachmentMeta {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

async function migrateAttachments() {
  console.log('Starting attachment migration...');
  console.log(`Attachments directory: ${ATTACHMENTS_DIR}`);
  
  // Check if directory exists
  if (!existsSync(ATTACHMENTS_DIR)) {
    console.log('No attachments directory found. Nothing to migrate.');
    return;
  }

  // Get all notes with attachments in JSON field
  const notes = await prisma.note.findMany({
    where: {
      attachments: { not: { equals: null } },
    },
  });

  console.log(`Found ${notes.length} notes with potential attachments`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const note of notes) {
    const attachments = (note.attachments as unknown as AttachmentMeta[]) || [];
    
    if (attachments.length === 0) continue;

    console.log(`\nProcessing note ${note.id} (${note.title})`);
    console.log(`  Found ${attachments.length} attachments in JSON field`);

    for (const attachment of attachments) {
      // Check if already migrated
      const existing = await prisma.attachment.findUnique({
        where: { id: attachment.id },
      });

      if (existing) {
        console.log(`  - Skipping ${attachment.originalName} (already migrated)`);
        skippedCount++;
        continue;
      }

      // Try to find the file
      const filePath = path.join(ATTACHMENTS_DIR, attachment.filename);
      
      if (!existsSync(filePath)) {
        console.log(`  - ERROR: File not found: ${attachment.filename}`);
        errorCount++;
        continue;
      }

      try {
        // Read file data
        const data = await fs.readFile(filePath);
        
        // Insert into database
        await prisma.attachment.create({
          data: {
            id: attachment.id,
            noteId: note.id,
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            data: data,
            createdAt: new Date(attachment.createdAt),
          },
        });

        console.log(`  - Migrated: ${attachment.originalName} (${(attachment.size / 1024).toFixed(1)} KB)`);
        migratedCount++;
      } catch (error) {
        console.log(`  - ERROR migrating ${attachment.originalName}:`, error);
        errorCount++;
      }
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped (already migrated): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('========================================');

  if (migratedCount > 0 && errorCount === 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('You can now optionally delete the data/attachments directory.');
  } else if (errorCount > 0) {
    console.log('\n⚠️ Migration completed with errors. Check the log above.');
  }
}

migrateAttachments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
