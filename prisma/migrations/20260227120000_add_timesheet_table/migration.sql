-- Migration: add separate timesheets table

CREATE TABLE "timesheets" (
    "id" TEXT PRIMARY KEY,
    "work_date" TIMESTAMP NOT NULL,
    "hours_worked" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "task_id" TEXT,
    "project_id" TEXT,
    "client_id" TEXT,
    "timesheet_rate" DOUBLE PRECISION,
    "timesheet_state" "TimesheetState" DEFAULT 'DRAFT',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "Timesheet_task_id_idx" ON "timesheets"("task_id");
CREATE INDEX "Timesheet_project_id_idx" ON "timesheets"("project_id");
CREATE INDEX "Timesheet_client_id_idx" ON "timesheets"("client_id");
CREATE INDEX "Timesheet_work_date_idx" ON "timesheets"("work_date");

-- Foreign keys
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "notes"("id") ON DELETE SET NULL;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;
