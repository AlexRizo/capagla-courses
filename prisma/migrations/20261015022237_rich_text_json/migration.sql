/*
  Warnings:

  - The `recipe` column on the `CourseItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `body` column on the `CourseItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CourseItem" DROP COLUMN "recipe",
ADD COLUMN     "recipe" JSONB,
DROP COLUMN "body",
ADD COLUMN     "body" JSONB;
