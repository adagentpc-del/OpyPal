---
name: Partner Portal auth boundaries
description: Which api-server endpoints the public partner page needs unauthenticated, vs. which require Clerk auth.
---

# Partner Portal public vs. admin API split

The api-server serves both the public per-partner page and the admin portal. Auth is enforced per-route, NOT via a blanket router-level guard, because two endpoints must remain public.

**Must stay public (the white-label partner page at `/partner/:slug` calls only these):**
- `GET /partners/slug/:slug` — public partner page load (embeds active pricing inline)
- `POST /partner-requests` — public referral/request intake form

**Everything else under partners / partner-requests / pricing-rules requires `requireAuth`** (Clerk). This includes all admin reads (`GET /partners`, `GET /pricing-rules`, `GET /partner-requests`, etc.) and all mutations.

**Why:** A prior session left these admin routes completely unauthenticated, so anyone could create/update/delete partners, pricing, and requests. Architect review flagged it as broken access control. Fixed by adding `requireAuth` to each admin route while leaving the two public endpoints open.

**How to apply:** When adding a new partner/pricing/request endpoint, default to `requireAuth`. Only leave it open if the public partner page genuinely needs it, and confirm by grepping `artifacts/a3-partner-portal/src/pages/partner-portal.tsx` (the only public page) for its api usage.

# Web auth is cookie-based, same-origin

Replit-managed Clerk on the web sets a session cookie. The frontends and `/api` are same-origin behind the proxy, so cookies flow automatically. Fetch helpers use `credentials: "include"` to be explicit. There is no bearer-token handling on web — do not add `Authorization` headers.
