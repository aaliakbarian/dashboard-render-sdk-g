# Text Renderer-Only Bundle Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Text renderer-only bundle without editor closure |
| Status | Bounded technical experiment complete |
| Created | 2026-10-13 |
| Last Updated | 2026-10-13 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Final status | **PASS** |

This document uses the phase semantics defined by the
[project roadmap](../../../project/roadmap.md). It reports a disposable
engineering experiment, not a production package, public API, distribution
approval, or legal conclusion. Generated evidence under
`artifacts/experiments/text-renderer-only/` is intentionally ignored.

## 2. Hypothesis

The real Grafana 13.2.3 Text renderer can be built as a Markdown view-only
provider artifact without Monaco, React-Monaco, `TextPanelEditor`, Codicon
editor assets, or unrelated authoring/configuration dependencies, while the
real dashboard-by-UID Gate A path continues to render native DOM.

The experiment tests Text only. It makes no claim about Stat, Time series,
datasources, arbitrary Text modes, or general Grafana compatibility.

## 3. Baseline

The fresh baseline is an isolated build rooted at the exact Phase 0 Text v1
module entrypoint
[`public/app/plugins/panel/text/v1/module.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/public/app/plugins/panel/text/v1/module.tsx).
It is not the whole multi-entry POC build, so unrelated Stat, Time series, and
TestData closure cannot distort the comparison.

The baseline statically constructs `PanelPlugin(TextPanel)`, registers option
editors, imports `TextPanelEditor`, and installs the migration handler. Those
edges make the editor closure reachable even though Gate A uses Markdown and
never requests an editor at runtime.

| Baseline measure | Fresh result |
| --- | ---: |
| Reachable JavaScript chunks | 88 |
| Reachable modules | 1,063 |
| Reachable JavaScript | 3,789,025 B raw / 1,027,998 B gzip |
| Grafana `public/app` sources | 6 |
| Editor identities | 844 |
| Monaco identities | 843 |
| `TextPanelEditor` identities | 1 |
| Emitted non-evidence assets | 3 |

The three emitted assets were Codicon TTF (72,504 B raw / 40,396 B gzip),
Monaco editor CSS (39,288 B / 6,953 B), and React-Monaco CSS
(42,432 B / 7,557 B). The baseline also emitted the 1,854,550-byte Monaco
`editor.api` chunk, the 888,002-byte React-Monaco chunk, and many language
chunks.

## 4. Predeclared pass/fail criteria

These criteria were fixed before the renderer entry was implemented.

**PASS** requires the exact Grafana Text renderer; the real UID-to-Gate-A path;
the Markdown sentinel; no iframe, shell, `GrafanaApp.init`, second React,
arbitrary SystemJS, Monaco, React-Monaco, `TextPanelEditor`, or editor Codicon;
clean lifecycle behavior; exact provenance; and a materially smaller isolated
artifact.

**FAIL** means the real Text renderer structurally requires its editor closure
under the allowed architecture. **INCONCLUSIVE** means unrelated POC closure
cannot be separated sufficiently to test the hypothesis.

## 5. Dependency analysis

| Exact source/dependency | Classification | Result |
| --- | --- | --- |
| `public/app/plugins/panel/text/v1/TextPanel.tsx` | **RENDERER REQUIRED** | Retained unchanged as the real component source |
| `public/app/plugins/panel/text/panelcfg.gen.ts` | **SHARED REQUIRED** | Retained for `TextMode`, option shape, and Code defaults referenced by the renderer |
| `public/app/plugins/panel/text/v1/TextPanelEditor.tsx` | **EDITOR ONLY** | Excluded |
| `public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts` | **MIGRATION ONLY** | Excluded; current-schema conversion remains upstream of rendering |
| `public/app/plugins/panel/text/v1/module.tsx` | **METADATA / CONFIGURATION ONLY** for this profile | Replaced by a minimal project-owned `PanelPlugin` construction |
| `public/app/core/config.ts` | **CONFIG ONLY** | Replaced by a facade exposing only `disableSanitizeHtml` from published Runtime config |
| `@grafana/i18n` option labels | **EDITOR / METADATA ONLY** | Excluded with the full module entrypoint |
| `@grafana/ui` `ScrollContainer`, `useStyles2` | **RENDERER REQUIRED** | Isolated artifact: exact published ESM leaves. Browser proof: bound to the host's loaded `@grafana/ui` cohort |
| `@grafana/ui` `CodeEditor` | **EDITOR ONLY FOR THE ADMITTED PROFILE** | Replaced by a fail-closed unsupported-mode component; Monaco is not bundled |
| `@grafana/data` Markdown and sanitization behavior | **RENDERER REQUIRED** | Isolated artifact: exact published ESM leaves. Browser proof: bound to the host's loaded `@grafana/data` cohort |
| React, Emotion, `react-use`, `dangerously-set-html-content` | **RENDERER REQUIRED** | Retained; React/JSX runtimes are external to the isolated artifact |

The full upstream renderer imports `CodeEditor` because one component covers
Markdown, HTML, and Code modes. Static ESM imports made Code mode's editor graph
part of the artifact even when Code mode was never selected. The bounded
facade preserves the real component and its Markdown path but rejects Code mode
instead of silently loading or approximating it.

## 6. Experimental architecture

```text
dashboard UID
  -> existing runtime/API/converter/Scenes path
  -> existing closed Text catalogue
  -> dynamic `grafana-poc-text-panel` alias
  -> experimental `rendererOnly.ts`
     -> published `PanelPlugin` implementation
     -> exact pinned TextPanel.tsx
        -> exact panelcfg.gen.ts
        -> view-only data/UI/runtime facades
  -> native Text DOM
```

All new renderer construction and facades live under
`experiments/bundle/text-renderer-only/`. Existing production package exports
are unchanged. The host selects the experiment only when
`POC_TEXT_RENDERER_ONLY_EXPERIMENT=1`; otherwise the Phase 0 bridge continues to
load the full Text v1 module.

The forbidden-import guard admits the seven experiment aliases only from this
exact directory. It still rejects those aliases from `poc-host`, `poc-compat`,
and `poc-grafana-bridge`, and it continues to reject Grafana shell, routing,
general loader, internal, and SystemJS boundaries.

## 7. Renderer identity

The renderer is the exact
[`TextPanel.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/public/app/plugins/panel/text/v1/TextPanel.tsx)
from commit `6193dc03311b631b9727b560d24369e683dc396e`.
`pinnedGrafanaSourceTransformPlugin` resolves that source from the clean pinned
checkout and rejects another commit or dirty checkout. No Text HTML, snapshot,
or project-owned rendering replacement is used.

The experiment changes dependency resolution around the unmodified component:
it substitutes narrow facades for the three broad imports `@grafana/data`,
`@grafana/ui`, and `app/core/config`. That distinction is part of the provider
provenance and must not be described as an unmodified upstream module artifact.

## 8. PanelPlugin/Scenes integration

The renderer artifact creates `new PanelPlugin(TextPanel)` using the pinned
published `@grafana/data` implementation. It deliberately omits
`setPanelOptions`, `setMigrationHandler`, and `setSuggestionsSupplier`, because
those configure editing, migration, and authoring rather than current-schema
view rendering.

The existing closed catalogue adds the minimum runtime metadata Scenes needs:
`id: text`, name, type, version 13.2.3, `skipDataQuery: true`, and cache
behavior. It retains the POC's legacy compatibility label
`public/app/plugins/panel/text/v1/module.tsx`; that label is not treated as
artifact provenance in this experiment. The source-identity manifest and
bundle evidence record the actual `TextPanel.tsx` plus adapter entry. Dashboard
options still come from the validated schema-42 DTO and constrained converter;
they are not replaced with custom defaults. Unknown panel IDs remain rejected.

## 9. Bundle evidence

The isolated build has one entry and follows all its static and dynamic edges.
React, ReactDOM, and JSX runtimes are externalized so the artifact cannot hide a
second React implementation.

| Evidence | Renderer-only result |
| --- | ---: |
| Reachable JavaScript chunks | 4 |
| Reachable modules | 125 |
| Reachable JavaScript | 375,732 B raw / 118,696 B gzip |
| Grafana `public/app` sources | 2 |
| CSS/font/image/worker assets | 0 |
| Grafana internal package imports | 0 |
| SystemJS modules | 0 |
| Bundled React/ReactDOM implementations | 0 |

Physical output is separated into a 1,948 B raw / 1,006 B gzip Text renderer
chunk, a 372,737 B / 117,040 B shared-dependency chunk, a 979 B / 567 B
Rolldown runtime chunk, and a 68 B / 83 B entry shim. The shared chunk is
deliberately not mislabeled as renderer code.

The source map also reports pre-minification rendered-module attribution. These
figures explain source ownership and are not additive with the minified chunk
sizes above:

| Source category | Rendered module bytes |
| --- | ---: |
| Exact Grafana application renderer source | 2,688 B |
| Project-owned renderer adapters | 842 B |
| Published Grafana package dependencies | 143,473 B |
| Third-party shared dependencies | 563,843 B |
| Existing `poc-host` / `poc-compat` / bridge code | 0 B |
| Bundler/runtime other | 1,662 B |

The exact published-package graph contains `@grafana/data`, `@grafana/ui`,
`@grafana/runtime`, Emotion packages, `react-use`,
`dangerously-set-html-content`, Markdown/sanitization dependencies (`marked`,
`marked-mangle`, DOMPurify, XSS, and sanitize-url), plus their measured
utilities. It does not include the broad package barrels as renderer source
imports; exact pinned ESM leaves are selected through experiment aliases. No
unrelated host POC module is reachable from the isolated renderer entry.

The isolated evidence is reproducible with the container-first commands below
(line wrapping is for readability):

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e TEXT_RENDERER_VARIANT=baseline dev \
  corepack yarn vite build --config experiments/bundle/text-renderer-only/vite.config.ts

docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e TEXT_RENDERER_VARIANT=renderer-only dev \
  corepack yarn vite build --config experiments/bundle/text-renderer-only/vite.config.ts

docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  corepack yarn node experiments/bundle/text-renderer-only/writeComparison.ts
```

## 10. Editor/Monaco evidence

Identity-based checks inspect reachable module IDs, not only filenames or
network requests. The renderer-only graph contains:

- Monaco / `@monaco-editor/react` / React-Monaco identities: **0**;
- CodeEditor / CodeMirror identities: **0**;
- `TextPanelEditor`: **0**;
- query/config editor identities: **0**;
- Codicon assets: **0**; and
- editor CSS and language chunks: **0**.

The same checks intentionally failed against the baseline, observing 843 Monaco
identities. This red result established that the guard detects the inherited
editor closure before the renderer-only build made it green.

## 11. Gate A result

Gate A passed through the real path:

```text
<GrafanaDashboard uid="grsdk-phase0-poc" />
  -> Grafana dashboard API
  -> constrained V1/schema-42 conversion
  -> Text VizPanel
  -> closed catalogue
  -> renderer-only provider artifact
  -> exact Grafana TextPanel
  -> native DOM
```

The browser rendered `TextPanel-converted-content`, the Markdown sentinel,
strong markup, PanelChrome region, and expected host/Grafana typography. UID
switch to `grsdk-phase0-poc-alt`, unmount, remount, portal cleanup, observer
cleanup, and scene/runtime lease release all remained green. There were zero
iframes, datasource queries, shell/navigation landmarks, unexpected routes,
console errors, and page errors.

Vite's development optimizer invalidates once when it first discovers this
deliberately lazy source boundary. The experiment browser setup directly loads
the exact provider across that one-time invalidation before starting lifecycle
evidence in a fresh context. This is development-server test plumbing; the
isolated production artifact does not use Vite dependency optimization.

## 12. Runtime/React result

The existing single-runtime contract remained intact: one physical React
19.2.8, one ReactDOM 19.2.8, one compatible Grafana Runtime identity, and the
existing Scenes 8.13.5 cohort. The browser experiment binds renderer facades to
the host's published Grafana barrels; an identity probe verified strict object
identity for the `PanelPlugin` constructor, Runtime `config` singleton, and
`useStyles2` helper. The known Scenes React `^18` peer warning remains visible
and was not suppressed. The isolated artifact includes no React or ReactDOM
implementation module.

No `GrafanaApp.init`, Grafana route tree, application shell, arbitrary SystemJS,
or second Grafana cohort was introduced. Existing runtime identity, lease,
theme, i18n, event, portal, and cleanup behavior continues to be owned by the
POC compatibility runtime.

## 13. Provenance

### Upstream Grafana application source retained

1. `public/app/plugins/panel/text/v1/TextPanel.tsx`
2. `public/app/plugins/panel/text/panelcfg.gen.ts`

### Upstream Grafana application source removed from the baseline closure

1. `public/app/plugins/panel/text/v1/module.tsx`
2. `public/app/plugins/panel/text/v1/TextPanelEditor.tsx`
3. `public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts`
4. `public/app/core/config.ts`

### Project-owned experimental adapters

- `rendererOnly.ts` — minimal `PanelPlugin` construction;
- `dataViewOnly.ts` — exact Markdown/sanitization leaves and erased types;
- `uiViewOnly.tsx` — exact view helpers and fail-closed Code mode;
- `runtimeConfigViewOnly.ts` — one-field Runtime config projection;
- `browserCohortData.ts`, `browserCohortRuntime.ts`, and `browserCohortUi.ts` —
  browser-only bindings to the host's already-loaded Grafana cohort;
- `browserCohortIdentity.ts` — browser identity probe for those bindings;
- `textRendererOnlyImportsPlugin.ts` — exact source-import mapping; and
- experiment build, analysis, provenance, and test files.

The emitted renderer chunk and its complete source-to-chunk map are recorded in
the ignored bundle evidence. This experiment narrows but does not eliminate
Grafana application source. Its distribution remains governed by the separate
[licensing and distribution strategy](../licensing-distribution-strategy.md)
and qualified review; no licensing conclusion is made here.

## 14. Size comparison

| Measure | Full Text v1 module | Renderer-only | Change |
| --- | ---: | ---: | ---: |
| Raw JavaScript | 3,789,025 B | 375,732 B | −3,413,293 B (−90.08%) |
| Gzip JavaScript | 1,027,998 B | 118,696 B | −909,302 B (−88.45%) |
| Reachable modules | 1,063 | 125 | −938 (−88.24%) |
| Reachable chunks | 88 | 4 | −84 (−95.45%) |
| Grafana application sources | 6 | 2 | −4 (−66.67%) |
| Editor identities | 844 | 0 | −844 (−100%) |
| Non-evidence assets | 3 | 0 | −3 (−100%) |

These figures compare isolated Text roots built with the same Vite 8.2.0
toolchain and pinned source checkout. They are not whole-application transfer
sizes and do not claim equivalent savings for other panels.

## 15. Limitations

- Only the controlled Markdown mode is admitted and browser-verified.
- Code mode fails closed and is not a capability of this artifact.
- HTML mode shares upstream code but was not conformance-tested and is not
  declared supported.
- Option editors, migration, suggestions, and authoring metadata are absent.
- The existing POC catalogue's `module` metadata remains a legacy full-module
  compatibility label; a production manifest needs a distinct renderer-source
  provenance field.
- The experiment uses absolute, version-pinned published-package ESM leaves;
  these are not exported public subpaths and require compatibility testing for
  every provider build.
- The 376 kB raw artifact still contains a meaningful shared Markdown,
  sanitization, UI, Emotion, and Runtime closure; Experiment B should determine
  how much can be shared across renderer artifacts without restoring editors.
- Vite dev mode needs bounded lazy-provider prewarming to avoid counting a
  development optimizer reload as an application lifecycle event.
- Distribution and licensing approval remain outside this result.

## 16. Decision

**PASS.** The real Grafana 13.2.3 Text renderer does not structurally require
its editor closure for the admitted Markdown view profile. The renderer-only
strategy is evidence-backed for Text: it preserves Gate A and removes Monaco,
React-Monaco, Text editor code, Codicon, editor CSS, and language chunks from
the complete isolated dependency graph.

This is not a decision to publish the artifact or to replace the POC bridge.

## 17. Architecture impact

The result supports the bundle strategy's provider-owned, renderer-only, lazy
artifact model. A provider manifest must distinguish view capabilities from
authoring capabilities. For Text, it must declare at least:

- exact Grafana/source/provider build identity;
- panel ID `text`;
- admitted mode `markdown`;
- excluded modes (`code`, and `html` until tested);
- no option editor, migration, or suggestions capability;
- required Runtime config field `disableSanitizeHtml`;
- exact application-source and published-leaf provenance; and
- external React/runtime compatibility requirements.

Preflight must reject an unsupported Text mode before scene activation. It must
not fall through to the fail-closed CodeEditor component as normal control
flow.

## 18. Follow-up

Bundle Experiment B should proceed: repeat the same source-identity,
reachability, browser-fidelity, and lifecycle method for the TestData runtime
entry while separating query execution from datasource editors and dormant
scenarios. It must not infer success from this Text result.

Further work should also:

1. formalize manifest fields for view modes and absent authoring behavior;
2. decide how version-specific deep published ESM leaves are generated and
   conformance-tested;
3. test HTML mode separately if it is proposed for Phase 2;
4. decide whether shared view-runtime chunks preserve the zero-editor graph;
5. keep the full Text module as a negative/control build in bundle CI; and
6. obtain required distribution/licensing review before any public artifact.

## 19. Final status

**PASS**

The hypothesis is proven for the exact Text Markdown renderer profile on
Grafana OSS 13.2.3. The evidence authorizes the renderer-only pattern as a
technical input to Phase 1 architecture; it does not authorize publication or
generalize to another renderer or datasource.
