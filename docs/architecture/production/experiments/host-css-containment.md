# Host CSS Collision Containment Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Host CSS collision containment (GitHub issue #40) |
| Status | Bounded technical experiment complete; revalidated against merged Experiment E |
| Created | 2026-10-14 |
| Last Updated | 2026-10-14 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Presentation profile | View-only, light theme, scoped light DOM |
| Final status | **PASS** |

This document follows the canonical Phase 1 terminology in the
[project roadmap](../../../project/roadmap.md). It records disposable experiment
evidence, not production implementation or universal CSS isolation. Generated
computed-style evidence and screenshots under
`artifacts/experiments/host-css-containment/` are ignored.

After the branch was rebased onto current `main`, the experiment was revalidated
against the merged [React-externalized provider](./react-externalized-provider.md)
boundary at `4670654`. A disposable cross-boundary browser probe built the real
Experiment E provider and host artifacts, applied this experiment's exact host
profiles and scoped normalization, and exercised real Text, Stat, Time series,
TestData, host sentinels, admission identity, and per-profile cleanup. The
committed Experiment E admission/browser suites and the original issue #40
lifecycle suite were rerun independently.

## 2. Hypothesis

The selected [styling-containment strategy](../styling-containment-strategy.md)—
scoped light DOM with provider-owned styles, theme, Emotion cohort, portal, and
asset policy—can preserve real Grafana Text, Stat, and Time series rendering in
a host with aggressive but realistic CSS. Provider styles must also leave host
content outside the provider surface unchanged.

A pass is limited to the exact version cell and CSS matrix below. It does not
mean that light DOM prevents arbitrary host selectors from reaching provider
content.

## 3. Predeclared criteria

The predeclared PASS, FAIL, and INCONCLUSIVE criteria were not changed after
the run. PASS required real Text, Stat, Time series, TestData, PanelChrome,
responsive resize, shared portal ownership, two instances, clean lifecycle,
one React runtime, host-sentinel stability, and no iframe, Shadow DOM, full
Grafana reset, or blanket `!important` repair.

All required criteria passed after one measured collision was repaired inside
the experiment's scoped provider stylesheet. No production source was changed.

Revalidation through Experiment E also passed. Its provider artifact retained
zero bundled React, ReactDOM, JSX-runtime, or JSX-dev-runtime implementations;
all host/provider identity checks were true before the Grafana implementation
loaded; and duplicate-identity and unsupported-version probes still rejected
before implementation load.

## 4. Baseline

The baseline rendered the real schema-42 fixture through the shared provider
cohort:

```text
dashboard UID
  -> constrained dashboard retrieval/conversion
  -> shared Grafana/Scenes/Runtime/Emotion cohort
  -> independently lazy Text, Stat and Time series renderers
  -> real TestData /grafana/api/ds/query path
  -> native light DOM and canvas
```

At a 1,280 px browser viewport, the measured baseline was:

| Surface | Measurement |
| --- | ---: |
| Provider root | 1,120 px wide; 14 px Inter/system font; `border-box` |
| Text panel | 368 × 220 px |
| Stat panel | 368 × 220 px |
| Time series uPlot | 726 × 290 px |
| Time series canvas | 726 × 290 px |
| Legend label button | 140.89 × 20.58 px; transparent background; zero border/padding |
| Emotion markers | One document-head `style[data-emotion="css"]` owner |

The Text heading and paragraph were readable, Stat displayed the real
percentage with non-white threshold/background colors, and Time series showed
the real transformed `Phase 0 Pulse Signal` line/fill, axes, and legend.

## 5. Host CSS matrix

| Profile | Host rules exercised | Result |
| --- | --- | --- |
| Baseline | Explicit host typography, controls, SVG/canvas and container presentation | PASS |
| A — reset | Universal border-box, heading/paragraph margin reset, inherited controls, block/max-width media | PASS |
| B — typography | Courier host body, 19 px/1.85 typography, stronger descendant line-height and letter spacing | PASS |
| C — layout/sizing | Zero minimum widths, media auto-sizing/max-width, generic container/content/panel overflow patterns | PASS |
| D — controls | Global button/input/select padding, border, pill radius, background and font | PASS after scoped legend normalization |
| E — framework-like | High-specificity host-root descendants for generic classes, headings and canvas/SVG alignment | PASS |
| F — controlled `!important` | Media max-width plus control box-sizing/font only | PASS; no provider `!important` added |

The profiles are deterministic and intentionally realistic. They do not use
rules such as `display:none !important` or fixed one-pixel canvases whose only
purpose would be to defeat any light-DOM integration.

## 6. Provider root

The experiment uses the selected conceptual surface:

```html
<section
  class="grsdk-experiment-provider-surface"
  data-grsdk-surface="dashboard"
  data-grsdk-provider="grafana-13.2.3"
  data-grsdk-theme="light"
  data-grsdk-instance="host-css-primary"
></section>
```

The shared portal receives the matching surface/provider/theme markers. The
root establishes only the documented minimum: border-box descendants,
font/color/line-height, light color scheme, `min-width: 0`, `max-width: 100%`,
dashboard/list sizing, form typography inheritance, media max-width, uPlot
containment, and one exact legend repair. It does not use `all`, a copied reset,
Shadow DOM, or Grafana `GlobalStyles`.

The names remain experiment-only and are not frozen public selectors.

## 7. Cascade analysis

Most profiles were naturally safe or resolved through root inheritance and
size containment:

- reset media sizing agreed with the provider's border-box/max-width policy;
- body typography stopped at the provider's explicit font/color/line-height;
- generic `.container`, `.content`, and `.panel` selectors did not match or
  did not override the rendered surfaces materially;
- fixed grid sizing plus `min-width: 0` prevented intrinsic overflow; and
- component-local Emotion classes retained Text, Stat, PanelChrome, and plot
  presentation.

One genuine specificity collision occurred. Grafana UI's pinned
`VizLegendListItem` renders a native button and styles it with one Emotion class
(`LegendLabel`). Profile D's `body[data-host-css-profile] button` selector has
higher specificity, so it replaced the transparent background, zero border,
and zero padding. Before repair the legend grew from 20.58 px to 46.95 px and
the fixed-height plot shrank from 290 px to 267 px.

The experiment repaired the cause, not the symptom: a provider-scoped,
version-coupled selector reinforces only the exact `-LegendLabel` surface. It
does not reset every Grafana button. After repair, all legend and plot metrics
matched baseline in every profile.

## 8. Computed style evidence

Every profile records before-mount, during-render, and after-unmount computed
styles for host heading, text, button, input, container, SVG, and canvas. During
render it additionally records provider, panel, Text heading/paragraph/title,
Stat colors, Time series canvas/uPlot/legend, document overflow, portal markers,
and Emotion markers.

Across all final profiles:

- provider root remained 1,120 px, 14 px, Inter/system, and border-box;
- Text and Stat remained 368 × 220 px;
- uPlot and canvas remained 726 × 290 px;
- legend remained 140.89 × 20.58 px with transparent background and zero
  border/padding;
- document `scrollWidth` did not exceed `clientWidth`; and
- host computed styles and element dimensions were equal before mount, during
  provider rendering, and after provider unmount within each profile.

Viewport-relative `x`/`y` coordinates remain in the diagnostic evidence but
are not a containment invariant: focusing the Time series legend can scroll
the document without changing host CSS or intrinsic geometry.

The direct Experiment E replay produced the same 20.58 px legend height and
290 px plot height for baseline and Profiles A–F. Every profile recorded all
React/ReactDOM/JSX admission identities as true, a real
`/grafana/api/ds/query` request, zero iframe/navigation elements, zero SystemJS
requests, stable host sentinel styles/dimensions, and zero instance resources
after unmount.

Cross-profile host differences were intentional proof that the hostile styles
were active. For example, Profile B changed the host heading line height from
32.4 px to 48.6 px while the provider root stayed at 14 px/21 px.

## 9. Text result

**PASS.** The exact real Text renderer displayed the Markdown heading,
paragraph, bold text, and resolved variable content under every profile.
PanelChrome remained visible; heading font size stayed above 20 px; paragraph
line height stayed readable; wrapping and overflow remained bounded. No custom
replacement markup was used.

## 10. Stat result

**PASS.** The exact Stat renderer consumed real TestData query output and
displayed the expected percentage under every profile. The BigValue layout,
centering, unit formatting, field configuration, and green threshold/background
surfaces remained visible and bounded at 368 × 220 px.

## 11. Time series result

**PASS.** The exact Time series renderer consumed real TestData data and the
verified transformation, then rendered the real uPlot canvas, axes, green
line/fill, and `Phase 0 Pulse Signal` legend. The legend remained keyboard
focusable in every profile. Canvas and plot dimensions matched baseline after
the scoped Profile D repair.

## 12. Host protection result

**PASS.** Provider mounting, Emotion insertion, panel lazy loading, portal
creation, UID changes, unmount, and remount did not change computed style or
geometry for host-owned heading, paragraph, button, input, container, SVG, or
canvas sentinels. Host rules continued to style those sentinels according to
the active profile. Provider-authored selectors target dashboard/portal
surfaces and never `html`, `:root`, `body`, or unrelated host nodes.

## 13. `!important` result

The provider uses zero `!important` declarations. Profile F's realistic
`max-width` media rule and form `box-sizing`/font rules were compatible with the
provider. This does not establish support for a host that deliberately applies
`!important` to panel dimensions, canvas height, internal display/position,
colors, or Grafana internal classes. Such rules belong outside the initial
host contract rather than triggering a CSS specificity arms race.

## 14. Layers/scoping findings

Root scoping plus explicit provider inheritance and sizing is sufficient for
the tested profiles. `:where()` is useful for low-specificity host/reset rules,
but it cannot repair a higher-specificity host selector after the fact. The
legend result shows that a small audited set of version-coupled provider
normalizations may be necessary where upstream components depend on a
single-class Emotion rule.

Cascade layers were not required. They could organize provider-authored static
CSS, but they cannot be assumed to control unlayered Emotion rules or hostile
unlayered host `!important` rules. CSS containment properties were not used as
selector isolation because they can alter measurement and overflow.

## 15. Emotion observations

`@emotion/css` inserted one `style[data-emotion="css"]` owner in the document
head. It remained one owner across compatible profiles and mounts; Grafana
component styles did not restyle host sentinels. The Profile D finding is a
specificity issue, not duplicate Emotion identity or unbounded style growth.

This experiment did not create a host-owned Emotion cache, test hydration
markers, CSP nonces, or reverse insertion order. Those remain inputs to issue
#41. A React `CacheProvider` alone would not relocate the separate
`@emotion/css` singleton used by Grafana UI.

The Experiment E artifact boundary introduced no additional Emotion owner or
new measured collision. React externalization and pre-initialization admission
did not change the known Profile D specificity result.

## 16. Multiple-instance result

**PASS.** Two compatible dashboard instances rendered two real Time series
plots with independent scenes, queries, and ResizeObservers while sharing the
same Runtime, provider cohort, plugin/datasource caches, portal, and one
React/ReactDOM identity. Removing the secondary reduced observer ownership and
left the primary plot functional. The per-profile primary teardown returned all
instance resource counters to zero. No cross-instance style corruption
occurred.

## 17. Lifecycle result

**PASS.** The experiment exercised:

```text
mount -> hostile CSS -> real render -> UID switch -> resize
  -> unmount -> cleanup -> remount -> real render
```

Switching to `grsdk-phase0-poc-alt` displayed `phase0-alt` and removed the
query-backed panels; switching back produced a new valid Text/Stat/Time series
graph. Resizing the provider from 1,120 px to 640 px delivered a native
ResizeObserver event and reduced the Time series plot from 726 px to 622 px.
After unmount, all instance-owned resource counters returned to zero and the
owned empty portal root was removed. Remount succeeded through the same
compatible runtime identity.

## 18. Visual evidence

Ignored screenshots exist for baseline and Profiles A–F. They supplement—not
replace—the computed styles, DOM dimensions, query assertions, focus check,
observer evidence, and resource accounting. The screenshots show consistent
provider geometry and renderer presentation while host sentinels visibly adopt
their intended profile styles.

No pixel-perfect or universal browser parity claim is made.

## 19. Collision catalogue

| Collision class | Observation | Classification |
| --- | --- | --- |
| Universal border-box | Agreed with provider baseline | Naturally safe |
| Heading/paragraph margin reset | Real Text/PanelChrome retained component styles | Naturally safe in tested source order |
| Body typography/inheritance | Provider root fixed font/color/line-height | Solved by scoped root |
| Media max-width/auto sizing | Canvas/uPlot retained measured dimensions | Solved by scoped root plus feature CSS |
| Generic framework class rules | No material match/corruption in fixture | Harmless for tested DOM; not a universal guarantee |
| Global control styling | Overrode Time series legend button; 26.37 px height increase before repair | Requires exact scoped provider normalization |
| Controlled `!important` media/control rules | No renderer corruption | Harmless for tested properties only |
| Provider styles reaching host | No host computed-style or dimension delta during mount/unmount | Contained by provider selectors |
| Emotion insertion order | No observed host leak; one higher-specificity collision | Deeper coexistence delegated to issue #41 |

## 20. Required host contract

The initial Phase 2 contract should require the host to:

1. provide a connected, nonzero container and permit `min-width: 0` on its
   flex/grid integration point;
2. permit provider-owned font, color, line-height, box-sizing, overflow, and
   visualization sizing within declared dashboard and portal surfaces;
3. avoid selectors aimed at provider internals, hashed Emotion classes, or
   versioned Grafana DOM;
4. avoid broad `!important` overrides of internal display, position, width,
   height, padding, color, canvas, SVG, and overflow semantics;
5. permit provider-owned document-head Emotion styles and the declared shared
   portal root under the applicable CSP;
6. load only one compatible provider style/Emotion identity per realm; and
7. treat project-owned outer hooks—not Grafana classes—as the customization
   surface.

Common border-box resets, host typography, ordinary form styling, responsive
media defaults, and another design system are not categorically forbidden;
they are admitted only to the extent covered by conformance profiles.

## 21. Limitations

- One Chromium/desktop viewport and the exact verified version cell were used.
- Only light theme and Text, Stat, Time series, and controlled TestData were
  exercised.
- No Table, arbitrary plugin/datasource, authoring UI, V2 dashboard, dark
  theme, RTL, browser zoom, or mobile accessibility matrix was tested.
- The portal root/lifecycle was tested, but a complete tooltip/menu/modal/focus
  overlay matrix remains separate conformance work.
- Host Emotion coexistence, hydration, CSP nonce, insertion points, and
  micro-frontends remain issue #41 inputs.
- The scoped `-LegendLabel` reinforcement is deliberately version-coupled and
  must be revalidated for each provider cell.
- The merged Experiment E Vite/Rolldown package boundary is now covered, but
  other consumer bundlers remain outside this experiment.

## 22. Decision

**PASS.** Scoped light DOM remains viable for the initial production
presentation architecture. The result supports an explicit, audited provider
baseline plus a documented host contract. It does not support either extreme:
depending only on upstream Emotion classes against arbitrary host CSS, or
shipping a broad global reset to overpower the host.

## 23. Architecture impact

The selected styling strategy does not need revision. Phase 2 planning should
add a provider-owned, versioned **presentation normalization catalogue** beside
panel capability metadata. Each rule must identify its upstream component,
collision evidence, supported provider cell, source/provenance, and conformance
test. Generic global resets and blanket specificity escalation remain forbidden.

The dashboard and portal markers, root sizing contract, one shared Emotion
cohort, lazy uPlot CSS, and cleanup ownership remain consistent with the
[provider architecture](../bridge-provider-architecture.md),
[runtime isolation model](../runtime-isolation-model.md), and
[bundle strategy](../bundle-dependency-strategy.md).

## 24. Inputs to Emotion experiment

Issue #41 may proceed. It should specifically test:

- host `@emotion/react` and `@emotion/css` identities alongside the provider;
- insertion points and reversed host/provider source order;
- SSR/hydration `data-emotion` markers;
- CSP nonce propagation;
- host and provider rules with equal/higher specificity;
- two roots and the shared portal; and
- whether provider-keyed `@emotion/css/create-instance` is necessary or would
  break Grafana class generation/provenance.

The legend collision should be retained as a known conformance fixture.

## 25. Follow-up

1. Execute issue #41 without changing the selected light-DOM model merely to
   make a test pass.
2. Turn the experiment's root/portal contract and normalization catalogue into
   provider contract tests during Phase 2 planning.
3. Add dark theme, overlays, CSP, accessibility/zoom, and mobile/narrow-host
   profiles before broadening support claims.
4. Re-run the complete matrix for every supported Grafana/provider cell.

## 26. Final status

**PASS**

PASS means only that the initial scoped-light-DOM contract survived Profiles
A–F for Grafana 13.2.3, React/ReactDOM 19.2.8, and Scenes 8.13.5 with the
controlled capabilities. The result is now validated against the merged
Experiment E production-shaped provider boundary, and issue #40 is ready to
close after human review. It does not prove universal CSS isolation.
