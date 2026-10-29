-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_companyId_number_key" ON "SupplierPayment"("companyId", "number");

