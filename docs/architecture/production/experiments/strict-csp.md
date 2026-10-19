# Strict CSP Compatibility Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Strict CSP compatibility (GitHub issue #42) |
| Status | Bounded technical experiment complete |
| Created | 2026-10-17 |
| Last Updated | 2026-10-17 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime cell | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Emotion cell | `@emotion/react` and `@emotion/cache` 11.14.0; `@emotion/css` 11.13.5 |
| Provider baseline | Experiment E provider; issue #40 scoped light DOM; issue #41 Emotion ownership; issue #43 controlled portal; issue #44 local assets |
| Final status | **PASS** |

This report uses the canonical terminology from the
[project roadmap](../../../project/roadmap.md). Generated evidence under
`artifacts/experiments/strict-csp/` is ignored. This is a tested compatibility
profile for one browser/provider cell, not a claim about arbitrary host CSPs,
Grafana versions, browsers, panels, or datasources.

## 2. Hypothesis

The production-shaped renderer provider can operate under an enforced,
production-oriented CSP without `unsafe-eval`, `unsafe-inline`, remote script
or asset origins, a public CDN, an iframe, Grafana's application shell, or
uncontrolled style and portal insertion.

The hypothesis passed for the verified provider cell. Real Text, Stat with
TestData, transformed Time series, Grafana Popover and Modal, local fonts and
SVG, root and nested paths, offline execution, UID replacement, resize,
unmount/remount, and two compatible dashboards all remained functional.

## 3. Predeclared criteria

All 32 predeclared PASS criteria were retained. The final test ran with a
`Content-Security-Policy` response header in enforcement mode against static
production builds. Supported-path `SecurityPolicyViolationEvent` capture was
empty in root, nested/offline, and lifecycle probes.

The first enforced run exposed a caught Zod dynamic-code capability probe.
That was treated as a real violation, not ignored because the library caught
the exception. The provider now requires the realm-level Zod `jitless`
configuration before its dependency graph evaluates. After that ordering fix,
all criteria passed without adding `unsafe-eval` or relaxing another
directive.

Targeted predecessor regressions also passed:

| Baseline | Regression evidence |
| --- | --- |
| Issue #40 | Six hostile CSS profiles with real panels |
| Issue #41 | Three distinct Emotion owners in the host-first profile |
| Issue #43 | Controlled Popover portal and real Grafana Modal |
| Issue #44 | Root, nested, and offline local-asset profiles |
| Experiment E | Eight browser admission/behavior cases and seven unit/bundle contract cases |

## 4. CSP surface inventory

| Surface | Classification | Directive / evidence |
| --- | --- | --- |
| Script | **USED** | Same-origin host, provider, and lazy chunks; `script-src 'self'` |
| Style element | **USED** | Same-origin extracted CSS and nonce-authorized Emotion tags |
| Style attribute | **USED (CSSOM PROPERTY OUTPUT)** | Provider uses CSSOM property assignment; explicit inline style attributes are rejected by `style-src-attr 'none'` |
| Font | **USED** | Local Inter Regular and Medium; `font-src 'self'` |
| Image / SVG | **USED** | Local Grafana `times.svg`; `img-src 'self'` |
| Connect / fetch | **USED** | Same-origin dashboard APIs and `/grafana/api/ds/query`; `connect-src 'self'` |
| Worker | **NOT USED** | `worker-src 'none'` |
| Frame | **NOT USED** | `frame-src 'none'`; no iframe exists |
| Object | **NOT USED** | `object-src 'none'` |
| Media | **NOT USED** | `media-src 'none'` |
| Base URI | **NOT USED** | `base-uri 'none'` |
| Form action | **NOT USED** | `form-action 'none'` |
| Blob URL | **NOT USED** | No `blob:` source or request |
| Data URL | **NOT USED** | No `data:` source or request |
| Inline event handler | **DIAGNOSTIC ONLY** | Negative probe rejected by `script-src-attr 'none'`; provider DOM has none |
| Eval / `Function` | **DIAGNOSTIC ONLY** | Negative probe rejected; supported path emits no violation |

The classification describes runtime use in this cell. Static dependency code
can contain dormant branches that are never executed; those are discussed in
the script-policy section.

## 5. Initial policy

The enforced candidate was generated with a fresh base64url nonce for each
HTML response:

```text
default-src 'none';
script-src 'self' 'report-sample';
script-src-attr 'none';
style-src 'self' 'nonce-<per-response-nonce>';
style-src-elem 'self' 'nonce-<per-response-nonce>';
style-src-attr 'none';
font-src 'self';
img-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-src 'none';
frame-ancestors 'none';
worker-src 'none';
media-src 'none';
form-action 'none'
```

`report-sample` supplies diagnostic text for blocked script probes; it grants
no execution authority. The profile contains no `unsafe-eval`,
`unsafe-inline`, `strict-dynamic`, `data:`, `blob:`, public origin, wildcard,
or WebSocket source.

## 6. Script policy

**PASS.** All executable host/provider code is self-hosted external JavaScript.
The build retains independently lazy Text, Stat, Time series, and TestData
features. Hashed chunks load under `script-src 'self'`; no runtime-created
script tag, import map, SystemJS lookup, blob script, arbitrary import URL, or
remote script origin was observed.

Bundle inspection found zero provider-owned React, ReactDOM, JSX-runtime, or
JSX-dev-runtime implementation modules. The host build retains one owner for
all four categories, and runtime admission reports one React 19.2.8 and one
ReactDOM 19.2.8 object identity.

The experiment adds one same-origin external prelude before the host module.
It sets Zod's documented realm-shared `__zod_globalConfig.jitless` flag before
the provider module graph can evaluate. The same setting is applied
idempotently at the provider entry as a defensive assertion. This ordering is
a provider environmental contract candidate, not a request for
`unsafe-eval`.

Static bundle inspection still finds dormant `Function`-constructor source in
third-party code, including Zod's guarded capability probe and Lodash's
browser-global fallback. Runtime enforcement is decisive for this cell: the
Zod branch is disabled before import, the Lodash fallback is not selected in
the browser realm, and no supported-path violation occurs. Production builds
must retain a static dynamic-code audit and enforcement test; a future change
that executes such a branch fails admission/testing.

## 7. Inline event policy

**PASS.** A complete DOM scan found no attribute whose name starts with `on`.
React's delegated event listeners work under `script-src-attr 'none'` because
they are not inline event-handler attributes. A harness-created `onclick`
attribute was blocked and did not execute.

## 8. Host nonce ownership

The experiment server generates a cryptographically random nonce per HTML
response, places it in the CSP response header, and supplies the same value to
the host through server-rendered page metadata. The host validates the value
and passes it to the provider before provider style initialization.

The provider neither invents a nonce nor sets the HTTP policy. A conflicting
second nonce in the same realm is rejected. In Phase 2, nonce delivery is a
host integration contract: server/framework-specific transport may differ,
but the current response nonce must be available before provider admission.

## 9. Host `@emotion/react` nonce result

**PASS.** The independently owned `grsdk-host` cache receives the response
nonce at creation. Its emitted style tag reports that nonce through the DOM
nonce property and is accepted by the enforced policy.

## 10. Provider `@emotion/react` nonce result

**PASS.** The independent `grsdk-provider` cache is created with the same
response nonce before provider components render. Its cache object, key, style
tag, and rule ownership remain distinct from the host cache and the Grafana
`@emotion/css` singleton.

## 11. `@emotion/css` nonce result

**PASS WITH AN EXPLICIT PRE-EMISSION CONTRACT.** Grafana's default
`@emotion/css` singleton retains key `css`; it was not replaced with a custom
instance. Before Grafana UI can emit a rule, the provider sets the singleton
cache and sheet nonce, rejects any pre-existing tag with a different nonce,
and records the realm's configured nonce.

The resulting `data-emotion="css"` tag carried the current response nonce and
was accepted. This seam depends on current `@emotion/css` behavior and must be
conformance-tested on every cohort upgrade. `CacheProvider` alone does not own
this path.

## 12. Style element policy

**PASS.** Extracted CSS uses same-origin `<link>` elements. Dynamic host
Emotion, provider Emotion, and Grafana `@emotion/css` style elements all carry
the per-response nonce. A harness style element with a wrong nonce was blocked
and did not affect computed style.

No blanket style-element `unsafe-inline` is required. Browser nonce values
must be inspected through the `HTMLStyleElement.nonce` property because
browsers intentionally hide them from `getAttribute('nonce')`.

## 13. Style attribute policy

**PASS WITH `style-src-attr 'none'`.** The real provider rendered panels,
Floating UI placement, portal layer variables, modal behavior, and responsive
resize with this directive. Portal and plot code use DOM CSSOM property
assignment; Chromium did not classify those operations as authorized inline
style attributes and emitted no violation.

A harness `setAttribute('style', ...)` probe was blocked and did not change
computed style. The candidate therefore needs neither style-attribute
`unsafe-inline` nor a style-attribute hash. This result is browser-specific
evidence, not a universal statement about all engines or future dependencies.

## 14. Font policy

**PASS.** The local issue #44 Inter Regular and Medium WOFF2 files loaded under
`font-src 'self'`. Both were available through `document.fonts`; no remote
font origin or data URL was requested. A public-origin font probe was blocked
and generated an enforced `font-src` violation.

## 15. Image/SVG policy

**PASS.** The packaged Grafana `times.svg` used by Modal loaded from the
configured same-origin provider base under `img-src 'self'`. No `data:` or
public image origin was needed. A public-origin image probe was blocked and
generated an enforced `img-src` violation.

## 16. Connect policy

**PASS.** Dashboard discovery, V1 DTO retrieval, frontend settings, and real
TestData `/grafana/api/ds/query` traffic all use the host's same-origin
transport and pass `connect-src 'self'`. No WebSocket, EventSource, HMR
connection, CDN, or public API origin is allowed in the production profile. A
public-origin fetch probe was blocked.

Cross-origin production Grafana deployments need a separately reviewed host
CSP and CORS/authentication profile; this experiment proves the same-origin or
host-proxied path only.

## 17. Portal result

**PASS.** Issue #43's intentional, marked, reference-counted body child is
acquired before overlays open. Real Grafana Popover and Modal retain provider
context and Emotion styling. Floating placement, portal CSSOM styles, modal
inert behavior, Escape, and cleanup work without a CSP violation. Direct
`document.body` fallback remains forbidden.

This experiment revalidates CSP behavior only; it does not reopen focus,
accessibility, or z-index policy.

## 18. Root deployment

**PASS.** The root static build rendered real Text, Stat/TestData, and
transformed Time series, opened Popover and Modal, loaded local fonts and SVG,
and completed real Grafana requests with zero supported-path violations.

## 19. Nested deployment

**PASS.** The same provider ran beneath `/app/sdk/`. Host chunks, provider
chunks, CSS, WOFF2, SVG, and the pre-import CSP prelude resolved beneath the
nested base. No root-only exception was added.

## 20. Offline deployment

**PASS.** The nested browser profile aborted every non-localhost request. The
blocked list stayed empty because no public request was attempted. Local host
and provider assets plus the local Grafana transport remained sufficient.

## 21. Report-only diagnostics

Report-only mode was not needed. Diagnostics began directly under enforcement
mode so blocked behavior could not be mistaken for a supported path. Violation
events and console messages were captured during failure investigation and the
negative harness.

## 22. Enforcement result

**PASS.** The response contains `Content-Security-Policy`, not only a meta tag
or `Content-Security-Policy-Report-Only`. The server sets the header on the
HTML and experiment static responses. Root, nested/offline, and lifecycle
supported paths produced zero policy violations and zero console/page errors.

## 23. Violation evidence

The initial supported-path failure was:

- directive: `script-src`;
- blocked URI: `eval`;
- source: the provider Grafana cohort chunk; and
- sample: an empty anonymous `Function` constructor.

Source-to-runtime tracing identified Zod's cached `allowsEval` probe. The
probe explicitly documents `jitless` as the strict-CSP opt-out. Configuring it
before provider imports removed the violation without policy relaxation.

Final supported paths observed zero violations. Negative evidence contains
only directive, blocked category/URI, source where meaningful, disposition,
and a short browser-provided sample. It contains no cookies, request headers,
credentials, dashboard bodies, or query payloads.

## 24. Negative tests

| Probe | Enforced directive | Result |
| --- | --- | --- |
| Style element with wrong nonce | `style-src-elem` | Blocked; rule not applied |
| Explicit style attribute | `style-src-attr` | Blocked; declaration not applied |
| Inline script | `script-src-elem` | Blocked; global sentinel unchanged |
| Inline event handler | `script-src-attr` | Blocked; handler did not run |
| Public image | `img-src` | Blocked |
| Public font | `font-src` | Blocked |
| Public fetch | `connect-src` | Blocked/rejected |
| `Function` constructor | `script-src` | Blocked before execution |

All negative events reported `disposition="enforce"`. These probes belong to
the harness and do not modify provider source.

## 25. `unsafe-eval` result

**NOT REQUIRED.** The candidate omits `unsafe-eval`; the deterministic
`Function` probe is blocked. The one real dependency probe discovered during
development is disabled through Zod's supported pre-import `jitless` setting.
Any future runtime violation is a compatibility failure, not a reason to add
`unsafe-eval` automatically.

## 26. `unsafe-inline` result

The three concerns remain separate:

- scripts: no `unsafe-inline`; all scripts are self-hosted external files;
- style elements: no `unsafe-inline`; extracted CSS is same-origin and dynamic
  style tags carry the response nonce; and
- style attributes: no `unsafe-inline`; explicit style attributes are denied.

The verified profile therefore contains no `unsafe-inline` token at all.

## 27. Multiple-dashboard result

**PASS.** Two compatible dashboards share one admitted provider runtime, one
Grafana cohort, one nonce configuration, shared plugin/datasource caches, and
one controlled portal root. Their scene, query, ResizeObserver, and overlay
lifecycles remain independent. Removing one leaves the other active; final
release leaves no portal child or instance resource.

## 28. Lifecycle result

**PASS.** The tested sequence covered initial mount, lazy panel and TestData
loads, real queries, portal open/close, main-to-alternate UID replacement and
back, resize with plot adaptation, a second dashboard, removal of one owner,
provider unmount, resource release, remount, and cache reuse. No later dynamic
behavior added a violation.

The browser evidence reports zero retained instance-scoped observers,
subscriptions, timers, portal children, scenes, or runtime leases after the
release checkpoint. Full production integration lifecycle remains issue #45.

## 29. Initial Phase 2 CSP profile

The policy in section 5 is the initial Phase 2 **host compatibility profile**
for the exact tested cell. It is not an HTTP header set by the SDK. Hosts may
add unrelated sources for their own application, but provider support depends
on preserving at least:

- same-origin executable host/provider chunks;
- a per-response nonce accepted for provider dynamic style elements;
- same-origin packaged fonts and images;
- the selected same-origin Grafana transport path; and
- denial of inline handlers, explicit style attributes, eval, frames, objects,
  workers, media, base changes, and form submission for this capability set.

If a host deploys provider assets or Grafana transport on another origin, its
explicit CSP sources and the provider compatibility manifest must describe and
test that deployment. No broad wildcard is implied.

## 30. Required host contract

The host must:

1. generate and deliver the current response nonce;
2. apply the enforced CSP response header;
3. supply the nonce before provider admission/style initialization;
4. execute the same-origin Zod jitless prelude before loading the provider
   graph, or provide an equivalently ordered external bootstrap;
5. serve host/provider chunks, extracted CSS, fonts, and SVG from declared
   CSP-compatible origins;
6. provide the same-origin or explicitly authorized Grafana transport;
7. continue owning React/ReactDOM and satisfy Experiment E identity admission;
8. configure the provider asset base before Grafana UI evaluates; and
9. retain the controlled portal-root and three-cache ownership contracts.

The production provider should validate missing, late, or conflicting nonce
configuration before Grafana singleton initialization.

## 31. Limitations

- Chromium is the only enforced browser in this experiment.
- The result covers Grafana 13.2.3, React/ReactDOM 19.2.8, Scenes 8.13.5,
  Text, Stat, Time series, TestData, `renameByRegex`, and the tested overlays.
- It does not cover editors, Monaco/Codicons, workers, Live/WebSocket data,
  media panels, arbitrary HTML content, external images, arbitrary plugins,
  arbitrary datasources, cross-origin Grafana, SSR, or service workers.
- Dormant dynamic-code branches remain in third-party source and require
  continued build/runtime auditing.
- Nonce mutation of the default `@emotion/css` singleton is a version-coupled
  provider seam, not a general upstream guarantee.
- Per-response nonce behavior was tested with fresh page realms. Reusing one
  JavaScript realm across different document nonce identities is outside the
  provider lifetime model.
- This is not a general CSP recommendation for the host application's other
  code.

## 32. Decision

**PASS.** Strict CSP compatibility is technically viable for the verified
Phase 2 candidate provider. The provider does not fundamentally require
`unsafe-eval`, `unsafe-inline`, remote scripts/assets, iframe isolation,
Grafana shell bootstrap, or uncontrolled style/portal insertion.

## 33. Architecture impact

Phase 2 provider admission/manifest design must add a CSP capability profile
covering nonce support, pre-import Zod jitless ordering, same-origin asset and
transport sources, and the exact dynamic-style owners. Provider bootstrap must
remain a small eager boundary that runs before the Grafana cohort.

The experiment does not add production exports. The strict-CSP server,
provider wrapper, build transforms, and browser host are disposable evidence.
Production implementation should replace build-time source transforms with an
explicit reviewed provider bootstrap/configuration seam.

## 34. Inputs to #45

Issue #45 is unblocked with these inputs:

- acquire the response nonce before provider initialization;
- retain Zod `jitless` configuration before Grafana imports;
- validate nonce identity alongside runtime/provider admission;
- keep Emotion style counts bounded across provider lifetime;
- test multiple dashboard lifetimes without changing nonce in one document;
- keep the controlled portal root and asset base stable until final provider
  release; and
- treat any supported-path CSP violation as a lifecycle failure.

Issue #45 should not redesign CSP, Emotion ownership, portal ownership, or
asset packaging unless its integration evidence breaks one of these contracts.

## 35. Follow-up

- Add Chromium plus at least one other supported engine to the eventual Phase
  2 compatibility matrix before broad CSP claims.
- Convert the experiment nonce/Zod seams into explicit provider manifest and
  admission contracts during package design.
- Re-run static dynamic-code and enforcement probes on every Grafana, Scenes,
  Emotion, Zod, Lodash, panel, or datasource cohort change.
- Add separate profiles before supporting cross-origin Grafana, workers,
  WebSockets, editors, external images, or additional asset classes.
- Carry the local asset provenance and licensing evidence from issue #44 into
  any distributed provider artifact.

## 36. Final status

**PASS**

The verified Phase 2 candidate provider can operate under the documented CSP
compatibility profile for the tested Chromium/deployment cell. Issue #42 is
ready to close after human review. Issue #45 is unblocked; issue #47 remains a
separate transformation-conformance workstream and was not started.
