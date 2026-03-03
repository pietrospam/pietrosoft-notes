-- Add table to store task comments (REQ-016)

-- Create the table
CREATE TABLE "task_comments" (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id")
    REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- indexes
CREATE INDEX "task_comments_task_id_idx" ON "task_comments" ("task_id");
CREATE INDEX "task_comments_created_at_idx" ON "task_comments" ("created_at");
