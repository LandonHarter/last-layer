-- CreateTable
CREATE TABLE "solve_clip" (
    "userId" TEXT NOT NULL,
    "solveId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solve_clip_pkey" PRIMARY KEY ("userId","solveId")
);

-- AddForeignKey
ALTER TABLE "solve_clip" ADD CONSTRAINT "solve_clip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
