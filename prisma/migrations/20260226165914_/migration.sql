/*
  Warnings:

  - The primary key for the `attachments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `timesheet_date` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `timesheet_hours` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `timesheet_rate` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `timesheet_state` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `timesheet_task_id` on the `notes` table. All the data in the column will be lost.
  - The primary key for the `task_activity_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `created_at` on table `task_activity_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `timesheet_state` on table `timesheets` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_parent_client_id_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_timesheet_task_id_fkey";

-- DropForeignKey
ALTER TABLE "task_activity_logs" DROP CONSTRAINT "task_activity_logs_task_id_fkey";

-- DropForeignKey
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_client_id_fkey";

-- DropForeignKey
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_project_id_fkey";

-- DropForeignKey
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_task_id_fkey";

-- DropIndex
DROP INDEX "idx_clients_parent";

-- DropIndex
DROP INDEX "notes_timesheet_task_id_idx";

-- DropIndex
DROP INDEX "Timesheet_client_id_idx";

-- DropIndex
DROP INDEX "Timesheet_project_id_idx";

-- DropIndex
DROP INDEX "Timesheet_task_id_idx";

-- DropIndex
DROP INDEX "Timesheet_work_date_idx";

-- AlterTable
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "color" SET DATA TYPE TEXT,
ALTER COLUMN "parent_client_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "notes" DROP COLUMN "timesheet_date",
DROP COLUMN "timesheet_hours",
DROP COLUMN "timesheet_rate",
DROP COLUMN "timesheet_state",
DROP COLUMN "timesheet_task_id";

-- AlterTable
ALTER TABLE "task_activity_logs" DROP CONSTRAINT "task_activity_logs_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "task_id" SET DATA TYPE TEXT,
ALTER COLUMN "event_type" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "task_activity_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "timesheets" ALTER COLUMN "work_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "timesheet_state" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_parent_client_id_fkey" FOREIGN KEY ("parent_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_task_activity_created" RENAME TO "task_activity_logs_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_task_activity_task_id" RENAME TO "task_activity_logs_task_id_idx";
