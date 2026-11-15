-- AlterTable
ALTER TABLE "user" ADD COLUMN     "toolWelcomeSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ToolHelpVideo" (
    "key" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolHelpVideo_pkey" PRIMARY KEY ("key")
);
