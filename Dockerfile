FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=bun:bun package.json tsconfig.json index.ts ./

USER bun

CMD ["bun", "run", "index.ts"]
