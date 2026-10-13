# Independent Lazy Panel Chunks Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Grafana React SDK maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Independent lazy panel chunks |
| Status | Bounded technical experiment complete |
| Created | 2026-10-13 |
| Last Updated | 2026-10-13 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Admitted panel IDs | `text`, `stat`, `timeseries` |
| Final status | **PASS** |

This document uses the phase semantics defined by the
[project roadmap](../../../project/roadmap.md). It reports disposable experiment
code, not a production provider or package export. Generated evidence under
`artifacts/experiments/lazy-panel-chunks/` is ignored.

## 2. Hypothesis

A production-shaped provider can map the three admitted panel IDs to fixed
dynamic imports so each real renderer has an independent lazy feature chunk.
Dashboard JSON cannot supply a URL. Loading one panel must not request another
panel's renderer source chunk.

The result is scoped to the exact Grafana 13.2.3 provider cell. It does not
prove arbitrary plugin loading or shared-cohort deduplication.

## 3. Baseline

A fresh isolated production build of the existing Text + Stat + Time series
provider source path was captured before the new catalogue was assessed. It is
a reproducible source-path control built by this experiment harness, not an
untouched historical `poc-host` artifact. Its emitted JavaScript corpus was
1,899,352 B raw / 424,220 B gzip across nine chunks.

The entry's static initial closure was 89,250 B raw / 31,754 B gzip across
three chunks and contained zero panel application-source files. React,
ReactDOM, and `react/jsx-runtime` were external; zero React implementation
modules and zero duplicated modules were emitted. Baseline static renderer
closures were 377,585 B / 120,940 B gzip for Text, 1,622,377 B / 336,479 B
gzip for Stat, and 1,757,574 B / 382,182 B gzip for Time series. These are
provider artifact closures, not browser-download totals.

The baseline contained 13 panel application-source files: the renderer-only
Text pair, the full seven-file Stat registration closure, and four direct Time
series plugin files. GraphNG/TimeSeries core files were separately classified
in the provenance report. No panel application source was in a direct entry
chunk; the existing POC already used dynamic loader functions, but its nested
gate catalogues were not one production-shaped closed provider catalogue and
Stat still used the full module entrypoint.

## 4. Predeclared criteria

All 18 predeclared criteria passed:

1. three distinct provider-controlled renderer chunks exist;
2. bootstrap has no renderer application source;
3. Text-only requests Text and neither other renderer;
4. Stat-only requests Stat and neither other renderer;
5. Time-series-only requests Time series and neither other renderer;
6. the all-panels dashboard renders all three;
7. Gate A remains green;
8. Gate B remains green on real TestData `PanelData`;
9. Gate C remains green;
10. ID mapping is closed;
11. unknown IDs fail without URL construction;
12. no SystemJS loader exists;
13. no Grafana application shell/router/navigation exists;
14. no iframe exists;
15. one React/ReactDOM runtime remains;
16. every emitted application source has exactly one owning chunk;
17. repeat/concurrent loads reuse the same promise/plugin identity; and
18. deterministic load failure is panel-local and retryable.

**FAIL** and **INCONCLUSIVE** definitions were not changed after observing the
result. Neither condition occurred.

## 5. Closed loader architecture

```text
providerBootstrap.ts
  -> fixed "text"       -> import("./features/text.ts")
  -> fixed "stat"       -> import("./features/stat.ts")
  -> fixed "timeseries" -> import("./features/timeseries.ts")
  -> every other ID     -> UnsupportedLazyPanelError
```

The catalogue stores the first promise per ID, coalesces concurrent requests,
stores the resolved plugin identity, and evicts only a rejected promise so an
explicit retry can run. No ID is interpolated into a path, no server-provided
URL is executed, and no general plugin loader is installed.

## 6. Text entrypoint

Text uses the renderer-only result from Experiment A: the exact
`public/app/plugins/panel/text/v1/TextPanel.tsx` and generated
`panelcfg.gen.ts`. A project-owned `PanelPlugin` wrapper and the existing
view-only data/UI/config facades exclude `module.tsx`, `TextPanelEditor`,
Monaco, and the authoring closure from the Text feature.

## 7. Stat entrypoint

The experiment replaces the current full Stat module with the narrowest proven
renderer-capable source: `public/app/plugins/panel/stat/StatPanel.tsx`, wrapped
as `new PanelPlugin(StatPanel).useFieldConfig().setNoPadding()`.

| Classification | Source/behavior |
| --- | --- |
| **RENDERER REQUIRED** | `StatPanel.tsx` |
| **FIELD-CONFIG REQUIRED** | provider `useFieldConfig()` plus existing runtime registries |
| **MIGRATION ONLY** | `StatMigrations.ts`, shared migration handler |
| **SUGGESTION ONLY** | `suggestions.ts`, `presets.ts`, application suggestion utility |
| **EDITOR/CONFIG ONLY** | `common.ts` and module option-builder registration |
| **METADATA ONLY / REGISTRATION** | `module.tsx` |
| **TYPE-ONLY / TREE-SHAKEN** | `panelcfg.gen.ts` for the renderer's `Options` contract |

Only `StatPanel.tsx` appears in the emitted application-source graph. The broad
published `@grafana/ui` dependency remains an optimization opportunity.

## 8. Time series entrypoint

Time series preserves Phase 0 P2: exact `TimeSeriesPanel.tsx`, GraphNG/uPlot,
tooltip and outside-range renderer dependencies, the controlled field-config
adapter, and feature-owned uPlot CSS. It does not use the rejected full module,
migration, option-builder, or suggestion entrypoint.

## 9. Build/chunk model

Vite/Rolldown receives a single bootstrap entry whose only panel edges are the
three fixed dynamic imports. No manual chunk rule forces or disguises panel
separation. React and ReactDOM are external in the isolated provider artifact;
the production-shaped browser build supplies the host cohort once.

The bootstrap's static closure contains zero Grafana panel application-source
files. Each of the 11 emitted application-source files has exactly one owning
chunk; no renderer source is duplicated in another feature or entry.

The reproducible container sequence is:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev sh -lc '
  LAZY_PANEL_VARIANT=baseline corepack yarn vite build --config experiments/bundle/lazy-panel-chunks/vite.config.ts &&
  LAZY_PANEL_VARIANT=artifact corepack yarn vite build --config experiments/bundle/lazy-panel-chunks/vite.config.ts &&
  LAZY_PANEL_VARIANT=browser corepack yarn vite build --config experiments/bundle/lazy-panel-chunks/vite.config.ts &&
  LAZY_PANEL_BUNDLE_REPORT=artifacts/experiments/lazy-panel-chunks/artifact/evidence/bundle-evidence.json \
    corepack yarn vitest run tests/experiments/lazy-panel-chunks/catalog.spec.ts \
      tests/experiments/lazy-panel-chunks/bundle.spec.ts --environment node'
```

The dedicated Playwright config then runs the browser probe against the local
fixture using the repository's host-owned credential workflow; it writes only
sanitized paths under the ignored `artifacts/` tree.

## 10. Text-only result

**PASS.** Chromium retrieved the dashboard by UID, constrained conversion
selected only Text, the provider requested the Text source chunk, and the real
Grafana Text renderer displayed the fixture Markdown. Neither Stat nor Time
series renderer source chunk was requested.

## 11. Stat-only result

**PASS.** Chromium selected only Stat, loaded only its renderer source chunk,
executed the runtime-only TestData provider through `/grafana/api/ds/query`,
and displayed the real percent-formatted result. Neither Text nor Time series
renderer source chunk was requested.

## 12. Time-series-only result

**PASS.** Chromium selected only Time series, loaded only its renderer source
chunk, executed the real TestData query and configured transformation, and
rendered the real canvas/uPlot with `Phase 0 Pulse Signal`. Neither Text nor
Stat renderer source chunk was requested.

## 13. All-panels result

**PASS.** `grsdk-phase0-poc` followed UID retrieval → schema-42 conversion →
closed provider catalogue → three lazy imports → real Text, Stat, and Time
series rendering. The request trace contains all three source chunks and real
TestData query traffic.

## 14. Network lazy-loading evidence

Chunk identities were derived from source provenance, never hard-coded hashes.

| Probe | Text source chunk | Stat source chunk | Time series source chunk |
| --- | --- | --- | --- |
| Text only | requested | absent | absent |
| Stat only | absent | requested | absent |
| Time series only | absent | absent | requested |
| All panels | requested | requested | requested |

The browser build's observed static-asset request cost was:

| Probe | Files | Raw | Gzip estimate |
| --- | ---: | ---: | ---: |
| Text only | 47 | 4,995,742 B | 1,360,353 B |
| Stat only | 49 | 5,111,953 B | 1,389,621 B |
| Time series only | 50 | 5,131,740 B | 1,397,426 B |
| All three | 52 | 5,136,917 B | 1,399,934 B |

These totals include the standalone Scenes/runtime host and its shared Grafana
cohort. They are not renderer-only sizes and expose why Experiment D remains
necessary.

Against the asset set common to all three single-panel probes, the measured
incremental browser requests were:

| Probe | Unique files | Raw | Gzip estimate |
| --- | ---: | ---: | ---: |
| Text | 1 | 3,164 B | 1,495 B |
| Stat | 3 | 119,375 B | 30,763 B |
| Time series | 4 | 139,162 B | 38,568 B |

Stat and Time series include their query-runtime-only provider files in these
incremental costs; this table is not an isolated renderer-size claim.

## 15. Module-graph isolation

The exact renderer source owners are distinct:

| Panel | Emitted source chunk pattern | Application sources |
| --- | --- | ---: |
| Text | `assets/text-*.js` | 2 |
| Stat | `assets/stat-*.js` | 1 |
| Time series | `assets/*TimeSeriesPanel.tsx-*.js` | 8 |

No application source is emitted twice. The entry's static closure owns none
of them. Type-only sources admitted by the audited resolver but erased from the
artifact remain listed separately in `REVIEWED_APPLICATION_SOURCES`.

## 16. Cache behavior

**PASS.** First access records a miss. Two concurrent accesses return the same
promise and initialize once. Later access returns the same resolved
`PanelPlugin` identity and records a hit. The provider-lifetime cache may remain
warm across dashboard instance and UID lifecycles.

## 17. Load-failure behavior

**PASS.** With all three dashboard panels selected, an experiment-only first
Stat load failed during the real Scenes render path and produced typed
`panel-plugin-load-failed` evidence without recording the raw cause. Text and
Time series continued rendering, the host survived, the failed promise was
evicted, and an explicit Stat retry loaded successfully. A feature-load
failure is panel-local; runtime identity failure remains provider-fatal.

## 18. UID/lifecycle result

**PASS.** The all-panels probe exercised main → alternate → main UID changes.
The alternate dashboard rendered its own Text sentinel; returning constructed
fresh scene/query state while reusing safe provider caches. Dashboard unmount
returned every instance resource counter and active dashboard-scope count to
zero. Remount rendered Time series again, and each renderer retained exactly
one provider-cache start event across the lifecycle. The full Chromium
regression also passed 34/34 tests; dedicated Experiment A passed 1/1,
Experiment B plus Task 10/Gates B/C passed 10/10, and this experiment passed
5/5 browser probes.

## 19. React/runtime result

The isolated panel artifact contains no React or ReactDOM implementation
module. Browser runtime inspection reports one React 19.2.8 and one ReactDOM
19.2.8 identity. Every panel uses the Task 5 process-wide runtime, shared
Grafana types, provider contexts, and existing registries. The known Scenes
8.13.5 React `^18` peer warning remains visible and unsuppressed.

## 20. Shared-dependency observations

| Dependency | Text | Stat | Time series |
| --- | --- | --- | --- |
| React | external host | external host | external host |
| ReactDOM | not used | external host | external host |
| `@grafana/data` | shared provider | shared provider | shared provider |
| `@grafana/ui` | shared provider | shared provider | shared provider |
| `@grafana/runtime` | feature-local config | not used | feature-local |
| `@grafana/scenes` | not in feature artifact | not in feature artifact | not in feature artifact |
| RxJS | not used | shared provider | shared provider |
| Emotion | shared provider | shared provider | shared provider |
| uPlot | not used | shared/over-coupled | shared provider |

No module identity was duplicated across emitted chunks. However, shared chunk
formation couples Stat to uPlot and carries a large UI/Data closure. The build
also emits Monaco/Codicon material reachable through shared published-package
barrels; browser request evidence shows this is shared-cohort cost rather than
another panel's application renderer. Removing that cost belongs to Experiment
D and further published-package leaf analysis.

## 21. Size evidence

| Feature measure | Text | Stat | Time series |
| --- | ---: | ---: | ---: |
| Owning renderer chunk raw | 76,604 B | 34,325 B | 192,027 B |
| Owning renderer chunk gzip | 21,305 B | 12,100 B | 63,181 B |
| Static feature closure raw | 377,492 B | 1,604,669 B | 1,766,641 B |
| Static feature closure gzip | 120,880 B | 331,874 B | 385,152 B |

The large difference between owning chunk and closure is shared dependency
cost, not duplicated renderer source. Size targets in the bundle strategy are
directional and were not PASS criteria for this experiment.

## 22. Provenance

All upstream application code is pinned to Grafana OSS 13.2.3 commit
`6193dc03311b631b9727b560d24369e683dc396e`.

- Text: `panelcfg.gen.ts`, `v1/TextPanel.tsx`.
- Stat: `StatPanel.tsx`.
- Time series: `TimeSeriesPanel.tsx`, `TimeSeriesTooltip.tsx`,
  `plugins/OutsideRangePlugin.tsx`, `utils.ts`, GraphNG `GraphNG.tsx` and
  `utils.ts`, and TimeSeries `TimeSeries.tsx` and `utils.ts`.
- Project adapters: the experiment catalogue/features/facades plus existing
  `timeseriesConfig.ts` and `timeseriesAdapters.tsx`.

The evidence report maps every path to a content-hashed emitted chunk. This is
source provenance only; it makes no licensing or distribution conclusion.

## 23. Limitations

- only `text`, `stat`, and `timeseries` were tested;
- only Grafana 13.2.3 and the controlled schema-42 fixtures were tested;
- published-package shared closure remains very large;
- Stat's published UI closure still includes avoidable uPlot coupling;
- Time series still exposes Monaco/Codicon-related shared closure;
- the browser experiment uses the controlled TestData datasource only;
- authoring/editor capability is excluded; and
- this does not prove future version cells or arbitrary transformations.

## 24. Decision

**PASS.** Real Text, Stat, and Time series renderers can be delivered as closed,
independent lazy provider features without renderer duplication, arbitrary
URLs, SystemJS, Grafana shell, iframe, or a second React runtime.

## 25. Architecture impact

The provider contract should use a fixed capability manifest and loader map per
version cell. Each declared panel capability should own a lazy renderer feature
entry, provenance record, and panel-local typed load error. Production work
must retain promise coalescing, successful identity caching, failed-promise
eviction, and early unknown-ID rejection.

## 26. Experiment D inputs

Experiment D should start from this three-feature graph and determine how to:

- keep one React/ReactDOM and one Grafana Runtime identity;
- form stable shared Data/UI/Emotion/RxJS chunks across provider features;
- remove Stat's avoidable uPlot coupling;
- prevent Monaco/editor/Codicon material from the view-only shared cohort;
- measure cache reuse across multiple renderer and datasource chunks; and
- preserve these source-owner and network non-request assertions.

## 27. Follow-up

1. Execute Experiment D: shared Grafana cohort deduplication.
2. Convert this evidence into production provider build constraints only after
   Experiment D and the existing licensing/distribution gates are resolved.
3. Keep Table and arbitrary plugin discovery outside the current catalogue.
4. Add the three feature budgets and request-isolation assertions to the future
   version-cell conformance suite.

## 28. Final status

**PASS**

Experiment C is ready to close after human review. Experiment D should proceed.
