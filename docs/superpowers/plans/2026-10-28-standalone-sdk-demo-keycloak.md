# Lightweight Standalone SDK Demo with Keycloak Implementation Plan

> **For Codex:** Execute this plan with `superpowers:subagent-driven-development`, strict TDD, task review, and a final independent whole-branch review. Do not commit.

**Goal:** Add a minimal four-service reference application that authenticates a React SPA and Grafana OSS 13.2.3 with one Keycloak realm, then renders the provisioned Phase 2 dashboard through the existing SDK and host-owned transport.

**Architecture:** One loopback-published reverse proxy is the browser origin. It routes `/` to the React host, `/keycloak/` to Keycloak, and `/grafana/` to Grafana without stripping either subpath. The SPA uses Keycloak Authorization Code + PKCE through the official `keycloak-js` adapter. After SPA authentication, the host checks `/grafana/api/user`; an unauthenticated response starts a top-level Grafana Generic OAuth flow. Grafana establishes its own Viewer cookie and returns through the proxy-owned exact `/grafana/demo-return` sentinel. OIDC tokens remain inside the host authentication adapter and are never passed to Core, provider-13, or transport requests. The existing `GrafanaDashboard`, `createDashboardRenderSdk`, provider renderer, and host transport capability remain unchanged.

**Technology:** React 19.2.8, Vite 8.2.0, `keycloak-js` 26.2.4, Keycloak 26.8.1 development mode, Grafana OSS 13.2.3 pinned image, Nginx reverse proxy, Docker Compose, Vitest, Playwright Chromium. The adapter uses the most recent non-quarantined official release available to the immutable Yarn install; 26.2.5 was published less than a day before execution and was correctly rejected by the repository's Yarn quarantine policy.

**Issue:** Child F #102 under parent #93.

## Global constraints

- Exactly four demo services: `proxy`, `host`, `keycloak`, and `grafana`; Keycloak uses its embedded development database.
- No SDK package source changes, SDK backend, token forwarding, extra datasource, telemetry, UI framework, or generalized auth/proxy abstraction.
- The only new application dependency is official `keycloak-js`; all other versions remain pinned.
- Grafana remains `grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` and reuses the current datasource/dashboard provisioning files read-only.
- Browser credentials are development-only fixtures. No real secrets, access tokens, cookies, authorization headers, or generated runtime state are tracked or persisted as evidence.
- All Node/Yarn/Vitest/TypeScript/Playwright/build work runs in containers.
- Do not commit, push, publish, create a PR, or begin Child D.

## Task 1: Register the demo workspace and define the host authentication/transport boundaries

**Files:**

- Modify: `package.json`
- Modify: `yarn.lock`
- Create: `demo/standalone/package.json`
- Create: `demo/standalone/tsconfig.json`
- Create: `demo/standalone/index.html`
- Create: `demo/standalone/vite.config.ts`
- Create: `demo/standalone/src/authSession.ts`
- Create: `demo/standalone/src/authSession.test.ts`
- Create: `demo/standalone/src/transport.ts`
- Create: `demo/standalone/src/transport.test.ts`

**RED:** Add behavior tests proving that the session coordinator initializes Keycloak with `flow: 'standard'`, `pkceMethod: 'S256'`, and `login-required`; a successful SPA session still checks Grafana independently; 401 triggers only the exact Grafana OAuth bootstrap URL; non-401 errors do not become login; logout starts at Grafana; identity is detached from token material. Add transport tests for the existing exact dashboard/frontend-settings/query allowlist, same-origin credentials, request cancellation, security-header rejection, and response-header sanitization.

Run:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run demo/standalone/src/authSession.test.ts demo/standalone/src/transport.test.ts --environment node
```

Expected: RED because the modules/workspace do not exist.

**GREEN:** Add the private workspace, official Keycloak adapter dependency, typed host-owned session coordinator, and demo-local transport executor. The auth boundary exposes only bounded user display data and session state; it does not expose Keycloak tokens. Reuse the production SDK request policy shape without importing `apps/sdk-host` internals.

**Verification:** Focused tests and `yarn workspace @dashboard-render-sdk-g/standalone-demo typecheck` pass. `yarn install --immutable` passes after the intentional lockfile update.

## Task 2: Build the React reference application and responsive shell

**Files:**

- Create: `demo/standalone/src/App.tsx`
- Create: `demo/standalone/src/App.test.tsx`
- Create: `demo/standalone/src/main.tsx`
- Create: `demo/standalone/src/styles.css`

**RED:** Add browser-environment component tests for loading/authentication/error states; header identity and logout; the single existing Phase 2 navigation entry; collapse/expand semantics; dynamic UID state without full-page navigation; and construction of the real Core/provider-13 SDK handle. Assert that the dashboard component remains absent until both SPA and Grafana sessions are ready.

**GREEN:** Implement a full-height responsive shell with a header, accessible collapsible navigation rail, and main dashboard region. Construct the SDK with host-owned React identities and the demo transport. Render `<GrafanaDashboard sdk={sdk} uid="drsdk-g-phase2-visualizations" />` unchanged. Do not add fake Phase 3/4 entries or reproduce any renderer.

**Verification:** Focused unit tests and demo typecheck pass; no SDK package changes are present.

## Task 3: Create the deterministic four-service Compose stack

**Files:**

- Create: `demo/standalone/compose.yaml`
- Create: `demo/standalone/host.Dockerfile`
- Create: `demo/standalone/proxy/nginx.conf`
- Create: `demo/standalone/keycloak/dashboard-render-sdk-g-demo-realm.json`
- Create: `demo/standalone/.env.example`
- Create: `demo/standalone/playwright.compose.yaml`
- Create: `demo/standalone/compose-contract.test.mjs`

**RED:** Add an executable Compose contract test that runs the rendered Compose configuration and validates exactly four services, loopback-only publication, pinned Grafana identity, one TestData provisioning source, the Phase 2 dashboard mount, Keycloak import, no database/backend service, and exact proxy route ownership. Add negative fixture cases for broad Grafana callback interception and missing OAuth security settings.

**GREEN:** Implement the stack. The host image uses the pinned Node/Yarn toolchain and current ignored Grafana source checkout to build the provider artifact before Vite starts. Keycloak imports one realm with one public PKCE SPA client, one confidential Grafana client, and one obvious development-only Viewer user. Grafana Generic OAuth uses the same realm, assigns Viewer, disables anonymous access, and owns its independent cookie. Nginx preserves the `/keycloak` and `/grafana` subpaths and intercepts only `/grafana/demo-return`. The test override runs the existing Playwright development image with host networking; it does not add a fifth demo service.

**Verification:** `docker compose -f demo/standalone/compose.yaml config`, the contract test, and Nginx configuration validation pass. No generated Keycloak/Grafana data is tracked.

## Task 4: Prove authentication, authorized Grafana access, and native rendering in Chromium

**Files:**

- Create: `demo/standalone/playwright.config.ts`
- Create: `demo/standalone/e2e/standalone-demo.spec.ts`
- Create: `demo/standalone/e2e/support.ts`

**RED:** Start the stack and run Chromium before implementing any missing behavior. The suite must fail on an observable requirement, not a source-text assertion.

**GREEN acceptance test:**

1. An unauthenticated browser request to a protected Grafana dashboard API returns 401/redirect without disclosing data.
2. Visiting the SPA reaches the Keycloak login page; the demo user completes Authorization Code + PKCE.
3. The host independently establishes a Grafana Generic OAuth Viewer session and `/grafana/api/user` reports Viewer.
4. Header shows the bounded user identity and a keyboard-operable logout action.
5. Sidebar collapses to an icon rail, expands, and the main dashboard grows measurably.
6. UID navigation occurs in-page and the SDK retrieves `drsdk-g-phase2-visualizations`.
7. Every renderer in the actual shipped executable catalogue appears natively (currently Text, Stat, Time series, Gauge, and Bar gauge) from real TestData responses; Table, Pie chart, and Bar chart remain the existing inert `Not-Supported` placeholders. The demo must reflect the SDK's real support boundary rather than advertising or fabricating Table support.
8. Query traffic is limited to the approved Grafana paths; no OIDC token/Authorization header reaches SDK transport requests.
9. There is no iframe, Grafana shell/navigation, full-page UID navigation, duplicate React, console/page error, or unexpected request.
10. Logout clears the Grafana session, triggers Keycloak logout, and protected Grafana access is unauthorized afterward.

Use existing native panel selectors and verify at least one real `/grafana/api/ds/query` response contains the expected time/number frame data.

## Task 5: Document and validate the reproducible contributor workflow

**Files:**

- Create: `demo/standalone/README.md`
- Modify: `demo/standalone/package.json`
- Modify: `package.json` only for narrowly scoped demo verification scripts if justified

Document the one stack startup command, the development-only user, the existing pinned Grafana source checkout prerequisite, browser URL, architecture/session sequence, teardown, and container-only Chromium command. State explicitly that the demo is not an SDK backend or deployment template and that all credentials are local development fixtures.

Run:

```bash
docker compose -f demo/standalone/compose.yaml up --build --detach --wait
docker compose --env-file dev/grafana/.env -f compose.yaml -f demo/standalone/playwright.compose.yaml run --rm --no-deps dev yarn playwright test --config demo/standalone/playwright.config.ts
docker compose -f demo/standalone/compose.yaml down --volumes
```

## Task 6: Full regression, boundary, bundle, ownership, and sanitation verification

Run in containers:

```bash
yarn install --immutable
yarn workspace @dashboard-render-sdk-g/standalone-demo typecheck
yarn workspace @dashboard-render-sdk-g/standalone-demo test:unit
yarn typecheck
yarn test:unit
yarn test:integration
yarn check:provider-contract-boundary
yarn check:core-boundary
yarn check:provider-13-boundary
yarn build:sdk-slice
yarn inspect:sdk-host-bundle
```

Then rerun the demo Chromium suite, `git diff --check`, secret-pattern checks, ownership checks, and tracked/untracked inventory. Inspect the demo bundle to confirm one React/ReactDOM implementation, lazy provider chunks, no Grafana shell/SystemJS/iframe, and no Keycloak token strings in output/evidence.

## Task 7: Independent whole-branch review and focused corrections

Request a fresh-context reviewer against the clean branch baseline. Review security/session boundaries, OAuth redirect handling, logout completeness, Compose isolation, exact image/version pinning, SDK reuse, request policy, lifecycle, tests, and accidental SDK changes. Resolve justified Critical/Important findings with focused TDD, request scoped re-review, and rerun affected verification.

## Final acceptance

- The four-service stack starts from the documented container workflow and reaches healthy state.
- The actual Keycloak PKCE and Grafana Generic OAuth flows create distinct SPA and Viewer sessions.
- OIDC tokens/credentials never enter SDK configuration, transport requests, logs, or artifacts.
- The real SDK renders the Phase 2 dashboard, real native panels, real TestData, and expected placeholders in Chromium.
- Header, responsive sidebar, collapse/expand, logout, unauthorized access, and session cleanup work.
- Existing SDK tests and architectural boundaries remain green.
- No SDK package source change, extra service/datasource/backend, commit, push, PR, merge, or publication occurs.
