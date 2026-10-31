-- AlterTable
ALTER TABLE "VesselEngine" ADD COLUMN     "hoursAt" TIMESTAMP(3),
ADD COLUMN     "hoursBy" TEXT;

-- CreateTable
CREATE TABLE "PortalThread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'QUESTION',
    "vesselId" TEXT,
    "warrantyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "staffUnread" BOOLEAN NOT NULL DEFAULT true,
    "customerUnread" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromCustomer" BOOLEAN NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalThread_companyId_lastMessageAt_idx" ON "PortalThread"("companyId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "PortalThread_customerId_lastMessageAt_idx" ON "PortalThread"("customerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "PortalMessage_threadId_createdAt_idx" ON "PortalMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "PortalThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as the owner; nothing is exposed to the public API.
ALTER TABLE "PortalThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalMessage" ENABLE ROW LEVEL SECURITY;
