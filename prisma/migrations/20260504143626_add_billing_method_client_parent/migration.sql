-- AlterTable
ALTER TABLE "billing_methods" ADD COLUMN     "client_parent_id" TEXT;

-- CreateIndex
CREATE INDEX "billing_methods_client_parent_id_idx" ON "billing_methods"("client_parent_id");

-- AddForeignKey
ALTER TABLE "billing_methods" ADD CONSTRAINT "billing_methods_client_parent_id_fkey" FOREIGN KEY ("client_parent_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
