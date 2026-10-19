# Local Development

## Current state

The repository contains a runnable private React host, a containerized development environment, and a deterministic Grafana OSS 13.2.3 fixture for the disposable native-rendering POC. It does not yet contain Grafana runtime initialization, dashboard loading in the host, panel rendering in the host, or a datasource runtime adapter.

All POC packages are private research workspaces and must not be published. Passing POC code does not automatically become production SDK code.

## Prerequisites

The default workflow requires only:

- Git;
- Docker with Docker Compose;
- VS Code or Codex; and
- a repository checkout on the WSL Linux filesystem.

Node.js, npm, Yarn, TypeScript, Vite, Vitest, Playwright, Chromium, native browser dependencies, and Grafana are supplied by containers. They are not required on the WSL host.

## Local fixture credentials

Create ignored credentials for the isolated disposable fixture before using Compose:

```bash
cp dev/grafana/.env.example dev/grafana/.env
```

Replace the placeholder password in `dev/grafana/.env`. These credentials are only for the local Grafana container. They are not SDK configuration, are never compiled by Vite, and must not be committed. Anonymous access remains disabled; future browser tests receive credentials only through their test process and establish a normal Grafana session.

## Container-first setup

From the repository root:

```bash
docker compose --env-file dev/grafana/.env build dev
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
```

The image is based on `node:22.23.3-bookworm`, prepares Yarn `4.17.1` through Corepack, and installs the Chromium build required by Playwright `1.56.1`. Application dependencies are never installed globally in the image; the repository's `yarn.lock` remains authoritative.

The repository's `nodeLinker: node-modules` setting is authoritative. Compose therefore mounts named volumes at `/workspace/node_modules` and `/var/cache/yarn`, keeping dependency and Yarn cache contents outside the bind-mounted checkout. Source files and `yarn.lock` remain bind-mounted from WSL.

The container entrypoint reads the bind-mounted checkout's numeric UID/GID and runs the requested development command with that identity. This prevents generated files in the repository from becoming root-owned.

The known `@grafana/scenes@8.13.5` React peer warning is expected: Scenes declares React 18 while the pinned Grafana 13.2.3 cohort requires React 19.2.8. Do not suppress or override this warning; retain it as POC evidence.

## Workspace commands

| Operation | Container-first command |
| --- | --- |
| Immutable install | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable` |
| Type check | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck` |
| Unit tests | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit` |
| Integration tests | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration` |
| Browser/E2E tests | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:e2e` |
| Production build | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc` |
| Forbidden-import inspection | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn inspect:bundle` |
| In-container verification suite | `docker compose --env-file dev/grafana/.env run --rm --no-deps dev sh dev/container/verify-environment.sh` |
| Complete container/host contract | `set -a; . dev/grafana/.env; set +a; bash tests/container/dev-environment-contract.sh` |
| Grafana fixture HTTP and reference-UI contract | `sh tests/container/grafana-fixture-contract.sh` |

Use `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspaces list --json` to inspect workspace discovery. Use the same prefix with `yarn why react`, `yarn why react-dom`, and `yarn why @grafana/scenes` to inspect the pinned runtime identity and expected peer warning.

The complete container/host contract builds the image by default. If upstream registries are temporarily unavailable and the exact image has already been built, source `dev/grafana/.env` as shown in the command table and set `POC_SKIP_IMAGE_BUILD=true` before running `tests/container/dev-environment-contract.sh`. The Grafana fixture contract starts both services, verifies the APIs and real TestData query through `/grafana`, runs the credential-gated reference-UI test with tracing disabled, and writes its screenshot under ignored `artifacts/grafana-fixture/`.

## Run the development host

Start the host and Grafana fixture with:

```bash
docker compose --env-file dev/grafana/.env up --detach --wait grafana dev
```

Open `http://localhost:5173/` for the independent React host. Grafana diagnostics are available at `http://localhost:3000/grafana/`. Both published ports bind only to host loopback.

Inside the Compose network, Vite forwards `/grafana/*` to `http://grafana:3000` without stripping the prefix, changing the origin header, or adding credentials. From a browser, all future POC API calls use `http://localhost:5173/grafana/*`. Grafana's root URL and session-cookie path are both `/grafana`, so normal host-established cookies traverse the proxy. This proxy is development infrastructure, not an SDK backend, authentication service, or production deployment design.

The fixture provisions:

- Grafana image `grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` on `linux/amd64`;
- TestData datasource `Dashboard Render SDK G POC TestData`, UID `grsdk-testdata`, type `grafana-testdata-datasource`;
- schema-42 dashboard UID `grsdk-phase0-poc` with Text, Stat, Time series, and diagnostic Table panels; and
- lifecycle dashboard UID `grsdk-phase0-poc-alt` with one alternate Text sentinel.

The fixture has three related but intentionally distinct identities. The source-analysis baseline is the public annotated tag `v13.2.3`, peeled to `6193dc03311b631b9727b560d24369e683dc396e`. The fixture artifact is the immutable `linux/amd64` image manifest `sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4`. The image's running binary reports build commit `90ffed056f0884267356c12a0eeb72a022af53f1` and branch `release-13.2.3#patched`; `/api/health` exposes that build-time `BuildCommit`, not the public tag's peeled commit. Grafana's v13.2.3 release workflow deliberately stamps the commit actually built from the patched security mirror while retaining a separate publicly resolvable commit for tagging and publishing. Therefore, verify each identifier in its own role and do not expect the two commit hashes to match.

Provisioning is file-based and idempotent. Grafana state is held in the disposable `grafana-data` named volume. The fixtures contain only synthetic data.

Stop the host with:

```bash
docker compose --env-file dev/grafana/.env down
```

## Optional direct WSL tooling

Direct WSL execution is optional. If a contributor intentionally chooses it, they must install Node.js `22.23.3`, enable Corepack, and use Yarn `4.17.1`. The equivalent direct install remains:

```bash
corepack yarn install --immutable
```

The container workflow is the supported default and is used for POC verification.

## Working with the repository

1. Create a focused branch from the current default branch.
2. Read the project context, architecture overview, and relevant ADRs.
3. Edit only the files required for the change.
4. Review `git status` and `git diff` before requesting review.
5. Check Markdown links and inspect rendered formatting where practical.

## Documentation validation

Until automated tooling is selected, validate documentation manually:

- confirm requested files and directories exist;
- confirm relative links resolve;
- scan for trailing whitespace and accidental secrets;
- verify terminology and constraints are consistent; and
- review the complete diff for unrelated changes.

## Future setup

Later implementation tasks will add the Grafana container, runtime services, bundle evidence, and gate-specific commands. Do not infer that the development container authorizes those later tasks.
