-- CreateTable
CREATE TABLE "WebsiteSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT,
    "heroTitle" TEXT,
    "heroText" TEXT,
    "heroImageId" TEXT,
    "aboutTitle" TEXT,
    "aboutText" TEXT,
    "aboutImageId" TEXT,
    "highlights" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "mapQuery" TEXT,
    "openingHours" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "showCatalogue" BOOLEAN NOT NULL DEFAULT true,
    "showGallery" BOOLEAN NOT NULL DEFAULT true,
    "showBooking" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteService" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteGalleryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "imageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteListing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "imageId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteImage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "appointmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "handledAt" TIMESTAMP(3),
    "handledByName" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSettings_companyId_key" ON "WebsiteSettings"("companyId");

-- CreateIndex
CREATE INDEX "WebsiteService_companyId_position_idx" ON "WebsiteService"("companyId", "position");

-- CreateIndex
CREATE INDEX "WebsiteGalleryItem_companyId_position_idx" ON "WebsiteGalleryItem"("companyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteListing_companyId_productId_key" ON "WebsiteListing"("companyId", "productId");

-- CreateIndex
CREATE INDEX "WebsiteImage_companyId_idx" ON "WebsiteImage"("companyId");

-- CreateIndex
CREATE INDEX "WebsiteMessage_companyId_createdAt_idx" ON "WebsiteMessage"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "WebsiteSettings" ADD CONSTRAINT "WebsiteSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteService" ADD CONSTRAINT "WebsiteService_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteGalleryItem" ADD CONSTRAINT "WebsiteGalleryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteListing" ADD CONSTRAINT "WebsiteListing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteListing" ADD CONSTRAINT "WebsiteListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteImage" ADD CONSTRAINT "WebsiteImage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteMessage" ADD CONSTRAINT "WebsiteMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteGalleryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteListing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteMessage" ENABLE ROW LEVEL SECURITY;
