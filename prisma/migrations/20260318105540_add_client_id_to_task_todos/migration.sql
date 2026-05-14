-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "code" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "task_todos" ADD COLUMN     "client_id" TEXT,
ALTER COLUMN "task_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "task_todos_client_id_status_idx" ON "task_todos"("client_id", "status");

-- AddForeignKey
ALTER TABLE "task_todos" ADD CONSTRAINT "task_todos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
