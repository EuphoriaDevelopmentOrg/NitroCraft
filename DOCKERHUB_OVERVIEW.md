# NitroCraft

`repgraphics/nitrocraft` is a self-hosted Minecraft avatar/render API built with Nitro and `minecraft-toolkit`.

## What It Provides

- UUID-based avatars, skins, capes, and head/body renders
- Player lookup endpoints (`uuid`/`username`)
- Server status endpoints (Java, Bedrock, auto)
- Built-in cache support (`redis`, `memory`, or `none`)
- Optional outbound/inbound rate limiting

## Quick Start (Docker)

```sh
docker run -d --name nitrocraft \
  -p 3000:3000 \
  -v nitrocraft-images:/home/app/nitrocraft/images \
  -e NODE_ENV=production \
  -e BIND=0.0.0.0 \
  -e EXTERNAL_URL=http://localhost:3000 \
  -e CACHE_BACKEND=memory \
  docker.io/repgraphics/nitrocraft:latest
```

Open `http://localhost:3000`.

## Quick Start (Docker + Redis)

```sh
docker network create nitrocraft
docker volume create nitrocraft-images

docker run -d --name nitrocraft-redis --network nitrocraft redis:7-alpine

docker run -d --name nitrocraft \
  --network nitrocraft \
  -p 3000:3000 \
  -v nitrocraft-images:/home/app/nitrocraft/images \
  -e NODE_ENV=production \
  -e BIND=0.0.0.0 \
  -e EXTERNAL_URL=http://localhost:3000 \
  -e CACHE_BACKEND=redis \
  -e REDIS_URL=redis://nitrocraft-redis:6379 \
  docker.io/repgraphics/nitrocraft:latest
```

## Docker Compose

```sh
docker compose up -d
```

## Common Endpoints

Replace `{uuid}` with a valid Minecraft UUID:

- `/avatars/{uuid}?size=160&overlay`
- `/skins/{uuid}`
- `/capes/{uuid}`
- `/renders/head/{uuid}?scale=6&overlay`
- `/renders/body/{uuid}?scale=6&overlay`
- `/players/{uuid-or-username}`
- `/status/mc`

## Key Environment Variables

- `CACHE_BACKEND`: `redis`, `memory`, or `none`
- `REDIS_URL`: required when `CACHE_BACKEND=redis`
- `CORS_ORIGIN`: empty/`All` allows all origins
- `REQUESTS_RATE_LIMIT`: inbound per-IP rate limit (empty disables)
- `REQUESTS_RATE_LIMIT_WINDOW_MS`: limiter window in ms
- `SESSIONS_RATE_LIMIT`: outbound Mojang session requests/sec
- `STATUS_ALLOW_PRIVATE_TARGETS`: allow private/local `/status/*` probes (`false` recommended)
- `DEFAULT_REDIRECT_ALLOWLIST`: allowlist for external `default=` redirect hosts
- `PORT`, `BIND`, `EXTERNAL_URL`

## Notes

- Render endpoints require native `canvas` runtime libraries (already included in this image).
- This is a Linux image. On Windows, run via Docker Desktop (Linux containers/WSL2).

## Links

- Source: https://github.com/RepGraphics/NitroCraft
- Issues: https://github.com/RepGraphics/NitroCraft/issues
