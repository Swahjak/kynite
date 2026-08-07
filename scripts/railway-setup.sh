#!/usr/bin/env bash
#
# Railway bootstrap — run once, by a human, after `railway login` (M18).
#
# Everything that can live in the repo already does: `railway.json` holds the
# builder, the health check, the restart policy and the region; the `Dockerfile`
# holds the release step. What is left is the part that cannot be committed —
# creating the project, attaching Postgres, and pushing the secrets from
# `.env.local` into the service.
#
# Idempotent by construction: every step is either a create-if-missing or a
# `variable set`, so re-running it after a failure is safe. It never prints a
# secret value, and it never writes one to the repo.
#
#   Usage:  railway login          # once, opens a browser
#           ./scripts/railway-setup.sh
#           # then, after the domain is known:
#           ./scripts/railway-setup.sh --set-auth-url
#
# Verified against Railway CLI 5.30.4.

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="${RAILWAY_PROJECT_NAME:-kynite}"
SERVICE_NAME="${RAILWAY_SERVICE_NAME:-kynite}"
ENV_FILE="${ENV_FILE:-.env.local}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

require_cli() {
  command -v railway >/dev/null || {
    echo "railway CLI not found — https://docs.railway.com/guides/cli" >&2
    exit 1
  }
  railway whoami >/dev/null 2>&1 || {
    echo "not logged in — run 'railway login' first" >&2
    exit 1
  }
}

# Reads one KEY from the local env file without sourcing it (values may contain
# anything, and sourcing an untrusted file to move a secret is how a setup
# script becomes an exploit). Strips optional surrounding quotes.
read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -n1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# Pushes a variable by value on stdin: the secret never appears in the process
# table, in `ps`, or in this shell's history.
set_secret() {
  local key="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  - ${key}: not set in ${ENV_FILE}, skipped"
    return
  fi
  printf '%s' "$value" | railway variable set "$key" --stdin --service "$SERVICE_NAME" --skip-deploys >/dev/null
  echo "  - ${key}: set"
}

set_plain() {
  railway variable set "$1=$2" --service "$SERVICE_NAME" --skip-deploys >/dev/null
  echo "  - $1: $2"
}

# --------------------------------------------------------------------------
# --set-auth-url: the second run, once Railway has issued the domain.
# --------------------------------------------------------------------------
if [[ "${1:-}" == "--set-auth-url" ]]; then
  require_cli
  say "Reading the service domain"
  domain="$(railway domain list --service "$SERVICE_NAME" --json | node -e '
    let raw = ""; process.stdin.on("data", (c) => (raw += c)).on("end", () => {
      const flat = JSON.stringify(JSON.parse(raw));
      const match = flat.match(/[a-z0-9-]+\.up\.railway\.app/i);
      if (!match) { console.error("no Railway domain found — run: railway domain"); process.exit(1); }
      process.stdout.write(match[0]);
    });
  ')"
  say "BETTER_AUTH_URL = https://${domain}"
  set_plain BETTER_AUTH_URL "https://${domain}"
  echo
  echo "Now add this redirect URI in Google Cloud Console (manual, one time):"
  echo "  https://${domain}/api/google/oauth/callback"
  echo
  echo "Then release:  railway up --service ${SERVICE_NAME}"
  exit 0
fi

# --------------------------------------------------------------------------
# First run: project, database, service, secrets.
# --------------------------------------------------------------------------
require_cli

say "1. Project"
if railway status >/dev/null 2>&1; then
  echo "  already linked:"
  railway status
else
  railway init --name "$PROJECT_NAME"
fi

say "2. Managed Postgres"
# Provides ${{Postgres.DATABASE_URL}} as a reference for the app service below.
railway add --database postgres || echo "  (already present)"

say "3. App service"
railway add --service "$SERVICE_NAME" || echo "  (already present)"
railway service "$SERVICE_NAME" || true

say "4. Variables"
# DATABASE_URL is a *reference*, not a copy: Railway resolves it at deploy time,
# so rotating the database password never means re-running this script.
set_plain DATABASE_URL '${{Postgres.DATABASE_URL}}'
# §10 "One process; jobs in-process" — this container is also the worker.
set_plain JOBS_ENABLED true
set_plain NODE_ENV production

echo "  secrets from ${ENV_FILE}:"
for key in BETTER_AUTH_SECRET TOKEN_ENCRYPTION_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
  VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT; do
  set_secret "$key" "$(read_env "$key")"
done

say "5. Public domain"
railway domain --service "$SERVICE_NAME" --port 3000 || echo "  (already present)"

cat <<'NEXT'

Bootstrap done. Remaining, in order:

  1. ./scripts/railway-setup.sh --set-auth-url     # sets BETTER_AUTH_URL from the issued domain
  2. Google Cloud Console → OAuth client → add   https://<domain>/api/google/oauth/callback
  3. railway up                                    # build + deploy (the repeatable release)

Every later release is step 3 alone. Verify with:

  curl -fsS https://<domain>/api/health
  curl -N   https://<domain>/api/sse            # headers + heartbeat
  railway logs --service kynite
NEXT
