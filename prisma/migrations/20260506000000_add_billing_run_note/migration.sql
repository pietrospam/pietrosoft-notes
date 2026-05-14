-- AlterTable
ALTER TABLE "billing_runs" ADD COLUMN "note_id" TEXT UNIQUE;

-- CreateIndex
CREATE INDEX "billing_runs_note_id_idx" ON "billing_runs"("note_id");

-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
