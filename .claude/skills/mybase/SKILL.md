---
name: mybase
description: Use for anything touching this app's backend on mybase (self-hosted Postgres, S3 storage, cron, queues, cache, rate limits, analytics, vector search), project "lastlayer". Covers the mybase CLI, MCP tools, @mybase-dev/sdk, and mybase.config.ts.
---

# mybase

Project `lastlayer` on https://mybase.hangdong.lol. Services: database, storage, secrets, cache, users.

## Workflow

1. Ground yourself: `mybase context lastlayer --json` or MCP `get_project_context` (project "lastlayer").
2. Look up the exact API before writing code: `mybase docs --search "<words>"`, then `mybase docs <slug>`. Index: https://mybase.hangdong.lol/llms.txt
3. Declare cron jobs, queues, rate limit rules, and vector indexes in `mybase.config.ts`; preview with `mybase <service> sync --dry-run`, then sync.
4. Verify against the live project: `mybase queue peek`, `mybase cron runs`, MCP `list_cron_runs`, `peek_messages`, `analytics_stats`.

## Rules

- Never print, log, or commit secrets (database password, S3 secret key, cache password, `mb_…` API keys). They are shown once; if lost, the user rotates them.
- Destructive commands (`project delete`, `<service> disable`, `queue purge|delete`) need `--yes` and the user's explicit OK.
- Use `--json` when parsing CLI output. Exit codes: 1 failure, 2 usage, 3 not signed in, 4 not found.
- An API key that can't do something gets 403 with the permission it needs (e.g. `queue:write`): ask the user for a key with it, don't work around it.

## Read next

- [Quickstart](https://mybase.hangdong.lol/docs/quickstart.md)
- [Database (Postgres)](https://mybase.hangdong.lol/docs/database.md)
- [Storage (S3)](https://mybase.hangdong.lol/docs/storage.md)
- [Secrets](https://mybase.hangdong.lol/docs/secrets.md)
- [Secrets](https://mybase.hangdong.lol/docs/sdk/secrets.md)
- [Cache](https://mybase.hangdong.lol/docs/cache.md)
- [Cache](https://mybase.hangdong.lol/docs/sdk/cache.md)
- [Users](https://mybase.hangdong.lol/docs/users.md)
- [Better Auth](https://mybase.hangdong.lol/docs/sdk/better-auth.md)
