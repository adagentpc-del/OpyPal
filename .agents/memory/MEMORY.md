# Memory Index

- [lib/db composite build + DDL](db-package-build.md) — rebuild lib/db dist after schema edits or consumers typecheck stale; use psql for DDL (drizzle push is interactive); api-server has ~150 pre-existing tsc errors.
- [Sales OS workspace RBAC](sales-os-rbac.md) — role ranks, super_admin allowlist, suspended=denied at auth-load, super-admin cross-ws needs explicit x-workspace-id header, control-plane routes need explicit requireRole.
- [Opypal email provider layer](opypal-email-providers.md) — shared mailbox_connections keyed by provider col: ALWAYS filter queries by provider; sign OAuth state (HMAC); forwarding-inbox JSONB fallback; sendForWorkspace fallback chain.
- [Replit secrets vs blank env-vars](replit-secrets-vs-envvars.md) — never pre-create a blank shared env var with the same key as a secret; deleting the placeholder wipes the user-provided secret (shared namespace).
