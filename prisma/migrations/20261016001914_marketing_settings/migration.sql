-- CreateTable
CREATE TABLE "MarketingSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metaPixelId" TEXT NOT NULL DEFAULT '',
    "metaToken" TEXT NOT NULL DEFAULT '',
    "metaTestCode" TEXT NOT NULL DEFAULT '',
    "tiktokPixelId" TEXT NOT NULL DEFAULT '',
    "tiktokToken" TEXT NOT NULL DEFAULT '',
    "tiktokTestCode" TEXT NOT NULL DEFAULT '',
    "ga4MeasurementId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);
