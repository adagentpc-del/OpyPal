---
name: Opypal multi-provider email layer
description: Provider abstraction, OAuth state signing, connection isolation, and forwarding-inbox fallback for api-server email sending
---

## Provider model
- Outbound providers share one `mailbox_connections` table keyed by a `provider` column: `microsoft` (Outlook), `google` (Gmail), plus Resend (no row — config/env based) and a `forwarding` pseudo-provider fallback. A `ProviderType` union + `OUTBOUND_PROVIDERS` live in `lib/providers.ts`.
- Per-workspace config (default provider, priority order, forwarding inbox) is stored in `workspaces.senderIdentity` JSONB — **no DDL**, extend the `WorkspaceSenderIdentity` type in `packages/db/src/schema/workspaces.ts` and rebuild lib/db dist.
- Send path: `sendForWorkspace(ws, params)` resolves a fallback chain (priority → available → Resend last) and audits `outbound_send` with the provider actually used. The scheduler calls this; per-email `sendVia` can force a provider.

## Connection isolation rule (critical)
- **Any query against `mailbox_connections` that accepts a connection id OR matches by workspace+email MUST also filter by `provider`.** Because providers share the table, an Outlook route omitting the provider filter can read/update a Gmail row (token corruption, wrong-provider ops). This bit both `getOwnedConnection` AND the OAuth callback upsert lookup — fix both whenever adding a provider.

## OAuth state must be signed
- Connect callbacks (`/gmail/callback`, `/outlook/callback`) are PUBLIC (in `isPublicMixedRoutePath`) and cannot trust the `state` query param as a raw workspace id — doing so is a workspace-takeover vector (attacker binds their mailbox to any workspace).
- `lib/oauth-state.ts` signs state with HMAC (workspace id + nonce + 10-min expiry, constant-time verify). auth-url endpoints call `signState(ws)`; callbacks call `verifyState(...)` and **reject invalid/expired with 400 — never fall back to ws=1**.
- **Why:** without the signature, the unsigned-state + ws=1 fallback let anyone complete OAuth and attach a mailbox to an arbitrary tenant.

## Forwarding-inbox fallback
- Inbound (`routes/inbound-email.ts`): if recipient matches a workspace's `senderIdentity.forwardingInbox` (JSONB `->>'forwardingInbox'` lower() query), resolve that workspace and parse the forwarded body for the ORIGINAL sender/subject/body, then pass `workspaceHint` to `processInboundEmail` (replaces the old hardcoded ws=1).
- Forwarding addresses are enforced unique **at the app level** (409 in `PUT /providers/forwarding-inbox`) — a JSONB-expression unique index is intentionally avoided (no-DDL constraint), so this is best-effort against concurrent writes, acceptable for the tenant scale here.

## RBAC for provider routes
- View (status/sync/refresh) = `requireRole("manager")`; mutations (auth-url/connect, set-primary, delete, sender-identity, forwarding-inbox) = `requireRole("workspace_admin")`. `super_admin` passes all via the role floor. operators/viewers get no access.
