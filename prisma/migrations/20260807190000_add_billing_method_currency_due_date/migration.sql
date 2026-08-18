-- Add currency and payment term fields to billing methods
ALTER TABLE "billing_methods"
ADD COLUMN "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
ADD COLUMN "payment_term_days" INTEGER NOT NULL DEFAULT 0;
