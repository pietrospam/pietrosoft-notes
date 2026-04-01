-- REQ-026: Billing Methods table
CREATE TABLE "billing_methods" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "auth_type" VARCHAR(50) NOT NULL DEFAULT 'none',
    "auth_config" JSONB,
    "payload_template" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_methods_pkey" PRIMARY KEY ("id")
);

-- REQ-026: Billing Runs table
CREATE TABLE "billing_runs" (
    "id" TEXT NOT NULL,
    "client_parent_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "method_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50),
    "total_hours" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION,
    "currency" VARCHAR(10),
    "request_json" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "pdf_data" BYTEA,
    "pdf_filename" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "billing_runs_client_parent_id_idx" ON "billing_runs"("client_parent_id");
CREATE INDEX "billing_runs_method_id_idx" ON "billing_runs"("method_id");
CREATE INDEX "billing_runs_year_month_idx" ON "billing_runs"("year", "month");

-- Foreign keys
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "billing_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
