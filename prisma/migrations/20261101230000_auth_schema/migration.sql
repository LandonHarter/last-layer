-- Better Auth's tables move to `auth`, the schema mybase's users service made,
-- so its Users page, audit log and RLS helpers see them. Indexes, constraints
-- and foreign keys from app tables move with them.
CREATE SCHEMA IF NOT EXISTS "auth";

ALTER TABLE "public"."user" SET SCHEMA "auth";
ALTER TABLE "public"."session" SET SCHEMA "auth";
ALTER TABLE "public"."account" SET SCHEMA "auth";
ALTER TABLE "public"."verification" SET SCHEMA "auth";
