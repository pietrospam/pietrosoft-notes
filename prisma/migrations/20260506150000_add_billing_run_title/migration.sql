-- Add missing invoice_title column to billing_runs
ALTER TABLE "billing_runs" ADD COLUMN "invoice_title" VARCHAR(255);
