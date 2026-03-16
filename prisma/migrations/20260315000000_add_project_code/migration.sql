-- AlterTable: add optional code column to projects
ALTER TABLE "projects" ADD COLUMN "code" VARCHAR(100);
