#!/bin/sh
# Write a migration for what changed in prisma/schema.prisma, then apply it.
# The mybase role can't create a shadow database, so `prisma migrate dev`
# doesn't work; this diffs the live database against the schema instead.
# Usage: bun run db:migrate <name>
set -eu
name="${1:?usage: bun run db:migrate <name>}"
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_${name}"
sql="$(bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script)"
if printf '%s' "$sql" | grep -q 'This is an empty migration'; then
  echo "Schema matches the database; nothing to do."
  exit 0
fi
mkdir -p "$dir"
printf '%s\n' "$sql" > "$dir/migration.sql"
echo "Wrote $dir/migration.sql. Review it (it must not touch mybase objects), then press enter to apply."
read -r _
bunx prisma migrate deploy
bunx prisma generate
