# NitroCraft

NitroCraft is a Minecraft avatar/render API built on Nitro and `minecraft-toolkit`.

<p align="center">
  <img src="public/NitroCraft.png" alt="NitroCraft Logo" width="320" />
</p>

## Preview

| Steve Avatar | Alex Avatar | Steve Skin |
| --- | --- | --- |
| ![Steve Avatar](public/images/mhf_steve.png) | ![Alex Avatar](public/images/mhf_alex.png) | ![Steve Skin](public/images/mhf_steve_skin.png) |

## Quick Links

- [Contributing](CONTRIBUTING.md)
- [Docker Hub Overview](DOCKERHUB_OVERVIEW.md)
- [Pterodactyl Egg](pterodactyl%20egg/egg-nitrocraft.json)
- [License](LICENSE)

## Features

- UUID-based avatar, skin, cape, and render endpoints
- Username/UUID resolution endpoints via `minecraft-toolkit`
- Disk + metadata caching with Redis or memory backend
- Configurable outbound Mojang session rate limiting (`SESSIONS_RATE_LIMIT`)
- Optional inbound per-IP request rate limiting (`REQUESTS_RATE_LIMIT`)
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

## Docker

```bash
cp .env.example .env
docker compose up -d
```

## Environment

Create a `.env` file and configure the following values.

| Variable | Purpose |
| --- | --- |
| `CACHE_BACKEND` | Cache backend: `redis`, `memory`, or `none`. |
| `REDIS_URL` | Redis connection string (used when `CACHE_BACKEND=redis`). |
| `SESSIONS_RATE_LIMIT` | Outbound Mojang session request limit. |
| `REQUESTS_RATE_LIMIT` | Enable/disable inbound per-IP request limiting. |
| `REQUESTS_RATE_LIMIT_WINDOW_MS` | Rate-limit window size in milliseconds. |
| `REQUESTS_RATE_LIMIT_MAX_KEYS` | Maximum tracked rate-limit keys. |
| `REQUESTS_RATE_LIMIT_TRUST_PROXY` | Proxy-trust behavior for client IP detection. |
| `REQUESTS_RATE_LIMIT_EXCLUDE` | Comma-separated routes/patterns excluded from inbound limits. |
| `MAX_TEXTURE_BYTES` | Maximum allowed texture payload size. |
| `CORS_ORIGIN` | Empty/`All` allows all origins; otherwise use a comma-separated allowlist. |
| `RETENTION_DAYS` / `RETENTION_MAX_AGE_HOURS` | Cache/data max age. |
| `RETENTION_INTERVAL_HOURS` / `RETENTION_INTERVAL_DAYS` | Cleanup schedule interval. |
| `PORT` | HTTP server port. |
| `BIND` | Bind address/interface. |
| `EXTERNAL_URL` | Public base URL used for generated external links. |

## Notes

- Render endpoints require native `canvas` dependencies in your runtime image/environment.
- Core image endpoints use UUID input. `/players/{uuid-or-username}` resolves usernames.

## Support

- Discord: [discord.euphoriadevelopment.uk](https://discord.euphoriadevelopment.uk/)

## License

MIT (see [LICENSE](LICENSE)).
