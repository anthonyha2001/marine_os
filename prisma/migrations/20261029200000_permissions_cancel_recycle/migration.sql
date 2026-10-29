-- AlterTable
ALTER TABLE "CustomerReceipt" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'POSTED';

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'POSTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" JSONB;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'POSTED';

-- CreateTable
CREATE TABLE "RecycleBinItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "relinks" JSONB,
    "deletedByName" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    "restoredByName" TEXT,

    CONSTRAINT "RecycleBinItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecycleBinItem_companyId_deletedAt_idx" ON "RecycleBinItem"("companyId", "deletedAt");

ALTER TABLE "RecycleBinItem" ENABLE ROW LEVEL SECURITY;
