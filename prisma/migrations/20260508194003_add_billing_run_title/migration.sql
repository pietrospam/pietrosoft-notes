/*
  Warnings:

  - The primary key for the `billing_run_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `invoice_state` on the `billing_runs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "billing_run_items" DROP CONSTRAINT "billing_run_items_billing_run_id_fkey";

-- DropForeignKey
ALTER TABLE "billing_runs" DROP CONSTRAINT "billing_runs_note_id_fkey";

-- DropIndex
DROP INDEX "billing_runs_period_end_idx";

-- DropIndex
DROP INDEX "billing_runs_period_start_idx";

-- AlterTable
ALTER TABLE "billing_run_items" DROP CONSTRAINT "billing_run_items_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "billing_run_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "billing_run_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "billing_runs" DROP COLUMN "invoice_state",
ADD COLUMN     "invoiceState" VARCHAR(20) NOT NULL DEFAULT 'borrador',
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "period_start" DROP DEFAULT,
ALTER COLUMN "period_end" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_run_items" ADD CONSTRAINT "billing_run_items_billing_run_id_fkey" FOREIGN KEY ("billing_run_id") REFERENCES "billing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
