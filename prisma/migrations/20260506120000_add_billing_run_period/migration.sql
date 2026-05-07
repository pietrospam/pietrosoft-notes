-- AlterTable
ALTER TABLE "billing_runs" ADD COLUMN "period_start" TIMESTAMP(6) NOT NULL DEFAULT now();
ALTER TABLE "billing_runs" ADD COLUMN "period_end" TIMESTAMP(6) NOT NULL DEFAULT now();

-- CreateIndex
CREATE INDEX "billing_runs_period_start_idx" ON "billing_runs"("period_start");
CREATE INDEX "billing_runs_period_end_idx" ON "billing_runs"("period_end");
