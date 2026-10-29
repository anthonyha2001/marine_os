-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "nssfEnrolled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxExemption" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "incomeTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nssfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nssfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sicknessEmployee" DECIMAL(6,3) NOT NULL DEFAULT 3,
    "sicknessEmployer" DECIMAL(6,3) NOT NULL DEFAULT 8,
    "sicknessCap" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "familyEmployer" DECIMAL(6,3) NOT NULL DEFAULT 6,
    "familyCap" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "endOfService" DECIMAL(6,3) NOT NULL DEFAULT 8.5,
    "taxBrackets" TEXT NOT NULL DEFAULT '',
    "defaultExemption" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettings_companyId_key" ON "PayrollSettings"("companyId");

-- AddForeignKey
ALTER TABLE "PayrollSettings" ADD CONSTRAINT "PayrollSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PayrollSettings" ENABLE ROW LEVEL SECURITY;
