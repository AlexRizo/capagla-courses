-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'HIDDEN');

-- CreateTable
CREATE TABLE "LessonQuestion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "LessonQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonQuestion_itemId_status_idx" ON "LessonQuestion"("itemId", "status");

-- CreateIndex
CREATE INDEX "LessonQuestion_status_createdAt_idx" ON "LessonQuestion"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CourseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
