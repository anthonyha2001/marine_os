-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "offerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerAttention" TEXT,
    "customerAddress" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "letterDate" DATE NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'OFFICIAL LETTER',
    "reference" TEXT,
    "subject" TEXT,
    "salutation" TEXT,
    "body" TEXT NOT NULL,
    "closing" TEXT,
    "signatoryName" TEXT,
    "signatoryTitle" TEXT,
    "fields" JSONB,
    "enclosures" TEXT,
    "cc" TEXT,
    "marking" TEXT,
    "acknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Letter_number_key" ON "Letter"("number");

-- CreateIndex
CREATE INDEX "Letter_companyId_letterDate_idx" ON "Letter"("companyId", "letterDate");

-- CreateIndex
CREATE INDEX "Letter_offerId_idx" ON "Letter"("offerId");

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Supabase: no access through the public API.
ALTER TABLE "Letter" ENABLE ROW LEVEL SECURITY;
