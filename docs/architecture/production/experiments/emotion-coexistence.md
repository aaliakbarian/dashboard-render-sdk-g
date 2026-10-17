# Host and Provider Emotion Coexistence Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Grafana React SDK maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Host and provider Emotion coexistence (GitHub issue #41) |
| Status | Bounded technical experiment complete |
| Created | 2026-10-17 |
| Last Updated | 2026-10-17 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime cell | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Emotion cell | `@emotion/react` 11.14.0; `@emotion/cache` 11.14.0; `@emotion/css` 11.13.5 |
| Presentation profile | Issue #40 scoped light DOM, light theme |
| Final status | **PASS** |

This document follows the canonical Phase 1 terminology in the
[project roadmap](../../../project/roadmap.md). It records experiment evidence,
not production implementation or a general Emotion/Grafana compatibility claim.
Generated bundle and browser evidence under
`artifacts/experiments/emotion-coexistence/` is ignored.

## 2. Hypothesis

An independently Emotion-styled React host can coexist with the
[React-externalized provider](./react-externalized-provider.md) in one document
and JavaScript realm. The host and provider can own distinct React Emotion
caches, while Grafana's independent `@emotion/css` path remains observable,
without class ownership ambiguity, style mutation, rendering corruption,
unbounded style growth, or lifecycle leaks.

The claim is restricted to the exact version cell above, one compatible
provider/runtime owner, and the scoped light-DOM contract proved by
[issue #40](./host-css-containment.md).

## 3. Predeclared criteria

The PASS, FAIL, and INCONCLUSIVE definitions were fixed before execution. PASS
required unique independently owned caches; stable host styles before, during,
and after provider activity; real Text, Stat/TestData, and transformed Time
series; host-first and provider-first insertion; later dynamic host styles;
lazy provider features; portal styling; two dashboards; bounded 20-cycle style
growth; one React identity; and no iframe, Shadow DOM, full Grafana stylesheet,
blanket `!important`, shell, navigation, or SystemJS.

All required criteria passed. A deliberately invalid same-key configuration
was rejected before rendering. A non-gating exploratory second top-level
provider-root probe did not establish support, so multiple provider roots are
not included in the decision; multiple dashboards inside one compatible
provider owner did pass.

## 4. Baseline

The production-shaped path was:

```text
host-owned React/ReactDOM 19.2.8
  -> host @emotion/react cache
  -> Experiment E admission (version + object identity)
  -> provider artifact
       -> provider @emotion/react cache
       -> provider @emotion/css default singleton
       -> one Grafana/Scenes/Runtime cohort
       -> real Text, Stat, Time series and TestData
  -> scoped light DOM + provider portal
```

The root install supplied one physical source location per exact Emotion
package version. The built artifacts intentionally produced separate host and
provider runtime module ownership: host Emotion code is in the host artifact;
provider Emotion code is in the provider's single `provider-emotion-*` cohort
chunk. Package version equality therefore did not stand in for cache identity.

In the host-first case the host heading was 27 px Georgia and
`rgb(76, 29, 149)` before provider mount and retained the same complete
computed-style record after mount and unmount. During real rendering the three
style owners were:

| Owner | Key | Cache identity | Tags | Representative rules |
| --- | --- | --- | ---: | ---: |
| Host `@emotion/react` | `grsdk-host` | `host-react-cache-1` | 1 | 3–4 |
| Provider `@emotion/react` | `grsdk-provider` | `provider-react-cache-1` | 1 | 2 |
| Provider `@emotion/css` | `css` | `provider-css-cache-1` | 1 | 129–132 |

Browser identity comparisons proved all three cache objects distinct.

## 5. Emotion usage inventory

| Path | Package/API | Ownership | Evidence |
| --- | --- | --- | --- |
| Host sentinels | `@emotion/react` `CacheProvider` and `ClassNames` | **HOST OWNED** | Host cache/key/classes and dynamic insertion |
| Provider sentinel and portal | Provider artifact's `@emotion/react` `CacheProvider` and `ClassNames` | **PROVIDER OWNED** | Provider cache/key/classes across normal DOM and portal |
| Grafana UI `useStyles2` and panel chrome/renderers | Provider-cohort Emotion dependencies, predominantly `@emotion/css` | **PROVIDER OWNED DEFAULT SINGLETON** | `data-emotion="css"`, Grafana rule/class insertion |
| Provider static CSS | Lazy-panel and issue #40 scoped CSS | **PROVIDER OWNED STATIC** | Provider artifact CSS assets |
| `@emotion/styled` | Not installed at the root and no repository usage found | **NOT USED** | Source/package inventory |

The provider bundle report has one shared Emotion owner inside the provider
cohort. React, ReactDOM, JSX runtime, and JSX-dev runtime have zero
implementation modules in that provider artifact; the host artifact has the
single React implementation owner.

## 6. Host cache

The host creates one explicit cache with key `grsdk-host`. Its `CacheProvider`
wraps only host content. Host-generated classes all start with
`grsdk-host-`; host heading, button, input, generic container, and dynamically
mounted output retained their expected computed styles while provider panels
loaded and rendered.

The host cache is **host lifetime**. Provider mount, lazy loading, UID changes,
unmount, and remount neither flushed nor claimed its style tag. Its inserted
entry count remained 3 after the warm-up state in the 20-cycle test.

## 7. Provider cache

The provider module creates one explicit `@emotion/react` cache with key
`grsdk-provider`. It is provider/runtime lifetime, not dashboard lifetime.
Compatible dashboard instances and remounts reuse the same object and tag.
Provider-generated experiment classes start with `grsdk-provider-`.

The cache normally inserts into `document.head`. The experiment also measured
a provider marker and `prepend: true`; neither was needed for correct rendering.
No cache object, key, or style tag is shared with the host.

## 8. `@emotion/css` ownership

`@emotion/css` is a third, independent path. Pinned source
`node_modules/@emotion/css/src/index.ts` creates its package-default singleton
through `createEmotion({ key: 'css' })`. The provider's React `CacheProvider`
does not control it. The browser recorded a distinct cache object, key `css`,
one `style[data-emotion="css"]` tag, and bounded Grafana rule insertion.

The singleton is owned operationally by the single compatible provider cohort.
The required host contract must reserve key `css`, prohibit host mutation or
`flush()` of that singleton, and admit only one compatible provider cohort per
realm. This is clean enough for the verified provider cell because ownership,
key, tag, lifetime, and class path are observable.

Emotion documents `@emotion/css/create-instance` as the customization path for
keys, containers, and nonces. It is technically possible in isolation, but
Grafana source imports the default `@emotion/css` entry broadly. Replacing that
singleton would require an audited provider build alias or source adaptation
and could change upstream semantics. It was not done. Current evidence does not
show a production coexistence problem requiring that remediation.

Upstream references: [CacheProvider](https://emotion.sh/docs/cache-provider),
[`@emotion/cache` options](https://emotion.sh/docs/%40emotion/cache), and
[`@emotion/css` custom instances](https://emotion.sh/docs/%40emotion/css).

## 9. Unique-key negative test

The experiment's ownership guard rejects two independent React caches using
`grsdk-conflict` with typed code `duplicate-emotion-cache-key` and both owners
listed. The normal host/provider caches remain `grsdk-host` and
`grsdk-provider`; the negative path never renders.

Visible corruption is not required to establish invalidity. Emotion's own
cache guidance requires unique keys for multiple caches and warns that matching
keys can compete for the same style elements. Production admission must reject
this ambiguity before provider initialization.

## 10. Insertion-order matrix

| Case | Measured behavior | Result |
| --- | --- | --- |
| Host first, provider second | Host tag existed first; provider React and `css` tags appeared during render | PASS |
| Provider first, host content later | Real panels rendered before host sentinels; later host tag/classes did not change provider styles | PASS |
| Host dynamic styles after provider | A new host class/rule rendered without changing provider computed styles | PASS |
| Lazy Text after host styles | Exact Text source loaded and rendered | PASS |
| Lazy Stat after host styles | Exact Stat plus real TestData rendered | PASS |
| Lazy Time series after host styles | Exact Time series plus transform/uPlot rendered | PASS |

Source order is observable but was not outcome-sensitive for these owners:
their generated classes are applied to disjoint elements and the issue #40
scoped contract handles known host/provider selector overlap. Cache
initialization order alone does not determine tag order; first insertion does.
Selector specificity and class application remain the deciding cascade inputs.
The portal's DOM location outside the provider subtree did not change Emotion
context or class ownership because React context crosses the portal.

## 11. Container/insertion-point analysis

| Model | Host index | Provider React index | Provider `css` index | Result |
| --- | ---: | ---: | ---: | --- |
| A — shared `document.head`, unique keys | 16 | 17 | 22 | PASS |
| B — distinct marked positions in `document.head` | 9 | 11 | 22 | PASS |
| C — provider `prepend` | 17 | 0 | 22 | PASS |

**Selected initial model: Model A.** Shared `document.head` with unique keys is
the narrowest model supported by measured coexistence. A dedicated provider
insertion location is not required by this version cell, and prepend is not
required or recommended. Model B remains an available future tool when a
specific CSP, SSR/hydration, micro-frontend, or deterministic ordering contract
justifies its complexity. It does not relocate the independent default
`@emotion/css` singleton by itself.

## 12. Class ownership

The experiment distinguishes five concepts explicitly:

- **package identity** — exact package/version and built module owner;
- **cache object identity** — three objects compared directly in the browser;
- **cache key** — `grsdk-host`, `grsdk-provider`, and `css`;
- **style-element ownership** — attributed from exact `data-emotion` values;
- **class-name ownership** — host/provider prefixes and Grafana `css-*` names.

Host sentinels received host-prefixed classes, provider sentinels and portal
content received provider-prefixed classes, and Grafana surfaces used the
provider `css-*` path. No result relies on hash-collision probability.

## 13. Host-to-provider interference

**PASS.** Provider sentinel computed styles were identical before and after
later host content/style insertion. Real panel DOM and uPlot remained usable.
The host cache did not hydrate, mutate, remove, or flush provider tags. Profile
D's previously known control-selector collision remains resolved by issue
#40's targeted `LegendLabel` normalization; this experiment introduced no new
collision.

## 14. Provider-to-host interference

**PASS.** The complete host computed-style record remained equal across
provider mount, all three lazy feature loads, portal creation, UID switching,
provider unmount, and remount. Provider caches did not claim, mutate, remove,
or flush the host tag.

## 15. Text result

**PASS.** The real Grafana 13.2.3 Text renderer, PanelChrome, and Markdown
rendered through the Experiment E provider while both React Emotion owners and
the Grafana `css` singleton were active. No custom replacement renderer, full
Grafana stylesheet, iframe, or Shadow DOM was used.

## 16. Stat result

**PASS.** The real Stat renderer executed the real controlled TestData query,
displayed the percentage, and retained its unit/threshold/background behavior.
The request log contained `/grafana/api/ds/query`; no fabricated `PanelData`
was injected.

## 17. Time series result

**PASS.** The real Time series renderer consumed real TestData, applied the
verified rename-by-regex transformation, displayed `Phase 0 Pulse Signal`, and
rendered uPlot/canvas. Resize reduced the plot width as expected. The exact
issue #40 legend normalization remained effective under the host Emotion
fixture.

## 18. Portal result

**PASS.** A provider `ClassNames` child rendered through React `createPortal`
into the host-owned portal target with a `grsdk-provider-*` class and the
expected provider color/background. This proves provider Emotion context and
style ownership across the portal only. Keyboard/focus containment, stacking,
and z-index policy remain issue #43.

## 19. Multiple-dashboard result

**PASS.** Two compatible dashboards inside one provider owner rendered two
real Time series plots with independent scene/query/ResizeObserver lifecycles.
They shared one provider React cache, one provider `css` singleton, the Grafana
cohort, and plugin/datasource caches. Removing one did not affect the other;
after final teardown instance resources returned to zero.

## 20. Multiple-provider-root analysis

Multiple top-level provider roots are not part of the supported result. The
current architecture defines one provider/runtime owner per compatible realm
and supports multiple dashboard instances beneath it. An exploratory
non-gating attempt to mount a second top-level provider app did not preserve
the rendered dashboard surfaces, so no coordinated-root claim is made and the
probe was not retained as a supported harness path.

Phase 2 must reject or avoid independently initialized provider roots until a
separate design defines controller, runtime-lease, portal, and cache
coordination. This does not affect the required two-dashboard result.

## 21. Style-growth result

**PASS.** After warming both fixture UIDs, 20 cycles executed:

```text
mount -> lazy Text/Stat/Time series/TestData -> UID switch -> switch back
  -> unmount -> resource-zero assertion -> remount
```

Baseline and final cache evidence were identical: host `3/1`, provider React
`2/1`, and provider `css` `90/1` inserted entries/tags. The final document had
the same three Emotion tags and rule counts as the warmed baseline. No duplicate
provider tags or unbounded rule growth appeared.

Provider-lifetime rules intentionally remain after a dashboard unmount. Their
persistence is caching, not a dashboard leak.

## 22. Cleanup/lifetime model

| Resource | Lifetime | Observed cleanup |
| --- | --- | --- |
| Host cache/tag/classes | Host | Survives provider teardown unchanged |
| Provider React cache/tag/rules | Provider/runtime | Reused across dashboards/remounts; bounded |
| Provider `@emotion/css` singleton/tag/rules | Provider cohort | Reused across dashboards/remounts; bounded |
| Dashboard scene/query/observers | Dashboard instance | Released; counters returned to zero |
| Provider portal children | Dashboard/provider render | Empty after unmount |
| Portal target and cache infrastructure | Provider/runtime/host boundary | May outlive one dashboard by design |
| Lazy feature static CSS | Provider deployment | Loaded once and cached |

UID switching did not leak active scenes or instance resources. The evidence
does not claim garbage-collector observability for detached browser nodes; it
does prove stable connected style tags/rules and zero instrumented instance
resources.

## 23. Hydration/SSR analysis

SSR panel rendering remains unsupported and was not implemented. Emotion uses
the cache key in `data-emotion` ownership/hydration markers, so the unique
`grsdk-host`, `grsdk-provider`, and `css` values remain distinguishable. A
future SSR design must preserve those keys across server and client, prevent a
host cache from claiming provider markers, and define provider artifact import
behavior without browser globals. This experiment is client-only evidence.

## 24. CSP inputs

No CSP headers or enforcement were changed. Inputs for issue #42 are:

- host React cache creates `style[data-emotion="grsdk-host"]`;
- provider React cache creates `style[data-emotion="grsdk-provider"]`;
- provider `@emotion/css` creates `style[data-emotion="css"]`;
- custom React caches accept a `nonce` option, but this experiment supplied no
  nonce;
- the default Grafana `@emotion/css` singleton has no provider-supplied nonce
  in the verified path;
- custom `@emotion/css/create-instance` supports nonce/container options but
  would require an explicit upstream-import strategy; and
- static provider CSS assets are separate from dynamic Emotion tags.

These inputs are sufficient to begin CSP analysis. They do not establish CSP
compatibility.

## 25. Collision/issue catalogue

| Issue | Evidence | Disposition |
| --- | --- | --- |
| Same key for independent React caches | Typed rejection before rendering | Forbidden production configuration |
| Host/provider package versions match | Does not prove cache identity | Always validate cache/module ownership separately |
| Default `@emotion/css` outside `CacheProvider` | Separate key/object/tag, bounded across stress | Provider-cohort ownership; reserve `css`; no remediation yet |
| Head append ordering | Correct under both mount orders and later dynamic insertion | Supported initial model |
| Marked insertion positions | Correct, more explicit ordering | Optional future tool |
| Provider prepend | Correct but unnecessary | Do not select initially |
| Issue #40 Profile D selector | Targeted legend normalization remains effective | Existing scoped contract retained |
| Multiple dashboard instances | Shared caches, independent lifecycles | Supported |
| Multiple top-level provider roots | Not established | Unsupported pending separate design |
| Provider-lifetime retained rules | Counts stable across 20 cycles | Cache, not leak |

## 26. Required production contract

Phase 2 should require:

1. host ownership of the sole React/ReactDOM runtime, admitted by version and
   actual object identity before Grafana singleton initialization;
2. one compatible provider/runtime/Emotion cohort per JavaScript/document
   realm;
3. an explicit host `@emotion/react` cache key distinct from provider keys;
4. provider React key `grsdk-provider` or a manifest-declared stable equivalent;
5. reservation of the provider `@emotion/css` key `css` and no host mutation,
   hydration, or flushing of its tag/cache;
6. shared `document.head` insertion with unique keys as the initial model;
7. no dependency on prepend and no required dedicated insertion point;
8. issue #40's scoped light-DOM root and targeted version-coupled repairs;
9. one provider owner capable of hosting multiple dashboard instances, not
   independently initialized provider roots;
10. provider-lifetime cache/style accounting distinct from dashboard cleanup;
11. pre-render typed rejection for duplicate cache-key ownership; and
12. conformance tests for host-first, provider-first, dynamic styles, lazy
    features, portal context, UID changes, two dashboards, and bounded growth.

## 27. Limitations

- Exact Grafana 13.2.3/React 19.2.8/Scenes 8.13.5/Emotion version cell only.
- Chromium, light theme, scoped light DOM, Text, Stat, Time series, and
  controlled TestData only.
- No arbitrary host selectors, other design-system matrix, dark theme, RTL,
  mobile browsers, Table, plugin ecosystem, or datasource ecosystem claim.
- No SSR/hydration implementation or server-component claim.
- No enforced CSP/nonce test.
- Portal focus, keyboard, stacking, and z-index behavior are excluded.
- Multiple top-level provider roots are unsupported.
- `@emotion/css/create-instance` was analyzed but deliberately not substituted.

## 28. Decision

**PASS.** An independently Emotion-styled host can coexist with the verified
provider. Phase 2 should use independently owned React Emotion caches with
unique keys and retain the provider-owned Grafana `@emotion/css` singleton as
a separately governed third path.

For the tested client-only cell, `document.head` with unique keys is sufficient.
A dedicated provider insertion location and prepend are not required. The
`@emotion/css` path does not currently require production remediation, but its
default key, tag, singleton lifetime, and lack of injected nonce configuration
must remain explicit compatibility/CSP inputs.

## 29. Architecture impact

The result strengthens, rather than replaces, the
[styling containment strategy](../styling-containment-strategy.md): scoped
light DOM remains viable with another Emotion owner. The provider contract must
add cache-key admission, three-path ownership diagnostics, provider-lifetime
style accounting, and the one-provider-owner rule.

The [bridge/provider architecture](../bridge-provider-architecture.md) retains
host-owned React and provider-owned Grafana/Scenes/Runtime. Emotion is not one
undifferentiated singleton: host React Emotion, provider React Emotion, and
provider Grafana `@emotion/css` have distinct ownership.

## 30. Inputs to #42/#43/#45

- **Issue #42 (CSP):** has sufficient Emotion inputs to proceed later: all
  dynamic style owners/tags, cache nonce capability, default `css` limitation,
  and insertion containers are known. No CSP compatibility is claimed here.
- **Issue #43 (portal/focus/z-index):** is unblocked. Provider Emotion context
  and class/style ownership survive the portal; focus containment and stacking
  remain intentionally untested.
- **Issue #45 (lifecycle integration):** receives the provider-lifetime versus
  dashboard-lifetime model, 20-cycle bounded counts, UID/remount evidence, and
  the unsupported multiple-provider-root boundary.

## 31. Follow-up

1. Encode cache identities, keys, insertion model, and singleton ownership in
   the Phase 2 provider manifest/admission contract.
2. Keep `@emotion/css/create-instance` as a conditional remediation only if
   CSP or future container evidence requires it.
3. Execute issue #42 without assuming React `CacheProvider` controls the
   Grafana `css` singleton.
4. Execute issue #43 using the proved portal Emotion behavior as baseline.
5. Add a separate architecture decision before claiming multiple top-level
   provider roots or micro-frontend provider isolation.
6. Re-run this conformance cell for every supported provider version.

## 32. Final status

**PASS**

The pass proves independent host/provider Emotion coexistence only for the
verified Grafana 13.2.3 production-shaped provider cell under the selected
scoped-light-DOM model. It does not claim general Emotion, SSR, CSP, portal, or
Grafana compatibility.
