# NitroCraft (Rep Graphics Build)

`repgraphics/nitrocraft` is a self-hosted Minecraft avatar/render API.

It serves:
- 2D avatars from player skins
- 3D head/body renders
- Raw skins and capes

Built with Nitro and `minecraft-toolkit`.

## Quick Start (Docker)

```sh
docker network create nitrocraft
docker volume create nitrocraft-images

docker run -d --name nitrocraft-redis --network nitrocraft redis:7-alpine

docker run -d --name nitrocraft \
  --network nitrocraft \
  -p 3000:3000 \
  -v nitrocraft-images:/home/app/nitrocraft/images \
  -e REDIS_URL=redis://nitrocraft-redis:6379 \
  -e BIND=0.0.0.0 \
  docker.io/repgraphics/nitrocraft:latest
```

Then open `http://localhost:3000`.

## Docker Compose

```sh
cp .env.example .env
docker compose up -d
```

## Windows Support

Windows hosts are supported through Docker Desktop (Linux containers / WSL2).

PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Note: `repgraphics/nitrocraft` is a Linux container image, not a native Windows container image.

## Common Endpoints

Replace `{uuid}` with a valid Minecraft UUID:
- `/avatars/{uuid}?size=128`
- `/renders/head/{uuid}?scale=6`
- `/renders/body/{uuid}?scale=6`
- `/skins/{uuid}`

## Configuration

Environment variables are loaded from `.env`.
Common values:
- `REDIS_URL`
- `CACHE_BACKEND` (`redis`, `memory`, `none`)
- `SESSIONS_RATE_LIMIT` (outbound Mojang session requests/sec)
- `REQUESTS_RATE_LIMIT` + `REQUESTS_RATE_LIMIT_WINDOW_MS` (optional inbound per-IP limiting)
- `CORS_ORIGIN` (empty/`All` allows all, otherwise comma-separated origin allowlist)
- `PORT`
- `BIND`
- `EXTERNAL_URL`

## Links

- Source: https://github.com/RepGraphics/NitroCraft
- Issues: https://github.com/RepGraphics/NitroCraft/issues
