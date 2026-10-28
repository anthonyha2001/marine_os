-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "posRefundId" TEXT,
ADD COLUMN     "posSaleId" TEXT;

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lbpPerUsd" DECIMAL(14,2) NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosShift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingUsd" DECIMAL(12,2) NOT NULL,
    "openingLbp" DECIMAL(16,0) NOT NULL,
    "expectedUsd" DECIMAL(12,2),
    "expectedLbp" DECIMAL(16,0),
    "countedUsd" DECIMAL(12,2),
    "countedLbp" DECIMAL(16,0),
    "closeRate" DECIMAL(14,2),
    "notes" TEXT,

    CONSTRAINT "PosShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL DEFAULT 'Walk-in customer',
    "customerAddress" TEXT,
    "customerTaxNumber" TEXT,
    "subtotalHT" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountHT" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalHT" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "totalTTC" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "paidUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidLbp" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "paidCard" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeLbp" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceHT" DECIMAL(12,2) NOT NULL,
    "lineTotalHT" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PosSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosRefund" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "totalHT" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "totalTTC" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amountLbp" DECIMAL(16,0) NOT NULL DEFAULT 0,

    CONSTRAINT "PosRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosRefundLine" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountHT" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PosRefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_companyId_createdAt_idx" ON "ExchangeRate"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PosShift_companyId_status_idx" ON "PosShift"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PosShift_companyId_number_key" ON "PosShift"("companyId", "number");

-- CreateIndex
CREATE INDEX "PosSale_companyId_saleDate_idx" ON "PosSale"("companyId", "saleDate");

-- CreateIndex
CREATE INDEX "PosSale_shiftId_idx" ON "PosSale"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_companyId_number_key" ON "PosSale"("companyId", "number");

-- CreateIndex
CREATE INDEX "PosSaleLine_saleId_idx" ON "PosSaleLine"("saleId");

-- CreateIndex
CREATE INDEX "PosRefund_saleId_idx" ON "PosRefund"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "PosRefund_companyId_number_key" ON "PosRefund"("companyId", "number");

-- CreateIndex
CREATE INDEX "PosRefundLine_refundId_idx" ON "PosRefundLine"("refundId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_posSaleId_fkey" FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_posRefundId_fkey" FOREIGN KEY ("posRefundId") REFERENCES "PosRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefundLine" ADD CONSTRAINT "PosRefundLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "PosRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefundLine" ADD CONSTRAINT "PosRefundLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "PosSaleLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep Supabase public REST API closed for the new tables (see init migration).
ALTER TABLE "ExchangeRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosShift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSaleLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosRefund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosRefundLine" ENABLE ROW LEVEL SECURITY;
