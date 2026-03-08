# NitroCraft Pterodactyl Egg

This guide covers the quickest way to self-host NitroCraft with the included egg:

- Egg file: `egg-nitrocraft.json`
- Runtime image: `docker.io/repgraphics/nitrocraft:latest`

## What This Egg Does

- Runs NitroCraft on your server allocation port automatically.
- Creates required image cache folders:
  - `images/faces`
  - `images/helms`
  - `images/skins`
  - `images/renders`
  - `images/capes`
- Supports Redis cache or memory cache.
- If `CACHE_BACKEND=redis` but `REDIS_URL` is empty, it safely falls back to `memory`.
- Boots from `/home/container/.output` when available, otherwise uses the app bundled in the Docker image.

## Quick Setup (Recommended)

1. In Pterodactyl Admin, import [`egg-nitrocraft.json`](./egg-nitrocraft.json).
2. Create a new server using the NitroCraft egg.
3. Keep the default startup command.
4. Set these variables first:
   - `EXTERNAL_URL=https://your-domain.example`
   - `CORS_ORIGIN=https://your-frontend.example` (or `All` for public/open use)
   - `CACHE_BACKEND=memory` (or `redis`)
   - `REDIS_URL=redis://host:6379` (required only when using Redis)
5. Start the server and wait for log output containing:
   - `Listening on http://`
6. Open your service URL and test:
   - `/avatars/d634462bd663401d9788a8596307bc4d?size=160&overlay`
   - `/metrics`

## Important Variables

Use these first for a stable production setup:

- `EXTERNAL_URL`: public base URL for NitroCraft.
- `BIND`: keep `0.0.0.0`.
- `PORT`: usually leave empty; the egg uses the allocation port automatically.
- `CACHE_BACKEND`: `memory` or `redis`.
- `REDIS_URL`: required if `CACHE_BACKEND=redis`.
- `CACHE_LOCAL`: internal metadata cache TTL (seconds).
- `CACHE_BROWSER`: browser cache TTL (seconds).
- `REQUESTS_RATE_LIMIT`: inbound per-IP request limit (empty disables).
- `REQUESTS_RATE_LIMIT_WINDOW_MS`: window for inbound limiter.
- `REQUESTS_RATE_LIMIT_TRUST_PROXY`: keep `true` when behind a reverse proxy/CDN.
- `REQUESTS_RATE_LIMIT_EXCLUDE`: optional comma-separated path prefixes to skip limiter.
- `SESSIONS_RATE_LIMIT`: outbound Mojang API request rate cap.
- `MAX_TEXTURE_BYTES`: max downloaded skin/cape payload size.
- `RETENTION_ENABLED`: periodic cleanup of stale files/cache.
- `RETENTION_DAYS` and `RETENTION_INTERVAL_HOURS`: cleanup age/interval.

## Redis vs Memory

- `memory`:
  - Easiest setup, no external dependency.
  - Best for single-instance deployments.
- `redis`:
  - Better consistency across restarts and scaling scenarios.
  - Requires reachable Redis and valid `REDIS_URL`.

If Redis is misconfigured, this egg logs a warning and runs with memory cache so the API still comes online.

## Reverse Proxy Notes

- Put NitroCraft behind Nginx/Caddy/Traefik (and optional Cloudflare) for TLS.
- Forward standard headers (`X-Forwarded-For`, `X-Forwarded-Proto`, `Host`).
- Keep `REQUESTS_RATE_LIMIT_TRUST_PROXY=true` when proxied, or client IP limits may be inaccurate.

## Updating NitroCraft

Choose one of these update strategies:

- Image-first (recommended):
  1. Pull/redeploy using `docker.io/repgraphics/nitrocraft:latest`.
  2. Restart server.
- Source-ref pinning:
  1. Set `SOURCE_REPO` and `SOURCE_REF` (branch or tag).
  2. Reinstall the server to refresh `/home/container` bootstrap content.

## Data Persistence

Keep server storage persistent so generated assets and counters survive restarts:

- `images/faces/`
- `images/helms/`
- `images/skins/`
- `images/renders/`
- `images/capes/`
- `data/` (if using file-backed counters/metrics settings)

## Troubleshooting

- `CACHE_BACKEND=redis but REDIS_URL is empty` warning:
  - Set `REDIS_URL`, or switch `CACHE_BACKEND=memory`.
- API starts but you get blocked CORS in browser:
  - Set `CORS_ORIGIN` to your frontend origin(s), or `All`.
- Users hit `429` too often:
  - Raise `REQUESTS_RATE_LIMIT`, increase window, or add route exclusions.
- Slow or failing external lookups:
  - Increase `EXTERNAL_HTTP_TIMEOUT` (default `2000` ms).

## Useful Endpoints

- API docs/spec: `/openapi.json`
- Prometheus metrics: `/metrics`
- Live server-list tool: `/tools/server-list`
- API call count endpoint: `/metrics/api-calls`
