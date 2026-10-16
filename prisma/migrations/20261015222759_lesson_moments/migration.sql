-- CreateTable
CREATE TABLE "LessonMoment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LessonMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonMoment_userId_itemId_idx" ON "LessonMoment"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "LessonMoment" ADD CONSTRAINT "LessonMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonMoment" ADD CONSTRAINT "LessonMoment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CourseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
