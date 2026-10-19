# React and Grafana Scenes Compatibility Policy

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Resolve React 19 and Grafana Scenes compatibility policy |
| Status | Architecture research |
| Created | 2026-10-12 |
| Last Updated | 2026-10-12 |
| Upstream baseline | Grafana OSS 13.2.3; React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Related architecture | [Bridge/provider architecture](./bridge-provider-architecture.md), [runtime isolation model](./runtime-isolation-model.md), [Grafana version policy](./grafana-version-compatibility-policy.md) |
| Historical evidence | [Phase 0 POC results](../research/poc-results.md) |

This document belongs to the canonical **Phase 1 — Production Architecture
and Distribution Strategy** defined by the
[project roadmap](../../project/roadmap.md). The completed Phase 0 POC is
historical evidence. This policy does not change the POC, package versions, or
dependencies.

Evidence labels used throughout this document mean:

- **VERIFIED UPSTREAM SUPPORT** — an upstream release, manifest, or official
  migration document explicitly supports the stated relationship.
- **DECLARED PEER SUPPORT** — a published package peer range admits the stated
  version. This is metadata, not proof of every runtime behavior.
- **PROVEN BY OUR POC** — the exact combination passed this project's bounded
  Phase 0 tests; this is not an upstream support statement.
- **UNVERIFIED** — no applicable conformance evidence supports the
  combination.
- **INCOMPATIBLE** — manifests conflict or a relevant conformance test has
  demonstrated failure.
- **TECHNICAL RECOMMENDATION** — project policy proposed by this workstream.
- **DELEGATED/OPEN DECISION** — a decision owned by another workstream or an
  explicit future experiment.

## 2. Executive summary

**Final status: READY WITH CONSTRAINTS.**

**TECHNICAL RECOMMENDATION — HIGH confidence.** React and ReactDOM must be
host-owned, required peer dependencies and must resolve to one physical,
version-matched runtime per JavaScript realm. A renderer provider owns and pins
its exact Scenes build. Scenes is not independently selected by a host and is
not bundled with a second React runtime.

The only initial verified compatibility cell is:

```text
react 19.2.8
+ react-dom 19.2.8
+ @grafana/scenes 8.13.5
+ Grafana 13.2.3 provider/package cohort
```

Phase 0 proved that exact cell with Text, Stat, Time series, real TestData
queries, StrictMode lifecycle tests, UID changes, and two simultaneous
compatible dashboard instances. `@grafana/scenes@8.13.5` nevertheless declares
React and ReactDOM `^18.0.0` peers. The cell is therefore **PROVEN BY OUR POC**
but outside Scenes' **DECLARED PEER SUPPORT**. The warning must remain visible;
the project must not describe the cell as upstream-supported or modify package
metadata to hide it.

The initial Phase 2 package may expose this cell only as **EXPERIMENTAL**. A
future **SUPPORTED** claim requires a complete provider conformance run and,
by default, upstream peer alignment. A documented maintainer decision could
instead accept ownership of an upstream peer mismatch, but that decision has
not been made here.

StrictMode is supported and must not be disabled by the SDK. Providers must be
StrictMode-safe: rehearsed mounts may not leak resources or publish stale work,
and aborted duplicate work must be observable. Micro-frontends are supported
only when every SDK consumer shares the same host React/ReactDOM identity and
the same compatible renderer runtime identity.

## 3. Phase 0 evidence baseline

| Evidence | Phase 0 result | Policy consequence |
| --- | --- | --- |
| React and ReactDOM | One physical `react@19.2.8` and `react-dom@19.2.8` installation | This exact pair is verified; a semver range is not implied. |
| Scenes | `@grafana/scenes@8.13.5` rendered the controlled scene graphs | Scenes 8.13.5 is provider-pinned for the initial cell. |
| Grafana cohort | `@grafana/data`, `ui`, `runtime`, `schema`, `i18n`, and `e2e-selectors` 13.2.3 | React/Scenes policy is part of one immutable provider cohort. |
| Native rendering | Real Text, Stat, and Time series panels rendered without iframe or Grafana shell | The architecture is viable for the bounded capability catalog. |
| Query lifecycle | Real TestData queries reached Loading and Done; refresh, time-range change, cancellation, and stale-generation protection passed | React effects and Scenes activation can drive the bounded runtime safely. |
| StrictMode | Mount, unmount, remount, UID change, and cleanup passed under React 19 StrictMode | StrictMode is a supported host mode, with an efficiency qualification below. |
| Multiple instances | Two compatible dashboards shared one realm runtime with independent scenes, requests, and observers | Many roots/instances are viable when React and RuntimeIdentity match. |
| Cleanup | Queries, observers, portals, subscriptions, and instance leases returned to their expected baselines | Provider conformance must retain resource accounting. |
| Peer diagnostics | Scenes' React/ReactDOM `^18` warnings remained visible and unsuppressed | Project evidence does not rewrite upstream peer metadata. |
| Verification | 133 unit tests and 34 authenticated Chromium tests passed at Gate C | This is bounded evidence, not general React, Scenes, or Grafana compatibility. |

**PROVEN BY OUR POC.** React 19.2.8 did not produce invalid-hook-call,
duplicate-runtime, render, console, page, or cleanup failures in the exact
tested combination.

**INFERENCE.** Phase 0 proves a compatibility cell, not all React 19 releases,
all Scenes 8 releases, all dashboards, or all host topologies. Its known
StrictMode duplicate-initial-query/rehearsal behavior is a production
efficiency risk even though correctness and cleanup passed.

## 4. Upstream version metadata

### 4.1 Exact pinned manifests

| Package | Exact version | Relevant manifest evidence | Classification |
| --- | --- | --- | --- |
| `react` | 19.2.8 | Pinned direct host dependency; React has no React peer | **PROVEN BY OUR POC** |
| `react-dom` | 19.2.8 | Peer `react: ^19.2.8`; dependency `scheduler: ^0.27.0` | **DECLARED PEER SUPPORT** and **PROVEN BY OUR POC** for React 19.2.8 |
| `@grafana/data` | 13.2.3 | Peers `react: >=19`, `react-dom: >=19`; upstream development versions 19.2.8 | **DECLARED PEER SUPPORT** for React 19; **PROVEN BY OUR POC** at 19.2.8 |
| `@grafana/ui` | 13.2.3 | Peers `react: >=19`, `react-dom: >=19`; upstream development versions 19.2.8 | **DECLARED PEER SUPPORT** for React 19; **PROVEN BY OUR POC** at 19.2.8 |
| `@grafana/runtime` | 13.2.3 | Peers `react: >=19`, `react-dom: >=19`; upstream development versions 19.2.8 | **DECLARED PEER SUPPORT** for React 19; **PROVEN BY OUR POC** at 19.2.8 |
| `@grafana/scenes` | 8.13.5 | Peers `react: ^18.0.0`, `react-dom: ^18.0.0`; Grafana packages `>=11.6`; `react-router-dom: ^6.28.0` | React 19 is outside **DECLARED PEER SUPPORT**, but the exact cell is **PROVEN BY OUR POC** |

Data, UI, Runtime, and Scenes do not declare React or ReactDOM as normal
runtime dependencies in these manifests; they expect consumer-provided peers.
Their exact React/ReactDOM development dependencies identify their upstream
test/build cohort but do not install a private production React. ReactDOM
19.2.8 directly depends on `scheduler: ^0.27.0` and declares React `^19.2.8` as
its peer. The POC does not install `@grafana/scenes-react`.

The pinned Grafana 13.2.3 root manifest itself resolves React and ReactDOM
19.2.8 with Scenes 8.13.5. This is **VERIFIED UPSTREAM USAGE** of the
combination inside Grafana's application. It is strong integration evidence,
but it does not change the published Scenes peer range and does not by itself
promise standalone compatibility.

The current Yarn resolution reports unsatisfied React and ReactDOM peer
requirements for the workspaces that combine the Grafana 13 package cohort
with Scenes 8.13.5. Those warnings are expected evidence. Overrides,
resolutions, package extensions, or optional-peer metadata must not be used to
convert them into an apparent upstream-supported state.

### 4.2 Later Scenes evidence

**VERIFIED UPSTREAM SUPPORT.** The inspected later
[`@grafana/scenes` v8.20.1 manifest](https://github.com/grafana/scenes/blob/v8.20.1/packages/scenes/package.json)
declares React and ReactDOM `^18.0.0 || ^19.0.0`. This demonstrates that a later
Scenes release broadened its declared peer support to React 19.

**UNVERIFIED.** Scenes 8.20.1 has not been tested with the pinned Grafana
13.2.3 provider source, package cohort, scene conversion, or application-source
bridge. Its metadata cannot be retroactively applied to 8.13.5, and it is not
an approved upgrade.

### 4.3 Pinned references

- [Grafana 13.2.3 root manifest](https://github.com/grafana/grafana/blob/v13.2.3/package.json)
- [`@grafana/data` 13.2.3 manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json)
- [`@grafana/ui` 13.2.3 manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json)
- [`@grafana/runtime` 13.2.3 manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json)
- [`@grafana/scenes` 8.13.5 manifest](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/package.json)
- [Grafana 12-to-13 plugin migration guide](https://grafana.com/developers/plugin-tools/migration-guides/update-from-grafana-versions/migrate-12_x-to-13_x)
- [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React `StrictMode`](https://react.dev/reference/react/StrictMode)
- [React DOM `createRoot`](https://react.dev/reference/react-dom/client/createRoot)

## 5. Compatibility categories

| Combination or claim | Category | Reason |
| --- | --- | --- |
| Grafana 13.2.3 packages with React/ReactDOM 19 | **DECLARED PEER SUPPORT** | Data, UI, and Runtime declare `>=19`. |
| Grafana 13.2.3 application with React/ReactDOM 19.2.8 and Scenes 8.13.5 | **VERIFIED UPSTREAM USAGE** | The pinned Grafana manifest selects that exact combination. |
| Standalone provider with React/ReactDOM 19.2.8 and Scenes 8.13.5 | **PROVEN BY OUR POC** | Gate A, query runtime, Gate B, and Gate C passed. |
| Scenes 8.13.5 with React/ReactDOM 19.2.8 | Outside **DECLARED PEER SUPPORT** | Scenes 8.13.5 declares only `^18.0.0`. Runtime failure was not observed. |
| Scenes 8.20.1 with React 19 | **DECLARED PEER SUPPORT**, otherwise **UNVERIFIED** here | Later metadata admits React 19; this project has not run provider conformance. |
| Any other React 19 or ReactDOM 19 release | **UNVERIFIED** | Semver compatibility is not project conformance evidence. |
| React 20 | **UNVERIFIED** | No relevant provider test or pinned upstream promise exists. |
| React 18 with the Grafana 13.2.3 package cohort | Manifest-**INCOMPATIBLE** | Data, UI, and Runtime require React and ReactDOM `>=19`. |
| Different React and ReactDOM compatibility pairs | **INCOMPATIBLE** | ReactDOM declares a React peer and the project requires one tested pair. |
| Two physical React runtimes across one provider/component tree | Architecture-**INCOMPATIBLE** | Hooks, contexts, portals, and element ownership require one identity. |

The project must always state both the upstream declaration and project test
state. “Works in the POC” must never be shortened to “supported by Scenes.”

## 6. Host-owned React policy

**TECHNICAL RECOMMENDATION — HIGH confidence.** React and ReactDOM are
host-owned required peers for every package that exposes or renders React
components. The renderer provider must externalize them. A non-React contract
package does not need React merely because another workspace does.

The host owns:

- the one physical React module identity;
- the matching one physical ReactDOM/client identity;
- root creation and host `StrictMode` choice;
- compatible bundler sharing/deduplication; and
- error-boundary placement around the experimental dashboard component.

The provider owns:

- exact Scenes and Grafana package/source cohort versions;
- provider components, contexts, portals, and lazy imports;
- an admission manifest describing acceptable host React pairs; and
- conformance evidence for each admitted pair.

Provider-bundled React is rejected. It increases invalid-hook-call and split
context risk, prevents reliable host composition, makes Module Federation
coexistence fragile, and violates the existing one-runtime realm model.

The renderer is a browser client boundary. React Server Components and server
rendering of Grafana scenes are unsupported initially. A server-rendered host
may place the SDK behind its own client boundary, but importing or executing a
provider in the server graph is outside the initial policy.

## 7. Peer dependency policy

The future React-facing SDK package and each renderer provider must declare
`react` and `react-dom` as required peers. They must not be optional peers and
must not also be normal bundled dependencies.

Initial Phase 2 package metadata should represent only the exact verified pair:

```text
react: 19.2.8
react-dom: 19.2.8
```

This is a policy recommendation, not a package manifest change. Broader ranges
may be published only after the matrix contains all implied support cells or a
documented verification rule proves the complete bounded range. `^19`, `>=19`,
and `>=18` would currently overstate project evidence.

Package-manager enforcement is a first diagnostic layer, not the runtime
authority:

- a clean peer resolution does not prove a single physical module;
- a resolution/override can force an unverified graph;
- workspaces and module federation can still produce duplicate runtimes;
- package-manager warnings must not be suppressed; and
- the compatibility manifest plus runtime admission decides whether a provider
  may initialize.

If a host override changes React, ReactDOM, Scenes, or the provider cohort from
an admitted manifest cell, the combination is unsupported even when it builds.

## 8. Scenes peer mismatch

The observed peer mismatch is real metadata, not a false report:

```text
@grafana/scenes@8.13.5 -> react ^18.0.0, react-dom ^18.0.0
Grafana packages 13.2.3 -> react >=19, react-dom >=19
actual verified host -> react 19.2.8, react-dom 19.2.8
```

Three conclusions are justified:

1. **PROVEN BY OUR POC:** the bounded provider paths execute successfully at
   React/ReactDOM 19.2.8.
2. **VERIFIED UPSTREAM USAGE:** Grafana 13.2.3 itself pins Scenes 8.13.5 with
   React/ReactDOM 19.2.8.
3. React 19 is not within Scenes 8.13.5's **DECLARED PEER SUPPORT**. Hidden or
   untested React 18 assumptions may remain in paths the POC did not exercise.

It is therefore unsupported to call the mismatch “metadata-only.” Runtime
evidence reduces risk but cannot prove absence of unexercised assumptions.
React 19 removed legacy rendering, context, ref, factory, and DOM APIs; any
unvisited Scenes dependency that relies on them could still fail.

The initial experimental provider may retain Scenes 8.13.5 because it is the
only project-verified version. It must retain the warning and label the cell as
project-verified/outside-upstream-peer. Moving to a later Scenes release is an
upgrade experiment, not a metadata cleanup.

## 9. React 19 behavioral impact

The following React 19 changes materially affect provider conformance:

| Area | Relevant React 19 behavior | Provider requirement |
| --- | --- | --- |
| Legacy APIs | `ReactDOM.render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode`, string refs, `createFactory`, legacy context, and function `propTypes`/`defaultProps` behavior were removed or changed | Scan source and exercised bundles; fail an upgrade if reachable code uses removed APIs. Use `createRoot` and root `unmount`. |
| JSX runtime | The modern JSX transform is required; `react/jsx-runtime` and `react/jsx-dev-runtime` are physical-runtime entry points | Externalize both entry points and prove they resolve to the host cohort. |
| StrictMode | Development rehearses renders, effects, and ref callbacks; React 19 reuses memoized results during the second render | Initialization and effects must be idempotent, abortable, and cleanup-complete. |
| Refs | `ref` is available as a prop, callback refs may return cleanup functions, and element `ref` access changed | Provider wrappers must not depend on removed element-ref internals and must run cleanup exactly once per registration. |
| Root errors | `createRoot` supports caught, uncaught, and recoverable error callbacks; render errors are reported differently | Host and provider diagnostics must not rely only on rethrown render errors. |
| Error boundaries | Component error boundaries remain the render-subtree containment mechanism; root callbacks add reporting rather than replacing boundaries | Keep a host-visible boundary around each dashboard and classify provider failures without crashing unrelated host UI. |
| Suspense/lazy | A suspended tree commits its fallback immediately and prewarms siblings | Lazy plugin loading must tolerate replay and cancellation and may not initialize Grafana singletons speculatively. |
| Portals | Portals retain React-tree context/event behavior while targeting another DOM node | Portal content must use the same React identity; portal ownership and teardown remain provider responsibilities. |
| Context | Provider shorthand is available, but normal context identity rules remain | Do not cross physical React copies or recreate identity-bearing contexts per bundle. |
| Concurrent work | Render work can start, pause, restart, or be discarded | No render-phase side effects; generation fences must prevent stale publication. |

The policy does not require every dependency to adopt new React 19 APIs. It
requires the complete exercised provider closure to avoid removed APIs and to
behave correctly under React 19 scheduling and cleanup semantics.

## 10. StrictMode policy

**TECHNICAL RECOMMENDATION — HIGH confidence:** **SUPPORT STRICTMODE** and
**REQUIRE STRICTMODE-SAFE PROVIDERS**. The SDK must not disable StrictMode,
require a host to remove it, or hide its warnings. A descendant cannot opt out
of an ancestor StrictMode boundary reliably in any case.

Provider conformance requires:

- pure rendering with no singleton or request side effects in render;
- idempotent acquisition of the same runtime identity;
- prompt cancellation of rehearsal requests and stale dashboard generations;
- no publication from an aborted generation;
- symmetric subscription, timer, observer, portal, and scene cleanup;
- reusable mount/unmount/remount behavior;
- ref callback cleanup under the React 19 development rehearsal; and
- observable resource counters returning to the pre-mount baseline.

Phase 0's duplicate initial query/rehearsal is permitted as current
**EXPERIMENTAL** behavior only when the first request is promptly cancelled,
cannot publish, and leaks nothing. A **SUPPORTED** provider should coalesce,
defer, or otherwise prevent duplicate completed network work for one logical
initialization. StrictMode itself must not be disabled to obtain that result.

## 11. Duplicate runtime detection

No single check is sufficient. Production admission must combine four layers:

1. **Manifest check:** compare the provider's exact admitted React/ReactDOM
   pair with the host-reported versions before provider initialization.
2. **Module-identity check:** a project-owned React integration adapter creates
   an opaque identity token from the actual host-resolved React and ReactDOM
   client modules. The provider's external imports must resolve to that same
   token. A version string or `Symbol.for` value is not sufficient.
3. **Build check:** inspect provider chunks and dependency graphs to prove that
   React, ReactDOM, client, and JSX-runtime entry points are external and not
   duplicated.
4. **Behavioral conformance:** exercise a context/hook/portal round trip across
   host and provider boundaries, then verify mount and cleanup.

The first accepted React identity becomes part of `RuntimeIdentity` for the
realm. A different later identity causes a typed fatal error before any Grafana
singleton mutation. If conflict is detected after a renderer has initialized,
the realm is contaminated for that identity change; recovery requires a fresh
page/realm, not another initialization attempt.

Warnings are appropriate for diagnostics that do not change identity, such as
the known Scenes peer declaration. A detected duplicate physical React or
ReactDOM runtime is an error, not a warning.

## 12. Micro-frontend policy

### 12.1 Supported topology

The initial supported topology is:

- one JavaScript realm and document;
- one physical React 19.2.8 and ReactDOM 19.2.8 pair;
- one compatible provider/Scenes/Grafana package cohort;
- one compatible realm `RuntimeIdentity`; and
- any number of React roots and dashboard instances that acquire compatible
  leases from that shared runtime.

For webpack Module Federation, `react`, `react-dom`, `react-dom/client`,
`react/jsx-runtime`, and `react/jsx-dev-runtime` must resolve through the
host-owned shared singleton with strict version checking. Remotes must not
bring fallback copies. The provider cohort must also be selected once, before
Grafana singleton initialization.

### 12.2 Unsupported topology

The following are unsupported:

- different React or ReactDOM versions used by SDK consumers in one realm;
- independently bundled React copies across host and provider;
- one micro-frontend initializing a second Grafana Runtime/Scenes cohort;
- sharing SDK elements, contexts, portals, or providers across different
  physical React identities; and
- treating Shadow DOM as JavaScript-module isolation.

An unrelated micro-frontend with its own React copy may appear to coexist, but
the SDK makes no compatibility claim for that page topology. A true fresh realm
can isolate another cohort, but iframe-based isolation violates this project's
product constraints; a separate page is the only initial acceptable realm
boundary.

## 13. Scenes version coupling

Scenes is an exact provider-owned implementation dependency. It is:

- pinned to one exact artifact/version per provider build;
- recorded with artifact integrity and source identity in the compatibility
  manifest;
- coupled to the provider's Grafana package/source cohort and scene converter;
- never selected or overridden independently by the host; and
- admitted only after the provider conformance suite passes.

Grafana server version does not mechanically determine a Scenes version.
However, a provider compatibility cell binds server version, Grafana package
cohort, application-source bridge, Scenes version, and tested React pair. The
fact that Phase 0 selected Scenes 8.13.5 separately does not make arbitrary
Scenes substitution safe.

Semver alone is insufficient for an upgrade. Public API, state behavior,
activation lifecycle, plugin importer behavior, React peer metadata, and
Grafana package compatibility must all be re-evaluated.

## 14. Compatibility manifest impact

The future provider manifest should add or make explicit:

| Field | Policy |
| --- | --- |
| `react.requiredPeer` | Required host range; exact `19.2.8` initially. |
| `reactDom.requiredPeer` | Required host range; exact `19.2.8` initially. |
| `testedReactPairs[]` | Exact React/ReactDOM pairs with evidence IDs and support tier. |
| `react.physicalRuntime` | `host-singleton-required`. |
| `react.identityProtocol` | Core/provider token schema version and required identity checks. |
| `scenes` | Exact version, source/artifact identity, integrity, and upstream peer ranges. |
| `strictMode` | `supported`, with duplicate-work and cleanup conformance results. |
| `jsxRuntime` | `automatic`; required external modules and tested transform. |
| `renderingEnvironment` | `client-only`; RSC/SSR unsupported. |
| `bundlers[]` | Bundler/version/config profiles actually verified. |
| `knownIncompatibleReact[]` | Explicit failed or manifest-incompatible pairs. |
| `unverifiedReact[]` | Optional diagnostic list; absence never implies support. |
| `upstreamPeerAlignment` | Whether the exact Scenes build declares the tested pair. |

The manifest must distinguish an evidence state (`verified by project`) from a
product support tier (`experimental` or `supported`) and an upstream statement
(`declared peer support`). These fields must not collapse into one Boolean.

## 15. Error model

React/Scenes admission errors occur before provider singleton initialization
whenever possible. They are never downgraded to dashboard-level placeholders
when the realm itself is incompatible.

| Typed error | Classification | Trigger | Recovery |
| --- | --- | --- | --- |
| `UnsupportedReactVersion` | FATAL PROVIDER | Host React is outside the selected provider manifest | Select a compatible provider or change host React before initialization. |
| `UnsupportedReactDOMVersion` | FATAL PROVIDER | Host ReactDOM is outside the manifest | Select/change the pair before initialization. |
| `ReactDOMPairMismatch` | FATAL PROVIDER | React and ReactDOM do not form an admitted exact pair | Install one admitted pair. |
| `ScenesVersionMismatch` | FATAL PROVIDER | Loaded Scenes identity differs from the provider manifest/build | Load the intact provider artifact; do not override Scenes. |
| `DuplicateReactRuntime` | FATAL REALM | Provider and host resolve different physical React identities | Rebuild sharing configuration or reload a fresh realm. |
| `DuplicateReactDOMRuntime` | FATAL REALM | Provider and host resolve different ReactDOM/client identities | Rebuild sharing configuration or reload a fresh realm. |
| `ReactRuntimeIdentityConflict` | FATAL REALM | A later lease requests a different admitted React identity than the first realm identity | Use the existing identity or reload a fresh realm. |
| `StrictModeIncompatibleProvider` | FATAL PROVIDER | Selected provider lacks required StrictMode evidence while host policy requires it | Select a conforming provider; do not disable host StrictMode as automatic recovery. |
| `JSXRuntimeMismatch` | FATAL PROVIDER | JSX runtime entry points are bundled, missing, or resolve outside the host cohort | Correct bundler externalization and rebuild. |

“Fatal provider” is recoverable only before the provider mutates Grafana
singletons, by selecting another admitted provider. “Fatal realm” means the
current page cannot safely switch identity. None of these errors is caused by
one dashboard UID, so none is dashboard-level.

## 16. Build/bundler policy

The initial provider build contract requires:

- external `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, and
  `react/jsx-dev-runtime` entry points;
- the modern automatic JSX transform;
- exact provider-owned Scenes and Grafana cohort resolution;
- no fallback React copy in any lazy chunk;
- deterministic dynamic-import/public-path behavior for provider chunks;
- bundle reports proving React/ReactDOM exclusion and one Scenes cohort; and
- retained peer and compatibility-manifest validation in CI.

Minimum conformance profiles should cover Vite and Rollup first because the POC
uses that family, then webpack with a documented Module Federation singleton
profile. esbuild and Oxc may transform code inside a verified profile, but are
not separate support claims without an end-to-end build and browser run.

Tree shaking is an optimization, not a compatibility control. Source-built
Grafana application modules may have static imports or side effects that keep
large closures. A small output does not prove correct externalization, and a
large output does not justify aliasing another React copy.

The project must not claim universal bundler support. Each support claim names
the bundler, relevant version, module format, external configuration, and test
evidence.

## 17. Test matrix

The matrix avoids multiplying independent axes that are actually provider
build properties. Scenes and the Grafana cohort are fixed within one provider;
they are not swept independently for every test.

### 17.1 Smoke matrix

Run for every admitted React pair and provider artifact:

- install/peer validation;
- provider manifest and module-identity admission;
- one browser mount, Text render, and clean unmount;
- StrictMode on and off;
- duplicate-runtime negative probe;
- bundle externalization audit; and
- supported bundler build profiles.

### 17.2 Full verified matrix

For every product-verified compatibility cell, run:

- Gate A/B/C-equivalent Text, query, Stat, and Time series flows;
- dashboard API retrieval and constrained conversion;
- refresh, time-range update, resize, UID change, and remount;
- two simultaneous compatible dashboard instances;
- StrictMode rehearsal, cancellation, stale-publication, and resource checks;
- plugin/query failure isolation;
- portal, MutationObserver, and ResizeObserver cleanup;
- zero iframe, shell, duplicate React, console error, or page error;
- Vite/Rollup production build and at least one supported webpack profile; and
- browser coverage defined by the provider's separate browser policy.

The initial full row is exactly React/ReactDOM 19.2.8 + Scenes 8.13.5 + the
Grafana 13.2.3 provider. Phase 0 supplies historical evidence; production
packaging must rerun equivalent tests rather than merely cite the POC.

### 17.3 Upgrade-candidate matrix

An upgrade pull request runs the current verified cell and each proposed new
cell side by side. It adds source/manifest diffs, removed-API scans, StrictMode
tests, identity-conflict tests, bundle/provenance diffs, and full rendering and
cleanup tests. A candidate is not added to the public manifest until review
accepts the evidence.

## 18. Support tiers

| Tier | Required evidence | Meaning |
| --- | --- | --- |
| **VERIFIED** | Exact pair/provider full matrix passes with reproducible artifacts | Project evidence exists for this cell; this alone is not a maintenance promise. |
| **SUPPORTED** | VERIFIED plus published support commitment, upgrade/security ownership, documented host profile, and either upstream peer alignment or explicit maintainer risk acceptance | Users may rely on the stated compatibility policy. |
| **EXPERIMENTAL** | Reproducible bounded evidence exists but a material qualification remains, such as an upstream peer mismatch | Evaluation use only; no broad compatibility promise. |
| **UNSUPPORTED** | Outside the manifest, known incompatible, unverified override, duplicate runtime, or retired cell | Fail admission or operate entirely outside project support. |

The exact Phase 0 cell is technically **VERIFIED** and initially product-tier
**EXPERIMENTAL** because Scenes 8.13.5 does not declare React 19 support. Later
React 19 patches, React 20, or newer Scenes releases remain **UNSUPPORTED**
until they enter the matrix; semver similarity does not make them VERIFIED.

## 19. Upgrade workflow

Every React, ReactDOM, Scenes, or provider-cohort upgrade follows this sequence:

1. Open one versioned compatibility work item and identify the candidate
   manifest cell.
2. Review package manifests, peer ranges, release notes, migration guidance,
   source diffs, and artifact integrity.
3. Diff React-sensitive source for removed APIs, internals, refs, context,
   portals, Suspense/lazy behavior, render-phase side effects, and JSX runtime
   changes.
4. Produce a provider build with host React externalized and exact Scenes and
   Grafana dependencies pinned.
5. Run package graph, physical identity, lazy-chunk, and bundle-composition
   checks.
6. Run the smoke matrix and full Gate A/B/C-equivalent conformance matrix,
   including StrictMode and duplicate-runtime negative tests.
7. Compare runtime lifecycle, network count, resource balance, bundle size, and
   source provenance with the current supported cell.
8. Record failures and known incompatibilities; do not broaden a range to skip
   an unverified intermediate version.
9. Review and sign off the new manifest cell and support tier.
10. Release it as a new immutable provider build; never mutate old provider
    compatibility claims in place.

Moving from React 19.2.8 to another React 19 release uses the same process as a
major upgrade. React 20 additionally requires a migration/API review. Moving
from Scenes 8.13.5 to a React-19-declared Scenes version requires a full
provider rebuild and cannot be treated as a peer-warning-only change.

## 20. Initial Phase 2 policy

The narrow initial policy is:

- host React: exactly 19.2.8;
- host ReactDOM: exactly 19.2.8 and paired with React 19.2.8;
- provider Scenes: exactly 8.13.5, provider-owned and non-overridable;
- one physical React and one physical ReactDOM/client runtime per realm;
- React/DOM/JSX entry points externalized from provider chunks;
- host-created roots; renderer is client-only;
- StrictMode supported, with the duplicate-query efficiency qualification;
- one compatible renderer `RuntimeIdentity` shared by multiple roots and
  dashboards;
- provider manifest validation and physical identity admission before Grafana
  singleton initialization;
- all other versions fail early with typed errors; and
- product tier **EXPERIMENTAL**, despite project verification, until the Scenes
  peer-support qualification is resolved or explicitly accepted.

This policy does not broaden the Grafana 13.2.3 capability catalog or promise
general panel, datasource, transformation, dashboard, browser, or bundler
compatibility.

## 21. Decision matrix

Scores use 1 (poor) to 5 (strong). Weighted totals are out of 5.

- **MODEL A — exact React/Scenes combination only**
- **MODEL B — tested React minor ranges with pinned Scenes**
- **MODEL C — manifest-driven verified matrix**
- **MODEL D — optimistic peer-range compatibility**

| Criterion | Weight | MODEL A | MODEL B | MODEL C | MODEL D |
| --- | ---: | ---: | ---: | ---: | ---: |
| Correctness | 25% | 5 | 4 | 5 | 1 |
| Host flexibility | 15% | 1 | 4 | 4 | 5 |
| Maintenance | 10% | 2 | 3 | 4 | 4 |
| Ecosystem compatibility | 15% | 2 | 4 | 5 | 5 |
| Micro-frontend safety | 15% | 5 | 4 | 5 | 1 |
| Upgrade cost | 10% | 1 | 3 | 4 | 5 |
| Support clarity | 10% | 5 | 3 | 5 | 1 |
| **Weighted total** | **100%** | **3.25** | **3.70** | **4.65** | **2.90** |

**Result:** Model C is the production governance model. Its initial matrix has
one exact Model A-style cell. Model B may emerge only when multiple individually
verified React releases justify a bounded range. Model D is rejected because
peer metadata and semver do not establish physical identity or runtime
conformance.

## 22. Technical recommendation

**TECHNICAL RECOMMENDATION — HIGH confidence:** adopt Model C, host-owned React,
provider-pinned Scenes, and one explicit React runtime identity per realm. Use
the exact Phase 0 cell for the initial experimental provider and fail closed on
all other combinations.

Confidence is high for ownership and identity policy because React's component,
hook, context, portal, and root model plus Phase 0's one-runtime evidence all
point to the same boundary. Confidence is **MEDIUM** that Scenes 8.13.5 covers
enough React 19 behavior for a broader production claim: the POC is strong but
bounded, and upstream peer metadata disagrees. Confidence is **LOW** for any
unverified React or Scenes upgrade.

The preferred route to a future SUPPORTED tier is a conformance-tested Scenes
release whose manifest declares React 19. Retaining 8.13.5 as supported would
require an explicit project decision to own the mismatch and its untested
surface.

## 23. Product support policy

The product presents three separate statements for every compatibility cell:

1. upstream peer/support declaration;
2. project verification state; and
3. product support tier.

For the initial cell those statements are:

```text
Upstream Scenes peer support: no (React ^18 only)
Project verification: yes, exact bounded Phase 0 cell
Initial product tier: EXPERIMENTAL
```

Installation documentation must name the exact pair and expected Scenes peer
warning. It must not instruct users to silence, patch, or ignore all peer
warnings. Admission rejects unsupported versions before runtime initialization,
even if a package manager installed them through an override.

No compatibility claim is made for React Server Components, SSR/hydration of
Grafana scenes, React Native, non-browser DOM implementations, arbitrary
micro-frontend graphs, or unlisted bundlers.

## 24. StrictMode recommendation

Support host StrictMode and make it a required provider conformance profile.
Do not wrap the SDK in an internal anti-StrictMode boundary and do not ask hosts
to disable it.

Before an initial provider advances from EXPERIMENTAL to SUPPORTED:

- no rehearsal request may publish stale data;
- duplicate started requests must be cancelled or coalesced;
- no duplicate request may complete unnecessarily for one logical initial
  acquisition;
- activation, ref, portal, observer, and subscription cleanup must balance;
- repeat acquisition must preserve the same runtime identity; and
- development diagnostics must distinguish expected rehearsal from a leak.

The Phase 0 result meets correctness and cleanup requirements but leaves the
duplicate initial query as an efficiency item to harden.

## 25. Micro-frontend recommendation

Support multiple roots and compatible micro-frontends only through host-owned
singleton sharing. Provide reference configurations and negative conformance
tests for webpack Module Federation and ordinary monorepo builds. Vite/Rollup
dedupe is necessary in the initial development profile but is not by itself a
portable production guarantee.

Do not support different React versions or independent React copies in the same
realm. Do not expose a “bring your own React object” escape hatch that bypasses
manifest admission. A host-supplied identity token is evidence about the actual
resolved modules, not permission to claim arbitrary compatibility.

## 26. Other Phase 1 impacts

| Workstream | Impact | State |
| --- | --- | --- |
| Grafana version policy | Replace the delegated React range with exact tested pairs and upstream-peer-alignment metadata | **UNBLOCKED** documentation/schema design |
| Runtime isolation | Add React/ReactDOM module identity token and JSX runtime profile to `RuntimeIdentity`; retain one identity per realm | **UNBLOCKED** internal contract design |
| Bundle strategy | Externalize all React/DOM/JSX entries and audit lazy chunks; use exact provider-owned Scenes | **UNBLOCKED** and recommended next workstream |
| Styling containment | Ensure portals, theme contexts, and style roots never cross a second React identity | **UNBLOCKED**, subject to its own containment decisions |
| Public SDK API | React-facing package uses required peers; provider selection remains explicit; no public Scenes type leakage | **UNBLOCKED** design, implementation remains Phase 2 |
| Provider conformance | Add exact-pair, StrictMode, identity-conflict, multi-root, bundler, and cleanup profiles | **UNBLOCKED** |
| Server-hosted module experiment | Must prove server modules externalize to the host React and do not initialize another Scenes/Grafana cohort | **CONSTRAINED EXPERIMENT** |
| Provider publication | Must decide whether to ship the 8.13.5 peer qualification or first validate a React-19-declared Scenes release | **OPEN BEFORE SUPPORTED RELEASE** |

Recommended next workstream: **define the production bundle-size and dependency
boundary strategy**. React externalization, provider-owned Scenes, and lazy
chunk audits established here are direct inputs to that decision.

## 27. POC migration

| POC behavior | Production disposition | Required change |
| --- | --- | --- |
| Workspace resolutions pin React/DOM 19.2.8 | **KEEP CONCEPT / REWRITE** | Express exact host peers and manifest admission; do not use consumer resolutions as support enforcement. |
| One physical React/ReactDOM | **KEEP CONCEPT / HARDEN** | Add explicit module-identity protocol and negative tests. |
| Vite `dedupe` | **KEEP CONCEPT / SPLIT** | Retain for Vite profile; define equivalent Rollup/webpack/Module Federation profiles and bundle audits. |
| StrictMode support | **KEEP CONCEPT / HARDEN** | Preserve cleanup behavior and eliminate duplicate completed initial work before SUPPORTED tier. |
| Runtime identity checks | **KEEP CONCEPT / REWRITE** | Add host React, ReactDOM client, JSX runtime, and identity-protocol fields. |
| Scenes peer warnings | **KEEP EVIDENCE / DEFER** | Keep visible; resolve through validated Scenes upgrade or explicit project risk acceptance. Never suppress. |
| Scenes dynamic load | **KEEP CONCEPT / REWRITE** | Load provider-private exact Scenes lazily while all React entry points remain host externals. |
| POC package as product provider | **DISCARD** | Build a production provider from the approved contracts; do not rename disposable POC code into the SDK. |

## 28. Decisions made

1. React and ReactDOM are host-owned required peers for React-facing packages.
2. The initial verified host pair is exactly React/ReactDOM 19.2.8.
3. One physical React and ReactDOM/client identity is allowed per SDK realm.
4. Scenes is provider-owned, exact, and not independently host-selectable.
5. The initial exact Scenes version is 8.13.5 because it is project-verified.
6. The 8.13.5/React 19 mismatch is outside upstream declared peer support and
   must remain visible.
7. Project verification, upstream support, and product support tier are
   separate manifest concepts.
8. StrictMode is supported; providers must be StrictMode-safe.
9. The initial renderer is client-only; RSC/SSR rendering is unsupported.
10. Multiple roots/dashboards are supported only with a shared compatible
    React and runtime identity.
11. Model C, a manifest-driven verified matrix, is selected.
12. The initial Phase 2 cell is EXPERIMENTAL and fails closed outside its exact
    versions.

## 29. Delegated/open decisions

- Whether to validate and adopt a later React-19-declared Scenes release before
  the first experimental provider publication.
- Whether maintainers will ever accept ownership of an upstream peer mismatch
  for a SUPPORTED tier.
- Exact compatibility-manifest schema syntax and identity-token API; this
  document defines required semantics only.
- Browser/version support policy beyond Chromium POC evidence.
- Final Vite, Rollup, webpack, and Module Federation reference configurations.
- Bundle-size budgets and treatment of the Grafana application/editor closure.
- Styling and portal containment strategy across host design systems.
- Final distribution/licensing approval for provider artifacts.
- Server-hosted module feasibility under host React externalization.
- React 19 duplicate-initial-query optimization implementation.

None of these open decisions permits widening the initial compatibility cell.

## 30. Final status

**READY WITH CONSTRAINTS.**

The production policy is sufficiently defined for license-neutral provider
contracts, compatibility-manifest design, runtime identity design, bundler
experiments, and provider conformance work to proceed. The exact Phase 0 cell
is the only initial verified combination and is limited to an EXPERIMENTAL
product tier.

A SUPPORTED provider release remains constrained by two unresolved choices:
validate a newer Scenes build whose peers declare React 19, or explicitly
accept project ownership of the Scenes 8.13.5 peer mismatch after additional
conformance review. No dependency or package metadata should change until that
work is approved.
