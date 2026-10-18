-- AlterEnum
ALTER TYPE "QuestionStatus" ADD VALUE 'ASSISTANT';

-- CreateEnum
CREATE TYPE "QuestionVote" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "LessonQuestion" ADD COLUMN "assistantAnswer" TEXT,
ADD COLUMN "vote" "QuestionVote",
ADD COLUMN "draft" TEXT;

-- CreateTable
CREATE TABLE "LessonTranscript" (
    "itemId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lines" JSONB NOT NULL,

    CONSTRAINT "LessonTranscript_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "AssistantSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "maxChars" INTEGER NOT NULL DEFAULT 600,

    CONSTRAINT "AssistantSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LessonTranscript" ADD CONSTRAINT "LessonTranscript_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CourseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
