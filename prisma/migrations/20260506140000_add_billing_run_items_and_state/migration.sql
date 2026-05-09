-- AlterTable
ALTER TABLE "billing_runs" ADD COLUMN "exchange_rate_usd" DOUBLE PRECISION;
ALTER TABLE "billing_runs" ADD COLUMN "invoice_state" VARCHAR(20) NOT NULL DEFAULT 'borrador';

-- Create new table for billing run items
CREATE TABLE "billing_run_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "billing_run_id" varchar(255) NOT NULL,
  "name" text NOT NULL,
  "quantity" double precision NOT NULL,
  "unit_cost" double precision NOT NULL,
  "total" double precision NOT NULL,
  "description" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "billing_run_items_billing_run_id_idx" ON "billing_run_items"("billing_run_id");
ALTER TABLE "billing_run_items" ADD CONSTRAINT "billing_run_items_billing_run_id_fkey" FOREIGN KEY ("billing_run_id") REFERENCES "billing_runs"("id") ON DELETE CASCADE;
