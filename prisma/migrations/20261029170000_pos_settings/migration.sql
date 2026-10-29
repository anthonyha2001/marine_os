-- CreateTable
CREATE TABLE "PosSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "maxDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "allowUsd" BOOLEAN NOT NULL DEFAULT true,
    "allowLbp" BOOLEAN NOT NULL DEFAULT true,
    "allowCard" BOOLEAN NOT NULL DEFAULT true,
    "cardOverpay" TEXT NOT NULL DEFAULT 'BLOCK',
    "sellOutOfStock" BOOLEAN NOT NULL DEFAULT true,
    "customerRequiredAbove" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashierRefunds" BOOLEAN NOT NULL DEFAULT true,
    "refundDays" INTEGER NOT NULL DEFAULT 0,
    "blindClose" BOOLEAN NOT NULL DEFAULT false,
    "cashierSeesShiftTotals" BOOLEAN NOT NULL DEFAULT true,
    "receiptNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosSettings_companyId_key" ON "PosSettings"("companyId");

-- AddForeignKey
ALTER TABLE "PosSettings" ADD CONSTRAINT "PosSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PosSettings" ENABLE ROW LEVEL SECURITY;
