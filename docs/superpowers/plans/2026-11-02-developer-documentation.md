# Developer Documentation and README Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current private Phase 2 SDK and standalone demo understandable and reproducible for a new React developer without changing runtime behavior.

**Architecture:** Documentation is derived from the shipped `core`, `provider-13`, standalone demo, support matrix, and licensing gate. The root README provides the short orientation, the integration guide owns the complete host contract, and the demo README owns the runnable authenticated reference workflow.

**Tech Stack:** Markdown, React 19.2.8, TypeScript, Docker Compose, Grafana OSS 13.2.3, Scenes 8.13.5.

**Spec:** `docs/architecture/production/phase-2-native-rendering-support.md`

## Global Constraints

- Documentation-only: do not change SDK runtime behavior, package manifests, dependencies, authorization logic, renderers, or services.
- Describe only the exact Grafana OSS 13.2.3 / V1 schema 42 / React 19.2.8 / ReactDOM 19.2.8 / Scenes 8.13.5 compatibility cell.
- Name exactly the eight verified native panels: Text, Stat, Time series, Table, Gauge, Bar gauge, Pie chart, and Bar chart.
- Do not claim general Grafana compatibility, pixel-perfect parity, public package availability, production readiness, or completion of issue #65.
- Keep authentication, credentials, authorized HTTP execution, routing, redirects, and organization context host-owned.
- Preserve the current publication block and link the implemented #64 notice gate and pending #65 source-availability/reproducibility/SBOM gate.
- Run Node, Yarn, TypeScript, Vitest, build, and browser tooling only through Docker Compose.
- Do not commit, push, create a PR, merge, close issues, or publish.

## Review Focus

- A new developer copies the integration example: imports, opaque React identities, transport descriptor, executor result, provider, renderer, status callback, and teardown must match exported APIs.
- A developer interprets the support list as broad compatibility: every panel and datasource claim must be bounded to the support matrix's exact fixture profiles.
- A developer follows the auth example: the browser must use an independently established Grafana cookie session and must never pass OIDC tokens or credentials into the SDK.
- A contributor runs the demo: Compose paths, loopback URL, development-only credentials, startup/reset/shutdown commands, and four-service flow must match checked-in configuration.
- A release reader interprets notices as publication approval: the docs must retain the unresolved legal-review block and identify #65 as a separate gate.

---

### Task 1: Refresh the root developer entry point

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `packages/core/src/index.ts`, `packages/provider-13/src/index.ts`, `docs/architecture/production/phase-2-native-rendering-support.md`, `docs/development/third-party-licensing.md`.
- Produces: a concise project orientation that links to the detailed integration and demo guides.

- [ ] **Step 1: Run the README acceptance scan and confirm RED**

Run a read-only Node check that expects all eight panel names, current exact versions, a standalone demo quick-start, SDK integration guidance, issue #64/#65 status, and no obsolete “three-panel POC/current POC boundary” wording.

Expected: FAIL because the current README still describes only Text, Stat, and Time series and directs contributors to “Run the POC.”

- [ ] **Step 2: Rewrite `README.md` for the current Phase 2 state**

Keep the project purpose prominent; describe the private experimental SDK, eight-panel compatibility cell, frontend-only host contract, demo quick-start, concise verified React usage, container-first development/testing, architecture links, publication block, and explicit limitations.

- [ ] **Step 3: Run the README acceptance scan again**

Expected: PASS with every required statement and no stale three-panel POC claim.

### Task 2: Add the complete SDK integration guide

**Files:**
- Create: `docs/development/sdk-integration.md`

**Interfaces:**
- Consumes: public exports from `@dashboard-render-sdk-g/core`, `@dashboard-render-sdk-g/provider-13`, and `@dashboard-render-sdk-g/provider-contract`; proven host patterns in `apps/sdk-host/src/App.tsx` and `demo/standalone/src/transport.ts`.
- Produces: a complete host-owned React and transport integration example used by the README.

- [ ] **Step 1: Run the integration-guide acceptance scan and confirm RED**

Expected: FAIL because `docs/development/sdk-integration.md` does not exist.

- [ ] **Step 2: Write the guide using only current exports**

Document private-workspace prerequisites; exact versions; host React identity construction; a fail-closed host executor with a narrow request policy, cookie credentials, redirect rejection, and sensitive response-header filtering; capability and SDK creation; UID state changes; `onStatusChange`; unsupported/error behavior; unmount cleanup; and auth/session responsibilities.

- [ ] **Step 3: Typecheck the guide's complete TSX example in the development container**

Extract the marked complete example to ignored scratch space using a Node script, compile it with the repository TypeScript configuration and current workspace exports, and confirm no diagnostics. Do not add a package install command or unpublished-package claim.

Expected: PASS.

### Task 3: Make the standalone demo guide task-oriented

**Files:**
- Modify: `demo/standalone/README.md`

**Interfaces:**
- Consumes: `demo/standalone/compose.yaml`, `.env.example`, `src/authSession.ts`, `src/transport.ts`, the realm import, and Playwright configuration.
- Produces: the canonical quick-start, auth-flow, reset, testing, and troubleshooting guide for the reference app.

- [ ] **Step 1: Run the demo-guide acceptance scan and confirm RED**

Expected: FAIL because the current guide lacks an explicit common-troubleshooting section and compact stop-versus-reset guidance.

- [ ] **Step 2: Refine `demo/standalone/README.md`**

Preserve verified commands and security detail while clarifying prerequisites, four services, startup/URL/development credentials, Keycloak login plus independent Grafana Viewer session, eight-panel dashboard, sidebar behavior, stop/reset choices, Chromium verification, and concrete troubleshooting for build time, stale realm data, login loops, port conflicts, and missing pinned source.

- [ ] **Step 3: Validate commands against Compose configuration**

Run `docker compose -f demo/standalone/compose.yaml config` and static checks that the documented service names, URL, credentials, UID, and commands match checked-in files.

Expected: PASS.

### Task 4: Documentation integrity and regression verification

**Files:**
- Verify: `README.md`
- Verify: `demo/standalone/README.md`
- Verify: `docs/development/sdk-integration.md`
- Verify: `docs/superpowers/plans/2026-11-02-developer-documentation.md`

**Interfaces:**
- Consumes: all documentation produced by Tasks 1–3.
- Produces: fresh validation evidence and a reviewable uncommitted tree.

- [ ] **Step 1: Validate Markdown structure and local links**

Use a repository-local Node check to inspect all changed Markdown links, headings, code fences, trailing whitespace, and final newlines. HTTP links are syntax-checked only; no network dependency is required.

Expected: PASS.

- [ ] **Step 2: Scan claims and secrets**

Confirm exact versions/panel set, private publication status, host-owned auth, development-only credential labels, #64/#65 wording, and absence of real credentials or general compatibility claims.

Expected: PASS.

- [ ] **Step 3: Run container-first regressions**

Run immutable install, root typecheck, root unit tests, standalone demo typecheck/unit tests, provider/core boundary guards, licensing validation, and production SDK build/bundle inspection using the existing Compose development container.

Expected: every command exits 0; existing peer warnings remain visible rather than suppressed.

- [ ] **Step 4: Run Git hygiene checks**

Run `git diff --check`, review `git diff --stat`, and inventory tracked and untracked changes.

Expected: only the four planned documentation files are changed/untracked.

- [ ] **Step 5: Request a fresh-context whole-branch review**

Review issue #109 requirements against the actual working tree, exports, support matrix, demo configuration, and licensing state. Resolve all justified Critical and Important findings, rerun affected verification, and leave changes uncommitted.

