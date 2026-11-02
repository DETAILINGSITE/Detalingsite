#!/bin/sh
# Vercel build: migrate, optionally seed and bootstrap the owner account, then build.
#   SEED_ON_BUILD=1                      seed the catalog/content (inserts only what's missing)
#   BOOTSTRAP_ADMIN_EMAIL + ADMIN_PASSWORD  create or update the owner login (password never printed)
set -e
pnpm db:migrate
if [ "$SEED_ON_BUILD" = "1" ]; then
  pnpm db:seed
fi
if [ -n "$BOOTSTRAP_ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  pnpm admin:create --email "$BOOTSTRAP_ADMIN_EMAIL" --name "Owner" --role owner
fi
pnpm build
