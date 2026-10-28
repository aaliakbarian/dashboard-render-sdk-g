FROM node:22.23.3-bookworm

ENV COREPACK_HOME=/opt/corepack

RUN apt-get update \
    && apt-get install --yes --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p "${COREPACK_HOME}" \
    && corepack enable \
    && corepack prepare yarn@4.17.1 --activate

# The existing entrypoint runs commands as the bind-mounted checkout's owner.
# The ignored, pinned Grafana source is mounted at runtime, never downloaded.
COPY dev/container/entrypoint.sh /usr/local/bin/poc-dev-entrypoint
RUN chmod 0755 /usr/local/bin/poc-dev-entrypoint

WORKDIR /workspace
ENTRYPOINT ["poc-dev-entrypoint"]
