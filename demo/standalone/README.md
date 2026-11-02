# Standalone SDK demo

The demo exercises the exact bounded profiles in the
[Phase 2 native rendering support matrix](../../docs/architecture/production/phase-2-native-rendering-support.md).

This local reference app owns its navigation, layout, authentication, and logout
while rendering the existing Phase 2 dashboard through the public SDK. It is
experimental contributor infrastructure, not an SDK backend or a deployment
template. All usernames, passwords, and client secrets here are public local
development fixtures. Use them only with this disposable loopback stack.

## Prerequisites

Run every command below from the repository root. Use Git and Docker Engine with
Docker Compose on Linux/WSL; the browser runner uses Linux host networking and
the Compose override requires support for `!reset`. Node, Yarn, TypeScript,
Playwright, and Chromium run in containers; no host installation is needed.

The existing ignored Grafana source checkout must already be available at
`.grafana-source/grafana-v13.2.3/`, clean and pinned to public tag `v13.2.3`,
commit `6193dc03311b631b9727b560d24369e683dc396e`. The demo mounts this checkout
and does not download it. Verify it with:

```bash
git -C .grafana-source/grafana-v13.2.3 rev-parse HEAD
git -C .grafana-source/grafana-v13.2.3 status --porcelain
```

Expect the commit above and no status output. The Grafana server is separately
pinned in [compose.yaml](compose.yaml) to the existing Grafana OSS 13.2.3 image
digest on `linux/amd64`.

## Start and sign in

Start all four services with one command:

```bash
docker compose -f demo/standalone/compose.yaml up --build --detach --wait
```

The host installs locked dependencies with Yarn 4.17.1 on Node 22.23.3, builds
the provider artifact and the standalone app, then serves **Vite preview**.
Allow several minutes for the first install/build. Raw Vite development serving
does not satisfy the provider's React namespace identity contract; use this
build-and-preview path for native rendering. After changing source files, rerun
the startup command with `--force-recreate` to rebuild the host's runtime assets.

Open [http://localhost:8088/](http://localhost:8088/) and use the real Keycloak
login form:

| Field | Local fixture |
| --- | --- |
| Username | `demo-viewer` |
| Password | `development-only-viewer` |

The account becomes a Grafana **Viewer**, without Grafana admin privileges.
No environment file is required for this stack. Optional disposable admin
overrides are listed in [.env.example](.env.example); they do not change the
imported Viewer password or confidential OAuth client secret. Keep the exact
`http://localhost:8088` browser origin: both OIDC clients, callbacks, and logout
redirects are registered for it.

The host selects `drsdk-g-phase2-visualizations`, using the existing TestData
datasource `grsdk-testdata` and its Predictable Pulse fixture. Native panels are
Text, Stat, Time series, Table, Gauge, Bar gauge, Pie chart, and Bar chart.

## Use the app

- The header shows the application name, the signed-in Keycloak display name
  and username, and the logout action.
- The sidebar contains the existing Phase 2 dashboard. Its toggle collapses the
  navigation to a narrow icon rail and immediately gives the dashboard more
  horizontal space; expanding it restores the labels.
- The main area renders the real `GrafanaDashboard` SDK component. It retrieves
  `drsdk-g-phase2-visualizations` and runs the controlled TestData requests
  through the host-owned Grafana session.
- The optional UID input changes the React `uid` prop without a full-page
  reload. Selecting **Phase 2 visualizations** restores the provisioned fixture
  after trying another valid UID, including a missing UID.

The eight panels use the exact bounded profiles in the support matrix. A panel
outside those profiles remains visible as a `Not-Supported` placeholder instead
of silently disappearing or executing an unsupported query.

## Routing and independent sessions

Only Nginx publishes a host port, bound to `127.0.0.1:8088`:

| Service | Browser path | Responsibility |
| --- | --- | --- |
| `proxy` | all paths | Same-origin routing; exact OAuth return sentinel |
| `host` | `/` | Built React app, host chrome, public SDK integration |
| `keycloak` | `/keycloak/` | Development realm and both OIDC clients |
| `grafana` | `/grafana/` | Viewer cookie, provisioned dashboard, TestData API |

1. The host's `keycloak-js` adapter signs in through public client
   `standalone-demo` using Authorization Code with S256 PKCE. Tokens stay in
   adapter memory; they are not supplied to the SDK or Grafana APIs.
2. The host independently checks `/grafana/api/user` using same-origin cookies.
   A 401 navigates to Grafana Generic OAuth with `redirectTo=/demo-return`.
3. Grafana's confidential client `grafana` uses the existing Keycloak SSO session
   and S256 PKCE to create its own HTTP-only
   `standalone_demo_grafana_session` cookie. Grafana owns the callback at
   `/grafana/login/generic_oauth` and adds its `/grafana` subpath to the return.
   Nginx redirects only exact `/grafana/demo-return` to the host root, dropping
   the query string.
4. After `/grafana/api/user` succeeds, the SDK loads the dashboard through a
   host-owned, restricted cookie transport. Grafana's application shell and
   iframes are not loaded. The browser test checks the active organization's
   Viewer role through `/grafana/api/user/orgs`; `/api/user` alone does not expose
   that role in this Grafana version.
5. **Log out** clears the Grafana cookie through `/grafana/logout`, then visits
   Keycloak's end-session endpoint with `client_id=grafana` and Grafana's own
   ID-token hint. Complete Keycloak's confirmation if it appears. Returning to
   the host requires a fresh login, and protected Grafana APIs return 401.

The realm is defined in
[the realm import](keycloak/dashboard-render-sdk-g-demo-realm.json); routing is
defined in [nginx.conf](proxy/nginx.conf). The stack uses the existing datasource
and dashboard provisioning files rather than adding an SDK service or datasource.

## Container-only Chromium verification

Prepare the repository's existing Playwright image and dependency volume once.
If `dev/grafana/.env` does not exist, copy `dev/grafana/.env.example` there and
replace its placeholder password with a disposable local value. This file belongs
to the separate development fixture; the demo login uses the fixtures above.

```bash
docker compose --env-file dev/grafana/.env build dev
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
```

With the standalone stack healthy, run the real Chromium gate:

```bash
docker compose --env-file dev/grafana/.env -f compose.yaml -f demo/standalone/playwright.compose.yaml run --rm --no-deps dev yarn playwright test --config demo/standalone/playwright.config.ts
```

The [override](playwright.compose.yaml) attaches only the existing development
runner to the host network so Chromium can reach `localhost:8088`. Combine it
with the root `compose.yaml`, not the demo stack; `--no-deps` avoids starting the
separate root Grafana fixture. The equivalent workspace command inside this
runner is `yarn workspace @dashboard-render-sdk-g/standalone-demo test:e2e`.

The test exercises real login, both PKCE flows, Viewer authorization, eight native
panels, pulse query DataFrames, sidebar resizing,
missing-UID recovery, and logout. It also rejects unexpected network traffic,
token forwarding/storage, duplicate React renderers, iframes, Grafana shell,
and unexpected browser errors. It uses no route or response mocks. Authentication
traces, screenshots, video, and saved browser state are disabled; disposable
runner output goes to `/tmp`.

Host unit tests and type checking use the same container runner:

```bash
docker compose --env-file dev/grafana/.env -f compose.yaml -f demo/standalone/playwright.compose.yaml run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/standalone-demo test:unit
docker compose --env-file dev/grafana/.env -f compose.yaml -f demo/standalone/playwright.compose.yaml run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/standalone-demo typecheck
```

## Stop or reset

To stop containers while preserving the current Keycloak realm, Grafana state,
sessions, dependency volume, and Yarn cache:

```bash
docker compose -f demo/standalone/compose.yaml down
```

Keycloak imports a realm only when it does not already exist. Restarting an
existing volume does not apply edits to the realm JSON. To reproduce the checked-in
configuration, including the Grafana client's post-logout redirect registration,
reset the disposable demo and start it again:

```bash
docker compose -f demo/standalone/compose.yaml down --volumes
docker compose -f demo/standalone/compose.yaml up --build --detach --wait
```

For final teardown:

```bash
docker compose -f demo/standalone/compose.yaml down --volumes
```

`--volumes` deletes this demo's Keycloak/Grafana state, sessions, local changes,
dependency volume, and Yarn cache. It does not target the separate root
development volumes. Generated provider and host artifacts remain ignored in
the checkout. Use plain `down` only when intentionally preserving the current
realm and development state; use the reset sequence after realm import changes.

## Troubleshooting

### The first startup takes several minutes

The host performs an immutable install, builds the pinned provider, builds the
React app, and starts Vite preview before becoming healthy. Inspect the scoped
service state and logs instead of switching to the unsupported raw development
server:

```bash
docker compose -f demo/standalone/compose.yaml ps
docker compose -f demo/standalone/compose.yaml logs host grafana keycloak proxy
```

If the host reports that the Grafana source checkout is missing, verify
`.grafana-source/grafana-v13.2.3/` at the commit in [Prerequisites](#prerequisites).
The Compose stack intentionally does not download or modify that checkout.

### A realm or OAuth configuration change is not visible

Keycloak does not re-import an existing realm. Use the `down --volumes` reset
sequence in [Stop or reset](#stop-or-reset), then start the stack again. This
deletes only the volumes scoped to this demo.

### Login loops or the dashboard remains unauthorized

Use exactly `http://localhost:8088/`, not another hostname or port. The SPA and
Grafana OAuth clients, cookies, callbacks, and logout redirects are registered
for that origin. Confirm all four services are healthy. If a previous partial
login left disposable state behind, perform the clean reset and sign in again;
do not copy the Keycloak token into the SDK or add an Authorization header.

### Port 8088 is already in use

Only the reverse proxy publishes a port, fixed to loopback `127.0.0.1:8088`.
Stop the conflicting local process or Compose project. Changing the port alone
will break the checked-in OAuth callback registration and is not a supported
demo configuration.

### Source changes do not appear

The app serves a production build through Vite preview. Rebuild and recreate the
host after source changes:

```bash
docker compose -f demo/standalone/compose.yaml up --build --detach --wait --force-recreate
```

For authentication realm changes, use the volume-reset sequence as well.
