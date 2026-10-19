# Server-Hosted Grafana Frontend Module Experiment

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment with server-hosted Grafana frontend module loading |
| Status | Bounded technical experiment complete |
| Created | 2026-10-12 |
| Last Updated | 2026-10-12 |
| Source baseline | Grafana OSS 13.2.3 at `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime fixture | `grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` (`linux/amd64`) |
| Final status | **FAIL** |

This document follows the canonical phase semantics in the
[project roadmap](../../project/roadmap.md). It reports a disposable
experiment, not a production implementation, a provider-architecture change,
or a legal conclusion.

Evidence labels are:

- **VERIFIED FACT** — established by pinned upstream source or an existing
  durable project record;
- **EXPERIMENT RESULT** — observed against the exact controlled fixture;
- **INFERENCE** — a bounded engineering conclusion supported by that evidence;
- **DECISION** — the architectural consequence adopted by this workstream; and
- **FOLLOW-UP REQUIRED** — a question that needs a separate experiment or
  qualified review.

## 2. Executive summary

The experiment is **FAIL** under the defined built-in criteria. Grafana 13.2.3 serves the exact JavaScript used
by its own UI, but availability over HTTP is not equivalent to independent
module loadability.

- Core Text, Stat, and Time series renderers arrive as content-hashed webpack
  JSONP chunks under `/public/build/`. Their server metadata exposes logical
  `core:plugin/*` identities, not stable chunk URLs. The chunks register
  numeric module factories into Grafana's application webpack runtime and do
  not export a `PanelPlugin` to a native dynamic import. They fail the built-in
  PASS criteria.
- TestData is served through
  `/public/plugins/grafana-testdata-datasource/module.js` with useful plugin
  metadata. Its artifact is AMD, externalizes React and Grafana packages, and
  expects Grafana's SystemJS import map and shared dependency environment. A
  native import in the standalone host failed with `define is not defined`.
- Installed plugins have a materially better discovery surface: plugin
  settings contain ID, version, module path, loading strategy, signature, and,
  in limited configurations, an SRI-formatted module hash. That shape could
  support a future closed `RendererProvider`, but this experiment did not prove
  an installed external plugin executing independently of Grafana's loader.

**DECISION.** Keep provider-bundled renderer chunks as the Phase 2 reference
path. Do not use Grafana-server-hosted core modules for the initial provider.
Keep server-hosted installed plugins as an optional future capability behind a
separate provider profile and a further conformance experiment. Do not install
Grafana's general SystemJS loader or derive code URLs from dashboard data.

## 3. Research question

Can a standalone React host obtain and execute exact-compatible frontend code
from its target Grafana server, while preserving all of these invariants?

- the project does not redistribute the downloaded module bytes;
- no `GrafanaApp.init`, application shell, route tree, navigation, or iframe;
- one host-owned React/ReactDOM and one compatible Grafana runtime identity;
- provider-controlled, closed module selection;
- verifiable version and asset identity; and
- support for offline/on-premises deployment without making server-hosted
  delivery mandatory.

The answer must differ by category:

| Category | Answer |
| --- | --- |
| Built-in/core panels | **No for Grafana 13.2.3's delivered artifacts.** Bytes are retrievable, but modules are coupled to the Grafana application webpack runtime. |
| Built-in TestData datasource | **Not independently with native import.** It is a discoverable AMD plugin artifact coupled to Grafana's plugin-loader externals. |
| Externally installed plugins | **Potentially, but not yet proved.** Metadata and asset routing are suitable inputs to a controlled loader; runtime and security conformance remain unproved. |

## 4. Phase 0 / Phase 1 context

Phase 0 proved native rendering with a locally built, audited bridge: dashboard
retrieval by UID, constrained schema-42 conversion, real TestData query
execution, and real Text, Stat, and Time series rendering under React 19.2.8.
It did not use arbitrary remote modules or SystemJS. See the
[POC results](../research/poc-results.md).

Phase 1 has already decided that:

- core remains provider-neutral;
- providers own Grafana-specific code, manifests, loaders, and provenance;
- one compatible `RuntimeIdentity` is admitted per JavaScript realm;
- React/ReactDOM are host-owned;
- capabilities and loading are closed and manifest-driven;
- dashboard content never chooses executable URLs;
- local/offline deployment is required; and
- server-hosted delivery is an optional provider strategy, not a baseline.

This experiment supplies the missing evidence requested by the
[licensing/distribution strategy](licensing-distribution-strategy.md),
[provider architecture](bridge-provider-architecture.md),
[runtime isolation model](runtime-isolation-model.md),
[version policy](grafana-version-compatibility-policy.md), and
[bundle strategy](bundle-dependency-strategy.md).

## 5. Grafana frontend asset model

### 5.1 Application build

**VERIFIED FACT.** The pinned
[`webpack.common.ts`](https://github.com/grafana/grafana/blob/v13.2.3/scripts/webpack/webpack.common.ts)
writes application assets to `public/build`, names dynamic chunks
`[name].[contenthash].js`, and configures webpack public path as
`public/build/`. Production uses an assets manifest and a separate webpack
manifest in
[`webpack.prod.ts`](https://github.com/grafana/grafana/blob/v13.2.3/scripts/webpack/webpack.prod.ts).
Grafana's
[`public/app/index.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/index.ts)
can replace the webpack public path with `window.public_cdn_path` before the
application boot sequence.

The controlled container contained 901 files under
`/usr/share/grafana/public/build`. Relevant exact files were:

| Logical asset | Served path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Text | `textPanel.42bb49ae047235dce251.js` | 11,669 | `92b30b45f7bbb72667581e1347796e123f8c7bb194b5ea60dc30ce5a039a1081` |
| Stat | `statPanel.280c9ee0cecc3c4a4196.js` | 13,511 | `ddff9c463058cb7d3c47762428fd06eeaca54ab10d8bdd370b656a44b982addc` |
| Time series | `timeseriesPanel.0f2547f55a3ac4b6cb5e.js` | 25,778 | `214613b7df64bc91c5e92b593b25f165f2b47bc2a9a7eeec4f25ca2e3f87b2d0` |

These hashes identify the tested container bytes only. They are not a public
Grafana compatibility contract.

### 5.2 Manifests and source maps

**EXPERIMENT RESULT.** `/public/build/assets-manifest.json` returned `200` and
described common application entries and integrity metadata, but contained no
Text, Stat, or Time series entry. The app webpack runtime contained the
internal chunk-ID-to-filename map (`text` 404, `stat` 1965, `timeseries` 563).
Panel source maps existed and were served in this image. Neither the internal
runtime map nor source-map availability is a supported discovery API.

### 5.3 Cache and asset routing

**EXPERIMENT RESULT.** Core build chunks returned one-year cache headers. The
TestData plugin artifact returned a one-hour cache header. Grafana's Go asset
provider maps non-`dist` core plugins to `core:plugin/<directory>` and packaged
plugins to `public/plugins/<id>/module.js`; see
[`localprovider.go`](https://github.com/grafana/grafana/blob/v13.2.3/pkg/plugins/pluginassets/localprovider.go).

## 6. Built-in plugin loading model

**VERIFIED FACT.** The pinned
[`built_in_plugins.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/built_in_plugins.ts)
maps `core:plugin/text`, `core:plugin/stat`, and `core:plugin/timeseries` to
webpack dynamic imports of application source. Grafana's
[`importPluginModule`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/importPluginModule.ts)
recognizes those values and invokes the compiled-in map. It does not resolve
them through `/public/plugins/{id}/module.js`.

The browser boot metadata reported:

| Plugin | Logical module | Plugin version in panel metadata |
| --- | --- | --- |
| Text | `core:plugin/text` | empty |
| Stat | `core:plugin/stat` | empty |
| Time series | `core:plugin/timeseries` | empty |

The normal metadata therefore provides the logical built-in identity but not
the content-hashed browser path or an asset digest. The webpack application
runtime owns both resolution and execution.

**DECISION.** A provider must not scrape `runtime.*.js`, enumerate build files,
or guess content hashes. Those techniques would be build-internal discovery,
not a stable, closed module contract.

## 7. Installed plugin loading model

Grafana discovers packaged plugins from `plugin.json`; official plugin tooling
describes `module.js` as the frontend entry point. The pinned plugin webpack
configuration emits an AMD library named `module.js`, externalizes React,
Grafana packages, RxJS, Emotion, lodash, and other shared dependencies, and
sets its public path relative to the AMD module URI. See the upstream
[`webpack.config.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-plugin-configs/webpack.config.ts),
[plugin anatomy](https://grafana.com/developers/plugin-tools/key-concepts/anatomy-of-a-plugin/),
and [packaging documentation](https://grafana.com/developers/plugin-tools/publish-a-plugin/package-a-plugin).

`GET /api/plugins/{pluginId}/settings` can return:

- plugin ID and type;
- plugin and Grafana dependency metadata;
- module path and base URL;
- plugin version;
- loading strategy (`script` or `fetch`);
- signature state/type/organization;
- optional `moduleHash`; and
- translations and extension metadata.

**VERIFIED FACT.** Grafana selects script/fetch behavior in
[`loadingstrategy.go`](https://github.com/grafana/grafana/blob/v13.2.3/pkg/plugins/pluginassets/loadingstrategy.go).
Grafana's module hash calculator returns an SRI-formatted hash only when SRI is
enabled, the signature is valid, the artifact comes through the CDN path, and
the signed v2 manifest contains `module.js`; local filesystem plugins normally
return an empty value; see
[`modulehash.go`](https://github.com/grafana/grafana/blob/v13.2.3/pkg/plugins/pluginassets/modulehash/modulehash.go).
The upstream [signing documentation](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
confirms that plugin `MANIFEST.txt` records file hashes.

**FOLLOW-UP REQUIRED.** This fixture has no deliberately installed external
panel plugin. TestData validates the packaged asset shape, while independent
execution of a signed external plugin requires a separate minimal fixture.

## 8. Module formats

| Artifact | Observed format | Loader assumptions | Standalone native import result |
| --- | --- | --- | --- |
| Text/Stat/Time series core chunks | Webpack JSONP: pushes module factories into `self.webpackChunkgrafana` | Exact Grafana application webpack runtime, numeric module graph, public path, shared app chunks | Script evaluates, but exports no `PanelPlugin`; only queues a chunk |
| Grafana application runtime/chunks | Webpack runtime plus JSONP chunks | Whole application build graph | Not admitted; booting this graph would cross the shell boundary |
| TestData `module.js` | AMD `define([...], factory)` | Grafana SystemJS with AMD extra, shared dependency import map, loader hooks | Rejected: `ReferenceError: define is not defined` |
| Normal installed plugin output | AMD under pinned plugin webpack configuration | Same Grafana plugin loader assumptions, unless a future provider supplies a bounded equivalent | Not proved in this experiment |

No probed renderer or datasource artifact was native ESM or
`System.register`. Grafana's pinned loader imports SystemJS core plus AMD and
named-register extras in
[`loader/systemjs.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/loader/systemjs.ts).
Its hooks add the shared dependency map and loading behavior. These are
application-owned internals, not a supported `@grafana/runtime` API.

## 9. Network evidence

The reference Grafana UI loaded the real controlled dashboard and rendered
Text, Stat, Time series, and TestData data. The sanitized capture observed 26
JavaScript/CSS requests. It included:

- app runtime/common/application JS and Grafana CSS;
- the exact Text, Stat, and Time series chunks listed in section 5;
- the TestData `module.js` path;
- the Table chunk because the full fixture contains a Table panel; and
- other numbered/common application chunks.

All four target artifacts returned `200` with JavaScript MIME types. The
capture stored method/path/status/type/cache metadata only—not cookies,
authorization headers, credentials, or response bodies.

**INFERENCE.** The reference page proves that Grafana's complete app runtime
can load the assets. It does not prove that an independent host can load them,
which is why the same-origin standalone probe was required.

## 10. Discovery mechanisms

| Mechanism | Built-in panels | Packaged/installed plugins | Assessment |
| --- | --- | --- | --- |
| Dashboard JSON | Plugin ID only | Plugin ID only | Never an executable URL authority |
| Boot/panel metadata | `core:plugin/{id}` | Module and plugin metadata may be present | Built-in path remains logical |
| `/api/plugins/{id}/settings` | No standalone core chunk path | Module path, version, signature, strategy, optional hash | Strongest candidate contract; authentication/access still applies |
| `assets-manifest.json` | No tested async panel entries | Not the plugin manifest | Insufficient for core discovery |
| Application `runtime.*.js` | Internal chunk map | Not applicable | Rejected: internal and runtime-coupled |
| Filesystem/build enumeration | Can reveal names | Can reveal files | Rejected: unavailable/unsupported to browser providers |

A production-shaped closed discovery contract would have to be provider-owned:

```text
provider manifest logical capability
  -> authenticated server preflight
  -> exact approved server/plugin identity
  -> provider deployment descriptor with URL + digest + format + externals
  -> integrity and runtime-cohort validation
  -> closed loader
```

Grafana 13.2.3 does not expose sufficient built-in metadata to construct that
descriptor safely at runtime.

## 11. Same-origin experiment

The experiment used the existing host-owned `/grafana` Vite proxy. Browser
code contained exact provider-controlled paths for the pinned fixture; no path
came from dashboard data.

### 11.1 Text

Native dynamic import returned an empty module namespace and increased
`webpackChunkgrafana` queue length by one. It did not return the real
`PanelPlugin`. Supplying Grafana's app webpack runtime to consume that queue
would import the application dependency graph and violate the experiment
boundary.

### 11.2 TestData

Fetch succeeded, format detection identified AMD, and native dynamic import
rejected with `define is not defined`. The standalone page had no AMD/SystemJS
loader or shared dependency map by design.

### 11.3 Invariants

The standalone host retained:

- zero iframe elements;
- no `GrafanaApp` global or initialization;
- zero Grafana navigation landmarks;
- its existing route and DOM;
- one existing React/ReactDOM cohort; and
- no arbitrary or dashboard-selected module path.

This was a module-load probe, not panel rendering and not a production loader.

## 12. Cross-origin analysis

The deployment pair `https://app.example.com` and
`https://grafana.example.com` adds browser policy constraints that the
same-origin proxy avoids.

| Concern | Evidence and implication |
| --- | --- |
| CORS | Fixture responses to an explicit foreign `Origin` contained no `Access-Control-Allow-Origin`. Native cross-origin ESM/fetch therefore cannot rely on the default fixture. Official Grafana guidance says to configure CORS at a reverse proxy. |
| Module/script mode | Core chunks are classic webpack JSONP and plugins are AMD, not native module scripts. Loading a classic script does not solve dependency, identity, or export capture. |
| Cookies | Static asset routes were retrievable without credentials in the fixture; plugin metadata/API preflight may require the host-owned session. Cross-site cookie behavior remains subject to `SameSite`, HTTPS, and deployment policy. |
| CSP | Host `script-src` must explicitly admit a remote origin or a same-origin gateway. Grafana's own configurable CSP does not grant the host page permission. |
| Authentication | Asset availability and API authorization are distinct. The SDK must not embed service credentials or weaken host policy. |
| Redirect/public path | The direct plugin path followed Grafana's configured root/subpath; the `/grafana` proxy normalized this for the host. Misaligned `root_url` can break asset resolution. |

The official [Grafana security guidance](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/)
states that CORS should be configured in a reverse proxy and discourages a
wildcard origin. Cross-origin operation is therefore deployment-specific and
is not established by this experiment.

## 13. Text built-in result

**Result: FAIL for the built-in PASS criteria.**

- A real exact asset exists and is browser-addressable.
- Its filename is build-specific and absent from the public assets manifest.
- It is a webpack JSONP chunk rather than a standalone module.
- Native import yields no renderer export.
- Execution requires Grafana's application webpack runtime and module graph.
- Server metadata does not provide a verified mapping from
  `core:plugin/text` to filename/hash.

The probe did not fabricate or locally wrap the asset. It correctly stopped
before app runtime/shell bootstrap.

## 14. TestData result

**Result: FAIL for independent native loading; useful partial discovery
evidence.**

The controlled settings response reported:

| Field | Value |
| --- | --- |
| ID | `grafana-testdata-datasource` |
| Type | `datasource` |
| Module | `public/plugins/grafana-testdata-datasource/module.js` |
| Loading strategy | `script` |
| Signature | `internal` |
| Module hash | empty |
| Reported plugin version | `13.2.2` |
| `plugin.json` Grafana dependency | `>=12.3.0` |

The source package is 13.2.3, while the image's generated plugin metadata
reported 13.2.2. That observed distinction reinforces that server, source,
plugin, and build identities must not be inferred from one another.

The 248,033-byte artifact had SHA-256
`28398815b118e4b8b63a22e597584d49fdf9f26aaf5a7c349d8f0f4edc0389d0`
and declared AMD dependencies including `@grafana/data`, `@grafana/ui`,
`@grafana/runtime`, React, RxJS, Emotion, and lodash. Its real application
execution depends on Grafana's shared module environment. Installing that
environment generally is outside this experiment and the initial product
policy.

## 15. Installed-plugin comparison

The normal installed-plugin mechanism is structurally closer to a future
server-hosted provider than the core-panel mechanism:

1. `plugin.json` provides an explicit ID, type, declared Grafana compatibility,
   and version metadata.
2. The server exposes a conventional `module.js` path and plugin settings DTO.
3. Plugin signing provides a manifest and file hashes.
4. Grafana can report a loading strategy and, for supported CDN/SRI cases, a
   module hash.
5. Static plugin assets are scoped beneath `/public/plugins/{id}/`.

However, the delivered module still assumes Grafana's loader and shared
dependency cohort. An external plugin may additionally contain nested chunks,
CSS, images, fonts, backend/resource calls, translations, extension points, or
application-specific behavior. A plugin being signed and loadable by Grafana
does not imply compatibility with this SDK provider.

**FOLLOW-UP REQUIRED.** Use one tiny signed deterministic plugin only in a
future isolated test fixture. Test a closed adapter with a provider-declared
ID, exact plugin version, exact hash/manifest, explicit external map, same
physical React/Grafana cohort, and no general SystemJS namespace. Until that
passes, external plugin support remains undeclared.

## 16. Version identity

No single observed value is sufficient. A future server-hosted provider would
need to bind all of these:

- exact Grafana server release and server build identity;
- exact provider build and compatibility-manifest fingerprint;
- exact React/ReactDOM and Grafana package cohort;
- plugin ID, type, version, signature state, and declared Grafana dependency;
- module format and external dependency map version;
- exact asset URL after trusted base-path normalization;
- immutable content digest/SRI value; and
- loader/deployment-manifest schema version.

The source tag commit, Docker image digest, running binary `BuildCommit`, and
frontend asset hashes are separate identities. A server version alone cannot
authenticate a core chunk filename. The runtime identity model must include a
server-hosted provider/deployment fingerprint if this mode is ever admitted.

## 17. Integrity model

| Integrity input | Current evidence | Production use |
| --- | --- | --- |
| Content-hashed core filename | Detects build change accidentally; no trusted core mapping | Insufficient alone |
| Locally measured SHA-256 | Exact for tested fixture | Evidence only unless signed/provider-declared |
| `assets-manifest.json` SRI | Available for listed common entries, not tested panel chunks | Insufficient for built-ins |
| Plugin `MANIFEST.txt` | Signed plugin packaging includes file hashes | Candidate provenance input |
| Settings `moduleHash` | Empty for local TestData; calculated only in restricted SRI/CDN cases | Optional, not universal |
| Trusted HTTPS origin | Protects transport to that origin | Does not establish compatibility or least privilege |
| Provider deployment manifest | Not provided by Grafana server | Required if a future provider admits remote assets |

**DECISION.** Never execute based only on plugin ID, reported version, a
content-hashed filename, or trusted origin. A future loader must compare a
provider-approved descriptor with server metadata and verified bytes before
evaluation. Any mismatch is provider-fatal and cannot fall back to a dashboard
URL or general plugin importer.

## 18. Offline support

Both same-origin forms can be internet-independent:

- a bundled/local provider requires only locally deployed provider assets and
  the Grafana API;
- a server-hosted provider could retrieve assets from an on-premises Grafana
  server without a public CDN.

Internet-independent does not mean origin-independent. Cross-origin CORS/CSP,
cookies, and trusted TLS still apply. A disconnected host must also retain the
exact server assets for as long as it renders; server upgrades can invalidate
remote asset identity immediately.

**DECISION.** Offline/on-premises support remains mandatory through the local
provider path. Server-hosted assets may optimize some deployments but never
become required for core SDK operation.

## 19. Distribution distinction

This is a technical distinction, not a legal conclusion.

| Scenario | Who serves Grafana-derived bytes to the browser? | This project's artifact contains those bytes? | Legal review status |
| --- | --- | --- | --- |
| Provider-bundled chunks | Project/provider distributor | Yes | Existing legal-review issue applies |
| Server-hosted module | User's/target Grafana deployment | No module bytes in the SDK package; loader code remains ours | Legal interpretation remains open |
| Local/generated bridge | User's build/deployment | Depends on distributed outputs | Existing local-build questions apply |
| Grafana UI/application | Grafana deployment | No, but violates this product's shell constraint | Not an architecture candidate |

Dynamic loading changes distribution mechanics; it does not by itself answer
license, source-offer, attribution, modification, or network-interaction
questions. Refer those questions to
[the licensing/distribution strategy](licensing-distribution-strategy.md) and
qualified counsel.

## 20. Security/trust analysis

The target Grafana server becomes an executable-code origin in a server-hosted
model. That increases the consequence of a compromised server, DNS/TLS
failure, malicious administrator, or compromised installed plugin.

Required future controls are:

- explicit host selection of a trusted Grafana origin;
- normalized base URL and same-origin/reverse-proxy policy;
- a provider-owned allowlist of plugin IDs and logical capabilities;
- rejection of dashboard URLs, arbitrary plugin IDs, redirects to unapproved
  origins, and undeclared nested assets;
- signature state plus independently verified content identity;
- exact dependency/external mapping to the already admitted physical cohort;
- CSP-compatible loading with no `unsafe-eval` assumption;
- typed preflight and integrity errors before scene activation;
- cache partitioning by server/provider/plugin identity; and
- sanitized telemetry that never records credentials or module bodies.

Grafana plugin signatures help establish plugin provenance but do not prove SDK
compatibility. A dashboard referencing a signed plugin remains untrusted input.

## 21. Performance/cache analysis

| Dimension | Provider-bundled chunks | Server-hosted modules |
| --- | --- | --- |
| First use | Host/provider CDN or local deployment; preload is controllable | Additional server round trips and metadata preflight |
| Cache lifetime | Provider owns immutable hash policy | Core chunks measured at one year; plugin artifact at one hour |
| Upgrade behavior | Provider build and manifest change together | Grafana upgrade can invalidate URLs/bytes independently of host deployment |
| Cross-dashboard reuse | Shared provider/runtime cache | Browser HTTP cache plus provider cache, if identity keys are correct |
| Bundle size | Bytes distributed with provider, but lazily splittable | Potentially removes renderer/plugin bytes from provider artifact |
| Runtime overhead | Native bundler imports | Format adaptation, integrity verification, dependency binding, and more failure modes |
| Offline | Deterministic local asset set | Works only while exact target server remains reachable |

Measured target bytes were small individually (about 11–26 KiB for the three
entry chunks), but they do not include their shared transitive application
chunks. TestData's single entry was about 248 KiB before its externals. The
reference dashboard requested 26 JS/CSS resources, so comparing only entry
files would materially understate either closure.

## 22. Architecture comparison

| Model | Feasibility | Security/identity | Fidelity/version match | Offline | Bundle/distribution | Operations/testing | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A — provider-bundled renderer chunks | Proved by Phase 0; production build work remains | Closed manifest and local integrity are achievable | High for exact tested provider cell | Yes | Largest provider closure; distribution/legal review required | Reproducible build and full provider conformance | **REFERENCE / TECHNICALLY PREFERRED** |
| B — server-hosted built-ins | Core artifacts are not standalone or discoverable | No supported URL/hash contract; would require app runtime | Exact server bytes, but unusable within constraints | Server-local only | Could reduce distributed bytes | Brittle build-internal coupling | **FAIL / TECHNICALLY REJECTED for 13.2.3** |
| C — server-hosted installed plugins only | Metadata/asset shape is promising; execution unproved | Signatures and optional hash help; closed adapter still required | Plugin/server aligned, provider cohort compatibility unknown | Yes with local Grafana | Could avoid plugin-byte redistribution by this project | Requires per-plugin conformance and loader experiment | **INCONCLUSIVE / EXPERIMENT REQUIRED** |
| D — hybrid bundled built-ins + hosted external plugins | Composes with provider contract | Separate closed catalogues and identities required | Preserves built-in proof; external fidelity conditional | Yes, with bundled baseline | Good optionality; complex manifests | Highest matrix and failure-isolation burden | **TECHNICALLY VIABLE AFTER C PASSES** |
| E — local/generated bridge | Phase 0-like path is technically viable | Build provenance and reproducibility required | Exact source-aligned fidelity | Yes | User builds/hosts output | High host/toolchain burden | **VIABLE FALLBACK** |

Model B is rejected because the actual bytes fail the stipulated module and
discovery requirements—not because server-hosted delivery is categorically
undesirable. Model C remains distinct and open.

## 23. Pass/fail result

### 23.1 Built-in criteria

| Criterion | Result |
| --- | --- |
| Stable/discoverable module exists | **FAIL** — logical identity exists; standalone URL/hash contract does not |
| Loads independently | **FAIL** — Text only queues a webpack chunk |
| No shell bootstrap required | **FAIL** for execution — required webpack graph is app-owned |
| Identity/version verifiable | **FAIL** — measured hash is not exposed as trusted metadata |
| Closed provider loading | **FAIL** without a provider-generated server-build manifest unavailable from Grafana |
| One React/runtime identity | **Not reached** — loader failed before renderer construction |

### 23.2 Overall classification

The prescribed definitions classify the overall experiment as **FAIL**:
built-in renderers exist only as application-runtime-coupled chunks and do not
satisfy independent-load criteria. A `PARTIAL` result would require proof that
an externally installed plugin is independently loadable. This fixture proves
only that installed-plugin delivery exposes a structured server asset and
metadata mechanism, so that narrower path is **INCONCLUSIVE / EXPERIMENT
REQUIRED**, not a declared capability.

## 24. Provider-contract impact

No current provider decision changes. The contract already has the right
abstractions: provider identity, compatibility manifest, deployment manifest,
closed logical loader IDs, preflight, typed failure, and opaque Grafana
handles.

If installed-plugin loading is later admitted, add a separate provider profile
or capability containing inert fields equivalent to:

- delivery kind `grafana-server-installed-plugin`;
- approved plugin ID/type/version and Grafana dependency constraint;
- expected module format and loader-adapter version;
- exact external/shared-cohort fingerprint;
- allowed normalized asset base/origin policy;
- signature requirement and content-integrity policy;
- required auxiliary assets/translations;
- offline/cache behavior; and
- conformance evidence ID.

The provider, never the dashboard, resolves those descriptors. Server-hosted
and bundled capabilities sharing a realm must resolve to the same physical
React/Grafana runtime cohort and `RuntimeIdentity`.

## 25. Bundle-strategy impact

- Keep the Phase 2 provider bootstrap and compatibility manifest renderer-free.
- Keep Text, Stat, Time series, TestData, and transformations as lazy
  provider-bundled logical chunks in the initial deployment manifest.
- Do not count server-hosted core chunks as a supported bundle-reduction
  technique.
- Continue reducing editor/Monaco and application closure at build time.
- Preserve delivery-neutral logical loader IDs so a future installed-plugin
  provider can map an approved ID to verified server bytes.
- Bundle budgets must count the adapter, external cohort, metadata preflight,
  integrity work, CSS/assets, and fallback behavior—not just remote
  `module.js` bytes.

The experiment closes the generic “server-hosted built-ins” optimization for
the 13.2.3 compatibility cell. It does not close the installed-plugin path.

## 26. Licensing-strategy impact

**VERIFIED FACT.** In this probe, the project did not copy server response
bodies into tracked artifacts; the target Grafana server served the code to
the browser. The experiment test contains only exact paths, measured hashes,
metadata assertions, and sanitized observations.

**INFERENCE.** A successful server-hosted provider could change which party
distributes module bytes and could reduce application-derived code inside the
project's npm artifacts. It would not eliminate the need to review the loader,
adapters, generated metadata, modifications, notices, assets, and network-use
implications.

**FOLLOW-UP REQUIRED.** Qualified counsel must determine whether browser
loading from a user's Grafana deployment changes any obligations relevant to
the project's intended distribution. This document makes no legal conclusion.

## 27. Required follow-up

### 27.1 Required before any installed-plugin capability

Run a separate bounded experiment with one deterministic signed external
plugin:

1. pin plugin ID, version, archive digest, signature, Grafana compatibility,
   and exact Grafana server/image;
2. retrieve metadata only through the approved host-owned API transport;
3. resolve only a provider-declared logical ID;
4. verify redirects, origin, MIME, signature state, and asset digest;
5. supply a narrow AMD adapter and explicit external map without importing
   Grafana's app-wide SystemJS hooks;
6. bind all externals to the admitted provider cohort and host React;
7. prove no `GrafanaApp.init`, shell, navigation, iframe, duplicate React, or
   arbitrary import;
8. test CSS/nested chunks/public paths, cancellation, cache invalidation,
   upgrade mismatch, CSP, CORS, same-origin, and offline behavior; and
9. run provider conformance plus source/licensing review.

If this requires general SystemJS, `unsafe-eval`, Grafana application bootstrap,
or an unbounded import map, reject the path.

### 27.2 Not required for initial Phase 2

- further attempts to scrape core webpack chunks;
- making server-hosted delivery a baseline;
- cross-origin wildcard CORS changes;
- broad third-party plugin support; or
- changes to the proven Phase 0 POC.

### 27.3 Issue disposition

This workstream's question is answered for the pinned cell and is ready to
close after human review. Track the signed installed-plugin adapter probe as a
new, explicitly optional Phase 1/Phase 2 experiment rather than keeping the
general server-hosted-module issue open.

## 28. Final status

**FAIL**

- **Built-in plugin loading:** FAIL. Core panel chunks are application
  webpack-runtime artifacts, not standalone discoverable modules.
- **TestData loading:** FAIL for an independent native loader; PASS only for
  discovery/retrieval of an AMD plugin artifact and metadata.
- **Installed-plugin loading:** promising structured mechanism, but independent
  execution remains unproved and must not be advertised.
- **Architecture:** retain provider-bundled built-ins as the reference. Keep an
  optional, closed installed-plugin provider experiment available without
  altering the core/provider/runtime decisions.

No production source, provider behavior, dependency, package manifest,
lockfile, license, Grafana version, or Phase 0 POC behavior was changed by this
experiment.
