# NitroCraft

NitroCraft is a Minecraft avatar/render API built on Nitro and `minecraft-toolkit`.

![NitroCraft Logo](public/NitroCraft.png)

## Preview

![Steve Avatar](public/images/mhf_steve.png)
![Alex Avatar](public/images/mhf_alex.png)
![Steve Skin](public/images/mhf_steve_skin.png)

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

## Endpoints

- `GET /avatars/{uuid}?size=160&overlay`
- `GET /skins/{uuid}`
- `GET /capes/{uuid}`
- `GET /renders/head/{uuid}?scale=6&overlay`
- `GET /renders/body/{uuid}?scale=6&overlay`
- `GET /status/mc`
- `GET /players/{uuid-or-username}`
- `GET /players/{uuid-or-username}/profile`
- `GET /players/{uuid-or-username}/history`
- `GET /players/{uuid-or-username}/skin-metadata`
- `GET /status/java?address=host`
- `GET /status/bedrock?address=host`
- `GET /status/server?address=host&edition=auto`
- `GET /status/icon?address=host`
- `GET /format/html?text=...`
- `GET /format/strip?text=...`
- `GET /format/css`

## Local Development

```bash
corepack enable
nvm use
pnpm install
pnpm dev
```

Build and run production output:

```bash
pnpm build
pnpm start
```

Run tests:

```bash
pnpm test
```

## Docker

```bash
cp .env.example .env
docker compose up -d
```

## Environment

Copy `.env.example` to `.env` and adjust values.

Key variables:
- `CACHE_BACKEND` (`redis`, `memory`, `none`)
- `REDIS_URL`
- `SESSIONS_RATE_LIMIT`
- `REQUESTS_RATE_LIMIT`
- `REQUESTS_RATE_LIMIT_WINDOW_MS`
- `REQUESTS_RATE_LIMIT_MAX_KEYS`
- `REQUESTS_RATE_LIMIT_TRUST_PROXY`
- `REQUESTS_RATE_LIMIT_EXCLUDE`
- `MAX_TEXTURE_BYTES`
- `CORS_ORIGIN` (empty/`All` => allow all, otherwise comma-separated origin allowlist)
- `RETENTION_DAYS` or `RETENTION_MAX_AGE_HOURS`
- `RETENTION_INTERVAL_HOURS` or `RETENTION_INTERVAL_DAYS`
- `PORT`
- `BIND`
- `EXTERNAL_URL`

## Notes

- Render endpoints require native `canvas` dependencies in your runtime image/environment.
- Core image endpoints use UUID input. `/players/{uuid-or-username}` resolves usernames.

## Support

- Discord: [discord.euphoriadevelopment.uk](https://discord.euphoriadevelopment.uk/)

## License

MIT (see [LICENSE](LICENSE)).
