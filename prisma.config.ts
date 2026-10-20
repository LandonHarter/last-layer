import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the direct connection; the app uses the pooled one (src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
