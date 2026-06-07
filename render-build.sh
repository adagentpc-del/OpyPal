#!/usr/bin/env bash
# Render build for OpyPal — installs deps, builds both SPAs and the API server,
# then stages the SPA bundles next to the server bundle for single-service serving.
set -euo pipefail

echo "==> Enabling pnpm via corepack"
corepack enable
corepack prepare pnpm@9 --activate

echo "==> Installing dependencies"
pnpm install --no-frozen-lockfile --prod=false

export NODE_ENV=production

echo "==> Building a3-sales-os (base /)"
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/a3-sales-os build

echo "==> Building a3-partner-portal (base /a3-partner-portal/)"
PORT=3000 BASE_PATH=/a3-partner-portal/ pnpm --filter @workspace/a3-partner-portal build

echo "==> Building api-server bundle"
pnpm --filter @workspace/api-server build

echo "==> Staging SPA assets next to server bundle"
DEST=artifacts/api-server/dist/client
rm -rf "$DEST"
mkdir -p "$DEST/a3-partner-portal"
cp -r artifacts/a3-sales-os/dist/public/. "$DEST"/
cp -r artifacts/a3-partner-portal/dist/public/. "$DEST/a3-partner-portal"/

echo "==> Build complete"
