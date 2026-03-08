# NitroCraft

> Minecraft avatars, skins, and renders at Nitro speed.

NitroCraft is a Minecraft avatar/render API built on Nitro and `minecraft-toolkit`.

<p align="center">
  <img src="public/NitroCraft.png" alt="NitroCraft Logo" width="320" />
</p>

## Preview

| Player | Avatar | Head Render | Body Render |
| --- | --- | --- | --- |
| RepGraphics | ![RepGraphics Avatar](https://nitrocraft.uk/avatars/d634462bd663401d9788a8596307bc4d?size=100&overlay) | ![RepGraphics Head Render](https://nitrocraft.uk/renders/head/d634462bd663401d9788a8596307bc4d?scale=6&overlay) | ![RepGraphics Body Render](https://nitrocraft.uk/renders/body/d634462bd663401d9788a8596307bc4d?scale=6&overlay) |
| 26bz | ![26bz Avatar](https://nitrocraft.uk/avatars/15851079f1d24d418207ce9f914e966d?size=100&overlay) | ![26bz Head Render](https://nitrocraft.uk/renders/head/15851079f1d24d418207ce9f914e966d?scale=6&overlay) | ![26bz Body Render](https://nitrocraft.uk/renders/body/15851079f1d24d418207ce9f914e966d?scale=6&overlay) |

## Quick Links

- [Contributing](CONTRIBUTING.md)
- [Docker Hub Overview](DOCKERHUB_OVERVIEW.md)
- [Pterodactyl Egg](pterodactyl%20egg/egg-nitrocraft.json)
- [Donations](#donations)
- [License](LICENSE)

## Features

- UUID-based avatar, skin, cape, and render endpoints
- Username/UUID resolution endpoints via `minecraft-toolkit`
- Disk + metadata caching with Redis or memory backend
- Short-TTL + in-flight deduplicated status probe caching for `/status/*` endpoints
- Configurable outbound Mojang session rate limiting (`SESSIONS_RATE_LIMIT`)
- Optional inbound per-IP request rate limiting (`REQUESTS_RATE_LIMIT`)
- Hosted API docs (`/docs`) and Prometheus metrics (`/metrics`)
- Interactive server-list simulator (`/tools/server-list`) with import/share flow
- PWA support with installable manifest, offline fallback, and share-target support
- Nitro runtime with `pnpm` workflows

## API Endpoints

### Avatar, Skin, and Render

- `GET /avatars/{uuid}?size=160&overlay`
- `GET /skins/{uuid}`
- `GET /capes/{uuid}`
- `GET /renders/head/{uuid}?scale=6&overlay`
- `GET /renders/body/{uuid}?scale=6&overlay`

### Player Lookup

- `GET /players/{uuid-or-username}`
- `GET /players/{uuid-or-username}/profile`
- `GET /players/{uuid-or-username}/history`
- `GET /players/{uuid-or-username}/skin-metadata`

### Server Status

- `GET /status/mc`
- `GET /status/java?address=host`
- `GET /status/bedrock?address=host`
- `GET /status/server?address=host&edition=auto`
- `GET /status/icon?address=host`

### Text Formatting

- `GET /format/html?text=...`
- `GET /format/strip?text=...`
- `GET /format/css`

### Tooling and Meta

- `GET /tools/server-list`
- `GET /docs`
- `GET /metrics`

## Getting Started

### Local Development

```bash
corepack enable
nvm use
pnpm install
pnpm dev
```

### Build and Run Production Output

```bash
pnpm build
pnpm start
```

### Run Tests

```bash
pnpm test
```

### Run Lint

```bash
pnpm lint
```

## Docker

```bash
cp .env.example .env
docker compose up -d
```

## GitHub Actions (Docker Hub)

This repo includes a Docker publish workflow at `.github/workflows/docker-publish.yml`.

It runs on:
- Push to `master`/`main`
- Version tags like `v1.2.3`
- Daily schedule (`03:00 UTC`)
- Manual dispatch

Add these repository secrets in GitHub:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN` (Docker Hub access token)
- `DOCKERHUB_REPOSITORY` (for example: `repgraphics/nitrocraft`)

## GitHub Actions (Build Releases)

This repo also includes `.github/workflows/build-release.yml`.

It:
- Runs `pnpm build`
- Packages `.output` as a tarball
- Publishes assets to the GitHub Release for the tag

Triggers:
- Push tags like `v1.2.3`
- Manual dispatch (provide an existing tag)

## Environment

Create a `.env` file and configure the following values.

| Variable | Purpose |
| --- | --- |
| `CACHE_BACKEND` | Cache backend: `redis`, `memory`, or `none`. |
| `REDIS_URL` | Redis connection string (used when `CACHE_BACKEND=redis`). |
| `API_CALL_COUNT_FILE` | JSON file path for persistent API call count (used when Redis is unavailable). |
| `API_CALL_COUNT_FLUSH_MS` | Flush interval for persisting API call count updates. |
| `SPONSOR_CARDS` | JSON array of sponsor cards shown below the jumbotron; each entry is `{ "url": "...", "image": "...", "alt": "..." }`. Takes precedence over `SPONSOR_CARD_*`. |
| `SPONSOR_CARD_URL` | External link target for the optional sponsor card shown below the homepage jumbotron. |
| `SPONSOR_CARD_IMAGE` | Image URL (or `/public-path` image) used for the optional sponsor card. |
| `SPONSOR_CARD_ALT` | Alt text for the sponsor card image (`Sponsor` by default). |
| `SESSIONS_RATE_LIMIT` | Outbound Mojang session request limit. |
| `REQUESTS_RATE_LIMIT` | Enable/disable inbound per-IP request limiting. |
| `REQUESTS_RATE_LIMIT_WINDOW_MS` | Rate-limit window size in milliseconds. |
| `REQUESTS_RATE_LIMIT_MAX_KEYS` | Maximum tracked rate-limit keys. |
| `REQUESTS_RATE_LIMIT_TRUST_PROXY` | Proxy-trust behavior for client IP detection. |
| `REQUESTS_RATE_LIMIT_EXCLUDE` | Comma-separated routes/patterns excluded from inbound limits. |
| `STATUS_ALLOW_PRIVATE_TARGETS` | Allow private/local network addresses in `/status/*` probe endpoints (`false` by default). |
| `MAX_TEXTURE_BYTES` | Maximum allowed texture payload size. |
| `DEFAULT_REDIRECT_ALLOWLIST` | Comma-separated host allowlist for `default=` URL redirects (supports `*.example.com`). If unset, only `EXTERNAL_URL` host is allowed. |
| `SITEMAP_LASTMOD` | Optional ISO timestamp used for sitemap `<lastmod>` values. |
| `SITE_UPDATED_AT` | Optional ISO timestamp exposed via homepage Open Graph `og:updated_time`. |
| `CORS_ORIGIN` | Empty/`All` allows all origins; otherwise use a comma-separated allowlist. |
| `RETENTION_DAYS` / `RETENTION_MAX_AGE_HOURS` | Cache/data max age. |
| `RETENTION_INTERVAL_HOURS` / `RETENTION_INTERVAL_DAYS` | Cleanup schedule interval. |
| `PORT` | HTTP server port. |
| `BIND` | Bind address/interface. |
| `EXTERNAL_URL` | Public base URL used for generated external links. |
| `STATUS_PROBE_CACHE_TTL_MS` | Cache TTL for `/status/java`, `/status/bedrock`, `/status/server`, and `/status/icon` probes. |

## Notes

- Render endpoints require native `canvas` dependencies in your runtime image/environment.
- Core image endpoints use UUID input. `/players/{uuid-or-username}` resolves usernames.
- Credit to [26bz](https://github.com/26bz) for creating [`minecraft-toolkit`](https://github.com/26bz/minecraft-toolkit), which powers player/status tooling in NitroCraft.

## Donations

If NitroCraft helps your projects, you can support ongoing development here:

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Support-181717?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/EuphoriaDevelopmentOrg)

- GitHub Sponsors: [github.com/sponsors/EuphoriaDevelopmentOrg](https://github.com/sponsors/EuphoriaDevelopmentOrg)

### Supporter Tiers

NitroCraft tiers are designed so any support helps, while the `$20` tier is the clear best fit for teams or brands that want visibility.

- `Supporter ($5/month)`: helps cover baseline hosting and maintenance costs, plus supporter role/thanks in community channels.
- `Builder ($10/month)`: includes Supporter perks, plus priority review for one feature suggestion per month and access to sponsor polls.
- `Sponsor Spotlight ($20/month)`: includes all lower-tier perks, plus placement in the NitroCraft homepage sponsor section and README sponsor listing with your linked image card.

## Support

- Discord: [discord.euphoriadevelopment.uk](https://discord.euphoriadevelopment.uk/)

## License

MIT (see [LICENSE](LICENSE)).
