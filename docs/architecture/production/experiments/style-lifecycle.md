# Production-Shaped Style Lifecycle Cleanup Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Production-shaped style lifecycle cleanup (GitHub issue #45) |
| Status | Bounded integration experiment complete |
| Created | 2026-10-18 |
| Last Updated | 2026-10-18 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime cell | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Presentation inputs | Experiment E and issues #40, #41, #42, #43, and #44 |
| Final status | **PASS** |

This report follows the canonical terminology in the
[project roadmap](../../../project/roadmap.md). The experiment code is marked
`POC / EXPERIMENT / NOT FOR PRODUCTION`; generated evidence under
`artifacts/experiments/style-lifecycle/` is ignored. This result does not
authorize Phase 2, define a public package API, or expand the verified version,
panel, datasource, browser, or deployment cell.

## 2. Hypothesis

The accepted Phase 1 presentation architecture can operate as one coherent
production-shaped lifecycle across provider admission, real dashboard
rendering, queries, lazy features, portals, CSP, assets, repeated dashboard
cycles, two dashboards, failures, and teardown without unbounded presentation
or instance-resource growth.

The hypothesis passed for the exact cell in the metadata. No page reload was
needed for compatible dashboard or provider remount. A conflicting runtime
identity remained correctly unsupported and was rejected before side effects.

## 3. Predeclared criteria

All 50 predeclared criteria were retained. The normal path proved strict CSP,
admission, initialization ordering, one host-owned React identity, three
bounded Emotion owners, an intentional provider portal root, real Text,
Stat/TestData, transformed Time series, refresh, time-range updates, resize,
Popover, Modal, local assets, root and nested deployment, UID replacement,
two dashboards, cleanup, compatible remount, and all prohibited-shell
boundaries.

The result is PASS because structural instrumentation distinguished
intentional provider-lifetime initialization from dashboard leaks. Raw Task 4
counters that record historical registrations are retained as diagnostics but
are not misrepresented as live-resource counts.

## 4. Accepted presentation decisions

This experiment consumed rather than reopened the accepted inputs:

- scoped light DOM; no Shadow DOM or iframe;
- host-owned React/ReactDOM with one runtime identity;
- distinct host `@emotion/react`, provider `@emotion/react`, and Grafana
  `@emotion/css` ownership;
- shared `document.head` with unique Emotion keys for the verified client-only
  profile;
- one intentional, marked, reference-counted provider portal root;
- host-supplied bounded z-index base with provider-relative levels;
- provider-owned, local/offline assets with separate module and
  Grafana-compatible asset bases;
- per-response host CSP nonce and pre-import Zod jitless policy;
- light theme only; and
- one compatible presentation/runtime identity per JavaScript realm.

The production-shaped profile also removed the earlier harness-only global
`browser.css`; it retains only host CSS and the accepted scoped provider/view
styles.

## 5. Ownership hierarchy

| Resource | Owner | Expected lifetime |
| --- | --- | --- |
| React, ReactDOM | Host | Host |
| Host Emotion cache | Host | Host |
| Provider Emotion cache | Renderer provider | Provider/runtime |
| Grafana `@emotion/css` cache | Grafana provider cohort | Provider/runtime |
| Style tags and cached CSS rules | Emitting host/provider cache | Host or provider/runtime |
| Grafana runtime globals, `BackendSrv`, `DataSourceSrv` | Renderer provider | Provider/runtime |
| Plugin, datasource, panel-module caches | Renderer provider | Provider/runtime |
| Scene root | Dashboard instance | Dashboard instance |
| `SceneQueryRunner`, transform pipeline | Panel scene | Panel |
| Resize/Mutation observers | Dashboard/panel DOM owner | Panel |
| Component listeners and timers | Declaring surface | Dashboard, panel, portal, or provider |
| Requests, cancellation, subscriptions | Dashboard generation/query | Query |
| Portal root | Renderer provider | Provider/runtime |
| Portal children, modal inert/focus state | Overlay owner | Portal child |
| Asset manifest and local CSS/font/icon bytes | Provider deployment/browser | Provider and browser cache |

The executable ownership catalogue is in
`experiments/styling/style-lifecycle/lifecycleContract.ts` and is covered by a
focused contract test.

## 6. Initialization order

The observed experiment order was:

1. host CSP nonce ready;
2. Zod jitless prelude ready;
3. host Emotion cache ready;
4. provider admission start;
5. provider admission complete;
6. Zod jitless policy confirmed;
7. provider asset base validated;
8. provider Emotion cache ready;
9. Grafana provider implementation loaded;
10. datasource/query runtime and closed panel catalogue ready;
11. controlled provider portal root acquired; and
12. dashboard scene ready, only after an instance was mounted.

Within runtime acquisition, evidence records host configuration validation,
minimal boot-data and asset policy, Grafana cohort loading, field/transform
registries, panel catalogue, theme/i18n, backend transport, app events,
location policy, query runtime, datasource service, TestData instance, and
`runRequest` installation. The dormant-start probe confirmed that step 12 did
not occur before a dashboard existed.

## 7. Zero-dashboard provider baseline

The dedicated `startDormant` probe initialized the provider without mounting a
dashboard. Its baseline was:

| Measure | Baseline |
| --- | ---: |
| Active dashboard scopes | 0 |
| Runtime leases | 1 |
| Portal roots / children / dashboard references | 1 / 0 / 0 |
| Emotion style tags | 3 |
| Emotion CSS rules | 41 |
| Resize / Mutation observers | 0 / 0 |
| Timers / intervals / RAF | 0 / 0 / 0 |
| Fetches / subscriptions | 0 / 0 |
| Comparable live listeners | 163 |

The three style owners were `grsdk-host`, `grsdk-provider`, and `css`, all with
the current response nonce. The provider cache contained one inserted key and
the Grafana CSS cache contained 24. The controlled portal root was already
present because it is provider-owned, but it had no child and no dashboard
reference.

## 8. Single-dashboard lifecycle

The test mounted the controlled dashboard from the dormant baseline, rendered
real Text, Stat/TestData, and transformed Time series, refreshed both query
panels, changed the time range, opened/closed Popover and Modal, switched to
the alternate UID and back, resized, and unmounted.

After unmount, active dashboard scopes, portal children, portal dashboard
references, resize observers, Mutation observers, fetches, intervals, RAF,
and subscriptions were zero. Host sentinels were unchanged. The same provider
then rendered a new compatible dashboard. A subsequent full provider React
unmount released the runtime lease and removed the portal root; provider
remount reused the same valid page-lifetime Grafana singleton identity and
rendered again.

## 9. Repeated-cycle result

Twenty complete mount/unmount cycles passed under `StrictMode`. Every cycle
executed real dashboard retrieval, lazy cached panel acquisition, TestData
queries, and resize; every fifth cycle switched UID twice; every fourth cycle
opened and closed a Popover.

There was no unbounded monotonic growth:

- style elements remained exactly 3;
- CSS rules warmed from 145 to 148 once during the repeated cycles and stayed
  flat;
- portal children and dashboard references returned to 0 every cycle;
- resize and Mutation observers returned to 0 every cycle;
- fetches, intervals, RAF, and subscriptions returned to 0;
- ordinary cycles retained the 163-listener provider baseline;
- first portal use installed 138 React delegated listeners on the persistent
  provider portal root, after which the total remained exactly 301 through
  cycle 20; and
- all observed pending timers were 2,000 ms tasks; after a 2.1-second quiescent
  period, their count returned to 0.

The Task 4 `AbortController` counter rises when a completed request's
controller is not explicitly aborted, because that tracker decrements only on
`abort()`. It is historical bookkeeping, not active-request evidence. The
experiment therefore records it diagnostically and uses zero live fetches,
weak-reference listener accounting, cancellation probes, and settled
structural state as the operative evidence.

## 10. Two-dashboard handoff

Two compatible dashboards shared one runtime/provider cohort and used
independent scenes, queries, observers, portal references, and DOM owners.
At the measured two-dashboard/Modal peak there were 2 active scopes, 22 resize
observers, 2 portal references, and 1 portal child.

Unmounting dashboard A left dashboard B usable with 1 scope, 11 resize
observers, 1 portal reference, and no stale modal/inert state. B opened and
closed its own Popover. Unmounting B returned scopes, resize observers, portal
references, and children to zero without removing provider-lifetime caches or
the provider-owned root.

## 11. Dormant provider state

With zero dashboards, the runtime remains deliberately dormant rather than
pretending Grafana globals are resettable. One provider lease and the
controlled empty portal root remain until the provider itself unmounts.
Plugin, datasource, transformation, Emotion, and browser asset caches remain
page/provider scoped. No scene stays active and no query, observer, overlay,
or dashboard portal reference remains.

## 12. Compatible remount

A compatible remount after zero dashboard instances rendered all three panels,
executed real queries, and preserved CSP/asset/portal behavior. Runtime
initialization steps did not duplicate; React and ReactDOM remained one copy
at 19.2.8; plugin and datasource caches were reused; new scene state was
independent; and the host stayed functional.

## 13. Incompatible identity rejection

An experiment-only acquisition with a conflicting Grafana base, asset base,
and panel-catalog identity failed with `runtime-conflict`. Evidence confirmed
no change to active scopes, leases, runtime fingerprint, initialization-step
count, or React module identities. Rejection occurred before a second Grafana
cohort, provider Emotion identity, asset identity, or dashboard activation.

## 14. StrictMode result

**PASS.** `StrictMode` remained enabled. Rehearsal effects did not duplicate
runtime initialization, React, services, or static assets. Aborted work and
provider/dashboard cleanup remained valid. Real query traffic can be repeated
by legitimate remount/refresh behavior; no duplicate query result was allowed
to publish from a stale generation.

## 15. CSP lifecycle

**PASS.** Root and nested builds used the issue #42 enforced policy. The nonce
was stable for each response and present on all three Emotion style owners.
Lazy panel loading, UID replacement, portal creation, asset reuse, dashboard
remount, and provider remount produced zero supported-path CSP violations. No
`unsafe-eval`, inline script authorization, or CSP relaxation was added.

## 16. Emotion lifecycle

**PASS.** The host cache key remained `grsdk-host`, the provider cache key
remained `grsdk-provider`, and Grafana retained its separate `css` singleton.
Style-element count remained 3. Rule growth was bounded provider-lifetime
warming: 41 before any dashboard, 145 after panel rendering, 148 after the
first Popover, and 164 after the first Modal. Compatible remount did not add
another owner or another style tag.

Provider-lifetime rules were not flushed merely to satisfy a zero-dashboard
assertion. This is the intended client-only policy from issue #41.

## 17. Portal lifecycle

**PASS.** The root was intentionally created as a marked body child before
overlays opened. Direct body fallback stayed zero. Popover and real Grafana
Modal worked; the tested Modal focus/ARIA behavior from issue #43 regressed
green; modal inert state and focus were restored; and removing an overlay
owner removed only its child. Two dashboards safely shared the root. The root
survived dormant dashboard state and was removed on full provider unmount.

## 18. Asset lifecycle

**PASS.** Root and `/app/sdk/` paths remained deterministic. The observed
provider static set was the two Inter WOFF2 files, provider runtime CSS, slider
CSS, uPlot CSS, and Modal `times.svg`, plus host CSS. No static path was
requested more than once during the 20-cycle/two-dashboard/remount test.

The production-shaped provider excluded
`experiments/bundle/lazy-panel-chunks/browser.css`; bundle evidence confirms
that harness-only global stylesheet is absent. Assets remain provider/browser
cache lifetime as established by issue #44.

## 19. Host CSS lifecycle

**PASS.** The accepted issue #40 containment/normalization remained active.
Host sentinel background, border, radius, and typography did not change across
UID switches, resizes, 20 cycles, two dashboards, or remount. No Shadow DOM or
full Grafana application stylesheet was introduced. The separate issue #40
profiles A–F regression, including the `LegendLabel` normalization, also
passed.

## 20. Failure recovery

| Failure | Recovery evidence |
| --- | --- |
| Panel loader | Controlled first Time series load failed; provider displayed its bounded error; full compatible provider remount retried and rendered all real panels |
| Query HTTP | Two controlled `/api/ds/query` failures stayed panel/provider-local; refresh later produced a real successful query and render |
| Dashboard load cancellation | Delayed alternate DTO completed after dashboard unmount but published no stale scene; subsequent mount rendered the alternate dashboard and then switched back |
| Slow query during UID replacement | Delayed old-generation query could not publish Stat/Time series into the alternate Text-only dashboard; returning to the main UID rendered fresh data |
| Portal owner unmount | Removing the dashboard with an open Modal cleared the child and inert state; later mount succeeded |
| Asset failure | First Modal icon request was deliberately aborted once; the dialog and keyboard-operable text close action remained usable; later rendering remained healthy |

The experiment does not define production error UI. It proves that these
controlled failures can return to a consistent supported state without a page
reload or fabricated successful data path.

## 21. Resource accounting

The required structured accounting uses the true dormant baseline, the
two-dashboard/Modal peak, release of dashboard A, release of all dashboards,
and the final compatible remount followed by a 2.1-second settled release.

| Resource | Owner | Baseline | Peak | After dashboard A unmount | After all dashboards unmount | After remount + release | Expected lifetime | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Active scene scopes | Dashboard | 0 | 2 | 1 | 0 | 0 | Dashboard | PASS |
| Runtime lease | Provider | 1 | 1 | 1 | 1 | 1 | Provider/runtime | PASS |
| Emotion style tags | Host/provider caches | 3 | 3 | 3 | 3 | 3 | Host/provider | PASS |
| CSS rules | Provider caches | 41 | 164 | 164 | 164 | 164 | Provider/runtime lazy cache | PASS |
| Portal child | Overlay | 0 | 1 | 0 | 0 | 0 | Portal child | PASS |
| Dashboard portal references | Dashboard | 0 | 2 | 1 | 0 | 0 | Dashboard | PASS |
| Resize observers | Panel DOM | 0 | 22 | 11 | 0 | 0 | Panel | PASS |
| Mutation observers | Panel/portal DOM | 0 | 0 | 0 | 0 | 0 | Panel/portal | PASS |
| Comparable listeners | Host/provider/portal | 163 | 362 | 328 | 301 | 301 | Host/provider after portal warm-up | PASS |
| Timers | Component/query | 0 | 34 | 34 | 30 | 0 settled | Component/provider bounded task | PASS |
| Intervals | Component/query | 0 | 0 | 0 | 0 | 0 | Instance | PASS |
| RAF callbacks | Panel/portal | 0 | 0 | 0 | 0 | 0 | Instance | PASS |
| Active fetches | Query/dashboard | 0 | 0 at snapshots | 0 | 0 | 0 | Query | PASS |
| Subscriptions tracked by harness | Scene/query | 0 | 0 | 0 | 0 | 0 | Query | PASS |

The 301 post-portal comparable listeners consist of the original 163 baseline
plus exactly 138 React delegated listeners on the persistent portal root. They
were flat from first portal use through cycle 20. Detached listener records and
raw historical counters are diagnostic only; weak-target/DOM-connectivity
accounting plus forced GC was used for live comparable ownership.

## 22. Memory observations

Chromium exposed coarse `performance.memory` values. After forced GC, the
zero-dashboard warmed baseline and final settled state both reported a 3.76 GB
heap limit, 26.0 MB total JS heap, and 24.5 MB used JS heap. This is supporting
evidence only. The values are noisy and coarsely quantized; no general
memory-leak claim is based on them. Structural resource accounting is primary.

## 23. Production-shaped host model

```text
Host
├── React / ReactDOM 19.2.8
├── host Emotion cache
├── per-response CSP nonce and pre-import jitless policy
├── same-origin transport
├── host CSS and root DOM
│
└── Renderer provider
    ├── React/runtime admission
    ├── local asset policy
    ├── provider Emotion + Grafana @emotion/css
    ├── one Grafana/Scenes/runtime cohort
    ├── one controlled portal root
    ├── closed lazy Text/Stat/Time series catalogue
    └── TestData/query runtime
        └── independent dashboard/scene/query/overlay lifecycles
```

The experiment creates no public Phase 2 export. The provider build derives
from the accepted Experiment E boundary and uses audited experiment-only
source transforms to remove the harness stylesheet, avoid strong historical
scene retention, delay portal acquisition to the proved initialization point,
and inject controlled negative-test seams.

Bundle evidence records 2,743 provider module identities, including the same
22 audited Grafana `public/app` source modules already admitted by the
accepted provider closure, with zero `@grafana/*/internal` and zero SystemJS
modules. No new upstream Grafana source or asset provenance was introduced by
issue #45; its additions are project-owned experiment harness and accounting
code. Existing licensing/distribution review still applies to that provider
closure.

## 24. Collision/leak catalogue

| Observation | Classification | Resolution / contract |
| --- | --- | --- |
| Harness `browser.css` applied root/body/button globals | Experiment harness collision risk | Removed from the production-shaped provider graph; bundle guard added |
| Historical `scenes` array retained every scene strongly | Experiment instrumentation retention | Replaced in this bounded build with active `WeakRef` evidence and a numeric ready count |
| Raw AbortController count rose after completed requests | Instrumentation ambiguity | Classified as historical abort-only accounting; live fetch/cancel/weak evidence is authoritative |
| AbortSignal instrumentation listener appeared per controller | Instrumentation-owned record | Excluded from application listener baseline and reported separately |
| First portal use added 138 listeners | Intentional provider-lifetime React portal initialization | Attributed to the persistent marked portal root; proved exactly flat thereafter |
| 2,000 ms timers existed immediately after cycles | Bounded delayed cleanup | Delay buckets recorded; all returned to zero after the quiescent window |
| CSS rules rose 41 → 145 → 148 → 164 | Intentional lazy cache warming | Owners stayed constant at three; remount/cycles did not continue growth |

No unresolved unbounded structural growth was observed in the verified cell.

## 25. Required Phase 2 lifecycle contract

Phase 2 must preserve these requirements:

1. validate React object identity, versions, runtime identity, nonce, asset
   base, and capability manifest before Grafana singleton initialization;
2. initialize CSP/Zod policy and all style owners before style emission;
3. keep host React external and keep one provider-owned Grafana cohort;
4. represent runtime ownership honestly as realm/provider scoped, not
   dashboard-instance scoped;
5. expose explicit dashboard leases/scopes whose scene, query, observer,
   overlay, and cancellation resources are released independently;
6. keep one intentional provider portal root, reference-count dashboard
   owners, and forbid direct body fallback;
7. retain provider-lifetime plugin/datasource/Emotion/asset caches across
   compatible remounts without duplicating them;
8. reject incompatible identities before side effects;
9. cancel or generation-guard stale dashboard/query work;
10. keep style, observer, listener, timer, portal, and static-request
    conformance tests, including a repeated-cycle stress profile; and
11. preserve sanitized evidence and exact provider-source provenance.

## 26. Limitations

- The evidence is one client-only Chromium cell: Grafana 13.2.3,
  React/ReactDOM 19.2.8, and Scenes 8.13.5.
- Only Text, Stat, Time series, controlled TestData, and the selected
  transformation are covered.
- Only light theme, same-origin/host-proxied Grafana, root and `/app/sdk/`
  deployment, and the tested Popover/Modal surfaces are covered.
- The experiment does not prove SSR/hydration, other browsers, arbitrary host
  frameworks, cross-origin authentication, multiple incompatible providers,
  general panels/datasources/transforms, or V2 dashboards.
- Provider caches and upstream Grafana singletons intentionally survive
  dashboard release; upstream global reset is neither claimed nor attempted.
- The source transforms and negative-test knobs are experiment mechanics, not
  a proposed production implementation.
- Coarse heap observations are not a general memory proof.

## 27. Decision

**PASS.** The accepted Phase 1 presentation architecture has a bounded,
coherent, production-shaped lifecycle for the verified client-side provider
cell. The experiment found no need for an iframe, Shadow DOM, second React,
Grafana application shell, `GrafanaApp`, navigation, routing, SystemJS, page
reload, or fabricated query data.

## 28. Architecture impact

The combined issue #40–#45 presentation subsystem is now evidence-backed as a
single architecture rather than a collection of isolated decisions. Phase 2
planning may treat scoped light DOM, the three Emotion owners, strict nonce
ordering, the controlled portal root, local assets, and dormant compatible
runtime reuse as its presentation baseline.

This does not resolve licensing/distribution approval, broaden Grafana version
support, or authorize production SDK implementation. Those remain governed by
the other Phase 1 decisions and final synthesis.

## 29. Inputs to Phase 1 synthesis

- Presentation integration status: PASS for the pinned provider cell.
- Lifecycle ownership: provider globals/caches survive; instance resources do
  not.
- Styling workstream: issues #40, #41, #42, #43, #44, and #45 are technically
  complete after human review.
- Bundle boundary: provider React implementations remain absent; one host
  React owner and one provider Grafana cohort remain.
- CSS boundary: harness-only globals must not enter the provider artifact.
- Conformance boundary: repeated cycles, two dashboards, failure recovery,
  incompatible admission, CSP, and asset provenance are release-gate inputs.
- Remaining adjacent experiment: issue #47 transformation conformance.

## 30. Follow-up

Issue #47 should proceed next. Final Phase 1 architecture approval should wait
for that workstream and the broader Phase 1 synthesis. Phase 2 should not copy
this experiment code directly; it should implement the lifecycle contract
through the approved provider/package architecture and retain equivalent
conformance evidence.

No changes to prior experiment reports are required by this result.

## 31. Final status

**PASS**

Issue #45 is ready to close after human review. The styling/presentation
integration blockers covered by issues #40–#45 are complete for the verified
cell. This result alone does not authorize Phase 2.
