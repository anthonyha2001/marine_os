-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "deliveryPlace" TEXT,
ADD COLUMN     "incoterm" TEXT,
ADD COLUMN     "leadTime" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revisionOf" TEXT,
ADD COLUMN     "warranty" TEXT;

-- CreateTable
CREATE TABLE "OfferClause" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferClause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferClause_companyId_idx" ON "OfferClause"("companyId");

-- AddForeignKey
ALTER TABLE "OfferClause" ADD CONSTRAINT "OfferClause_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "OfferClause" ENABLE ROW LEVEL SECURITY;
