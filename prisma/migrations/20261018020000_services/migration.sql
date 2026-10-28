-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "unit" TEXT;

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

