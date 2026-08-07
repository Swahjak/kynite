#!/bin/sh
# Container release step (M18).
#
# Migrations run *before* the server, in the same container, on every start:
# Railway replaces the running container on deploy, so there is no separate
# release phase to hang them off. Applying an already-applied migration is a
# no-op (drizzle's `__drizzle_migrations` table), which is what makes this safe
# to repeat on a restart and on a second replica.
#
# `set -e` is the whole point: a failed migration must abort the boot, so the
# health check never goes green on a container whose schema is behind and
# Railway keeps the previous deployment serving.
set -e

echo "[entrypoint] running migrations"
node /app/migrator/migrate.mjs

echo "[entrypoint] starting server"
exec "$@"
