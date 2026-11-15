-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "introVideoId" TEXT;

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "toolPageVideoId" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
