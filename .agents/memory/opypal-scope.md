---
name: OpyPal product scope
description: What OpyPal is, and how the partner portal relates to it (product-direction decision, not derivable from code).
---

# OpyPal product scope

- **OpyPal = "Opportunity Operations Pal"** — an automated CRM & relationship management tool. The flagship/main app is the CRM at `artifacts/a3-sales-os` (formerly "A3 Sales OS"). Its main page/functionality is the CRM dashboard.
- **The tagline is NOT "partner portal."** Do not brand OpyPal around partner portals.
- **The partner portal (`artifacts/a3-partner-portal`) is OUT of scope right now.** The owner explicitly asked to leave it out. It is a separate, pre-existing artifact. It is intended to become a *tab inside the super-admin area of the CRM*, to be built later — not a standalone product surface for OpyPal users.

**Why:** The owner was alarmed when an earlier build (a) put the partner portal forward as if it were the product and (b) gated the CRM behind a login that landed them away from the dashboard. The partner portal's Clerk/multi-tenant changes were reverted to its pre-Clerk state on their instruction.

**How to apply:** When working on "OpyPal," default to the `a3-sales-os` CRM. Do not develop or surface the partner portal unless the owner explicitly revisits it (the future "super-admin tab"). After auth, signed-in users must land directly on the CRM dashboard with full access.
