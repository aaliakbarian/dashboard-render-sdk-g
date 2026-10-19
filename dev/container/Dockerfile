FROM node:22.23.3-bookworm

ARG PLAYWRIGHT_VERSION=1.56.1

ENV COREPACK_HOME=/opt/corepack \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install --yes --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "${COREPACK_HOME}" \
    && corepack enable \
    && corepack prepare yarn@4.17.1 --activate

RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
    && rm -rf /root/.npm /var/lib/apt/lists/*

RUN mkdir -p /workspace/node_modules /var/cache/yarn /tmp/poc-home \
    && chmod 0777 /workspace/node_modules /var/cache/yarn /tmp/poc-home

COPY dev/container/entrypoint.sh /usr/local/bin/poc-dev-entrypoint
RUN chmod 0755 /usr/local/bin/poc-dev-entrypoint

WORKDIR /workspace

ENTRYPOINT ["poc-dev-entrypoint"]
CMD ["yarn", "workspace", "@dashboard-render-sdk-g/poc-host", "dev"]
