# syntax=docker/dockerfile:1

# Kynite production image (M18).
#
# Four stages, one runtime image:
#   deps     — the full install, cached on the lockfile alone
#   migrator — an *isolated* two-package tree for the release migration step
#   builder  — `next build`, which emits `.next/standalone`
#   runner   — the image that ships: standalone server + migrations, no pnpm,
#              no devDependencies, no source
#
# The process it runs is the one docs/architecture.md §10 describes: a single
# Node server that also hosts the pg-boss workers in-process (JOBS_ENABLED).

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=1
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------

FROM base AS deps
# Lockfile-only copy: editing a component must not invalidate the install layer.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------

# The migration runner's dependencies, resolved to the *exact* versions the app
# itself was installed with, so `scripts/migrate.mjs` can never apply a
# migration with a different drizzle than the one that reads the result.
#
# It is a separate tree rather than a copy of `node_modules` because that is the
# difference between ~3MB and ~500MB in the runtime image, and because pnpm's
# symlinked store does not survive a `COPY` of a subdirectory.
FROM deps AS migrator
WORKDIR /migrator
RUN node -e "\
  const v = (name) => require('/app/node_modules/' + name + '/package.json').version; \
  require('fs').writeFileSync('package.json', JSON.stringify({ \
    name: 'kynite-migrator', private: true, type: 'module', \
    dependencies: { 'drizzle-orm': v('drizzle-orm'), pg: v('pg') } \
  }, null, 2)); \
" && pnpm install --node-linker=hoisted --ignore-scripts

# ---------------------------------------------------------------------------

FROM deps AS builder
COPY . .
# The build is secret-free by design (docs/architecture.md §9, src/server/env.ts:
# validation is lazy so `next build` never reads a secret) — which is why no
# build args or mounted secrets appear here. NODE_ENV=production keeps the build
# honest about which branch of the app it is compiling.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------------------------------------------------------------------------

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds this host/port; Railway injects its own PORT.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# §10 "One process; jobs in-process": the container *is* the worker. A second,
# web-only replica overrides this to `false`.
ENV JOBS_ENABLED=true

RUN addgroup -S kynite && adduser -S kynite -G kynite

# `standalone` carries server.js plus a traced node_modules; `static` and
# `public` are the two things it deliberately does not include.
COPY --from=builder --chown=kynite:kynite /app/.next/standalone ./
COPY --from=builder --chown=kynite:kynite /app/.next/static ./.next/static
COPY --from=builder --chown=kynite:kynite /app/public ./public

# The release step. `migrate.mjs` sits *inside* /app/migrator so Node resolves
# its imports against /app/migrator/node_modules, and finds the SQL at ../drizzle.
COPY --from=migrator --chown=kynite:kynite /migrator ./migrator
COPY --chown=kynite:kynite scripts/migrate.mjs ./migrator/migrate.mjs
COPY --chown=kynite:kynite drizzle ./drizzle
COPY --chown=kynite:kynite scripts/docker-entrypoint.sh ./docker-entrypoint.sh

USER kynite
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
