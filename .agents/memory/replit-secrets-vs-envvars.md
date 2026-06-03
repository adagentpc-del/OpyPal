---
name: Replit secrets vs blank env-var placeholders
description: Why setting blank shared env vars with the same key as a secret destroys the secret
---

## Never create a blank shared env var with the same key as a secret
- `setEnvVars` (shared/dev/prod) and `requestEnvVar` secrets share ONE key namespace. If a blank shared env var `FOO=""` exists and the user then provides secret `FOO`, they collide; later `deleteEnvVars(["FOO"], shared)` removes the value entirely and the secret reads back as absent.
- **Symptom seen:** set blank `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI` as placeholders → user supplied real secret values → deleting the blank shared placeholders wiped the secrets (viewEnvVars showed them gone), forcing a re-request.
- **Rule:** to let a user "save a secret for later," DON'T pre-create a blank env var. Just `requestEnvVar` when ready, or tell them to use the Secrets tab. If a key must exist as both, never delete the shared one while the secret is needed.
