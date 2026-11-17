# Build from the repo root: docker build -f apps/server/Dockerfile -t moba-server .
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN yarn workspaces focus @game/server
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/server apps/server
RUN yarn workspace @game/server build
# Drop dev dependencies before the runtime stage copies node_modules.
RUN yarn workspaces focus @game/server --production

FROM node:${NODE_VERSION}-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/packages/core/package.json packages/core/
COPY --from=build --chown=node:node /app/packages/core/dist packages/core/dist
COPY --from=build --chown=node:node /app/apps/server/package.json apps/server/
COPY --from=build --chown=node:node /app/apps/server/dist apps/server/dist
USER node
EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
