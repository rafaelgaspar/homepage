# syntax=docker/dockerfile:1
# rafaelgaspar/homepage — Node 26 on Debian forkly (builder + runner).
FROM debian:forky-slim@sha256:91b0aaebf7a1ccacfe7a9cbff6ab2d6be7d9b3b6cf1dfcf44b25f9095c0e0464 AS node-forky
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_26.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
  && printf '%s\n' \
      'Package: nodejs' \
      'Pin: origin deb.nodesource.com' \
      'Pin-Priority: 1001' \
    > /etc/apt/preferences.d/nodesource \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && node --version \
  && npm --version \
  && groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node \
  && rm -rf /var/lib/apt/lists/*

# =========================
# Builder Stage
# =========================
FROM node-forky AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git python3 \
  && rm -rf /var/lib/apt/lists/*

# Setup
RUN mkdir config
COPY . .

ARG CI
ARG BUILDTIME
ARG VERSION
ARG REVISION
ENV CI=$CI

# Install and build only outside CI
RUN if [ "$CI" != "true" ]; then \
      corepack enable && corepack prepare pnpm@latest --activate && \
      pnpm install --frozen-lockfile --prefer-offline && \
      NEXT_TELEMETRY_DISABLED=1 \
      NEXT_PUBLIC_BUILDTIME=$BUILDTIME \
      NEXT_PUBLIC_VERSION=$VERSION \
      NEXT_PUBLIC_REVISION=$REVISION \
      pnpm run build; \
    else \
      echo "✅ Using prebuilt app from CI context"; \
    fi

# =========================
# Runtime Stage
# =========================
FROM node-forky AS runner
LABEL org.opencontainers.image.title="Homepage"
LABEL org.opencontainers.image.description="A self-hosted services landing page, with docker and service integrations."
LABEL org.opencontainers.image.url="https://github.com/gethomepage/homepage"
LABEL org.opencontainers.image.documentation='https://github.com/gethomepage/homepage/wiki'
LABEL org.opencontainers.image.source='https://github.com/gethomepage/homepage'
LABEL org.opencontainers.image.licenses='Apache-2.0'

RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu iputils-ping wget \
  && ln -sf /usr/sbin/gosu /usr/local/bin/su-exec \
  && rm -rf /var/lib/apt/lists/*

# Setup
WORKDIR /app

# Copy some files from context
COPY --link --chown=1000:1000 /public ./public/
COPY --link --chmod=755 docker-entrypoint.sh /usr/local/bin/

# Copy only necessary files from the build stage
COPY --link --from=builder --chown=1000:1000 /app/.next/standalone/ ./
COPY --link --from=builder --chown=1000:1000 /app/.next/static/ ./.next/static

USER root

ENV NODE_ENV=production
ENV HOSTNAME=::
ENV PORT=3000
EXPOSE $PORT

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider -Y off http://127.0.0.1:$PORT/api/healthcheck || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
