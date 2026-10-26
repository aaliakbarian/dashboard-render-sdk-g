# Host Transport Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Use `superpowers:test-driven-development` for every behavior change and `superpowers:requesting-code-review` for the final fresh-context whole-branch review. Do not commit; leave the completed working tree for human review.

**Goal:** Implement issue #87: a private, frontend-only, provider-neutral transport capability that wraps a trusted host executor and returns bounded, normalized results without owning authentication or performing Grafana work.

**Architecture:** `@dashboard-render-sdk-g/provider-contract` owns the inert descriptor, request, raw-response, normalized-result, executor, and capability vocabulary. `@dashboard-render-sdk-g/core` validates and snapshots descriptor metadata, validates and canonicalizes each request, invokes the trusted host executor, and normalizes cancellation, HTTP responses, malformed executor output, and unexpected failures. The capability is executable but is not registered with a runtime and creates no `RuntimeIdentity`; future provider-13 will consume it and privately adapt it to Grafana `BackendSrv`.

**Tech Stack:** TypeScript 6.0.2, Vitest 4.1.10, Yarn 4.17.1 workspaces, Node.js 22.23.3, Docker Compose, browser-standard `AbortSignal`.

**Spec:** [GitHub issue #87](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/87), `docs/architecture/production/phase1-production-architecture-decision.md`, `docs/architecture/production/bridge-provider-architecture.md`, and `docs/architecture/production/runtime-isolation-model.md`.

## Global Constraints

- Work only on `phase2/host-transport-capability`, based on `23afb5b`.
- Extend only the existing private `@dashboard-render-sdk-g/provider-contract` and `@dashboard-render-sdk-g/core` workspaces; create no package.
- Keep both packages private, experimental, `0.0.0-private`, and `AGPL-3.0-only`.
- Add no dependency and change no pinned version, package resolution, workspace layout, or lockfile content.
- Keep provider-contract and core provider-neutral. Production source must not import Grafana, Scenes, React, ReactDOM, provider-13, POC packages, RxJS, or Node-only transport implementations.
- The host executor is trusted executable configuration. Core validates data crossing the boundary but does not sandbox the executor or promise that arbitrary JavaScript Proxy traps are side-effect-free.
- Authentication, credentials, cookies, authorization-aware HTTP, proxy mapping, CORS, and redirects remain host-owned. No credential value or credential-bearing configuration field may enter the descriptor, normalized result, error, or documentation example.
- A created capability is not runtime compatibility admission, transport registration, a `RuntimeIdentity`, a runtime lease, or permission to initialize a provider.
- Do not implement Grafana API calls, `BackendSrv`, dashboard retrieval, rendering, React identity checks, retries, caching, telemetry, backend/proxy services, or Jalali behavior.
- Use Docker Compose for every Node.js, Yarn, TypeScript, Vitest, and build command. Do not install tools or dependencies on WSL and do not use unavailable `rg` or `jq`.
- Preserve existing provider-contract, core compatibility-evaluation, dependency-boundary, and Phase 0 POC behavior.
- Do not commit, push, publish, open a PR, or merge while executing this plan.

## Review Focus

- An abort that wins while the executor is pending must return `cancelled`, ignore a late response or rejection, and still attach a rejection handler so no `unhandledRejection` occurs.
- Path normalization must reject encoded separators, single- and double-encoded traversal, malformed percent escapes, absolute/protocol-relative URLs, fragments, and query text embedded in `path`, while admitting ordinary root-relative API paths.
- Credential-bearing header names must be rejected case-insensitively before executor invocation; credentials added privately by the host executor are outside the provider-facing request object.
- Throwing/revoked proxies, accessors, sparse/oversized arrays, symbol keys, and malformed executor responses must fail closed with deterministic bounded data and no raw cause or body leakage.
- HTTP 401, 403, and 500 are completed raw HTTP responses, not network failures; the future provider owns operation-specific authorization/HTTP error mapping.

## Approved Public Interfaces

Add the following provider-contract vocabulary in `packages/provider-contract/src/transport.ts` and export it from the package root:

```ts
export const HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION = 1 as const;

export type TransportMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD';

export type TransportHeader = readonly [name: string, value: string];
export type TransportQueryParameter = readonly [name: string, value: string];

export interface HostTransportDescriptor {
  readonly schemaVersion: typeof HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION;
  readonly targetOrigin: string;
  readonly basePath: string;
  readonly securityScopeId: string;
  readonly requestPolicyId: string;
}

export interface TransportRequest {
  readonly requestId: string;
  readonly method: TransportMethod;
  readonly path: string;
  readonly query?: readonly TransportQueryParameter[];
  readonly headers?: readonly TransportHeader[];
  readonly body?: string;
  readonly signal: AbortSignal;
}

export interface HostTransportResponse {
  readonly status: number;
  readonly headers: readonly TransportHeader[];
  readonly body: string;
}

export type HostTransportExecutor = (
  request: TransportRequest
) => Promise<HostTransportResponse>;

export type TransportPolicyErrorCode =
  | 'invalid-request'
  | 'path-outside-capability'
  | 'credential-header-forbidden'
  | 'host-controlled-header-forbidden'
  | 'invalid-response';

export type TransportResult =
  | {
      readonly kind: 'response';
      readonly requestId: string;
      readonly response: HostTransportResponse;
    }
  | {
      readonly kind: 'cancelled';
      readonly requestId: string;
    }
  | {
      readonly kind: 'network-error';
      readonly requestId: string;
    }
  | {
      readonly kind: 'policy-error';
      readonly requestId?: string;
      readonly code: TransportPolicyErrorCode;
    };

export interface HostTransportCapability {
  readonly descriptor: HostTransportDescriptor;
  execute(request: TransportRequest): Promise<TransportResult>;
}
```

Core owns capability-construction validation and exports:

```ts
export type HostTransportCapabilityCreationErrorCode =
  | 'invalid-descriptor'
  | 'invalid-executor';

export interface HostTransportCapabilityCreationError {
  readonly code: HostTransportCapabilityCreationErrorCode;
  readonly path: string;
  readonly message: string;
}

export type HostTransportCapabilityCreationResult =
  | {
      readonly valid: true;
      readonly capability: HostTransportCapability;
    }
  | {
      readonly valid: false;
      readonly errors: readonly HostTransportCapabilityCreationError[];
    };

export function createHostTransportCapability(
  descriptor: HostTransportDescriptor,
  executor: HostTransportExecutor
): HostTransportCapabilityCreationResult;
```

The public signature is strongly typed; runtime tests may cast hostile values through `unknown` to prove fail-closed behavior. Core does not convenience-re-export the provider-contract transport types. Callers import shared types from provider-contract and the constructor/result types from core.

## Exact Semantics

### Executor versus capability

- `HostTransportExecutor` is the trusted host-supplied function. It receives one already-normalized request and returns a raw HTTP response for every completed HTTP exchange, including 401, 403, and 500. It may throw synchronously or reject for network/runtime failure.
- `HostTransportCapability` is the provider-facing wrapper. Its `execute` method validates input, preserves the exact `requestId` value and `AbortSignal` object, and resolves to `TransportResult` for every expected outcome.
- The executor is captured in a closure and is not exposed as a capability property. The capability and its detached descriptor are frozen.
- No capability ID is generated in issue #87. Stable `transportCapabilityId` issuance and binding belong to future runtime admission.

### Descriptor identity

- `targetOrigin` is the browser-visible HTTP(S) request authority for the capability, not Grafana source provenance or observed Grafana build identity. Accept an exact origin with optional trailing `/`, reject credentials, path content beyond `/`, query, fragment, opaque origins, and non-HTTP(S) schemes, then store `new URL(value).origin`.
- `basePath` is the host mapping beneath that origin. It starts with one `/`, contains no query/fragment/backslash/encoded separator/traversal, and is stored without a trailing slash except `/` itself.
- `securityScopeId` is an opaque, non-secret host-issued identifier for the effective principal/organization/security context. It is not a username, token, cookie, credential hash, or permission proof.
- `requestPolicyId` is an opaque, non-secret host-issued version of routing/credential/request behavior. Credential rotation within the same effective policy need not change it; a materially different authority or policy must use another value.
- Both opaque IDs must be non-empty strings of at most 256 UTF-16 code units with no ASCII control characters. Core never interprets or logs their contents.
- Bound `targetOrigin` to 2,048 UTF-16 code units and `basePath` to 8,192 before parsing/normalization. Validation errors use fixed messages and paths; they never interpolate rejected values.

### Request path and query

- Root-relative request paths are capability-relative: `path` is relative to `basePath` but begins with `/`; for descriptor base `/grafana`, request path `/api/health` means the host maps to the equivalent of `<targetOrigin>/grafana/api/health`.
- `requestId` is an opaque, non-secret identifier: non-empty, at most 256 UTF-16 code units, and free of ASCII controls. Core preserves its exact value and does not assign or interpret it.
- `path` never contains a scheme/authority, leading `//`, `?`, `#`, raw backslash, encoded slash/backslash, control character, or empty interior segment.
- Bound `path` and each query name/value to 8,192 UTF-16 code units before scanning or canonicalizing them.
- Validate percent syntax, decode each segment exactly once, reject decoded `.`/`..`, and reject a decoded segment that still contains a `%HH` escape. Re-encode each decoded segment with `encodeURIComponent` to obtain the canonical path. Preserve a final slash only when supplied for a non-root path.
- Query parameters are separate logical, unencoded `[name, value]` pairs. Preserve pair order and duplicates. Validate strings, detach/freeze the tuples, and let the host executor encode each name/value exactly once when it constructs its authorized request.
- Treat an own optional `query`, `headers`, or `body` property whose value is `undefined` as omitted and omit it from the normalized request. Reject every other malformed optional-field value.
- A non-root `basePath` appearing again as the first request-path prefix is rejected as `path-outside-capability`, preventing accidental double-prefix semantics.
- The host remains the final authority for joining origin/base/path, permitted endpoints, credentials, and redirect destinations. The descriptor states the capability identity; core cannot prove that trusted executor code implements it honestly.

### Headers and bodies

- Provider-supplied headers are dense `[name, value]` tuples. Normalize names to lowercase; preserve order and duplicates.
- Header names must satisfy the HTTP token grammar. Header values must not contain CR, LF, NUL, or other ASCII control characters except horizontal tab.
- Bound each header name to 256 and each header value to 8,192 UTF-16 code units before scanning.
- Reject `authorization`, `cookie`, `proxy-authorization`, `x-api-key`, and `x-auth-token` case-insensitively as `credential-header-forbidden`. The host may add its private credentials only after this boundary.
- Reject provider control over request authority, organization/tenant scope, identity forwarding, and proxy routing as `host-controlled-header-forbidden`. The bounded provider-neutral reserved set is `host`, `origin`, `forwarded`, `x-real-ip`, `x-grafana-org-id`, `x-scope-orgid`, `x-org-id`, `x-tenant-id`, and `x-user-id`, plus every `x-forwarded-*` name. The host may add these privately and may enforce a stricter policy inside its trusted executor; core's list is a security floor, not a complete description of every deployment's policy.
- Request and response bodies are strings in contract version 1. JSON producers serialize before calling the capability; Grafana/provider code parses the raw response text. Binary, form-data, streams, chunked responses, live data, and WebSockets remain deferred.
- Bodies are opaque immutable strings: core checks their type but does not parse, log, or duplicate their content. Payload-size enforcement remains part of the host's `requestPolicyId` policy rather than an SDK-wide limit in issue #87.
- A normalized response preserves the raw status, raw string body, and all ordinary validated headers. Core removes known sensitive response headers—`set-cookie`, `set-cookie2`, `authorization`, `proxy-authorization`, `authentication-info`, and `proxy-authentication-info`—before constructing the provider-facing response. This mirrors the browser's non-exposure of `Set-Cookie` while keeping status/body semantics required by provider-13.
- Response bodies and remaining headers are trusted host-provided data; generic core validation cannot prove that they contain no credential or sensitive application data. They are returned only in a successful `response` result and are never copied into SDK-generated policy/network errors or diagnostics.

### Bounds and reflection

- Permit at most 1,024 query pairs, 1,024 request headers, and 1,024 response headers. For arrays, the own-property budget excludes the intrinsic non-enumerable `length` property: a valid dense array with indices `0` through `1023` is accepted, while index/count `1024` (1,025 entries) is rejected.
- Permit at most 1,024 own properties on each inspected record/array and return at most 100 descriptor-creation diagnostics.
- Require dense arrays and two-element dense tuple arrays. Reject unknown, symbol-keyed, non-enumerable, and accessor-backed fields.
- Inspect plain records through `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, and `Object.getPrototypeOf` inside guarded operations. Catch exceptions from throwing/revoked proxies and return typed failures. Required proxy traps may still execute; this is validation, not sandboxing.
- Require `signal` to pass the current JavaScript realm's native `AbortSignal` brand check. Catch a throwing brand/access operation as `invalid-request`; do not accept an arbitrary signal-shaped object. Cross-realm signal bridging is deferred because the approved runtime is realm-local.
- Descriptor validation order is fixed: root/schema, target origin, base path, security scope, request policy, then executor. Request validation order is request ID, method, path, query, headers, body, signal. Response validation order is status, headers, body.

### Cancellation and failure normalization

- If `signal.aborted` is already true, return `cancelled` without invoking the executor.
- Eliminate the check/listen race by checking `aborted`, registering the abort listener, and checking `aborted` again before executor invocation. An abort during listener registration returns `cancelled` and the executor is not called; an abort during executor invocation wins the result race.
- Pass the exact same signal object and request ID value in the frozen normalized request.
- Attach fulfillment and rejection handlers to the executor promise before waiting for cancellation.
- Whichever occurs first wins: a valid/malformed response, executor rejection, or the abort event. If abort wins, resolve `cancelled`; late executor fulfillment or rejection is consumed and ignored.
- Logical cancellation does not prove that a non-cooperative executor terminated underlying network work. Later dashboard-generation guards must still prevent stale publication.
- If the signal is aborted when an executor rejection is observed, return `cancelled`; otherwise return `network-error` with no raw cause, message, stack, URL, headers, or body.
- A completed HTTP exchange always returns `kind: 'response'` after response validation, regardless of status. Future provider-13 maps 401/403 and other status codes into Grafana-operation-specific errors.
- Malformed request input returns a policy error without executor invocation. Malformed executor output returns `invalid-response`. Results are fresh, detached, and deeply frozen except for the intentionally shared browser `AbortSignal`, which never appears in a result.

## Planned File Set

Create:

- `packages/provider-contract/src/transport.ts`
- `packages/provider-contract/src/transport.type-test.ts`
- `packages/core/src/hostTransport.ts`
- `packages/core/src/hostTransportValidation.ts`
- `packages/core/src/hostTransport.type-test.ts`
- `packages/core/src/hostTransport.test.ts`

Modify:

- `packages/provider-contract/src/index.ts`
- `packages/core/src/index.ts`
- `packages/core/package.json`
- `packages/core/README.md`

Expected unchanged but blocking verification inputs:

- `packages/provider-contract/src/contracts.ts`
- `packages/core/src/contracts.ts`
- `packages/provider-contract/package.json`
- root `package.json`
- `scripts/check-provider-contract-boundary.mjs`
- `scripts/check-provider-contract-boundary.test.mjs`
- `scripts/check-core-boundary.mjs`
- `scripts/check-core-boundary.test.mjs`
- TypeScript configurations, `yarn.lock`, and all POC source/tests

If implementation proves that an expected-unchanged file must change, stop and obtain review rather than widening the issue implicitly. Package-local test-script enumeration in `packages/core/package.json` is the only planned manifest edit and must not change dependencies.

## Fake-Executor Tests and Negative Test Matrix

`packages/core/src/hostTransport.test.ts` uses deterministic fake executors only; it performs no HTTP request. Tasks 2–4 cover valid descriptor snapshotting, raw 2xx/401/403/500 responses, synchronous throws, rejected promises, malformed and hostile response values, pre-abort, mid-flight abort, late resolution/rejection, path and query escape attempts, credential-bearing headers, resource limits, and safe-reflection failures. The task steps below are the authoritative assertions and RED/GREEN sequence.

---

### Task 1: Add provider-neutral transport vocabulary

**Files:**

- Create: `packages/provider-contract/src/transport.type-test.ts`
- Create: `packages/provider-contract/src/transport.ts`
- Modify: `packages/provider-contract/src/index.ts`

**Interfaces:**

- Consumes: browser-standard `AbortSignal` from the existing DOM TypeScript library configuration.
- Produces: all provider-contract symbols in **Approved Public Interfaces**.

- [ ] **Step 1: Write compile-time RED assertions**

  Add type assertions proving:

  - executor input is `TransportRequest` and its output is raw `HostTransportResponse`, never `TransportResult`;
  - capability execution returns `Promise<TransportResult>` and does not expose the executor;
  - request ID, method, path, query, headers, body, signal, descriptor, response, and result fields are readonly;
  - method, result-kind, and policy-code vocabularies are closed;
  - `AbortSignal` is required;
  - credentials, `RequestCredentials`, `fetch`, `Response`, Grafana types, runtime identity, admission, retry, cache, and observability fields are absent with `@ts-expect-error` assertions.

- [ ] **Step 2: Run provider-contract typecheck to prove RED**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  ```

  Expected: FAIL because the transport module and exports do not exist.

- [ ] **Step 3: Add the exact transport types and root exports**

  Implement only the declared types and schema-version constant. Do not add validation, fetch logic, Grafana vocabulary, a capability ID, runtime identity fields, or package dependencies.

- [ ] **Step 4: Verify GREEN and declaration separation**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract build
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-contract/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --build packages/provider-contract/tsconfig.json --pretty false --force --listEmittedFiles
  ```

  Expected: PASS; `transport.type-test.ts` is in the typecheck file list and absent from production declarations.

- [ ] **Step 5: Review checkpoint (no commit)**

  Inspect the diff for Task 1 and leave it uncommitted.

---

### Task 2: Validate and snapshot the host descriptor

**Files:**

- Create: `packages/core/src/hostTransport.type-test.ts`
- Create: `packages/core/src/hostTransport.test.ts`
- Create: `packages/core/src/hostTransportValidation.ts`
- Create: `packages/core/src/hostTransport.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `HostTransportDescriptor`, `HostTransportExecutor`, and `HostTransportCapability` from Task 1.
- Produces: `HostTransportCapabilityCreationErrorCode`, `HostTransportCapabilityCreationError`, `HostTransportCapabilityCreationResult`, and `createHostTransportCapability` exactly as specified.

- [ ] **Step 1: Write compile-time RED assertions**

  Prove the constructor accepts exactly descriptor plus executor; returns a discriminated creation result; does not export a registry, ID, `RuntimeIdentity`, admission, fetch implementation, or Grafana-specific error; and does not re-export provider-contract types from core.

- [ ] **Step 2: Write runtime RED tests for valid creation**

  Add tests named to prove:

  - a valid HTTPS descriptor and function produce `valid: true`;
  - HTTP loopback/development origins are accepted without requiring a proxy convention;
  - origin case/default ports and an optional trailing slash normalize through `URL.origin`;
  - `/grafana/` normalizes to `/grafana` and `/` remains `/`;
  - descriptor mutation after creation cannot change the capability snapshot;
  - descriptor, capability, creation result, and errors are frozen;
  - capability exposes no executor or capability ID;
  - construction never invokes the executor.

- [ ] **Step 3: Run focused tests to prove RED**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  ```

  Expected: FAIL because core transport symbols do not exist.

- [ ] **Step 4: Implement minimal descriptor creation and validation**

  Put guarded fixed-shape reflection, descriptor normalization, cloning/freezing, and resource constants in `hostTransportValidation.ts`. Put only the public result types, constructor, and capability closure in `hostTransport.ts`. Keep the executor captured privately and do not issue an ID or store global state.

- [ ] **Step 5: Add negative descriptor tests and reach GREEN**

  Cover invalid/non-HTTP origin, credentials/path/query/fragment in origin, malformed base path, traversal and ambiguous encodings, blank/oversized/control-character IDs, unknown/symbol/non-enumerable/accessor properties, non-plain prototypes, too many properties, non-function executor, throwing/revoked proxies, deterministic error order, and the 100-diagnostic cap. Assert accessors are not invoked where descriptors reveal them; do not assert that required Proxy traps never run.

  Include one-over-limit origin rejection, at-limit/one-over-limit base-path and opaque-ID tests, and ordinary valid origin normalization. Assert fixed diagnostics never echo the rejected value.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  ```

  Expected: PASS.

- [ ] **Step 6: Review checkpoint (no commit)**

  Inspect the Task 2 diff and leave it uncommitted.

---

### Task 3: Normalize requests before host execution

**Files:**

- Modify: `packages/core/src/hostTransportValidation.ts`
- Modify: `packages/core/src/hostTransport.ts`
- Modify: `packages/core/src/hostTransport.test.ts`

**Interfaces:**

- Consumes: a successfully created capability and provider-contract `TransportRequest`.
- Produces: executor invocation with one frozen, normalized request or a resolved `policy-error` without invocation.

- [ ] **Step 1: Write request-normalization RED tests**

  Cover a valid request and assert exact preservation of `requestId`, exact `signal` object identity, uppercase closed method, canonical path, ordered duplicate query pairs, lowercased headers, unchanged body, and one executor call.

- [ ] **Step 2: Write path/query negative RED tests**

  Cover relative/absolute/protocol-relative URLs, embedded query/fragment, raw and encoded backslashes/separators, malformed percent syntax, raw/encoded/double-encoded traversal, control characters, empty interior segments, repeated non-root base prefix, sparse/oversized query arrays, malformed tuples, accessors, symbols, proxies, and unknown request properties. Assert `path-outside-capability` only for target/base escape semantics and `invalid-request` for malformed request shape.

  Also prove that explicit `undefined` for each optional request field is canonicalized as omission, while nonconforming defined values fail without executor invocation.

  Include at-limit/one-over-limit tests for request ID, path, and query components. Verify opaque body strings are not parsed or reflected in policy results.

- [ ] **Step 3: Write header/security negative RED tests**

  Cover invalid token names, CR/LF/NUL/control values, sparse/oversized arrays, malformed tuples, and every forbidden credential header with mixed casing. Assert the executor is never called and no credential value appears in the result.

  Cover the exact host-controlled header set, representative mixed-case `X-Grafana-Org-Id`, and the `x-forwarded-*` prefix. Assert `host-controlled-header-forbidden`, no executor invocation, and no rejected value in the result. Prove an unrelated `x-*` application header remains allowed so the security floor does not become a blanket vendor-header ban.

  Include at-limit/one-over-limit header-name and header-value tests. Use dense request query/header arrays of exactly 1,024 entries to prove that array `length` is excluded from the own-property budget, and 1,025-entry arrays to prove rejection.

  Cover a signal-shaped plain object, throwing signal access, and a valid same-realm native `AbortSignal`; only the native signal reaches the executor.

- [ ] **Step 4: Run focused tests to prove RED**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  ```

  Expected: FAIL on the new request behavior.

- [ ] **Step 5: Implement fixed-order request validation and normalization**

  Reuse the guarded reflection helpers from Task 2. Validate in the documented order, construct a new request object and new tuple arrays, freeze them, preserve only the exact original signal object, and invoke no URL/network API. Do not concatenate origin/base/path; that remains the trusted host executor's responsibility.

- [ ] **Step 6: Verify GREEN**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  ```

  Expected: PASS.

- [ ] **Step 7: Review checkpoint (no commit)**

  Inspect the Task 3 diff and leave it uncommitted.

---

### Task 4: Normalize responses, failures, and cancellation

**Files:**

- Modify: `packages/core/src/hostTransportValidation.ts`
- Modify: `packages/core/src/hostTransport.ts`
- Modify: `packages/core/src/hostTransport.test.ts`

**Interfaces:**

- Consumes: normalized request plus the trusted raw `HostTransportExecutor`.
- Produces: `Promise<TransportResult>` with race-safe cancellation and detached response data.

- [ ] **Step 1: Write raw-response RED tests**

  Verify valid 200, 401, 403, and 500 responses all remain `kind: 'response'` with exact status and request ID; ordinary response headers normalize/detach/freeze; body remains raw text; and future Grafana-specific error names do not appear. Include each known sensitive response header and prove it is absent from the normalized response without changing the HTTP result, status, or body. State in the test name that this is bounded known-header filtering, not proof that host response data is credential-free.

  Use dense response-header arrays of exactly 1,024 entries to prove acceptance when intrinsic array `length` is excluded from the own-property budget, and 1,025 entries to prove `invalid-response`.

- [ ] **Step 2: Write malformed-response and executor-failure RED tests**

  Cover status outside integer 100–599, missing/unknown/accessor/symbol fields, invalid/sparse/oversized headers, non-string body, throwing/revoked proxy responses, synchronous throw, arbitrary rejection, `Error` containing a secret URL/token, and a throwing thenable. Expect `invalid-response` or `network-error` without raw causes, messages, headers, bodies, or credentials.

- [ ] **Step 3: Write cancellation RED tests**

  Verify:

  - a pre-aborted signal returns `cancelled` without executor invocation;
  - abort triggered immediately after listener registration but before executor invocation returns `cancelled` without invoking the executor;
  - abort triggered synchronously inside executor invocation, before its promise is returned, wins while the returned promise is still observed;
  - the executor receives the exact signal and request ID;
  - abort before executor settlement wins over a later valid response;
  - abort before a later rejection wins and creates no unhandled rejection;
  - executor rejection observed after the signal is aborted is `cancelled`;
  - response/rejection that settles before a later abort retains its completed result;
  - abort listeners are removed after every terminal path;
  - logical cancellation makes no claim that a non-cooperative executor stopped its underlying operation.

- [ ] **Step 4: Run focused tests to prove RED**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  ```

  Expected: FAIL on response/cancellation behavior.

- [ ] **Step 5: Implement one-settlement execution**

  Check abort, subscribe once, check abort again, then invoke the executor. Attach executor fulfillment and rejection handlers immediately, settle exactly once, consume late executor settlement, remove the listener, normalize/copy/freeze response data, filter the bounded sensitive-response-header set, and expose no raw cause. Do not implement timeouts, retries, caches, request supersession by ID, or network cancellation beyond passing the signal.

- [ ] **Step 6: Verify GREEN and repeat deterministically**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/core/src/hostTransport.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  ```

  Expected: both test runs and typecheck pass with no unhandled-rejection warning.

- [ ] **Step 7: Review checkpoint (no commit)**

  Inspect the Task 4 diff and leave it uncommitted.

---

### Task 5: Integrate package tests and document the boundary

**Files:**

- Modify: `packages/core/package.json`
- Modify: `packages/core/README.md`

**Interfaces:**

- Consumes: complete host transport capability from Tasks 1–4.
- Produces: package-local test orchestration and durable usage/security documentation.

- [ ] **Step 1: Add the focused suite to the core unit command**

  Append `packages/core/src/hostTransport.test.ts` to the existing explicit Vitest file list. Change no dependency, version, or other manifest field.

- [ ] **Step 2: Document trusted host execution and normalized provider use**

  Add a concise non-Grafana example showing descriptor + fake host executor + creation-result narrowing + capability execution. State:

  - credentials/cookies/tokens remain host-private;
  - path is relative to basePath and query is separate;
  - executor returns raw HTTP responses while capability returns normalized results;
  - 401/403/500 remain responses;
  - cancellation may be logical if host work is non-cooperative;
  - capability creation is not runtime admission and no capability ID is issued;
  - binary/streaming, provider-13, dashboard APIs, retries/caches, and runtime binding remain deferred.

  Preserve the future React-first/Jalali section and do not add a runnable SDK/dashboard claim.

- [ ] **Step 3: Run package-local regressions**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract build
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: all pass.

---

### Task 6: Prove dependency boundaries and repository regressions

**Files:**

- Verify unchanged: `scripts/check-provider-contract-boundary.mjs`
- Verify unchanged: `scripts/check-provider-contract-boundary.test.mjs`
- Verify unchanged: `scripts/check-core-boundary.mjs`
- Verify unchanged: `scripts/check-core-boundary.test.mjs`
- Verify unchanged: root `package.json`, `yarn.lock`, TypeScript configurations, and POC source/tests

**Interfaces:**

- Consumes: final source graph from Tasks 1–5.
- Produces: verification evidence only.

- [ ] **Step 1: Run immutable install and both boundary regression suites/guards**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-core-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
  ```

  Expected: all pass. Existing guards continue covering imports, type imports, re-exports, dynamic/CommonJS loading, triple-slash references, effective TypeScript roots, compiler plugins/helpers/types, paths/baseUrl redirection, and dependency metadata.

- [ ] **Step 2: Confirm type-test inclusion and declaration separation**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-contract/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/core/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --build packages/provider-contract/tsconfig.json packages/core/tsconfig.json --pretty false --force --listEmittedFiles
  ```

  Expected: both new type-test files appear in effective typecheck programs; no `.test` or `.type-test` artifact is emitted. Declarations expose only the planned contract/core symbols and no Grafana/React/POC type.

- [ ] **Step 3: Run root and POC regressions**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc
  ```

  Expected: all pass; existing React/Scenes peer warnings remain visible and unchanged. Browser/E2E rendering is not required because issue #87 neither changes nor invokes browser networking or rendering.

- [ ] **Step 4: Inspect scope, untracked files, whitespace, secrets, and dependency drift**

  ```sh
  git status --short
  git diff --stat
  git diff --check
  git ls-files --others --exclude-standard
  git diff -- package.json yarn.lock packages/provider-contract/package.json packages/core/package.json
  grep -RInE '(@grafana/|@grafana/scenes|provider-13|poc-compat|react-dom|from ["'"']react["'"']|GrafanaApp|BackendSrv|Authorization:|Bearer |service.?account|password|token)' packages/provider-contract/src packages/core/src packages/core/README.md || true
  ```

  Expected: only planned files changed/untracked; the core manifest diff is test-script-only; no lock/dependency drift, forbidden production import, embedded credential, or implementation beyond issue #87.

---

### Task 7: Request independent whole-branch review

**Files:**

- Review all tracked and untracked changes relative to `23afb5b`.
- Modify files only if the reviewer reports a justified Critical or Important finding and the correction remains within issue #87.

**Interfaces:**

- Consumes: verified issue #87 working tree.
- Produces: independent verdict and any focused TDD remediation evidence.

- [ ] **Step 1: Request a fresh-context review**

  Use `superpowers:requesting-code-review`. Ask the reviewer to inspect actual tracked and untracked files and focus on:

  - host executor versus normalized capability separation;
  - path/query canonicalization and target/base escape cases;
  - credential-header and secret/cause leakage boundaries;
  - pre-abort, mid-flight race, late fulfillment/rejection, and listener cleanup;
  - proxy/reflection/resource-limit safety and deterministic failures;
  - raw HTTP status preservation versus transport failure normalization;
  - descriptor/result detachment and immutability;
  - absence of runtime admission, Grafana/React coupling, backend/auth implementation, or dependency-boundary weakening.

- [ ] **Step 2: Resolve only justified blocking findings through focused TDD**

  For each Critical or Important finding, first reproduce it with a failing compile-time/runtime test, implement the smallest in-scope correction, and rerun the affected focused plus boundary suites. Do not broaden into dashboard retrieval or runtime admission.

- [ ] **Step 3: Run final verification after remediation**

  Rerun Tasks 5 and 6, then report exact changed/untracked files, final APIs, RED/GREEN evidence, commands/results, reviewer verdict, deviations, risks, `git status --short`, and diff summary. Leave everything uncommitted.

## Acceptance Criteria Mapping

| Issue #87 requirement | Plan evidence |
| --- | --- |
| Neutral transport types compile | Task 1 compile-time RED/GREEN and declarations |
| Executor separate from capability | Public interfaces, Task 1 type tests, Tasks 2/4 behavior |
| Descriptor validated and detached | Task 2 positive/hostile tests and frozen snapshot |
| Root-relative path and separate query semantics | Exact semantics and Task 3 matrix |
| Reject absolute/protocol-relative/traversal/ambiguous paths | Task 3 path negatives |
| Host owns destination, redirects, credentials, authentication | Global constraints, descriptor semantics, README |
| Request ID and exact AbortSignal preserved | Tasks 3–4 identity assertions |
| Pre-abort avoids execution | Task 4 cancellation tests |
| Cancellation wins over late executor settlement | Task 4 race and unhandled-rejection tests |
| Provider credential headers rejected | Task 3 mixed-case credential matrix |
| Provider cannot control host organization/tenant/forwarding/routing headers | Task 3 host-controlled-header matrix |
| HTTP 401/403/500 preserved | Task 4 raw-response tests |
| Known sensitive response headers do not cross the provider boundary | Task 4 bounded filtering tests |
| Unexpected executor failure hides raw cause | Task 4 secret-bearing error tests |
| Malformed executor output rejected | Task 4 response-shape/proxy tests |
| Resource bounds and safe reflection | Tasks 2–4 limits, arrays, accessors, proxy tests |
| Array limit excludes intrinsic `length` and accepts exactly 1,024 entries | Tasks 3–4 boundary tests |
| No Grafana error/API/runtime coupling | Contract shape, Task 6 guards, review |
| Existing package and POC regressions pass | Tasks 5–6 |
| Independent review completed | Task 7 |

## Deferred Responsibilities

- assigning or binding a stable `transportCapabilityId`;
- adding transport/security fields to `RuntimeIdentity`;
- one-capability-per-realm conflicts and provider runtime admission;
- server-version probing, Grafana API discovery, dashboard retrieval, DTO decoding, and API-specific errors;
- provider-13 endpoint construction and `BackendSrv`/RxJS adaptation;
- React object-identity admission, runtime initialization, leases, dashboard generations, and stale-publication guards;
- host authentication UI, credential/token storage, refresh, login, proxy implementation, and redirect implementation;
- automatic retries, timeouts, caching, ETags, observability sinks, and request-ID supersession;
- binary/form-data/streaming/chunked/live/WebSocket transport;
- dashboard rendering, sessions, component APIs, and Jalali calendar behavior.

## No Material Architectural Conflict

Issue #87 fills the transport interface already assigned to provider-contract by Phase 1 and the validation/normalization boundary assigned to core. It does not change the merged manifest validator, pure compatibility evaluator, or minimal `RuntimeIdentity`. Its executor is trusted host-owned authority, while its provider-facing capability is the normalized project-owned boundary. Runtime admission remains a later, separate workstream.

## Final Implementation Handoff

After execution, report:

- exact changed and untracked files;
- final provider-contract and core exports;
- descriptor/request/response limits and validation semantics;
- executor/capability separation;
- cancellation race and late-settlement evidence;
- HTTP/error/credential-boundary evidence;
- compile-time and runtime RED/GREEN evidence;
- package/dependency/boundary and root regression results;
- independent-review findings and verdict;
- deviations, remaining risks, and open questions;
- `git status --short` and complete diff inventory;
- recommended commit message and PR title.

Leave everything uncommitted for review.
