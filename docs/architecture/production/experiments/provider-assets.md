# Provider Font, Icon, and Static Asset Packaging Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Grafana React SDK maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Provider font, icon, and static asset packaging (GitHub issue #44) |
| Status | Bounded technical experiment complete |
| Created | 2026-10-17 |
| Last Updated | 2026-10-17 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime cell | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Provider baseline | Experiment E provider; issue #40 scoped light DOM; issue #41 Emotion ownership; issue #43 controlled portal |
| Final status | **PASS** |

This report uses the canonical terminology from the
[project roadmap](../../../project/roadmap.md). It records ignored evidence
under `artifacts/experiments/provider-assets/`; it does not define a public API,
production package, arbitrary plugin-asset contract, or legal conclusion.

## 2. Hypothesis

The production-shaped provider can own and deploy the complete static asset
closure used by the verified Text, Stat/TestData, Time series, and portal cell
without Grafana's application asset server, a CDN, internet access, the full
Grafana application asset tree, editor assets, Grafana shell initialization,
or root-only URL assumptions.

The hypothesis passed for root, `/app/sdk/`, and local offline profiles. The
claim is limited to the exact version and capability cell in the metadata.

## 3. Predeclared criteria

All 33 PASS/FAIL/INCONCLUSIVE criteria were retained. PASS required real Text,
Stat/TestData, transformed Time series, PanelChrome, and portal behavior; exact
asset ownership, emission, provenance, hashes, root/nested/offline resolution,
font fallback, editor exclusion, and prior presentation regressions; and one
React identity with no iframe, Grafana application shell, navigation,
`GrafanaApp`, or SystemJS.

All required criteria passed. During test development, MIME-aware network
checks caught provider CSS paths that Vite preview had incorrectly answered
with the SPA HTML fallback. The final artifact copies the provider's prebuilt
CSS/font closure at its actual relative dependency paths. All normal static
responses are now HTTP 200 with the expected CSS, WOFF2, or SVG content type.

## 4. Fresh asset inventory

The final root inventory contains six provider-owned runtime assets and one
host-owned experiment stylesheet. The nested inventory contains the same bytes
and hashes beneath `/app/sdk/`.

| Category | Emitted identity | Bytes | Consumer/timing | Owner |
| --- | --- | ---: | --- | --- |
| `FONT` | `assets/assets/Inter-Regular-B0QUfDW0.woff2` | 108,488 | Provider typography; CSS use | Provider |
| `FONT` | `assets/assets/Inter-Medium-B0NFony0.woff2` | 111,380 | Provider typography; CSS use | Provider |
| `CSS` | `assets/assets/providerRuntime-DeYWoyMT.css` | 3,814 | Provider surface/fonts/portal; provider import | Provider |
| `CSS` | `assets/lib-lN7-jXEs.css` | 5,083 | Transitive `@rc-component/slider` UI CSS; shared preload | Provider |
| `VISUALIZATION_ASSET` | `assets/provider-visualization-CnsZ1jie.css` | 1,644 | uPlot/Time series; shared preload | Provider |
| `ICON` | `provider-assets/build/img/icons/unicons/times.svg` | 261 | Grafana Modal close icon; overlay open | Provider |
| `CSS` | `assets/index-DgeBwh2g.css` | 2,905 | Experiment host/profile rules | Host, not provider contract |

No WOFF, TTF, EOT, bitmap image, worker, WASM, blob asset, data-URL asset,
icon font, or other SVG was emitted or requested. The ignored
`asset-inventory.json` records category, file, source path/package/version,
source commit where applicable, size, SHA-256, consumer, timing, URL, owner,
and license-evidence location for each item.

The slider CSS enters the present provider through the published UI cohort's
static preload map, although the fixture does not exercise a slider. It is a
small, known transitive asset, not a Grafana application-wide stylesheet. Its
possible removal belongs to production graph shaping in issue #45.

## 5. Browser network evidence

Sanitized evidence separates four request classes: `staticAssets`,
`javascript`, `api`, and `datasource`. It contains paths, statuses, content
types, cache headers, resource types, and service-worker flags only—no headers,
cookies, credentials, query bodies, or response bodies.

| Probe | Real behavior | Static result |
| --- | --- | --- |
| Text only | Exact Text plugin; no panel query event | Local CSS + regular/medium Inter; all expected MIME types |
| Stat only | Exact Stat plugin; panel 2 reached `Done` through TestData | Same local shared view closure |
| Time series only | Exact Time series; panel 3 reached `Done`; `Phase 0 Pulse Signal` visible | Same closure including uPlot CSS |
| All panels | Text + Stat + transformed Time series and two real query paths | Same closure; modal adds one local SVG request |
| Portal | Real Grafana Popover/Modal in controlled root | Uses the same provider base; no separate or fallback base |

The current prebuilt provider's UI import causes the small shared CSS set,
including uPlot CSS, to preload in single-panel profiles. JavaScript panel
features remain independently lazy as proved by Experiments C–E. CSS
capability-level laziness is not claimed.

## 6. Fonts

Only two font files were required and observed:

| Family | Weight/style | Source | Requested in Chromium |
| --- | --- | --- | --- |
| `Grsdk Provider Inter` | 400 normal | Grafana `public/fonts/inter/Inter-Regular.woff2` | Yes |
| `Grsdk Provider Inter` | 500 normal | Grafana `public/fonts/inter/Inter-Medium.woff2` | Yes |

The provider deliberately uses a scoped family name while preserving the
upstream Inter bytes. Italic Inter, medium italic, Roboto Mono, Font Awesome,
legacy `grafana-icons`, and all other Grafana font files were absent. This is
evidence from the verified view cell, not a claim that future capabilities will
never require them.

## 7. Font-loading policy

The candidate policy is:

- the provider owns its `@font-face` declarations and exact font bytes;
- only used weights are emitted;
- `font-display: swap` is retained;
- CSS uses relative WOFF2 URLs, so host deployment relocation applies to CSS
  and fonts together;
- the scoped dashboard and portal roots select the family with the fallback
  stack `Inter, ui-sans-serif, system-ui, sans-serif`; and
- the host may use its own fonts without becoming the provider font owner.

Both weights loaded in normal Chromium. When both WOFF2 requests were
deliberately failed, `document.fonts.check` returned false, the measured sample
used the system fallback width, all three real panels remained usable, and the
host remained alive. Fonts are therefore a **SOFT FIDELITY REQUIREMENT**, not a
functional hard dependency, for this cell.

## 8. Icons

The verified cell uses Grafana's published React `Icon` mechanism. In pinned
`@grafana/ui`, `getIconPath()` reads `window.__grafana_public_path__` once and
adds `build/img/icons/<kind>/<name>.svg`; `react-inlinesvg` then fetches and
inlines the SVG. The tested Modal close control required exactly:

`build/img/icons/unicons/times.svg`.

The provider emits that exact compatibility path beneath its configured asset
base. The normal request returned `image/svg+xml` and rendered inside the real
Grafana close button. View-only Text, Stat, and Time series required no icon
font or Codicon. uPlot rendered to canvas and required no image asset.

Because the upstream path is name-stable rather than content-hashed, a future
versioned provider base must make the directory immutable and the manifest must
carry its SHA-256. Renaming the individual SVG would break the upstream lookup
unless the provider added a reviewed URL mapping layer.

## 9. Visualization CSS

Time series uses `uplot@1.6.32` CSS emitted as the 1,644-byte
`provider-visualization-*` asset. It has no subordinate URL assets. The
provider runtime CSS also retains the narrow `.uplot` containment needed by
the tested surface. The separate 5,083-byte `@rc-component/slider@1.2.1` CSS
is a known published-UI transitive preload.

All bytes are static build assets. No runtime CDN, worker, image, or font URL
is introduced by uPlot. Root, nested, and offline profiles rendered the real
transformed plot and canvas successfully.

## 10. Root deployment

**PASS.** The root host served JS/CSS/font assets below `/assets/` and Grafana
path-based icons below `/provider-assets/build/img/icons/`. Every normal CSS,
WOFF2, and SVG response returned HTTP 200 with its expected MIME type. No
request reached `/grafana/public/` for provider presentation.

The Vite preview server intentionally returned `cache-control: no-cache`; that
is experiment-server behavior, not the production cache recommendation.

## 11. Nested-base deployment

**PASS.** The same artifact graph ran under `/app/sdk/`:

- chunks, CSS, and WOFF2 resolved beneath `/app/sdk/assets/`;
- relative font URLs resolved beside provider runtime CSS;
- the modal icon resolved beneath
  `/app/sdk/provider-assets/build/img/icons/unicons/times.svg`; and
- every observed local static response returned its expected MIME type.

No request accidentally used root `/assets/` or the original Grafana asset
tree.

## 12. Relative/unknown base analysis

Two resolution mechanisms must remain explicit:

1. **Module-graph assets**—JS, extracted CSS, and CSS-relative fonts—are
   relocated by the host/provider deployment build base. They do not need the
   final URL at source-authoring time.
2. **Grafana path-based assets**—the SVG icon mechanism tested here—use a
   normalized, same-origin provider `assetBasePath`, installed before Grafana
   UI/runtime evaluation.

The experiment accepts `/provider-assets/` and
`/app/sdk/provider-assets/`, rejects origins, protocol-relative URLs, queries,
fragments, and traversal, and rejects a conflicting second base in the same
JavaScript realm. The latter matches the one-compatible-provider/runtime
ownership policy: Grafana's icon root is module-cached and is not instance
local.

A production deployment contract needs both the module/deployment base and the
runtime Grafana-compatible asset base. A future public API may derive or
manifest them, but this experiment does not choose that API. `import.meta.url`
is suitable for provider-owned module assets; it cannot silently replace the
published Grafana `__grafana_public_path__` icon behavior.

## 13. Offline result

**PASS.** The offline profile aborted every non-localhost request. The blocked
list stayed empty while real Text, Stat/TestData, transformed Time series,
fonts, CSS, and the portal/modal icon remained usable. Grafana API/data access
continued through the local fixture, as permitted by the experiment. No public
internet or CDN asset was required.

## 14. Missing-asset result

**PASS.** The icon base was deliberately redirected to a nonexistent local
directory. Vite preview returned its SPA HTML fallback with HTTP 200, which
proved that status alone is not a sufficient asset-health check. The test
classified the failure as `ICON` because the expected SVG URL returned
`text/html`, retained the host and all panels, and closed the modal through its
remaining keyboard-operable text action.

Production asset verification must validate expected URL, status, and MIME
type. The experiment does not add product-facing missing-icon UX.

## 15. Font-failure result

**PASS.** Both exact WOFF2 requests were failed. The declared family list
remained visible in computed CSS, `document.fonts.check` reported both provider
weights unavailable, and a canvas metric probe confirmed the actual sample
width matched the system fallback. Text, Stat, and Time series remained
visible and usable. The result classifies these fonts as a soft fidelity
requirement.

The experiment records the metric delta; it does not claim that fallback text
is pixel-identical or that every locale has equivalent layout.

## 16. Cache policy

Recommended production behavior:

| Artifact | Candidate cache policy |
| --- | --- |
| Content-hashed JS/CSS/WOFF2 | Long-lived immutable |
| Stable Grafana-compatible icon names | Immutable only beneath an exact provider/Grafana version directory; otherwise revalidate |
| Compatibility/asset manifest | Short-lived or revalidated; changes select a new immutable graph |
| Provider metadata/admission document | Revalidated before singleton initialization |
| Development outputs | No-cache is acceptable |

Two dashboards requested no additional static assets after the warmed provider
graph. Unmounting one dashboard did not invalidate assets used by the other;
unmount/remount kept static request count bounded at six.

## 17. Asset hashes

| Asset | SHA-256 |
| --- | --- |
| Inter Regular | `b6f9db9e45be20f3c1312c97fbee7ec36b7d8280f8caa4d53c9ba0408cc9997a` |
| Inter Medium | `8458f8afa67b5691c1fcbe51607a2dafb53a9839e48131c608a186b65415d96d` |
| Modal `times.svg` | `ef212fb287617446776c03debe22b02b784bfef44e45cf1cb40651c3e023a4da` |
| Provider runtime CSS | `c77441060aebbecf46eb63674a5cb36e5c8e09f10b6c51bf891d79846511c466` |
| Slider CSS | `8be4ce8136d45e744b445bedde3774e6aff8d17a1c3289467e1e177fe2c97cbb` |
| uPlot CSS | `0fd9465202f6dfceac29e67c17e5ac9fb1b7ba7615c1bb08782391b791d9f1e0` |

Root and nested profiles produced identical hashes for provider bytes. These
are provenance/integrity evidence, not cryptographic signing.

## 18. Manifest impact

A future provider compatibility/deployment manifest must be able to express:

- exact Grafana/provider version cell and provider identity;
- module deployment base and Grafana-compatible `assetBaseUrl` policy;
- required and optional asset categories;
- emitted path, logical runtime path, size, MIME type, SHA-256, and load timing;
- required CSS chunks and their relative URL dependencies;
- font family, weight, style, format, fallback, and fidelity classification;
- stable-path icons and the capability that consumes them;
- source package/path/version/commit and license-evidence reference;
- local/offline capability;
- editor/view profile classification; and
- cache/versioning policy.

The manifest should reject unknown owners/categories before provider
initialization. This experiment does not edit the production manifest schema.

## 19. Provenance

| Asset group | Upstream/project identity | Evidence |
| --- | --- | --- |
| Inter 400/500 | `grafana/grafana` 13.2.3, pinned source commit, exact `public/fonts/inter` files | Grafana `LICENSING.md` and `NOTICE.md`; content hashes above |
| `times.svg` | `grafana/grafana` 13.2.3, pinned `public/img/icons/unicons/times.svg` | Grafana `LICENSING.md` and `NOTICE.md`; exact hash above |
| uPlot CSS | `uplot@1.6.32`, `dist/uPlot.min.css` | Installed package manifest/LICENSE and emitted hash |
| Slider CSS | `@rc-component/slider@1.2.1`, `assets/index.css` | Installed package manifest/LICENSE and emitted hash |
| Scoped/provider CSS | This repository's experiment, issue #40/#43 styles, and provider asset declarations | Repository `LICENSE` and bundle module inventory |

This table records source and existing license evidence. It makes no new legal
conclusion. Distribution review for Grafana-derived fonts/icons and all
third-party assets remains connected to the Phase 1 licensing workstream;
unknown or changed assets must be fed back to issue #21 before distribution.

## 20. Editor-asset regression

**PASS.** Source-module and emitted-filename guards found zero Monaco,
React-Monaco, CodeMirror, `TextPanelEditor`, Codicon CSS/font, datasource
editor asset, worker, or WASM identities. The analyzer deliberately uses
module identities and emitted filenames rather than minified string matches,
which would produce false positives from unrelated package metadata.

No Grafana application-wide CSS bundle was imported. The provider carries only
the enumerated view CSS closure.

## 21. Multiple-dashboard result

**PASS.** Two compatible dashboard instances used independent scene/query/
resize lifecycles with one runtime, one React/ReactDOM identity, shared plugin
and datasource caches, one portal root, and the same static assets. Removing
the first dashboard left the second functional. Final provider release removed
instance resources; remount did not duplicate static downloads.

## 22. Portal regression

**PASS.** The targeted issue #43 Popover and real Grafana Modal regressions
passed. Provider content stayed in the controlled, reference-counted body-child
root, retained React/Emotion context, used the configured provider icon base,
and recorded zero direct-body fallbacks. No separate uncontrolled portal asset
root appeared.

## 23. Emotion regression

**PASS.** The targeted issue #41 host-first regression passed. Host
`@emotion/react`, provider `@emotion/react`, and provider `@emotion/css`
remained distinct owners. Static URL-bearing CSS stayed provider-owned. The
asset experiment did not redesign cache insertion, add `@emotion/styled`, or
produce unbounded style/static-asset growth.

## 24. Host CSS regression

**PASS.** The targeted issue #40 profiles A–F regression passed. The added
font rule is scoped to the marked provider dashboard and portal roots, host
sentinels retained their styles, and the `LegendLabel` normalization remained
effective. The experiment imported no full Grafana global stylesheet.

The inherited experiment runtime CSS still contains small POC root/body rules
from earlier harness CSS. They caused no measured collision, but issue #45
must separate production provider CSS from harness-only global rules instead
of treating the POC stylesheet as a release artifact.

## 25. CSP inputs

Issue #42 now has the complete tested asset-input inventory:

- same-origin external CSS files;
- two same-origin WOFF2 font files referenced by relative CSS URLs;
- one same-origin SVG fetched and inlined by `react-inlinesvg`;
- content-hashed JavaScript chunks and dynamic imports;
- provider `@emotion/react` and `@emotion/css` generated style elements;
- inline style attributes used by uPlot/Grafana components and controlled
  portal positioning/layer tokens;
- local Grafana API/datasource connections; and
- no CDN, external asset origin, data URL, blob URL, worker, WASM, or icon font
  observed in this cell.

This unblocks execution of the strict-CSP experiment. It does **not** claim CSP
compatibility, nonce propagation, or a final CSP policy.

## 26. Required production contract

The production provider must:

1. publish/deploy an enumerable view-only asset graph with exact provenance;
2. keep module-graph and Grafana path-based asset resolution explicit;
3. install one normalized same-origin asset base before Grafana imports and
   reject conflicting bases per realm;
4. preserve relative CSS/font colocation through root and nested deployment;
5. deploy path-stable upstream icons under an exact versioned base;
6. validate status and MIME type, not status alone;
7. own scoped `@font-face` declarations and documented fallbacks;
8. keep editor assets out of the view profile with hard build guards;
9. include hashes, MIME types, cache policy, source identity, and licensing
   evidence in a provider manifest; and
10. support a fully local/offline asset profile.

Host authentication and Grafana API routing remain separate from static asset
ownership.

## 27. Limitations

- Only Text, Stat, Time series, TestData, and the bounded portal surfaces were
  tested.
- Only Grafana 13.2.3 / React 19.2.8 / Scenes 8.13.5 and Chromium were tested.
- Arbitrary panel, datasource, theme, locale, and plugin assets are not covered.
- CSS is shared/preloaded at provider-UI granularity; per-feature CSS laziness
  is not established.
- The stable icon compatibility path relies on an exact versioned base rather
  than a content-hashed filename.
- Font fallback is usable but not visually identical.
- Cache headers came from Vite preview; a production server was not built.
- CSP, SSR/hydration, package publication, signing, and broad accessibility
  are outside this experiment.
- The POC CSS graph still contains harness-only global rules that issue #45
  must exclude from production packaging.

## 28. Decision

**PASS.** The verified Phase 2 candidate provider can package and resolve its
view-only font, icon, CSS, and static assets under the tested local root,
nested, and offline deployment profiles. It does not require Grafana's
application asset server or an internet/CDN asset origin for rendering.

The selected direction is a provider-owned, manifest-enumerated static closure
with build-relative module assets plus a pre-import, same-origin,
version-specific Grafana-compatible asset base for path-addressed assets.

## 29. Architecture impact

This result strengthens the bounded provider model:

- provider ownership includes presentation assets, not only JS modules;
- the provider admission/identity contract must include asset identity/base;
- one provider runtime identity implies one compatible Grafana path-asset base
  per realm;
- static assets must be deployed with independently lazy JS features without
  merging those features;
- CSS extraction paths are part of artifact compatibility and must be tested
  after consuming the prebuilt provider; and
- licensing/provenance manifests must include fonts, icons, and CSS packages.

No Phase 0 behavior or production package export changed.

## 30. Inputs to #42/#45

**Issue #42 is fully unblocked to begin.** It now has complete asset origins,
URL forms, file types, runtime-generated style paths, and negative cases for
the verified cell. Its own experiment must still decide and test nonces,
inline-style treatment, and strict directives.

**Issue #45 receives sufficient asset inputs.** It must turn the experiment
copy rules into a production-shaped asset lifecycle, remove harness-only global
CSS, define manifest generation/validation, preserve relative CSS dependencies,
and verify provider install/uninstall/cache behavior. It must not broaden the
supported panel/datasource cell implicitly.

## 31. Follow-up

1. Execute issue #42 against the exact origins/style/URL inventory above.
2. Use issue #45 to replace experiment-only copying with a production-shaped
   provider asset/deployment lifecycle and remove harness-only CSS.
3. Feed Grafana font/icon and third-party CSS provenance into issue #21 review.
4. Consider CSS capability-level splitting only as a measured bundle/lifecycle
   optimization; do not merge or abandon the independently lazy JS features.
5. Add new asset categories only through manifest and browser-network evidence.

## 32. Final status

**PASS**

Issue #44 is ready to close after human review. The result proves only that the
verified Phase 2 candidate provider can package and resolve its view-only
font/icon/CSS/static assets under the tested local root, nested, and offline
profiles.
