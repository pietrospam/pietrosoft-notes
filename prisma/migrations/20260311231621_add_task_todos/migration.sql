-- CreateTable
CREATE TABLE "task_todos" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "recurrence_rule" TEXT,
    "recurrence_parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_notifications_sent" (
    "id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "reminder_minutes" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_notifications_sent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_todos_task_id_status_idx" ON "task_todos"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_todos_deadline_status_idx" ON "task_todos"("deadline", "status");

-- CreateIndex
CREATE INDEX "task_todos_snoozed_until_idx" ON "task_todos"("snoozed_until");

-- CreateIndex
CREATE INDEX "todo_notifications_sent_todo_id_notification_type_idx" ON "todo_notifications_sent"("todo_id", "notification_type");

-- AddForeignKey
ALTER TABLE "task_todos" ADD CONSTRAINT "task_todos_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_todos" ADD CONSTRAINT "task_todos_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "task_todos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_notifications_sent" ADD CONSTRAINT "todo_notifications_sent_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "task_todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
