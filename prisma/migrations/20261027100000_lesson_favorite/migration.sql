-- CreateTable
CREATE TABLE "LessonFavorite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "LessonFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonFavorite_itemId_idx" ON "LessonFavorite"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonFavorite_userId_itemId_key" ON "LessonFavorite"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "LessonFavorite" ADD CONSTRAINT "LessonFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonFavorite" ADD CONSTRAINT "LessonFavorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CourseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
