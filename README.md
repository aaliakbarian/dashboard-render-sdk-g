# Dashboard Render SDK G

> **Experimental pre-release software.** The SDK workspaces are private, no npm
> package has been published, and the verified compatibility surface is narrow.
> This repository is not yet a supported production SDK.

Dashboard Render SDK G renders supported Grafana OSS dashboards as native React
content inside a host application.

**No iframe. No Grafana application shell.**

The host keeps ownership of React, navigation, layout, authentication,
authorized HTTP transport, routing, and product chrome. The provider owns the
pinned Grafana implementation cohort needed to retrieve and render a dashboard
by UID. The project is independent of Grafana Labs; “Grafana” identifies the
upstream compatibility target, not affiliation or endorsement.

## What works today

The private Phase 2 SDK renders the controlled dashboard with eight real native
Grafana panels:

- Text
- Stat
- Time series
- Table
- Gauge
- Bar gauge
- Pie chart
- Bar chart

The tested path retrieves a dashboard by UID through a host-authorized browser
transport, validates the V1/schema-42 DTO, classifies each panel, executes the
controlled TestData Predictable Pulse query where required, and renders through
the real pinned Grafana panel implementations. Unsupported panel profiles remain
visible as white `Not-Supported` placeholders and do not execute hidden queries
or renderer code.

Browser evidence also covers UID switching, stale-work cancellation, two
compatible dashboard instances, responsive charts, and lifecycle cleanup. The
SDK uses native React/DOM/SVG/canvas output; it does not call `GrafanaApp.init`.

## Exact compatibility cell

| Component | Verified identity |
| --- | --- |
| Grafana | OSS 13.2.3 |
| Dashboard API/schema | `dashboard.grafana.app/v1`, V1 DTO, schema 42 |
| Grafana source | tag `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` |
| React / ReactDOM | host-owned React 19.2.8 / ReactDOM 19.2.8 |
| Scenes | 8.13.5 |
| Datasource | `grafana-testdata-datasource`, UID `grsdk-testdata` |
| Query profile | one exact Predictable Pulse target |
| Transformations | empty pipeline or the verified Time series `renameByRegex` step |

This is a compatibility cell, not a general Grafana compatibility claim. Exact
admitted panel options and known packaging constraints are documented in the
[Phase 2 native rendering support matrix](docs/architecture/production/phase-2-native-rendering-support.md).
Pixel-perfect parity, arbitrary dashboards, arbitrary plugins or datasources,
V2 dashboards, other Grafana/React/Scenes versions, and production deployment
compatibility are not claimed.

## Try the standalone demo

The reference app runs a reverse proxy, React host, Keycloak development
instance, and Grafana OSS 13.2.3. It demonstrates Authorization Code with PKCE,
an independent Grafana Viewer cookie session, all eight native panels, and the
host-owned transport boundary.

Prerequisites are Git, Docker Engine with Docker Compose, and the ignored pinned
Grafana source checkout described in the
[standalone demo guide](demo/standalone/README.md).

```bash
docker compose -f demo/standalone/compose.yaml up --build --detach --wait
```

Open <http://localhost:8088/> and sign in with the labeled development-only
fixtures `demo-viewer` / `development-only-viewer`. When finished:

```bash
docker compose -f demo/standalone/compose.yaml down --volumes
```

The demo is contributor evidence, not a deployment template. See the
[standalone demo documentation](demo/standalone/README.md) for the auth flow,
reset procedure, tests, and troubleshooting.

## React SDK integration

The current API uses an explicit provider, the host's real React module
identities, and a restricted host transport capability:

```tsx
import {
  createDashboardRenderSdk,
  GrafanaDashboard,
} from '@dashboard-render-sdk-g/core';
import {
  Grafana13DashboardRenderer,
  grafana13Provider,
} from '@dashboard-render-sdk-g/provider-13';

const creation = createDashboardRenderSdk({
  provider: grafana13Provider,
  renderer: Grafana13DashboardRenderer,
  hostReact, // actual React, ReactDOM/client, and JSX-runtime module identities
  transport, // created from the host's restricted, cookie-aware executor
  namespace: 'default',
});

if (!creation.valid) throw new Error('SDK configuration is invalid.');

export function Dashboard({ uid }: { readonly uid: string }) {
  return <GrafanaDashboard sdk={creation.sdk} uid={uid} />;
}
```

The packages above are repository-private and cannot be installed from npm.
The complete, typechecked host example—including React identity construction,
transport policy, status handling, UID changes, and cleanup—is in the
[SDK integration guide](docs/development/sdk-integration.md).

## Develop and test

The supported workflow is container-first. Create the ignored development
fixture environment once, replace its placeholder with a disposable local
password, then use the existing development container:

```bash
cp dev/grafana/.env.example dev/grafana/.env
docker compose --env-file dev/grafana/.env build dev
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:sdk-slice
```

Additional browser, fixture, bundle, licensing, and package-boundary commands
are documented in the [local development guide](docs/development/local-development.md),
[standalone demo guide](demo/standalone/README.md), and package scripts. The
known Scenes 8.13.5 React peer warning is preserved as compatibility evidence.

## Architecture and project documentation

- [Architecture overview](docs/architecture/architecture-overview.md)
- [Phase 1 production architecture decision](docs/architecture/production/phase1-production-architecture-decision.md)
- [Phase 2 native rendering support matrix](docs/architecture/production/phase-2-native-rendering-support.md)
- [Runtime isolation model](docs/architecture/production/runtime-isolation-model.md)
- [Bridge/provider architecture](docs/architecture/production/bridge-provider-architecture.md)
- [SDK integration guide](docs/development/sdk-integration.md)
- [Standalone authenticated demo](demo/standalone/README.md)
- [Project roadmap](docs/project/roadmap.md)
- [Contributing guide](CONTRIBUTING.md)

## Limitations

- Only the exact compatibility cell and panel profiles above are admitted.
- The only query-backed datasource profile is the provisioned TestData
  Predictable Pulse fixture; general datasource discovery is not implemented.
- Unsupported material options, targets, transformations, dashboards, or
  schemas fail closed or use the documented panel-level fallback.
- The host must establish and protect the authorized Grafana session. The SDK
  contains no credential manager, OAuth implementation, proxy service, or
  backend.
- Provider/runtime ownership is realm-wide for a compatible configuration;
  incompatible runtime identities are rejected.
- Current inline and Emotion style paths do not claim nonce-only strict-CSP
  compatibility.
- All packages remain private and experimental; there is no stable public API
  or published npm release.

## Licensing and publication status

Project-owned code is licensed under [AGPL-3.0-only](LICENSE). Third-party code
and assets retain their own licenses and notices; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the
[third-party licensing workflow](docs/development/third-party-licensing.md).

The automation and artifacts for
[#64 — third-party licensing and notices](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64)
are present, but the current production inventory is **blocked pending legal
review** for documented components. Passing the notice generator would not by
itself authorize publication.
[#65 — source availability, reproducibility, and SBOM](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65)
is a separate release gate and remains required before any public-release
decision. Do not publish the private workspaces.

Grafana is a trademark of Grafana Labs. Dashboard Render SDK G is not affiliated
with, endorsed by, or sponsored by Grafana Labs or its affiliates.
