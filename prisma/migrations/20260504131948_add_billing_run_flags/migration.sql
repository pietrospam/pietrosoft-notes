-- AlterTable
ALTER TABLE "billing_runs" ADD COLUMN     "sentToClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validated" BOOLEAN NOT NULL DEFAULT false;
