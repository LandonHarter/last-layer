-- AlterTable
ALTER TABLE "drill_attempt" ADD COLUMN     "cube" BOOLEAN,
ADD COLUMN     "execMs" INTEGER,
ADD COLUMN     "moveCount" INTEGER,
ADD COLUMN     "recogMs" INTEGER;

-- AlterTable
ALTER TABLE "solve" ADD COLUMN     "moves" TEXT;
