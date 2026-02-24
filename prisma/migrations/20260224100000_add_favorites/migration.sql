-- AlterTable
ALTER TABLE "notes" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "notes_is_favorite_idx" ON "notes"("is_favorite");
