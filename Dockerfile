FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-dev build-essential ffmpeg curl ca-certificates \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV SS_PW_WITH_DEPS=1 \
    SS_HEADLESS=1 \
    SS_ENGINE=playwright \
    SS_MODE=prod \
    HOST=0.0.0.0

RUN npm run setup

EXPOSE 8080 7866 7867 7868
CMD ["sh", "docker/entrypoint.sh"]
