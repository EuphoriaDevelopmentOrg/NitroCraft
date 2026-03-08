FROM node:24-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    pkg-config \
    redis-server \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
RUN useradd --create-home --shell /usr/sbin/nologin app
USER app

WORKDIR /home/app/nitrocraft
COPY --chown=app:app package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=app:app . .
RUN mkdir -p images/faces images/helms images/skins images/renders images/capes

ARG RUN_TESTS=false
RUN if [ "$RUN_TESTS" = "true" ]; then pnpm test; fi
RUN pnpm build
RUN pnpm prune --prod


FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /usr/sbin/nologin app
USER app
WORKDIR /home/app/nitrocraft
RUN mkdir -p images/faces images/helms images/skins images/renders images/capes

COPY --chown=app:app --from=builder /home/app/nitrocraft/node_modules ./node_modules
COPY --chown=app:app --from=builder /home/app/nitrocraft/.output ./.output
COPY --chown=app:app --from=builder /home/app/nitrocraft/package.json ./package.json

VOLUME /home/app/nitrocraft/images
ENV NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]
EXPOSE 3000
