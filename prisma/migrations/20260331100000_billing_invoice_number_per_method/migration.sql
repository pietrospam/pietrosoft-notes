-- REQ-026: Add per-method invoice numbering
ALTER TABLE "billing_methods" ADD COLUMN "next_invoice_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "billing_methods" ADD COLUMN "invoice_prefix" VARCHAR(20);
