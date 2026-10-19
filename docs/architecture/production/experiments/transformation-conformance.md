# Transformation Conformance Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | #47 — Transformation conformance experiments |
| Branch | `phase1/experiment-transformation-conformance` |
| Status | Complete — PASS |
| Created | 2026-10-18 |
| Last Updated | 2026-10-18 |
| Experiment identity | `transformation-conformance-v1` |
| Verified cell | Grafana OSS 13.2.3 at `6193dc03311b631b9727b560d24369e683dc396e`; `@grafana/data@13.2.3`; React/ReactDOM 19.2.8; `@grafana/scenes@8.13.5` |

This is disposable experiment evidence, not a production SDK implementation or
a general Grafana transformation compatibility claim. It implements the
experiment prescribed by the
[transformation compatibility strategy](../transformation-compatibility-strategy.md)
without modifying the Phase 0 POC.

## 2. Hypothesis

The production-shaped renderer provider can support an empty pipeline or one
exact Grafana `renameByRegex` operator without loading Grafana's application
transformation registry. The provider catalogue remains authoritative while
real DataFrame, Scenes, query, visualization, cancellation, lifecycle, and
presentation behavior remains intact.

Result: **confirmed for the verified cell and capability profile only**.

## 3. Predeclared criteria

The result was fixed before implementation as `PASS`, `FAIL`, or
`INCONCLUSIVE`. PASS required all 30 criteria from issue #47, including exact
operator/cohort identity, explicit/declarative parity, real Gate C rendering,
cancellation, fail-closed errors, narrow bundle provenance, bounded resource
behavior, one Grafana/Data identity, one React identity, and the existing
production-shaped provider lifecycle.

The criteria were not relaxed. One upstream behavior required an explicit
provider adaptation: Scenes 8.13.5 retains source series in its error result
when transformation execution throws. The experiment therefore proves and
documents a fail-closed provider subclass rather than accepting raw fallback.

## 4. Verified capability profile

| Property | Verified value |
| --- | --- |
| Pipelines | Empty, or exactly one `renameByRegex` |
| Topic/input | Series DataFrames matching the controlled Time series path |
| Options | Exactly `regex: string` and `renamePattern: string` |
| Maximum chain length | 1 |
| Grafana/Data version | 13.2.3 |
| Execution mode | Closed provider catalogue with the exact Grafana operator |
| Unknown mapping | Rejected; no ID-to-arbitrary-import construction |

Filters, `disabled`, explicit topics, interpolated options, annotations, table
inputs, custom operators, chains longer than one, and every other transform ID
remain unsupported.

## 5. Physical package/cohort evidence

- Yarn resolves one `@grafana/data` lock entry at 13.2.3.
- The installed manifest resolves to the repository's physical
  `node_modules/@grafana/data/package.json`.
- The compiled operator SHA-256 is
  `0b8d1926d4da5e14e7812993f4ffcd10cdd63634af3a9f0d70c783816f1b9c35`.
- The pinned source SHA-256 is
  `369838a1c1492c06aeec78aefd4bb458d9a0eb64ccdb6805fa90ac00840d0b2d`.
- The browser compares the loaded operator object to the operator returned by
  the runtime's one-entry registry. Object identity matched.
- Provider admission continued to report one React and one ReactDOM identity,
  both 19.2.8.

Package identity, operator identity, registry identity, and provider catalogue
identity were measured separately; matching version strings alone were not
used as identity proof.

## 6. Registry evidence

The provider runtime contained exactly one registry ID: `renameByRegex`. The
exact registry entry resolved to the same `DataTransformerInfo` object as the
experiment's operator loader. The immutable provider catalogue, not this
mutable global registry, determined admission.

No complete Grafana application registry was initialized. Unknown IDs were
rejected during preflight instead of inheriting `transformDataFrame`'s silent
pass-through behavior.

## 7. Exact operator entry

The selected entry is the exact compiled package path:

```text
@grafana/data@13.2.3/dist/esm/transformations/transformers/renameByRegex.mjs
```

Its pinned source is
[`packages/grafana-data/src/transformations/transformers/renameByRegex.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformers/renameByRegex.ts).
The package root is public, but this deep compiled entry is not in the package
export map. It is therefore an exact-version provider build seam, not a stable
SDK API.

The public-root candidate was rejected for the isolated capability artifact
because its closure is broader. A pinned source entry was unnecessary because
the installed exact package entry retained the authoritative implementation.

## 8. Explicit/declarative parity

Identical real TestData frames were executed through:

1. the exact operator directly; and
2. published `transformDataFrame` with an exact one-entry registry.

Semantic snapshots matched for frame count, field count/order, field names,
display names, config, state, values, labels, `refId`, and metadata. Expected
copying was not treated as an identity failure.

## 9. Empty pipeline

An empty pipeline returned the original frame-array reference unchanged. It did
not load the operator and did not initialize the registry merely to express
“no transformation.” Empty pipelines are a first-class supported capability.

## 10. Pipeline ordering diagnostic

A diagnostic two-operator sequence outside the admitted profile demonstrated
ordered execution:

- `Raw -> Intermediate -> Signal` produced `Signal`;
- reversing the two steps produced `Intermediate`.

This proves order is meaningful. It does not extend support beyond one
transformation.

## 11. Chain-length admission

Preflight rejected two transformations as `TransformationPipelineInvalid`
before scene activation. The capability descriptor reports
`maxChainLength: 1`.

## 12. Cancellation/stale-generation result

A real `/grafana/api/ds/query` request was delayed and then the dashboard was
unmounted. The dashboard scope returned to zero and the old generation did not
publish transformed output. A second delayed refresh was followed by a UID
change; the alternate dashboard rendered while the old `Signal` output stayed
absent. Returning to the primary UID created a fresh, successful transformed
generation.

This exercises cancellation before result, UID replacement, unmount, and later
generation recovery through the real query path.

## 13. Performance/input result

Container-local observations were deliberately diagnostic, not production
SLAs:

| Frames | Total fields | Points per field | Observed elapsed time |
| ---: | ---: | ---: | ---: |
| 1 | 2 | 120 | 4.20 ms |
| 1 | 5 | 3,600 | 0.23 ms |
| 4 | 36 | 10,000 | 0.49 ms |

All samples completed below the predeclared 2-second pathology guard and
preserved expected frame/field structure. Timing variance makes these values
unsuitable as an SLA. Structural cleanup is supported by the browser
cancellation probe and the accepted style-lifecycle regression rather than
noisy heap deltas.

## 14. Bundle/provenance result

The isolated capability build transformed 266 modules and emitted:

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| Operator feature chunk | 2.21 kB | 0.93 kB |
| Capability entry | 44.30 kB | 11.97 kB |
| Shared string/utility chunk | 120.48 kB | 34.25 kB |

The guard found exactly one `renameByRegex` implementation module and zero:

- Grafana `public/app` transformation modules;
- broad application registry initializers;
- transformation editors;
- unrelated transformer implementations;
- Monaco modules;
- Codicon assets; and
- transformation preview images.

The utility closure is not “operator-only” in byte terms and remains a Phase 2
bundle-budget input, but it does not contain the prohibited transformation UI
or application registry closure.

## 15. Field override/display result

The real fixture proved the ordering:

```text
Phase 0 Pulse Raw
  -> exact renameByRegex
  -> Phase 0 Pulse Signal
  -> field config / display processing
  -> real Time series legend
```

The transformed frame retained `refId: A`. The real VizPanel retained unit
`percent`, absolute thresholds, line width 2, and fill opacity 15. Refresh,
time-range change, and resize each preserved the visible transformed name.

## 16. Failure isolation

Preflight rejected unsupported ID, chain length two, missing option, extra
option, and `disabled` form with their exact typed categories.

An accepted configuration with an invalid regular expression failed during
execution. Text and Stat remained rendered. The Time series did not display
either `Phase 0 Pulse Raw` or `Phase 0 Pulse Signal`, and a later compatible
reload recovered.

**Important upstream finding:** `SceneDataTransformer` 8.13.5 catches the
operator error and creates `PanelData` with `state: Error`, but spreads the
source data into that error object, retaining raw `series`. The experiment's
provider-owned subclass observes only this error state, clears the errored
series, retains the panel-local error, and records containment. Production must
carry an equivalent tested fail-closed policy; operator error propagation alone
is insufficient.

## 17. Regex semantics

The pinned operator, not project code, was the behavior authority. Tests
covered:

- fixture form `/Raw/` with `Signal`;
- capture groups and `$1`/`$2` replacement;
- historical `/.../g` global-pattern form; and
- an unwrapped `Raw` string, which preserved the pinned no-match/display-name
  behavior.

Invalid regex syntax was classified as `TransformationExecutionFailure`.

## 18. Options profile

Admission requires an object with exactly two own keys:

```text
regex: string
renamePattern: string
```

There is no implicit normalization. Missing, non-string, or additional options
are rejected as `TransformationOptionsInvalid`. Additional transformation-level
keys are rejected as `TransformationPipelineInvalid`.

## 19. Lazy-loading observation

The operator is a dynamic provider feature. The empty-pipeline unit case proved
that preparing and executing no transform leaves the loader untouched. The
real fixture loads the operator once after runtime/bootstrap admission and
before scene activation; later uses hit the module cache.

The experiment did not add a second browser dashboard with an empty pipeline,
so network-level “no feature-chunk request” remains a useful Phase 2 packaging
assertion rather than a broader claim here.

## 20. Real query pipeline

The successful Chromium path was:

```text
dashboard UID
  -> V1/schema-42 DTO
  -> constrained converter
  -> SceneQueryRunner
  -> real TestData predictable_pulse
  -> /grafana/api/ds/query
  -> PanelData
  -> provider-owned fail-closed SceneDataTransformer
  -> exact renameByRegex operator
  -> real Time series renderer
```

No fabricated `PanelData`, iframe, Grafana application shell,
`GrafanaApp.init`, navigation tree, or SystemJS fallback was used.

## 21. Real Time series result

The Grafana 13.2.3 Time series panel rendered a real plot/canvas and visible
`Phase 0 Pulse Signal` legend from the real response. Refresh issued another
query; time-range update reran the query; resize changed the canvas width.
Text and Stat remained live alongside it.

## 22. Presentation regression

The conformance browser test retained the accepted production-shaped provider:

- strict CSP reported zero violations;
- all three Emotion style tags carried the response nonce;
- provider portal fallback count stayed zero;
- the real panels remained styled with local assets; and
- one React/ReactDOM identity remained.

The accepted style-lifecycle stress case, including 20 cycles and the
two-dashboard handoff, passed when run as the targeted regression. In two full
sequential-suite runs, that same unchanged case observed two transient
`totalRules` values after the preceding initialization test (the other four
cases passed); an isolated rerun passed. No #45 or shared source was changed.
This inherited suite-order sensitivity should be tracked as test-harness debt,
but the conformance provider's own strict-CSP, two-dashboard, transform,
presentation, and lifecycle assertions passed. This experiment did not reopen
issues #40–#45.

## 23. Input profile

Supported input is an array of Grafana DataFrames with at least one time field,
one numeric field, and aligned field lengths, matching the verified Time series
series path. Other shapes fail as `TransformationInputUnsupported`.

No support is claimed for tables, annotations, arbitrary field types, nested
frames, streaming semantics, or transform-specific input variants.

## 24. Error taxonomy

| Error | Scope |
| --- | --- |
| `UnsupportedTransformation` | Pre-activation; panel configuration fatal |
| `TransformationVersionMismatch` | Provider admission/preparation fatal |
| `TransformationRegistryUnavailable` | Provider admission/preparation fatal |
| `TransformationOptionsInvalid` | Pre-activation; panel configuration fatal |
| `TransformationInputUnsupported` | Runtime; panel-local and fail-closed |
| `TransformationLoadFailure` | Provider preparation fatal |
| `TransformationExecutionFailure` | Runtime; panel-local and fail-closed |
| `TransformationPipelineInvalid` | Pre-activation; panel configuration fatal |

These experiment classes inform the Phase 2 contract; they are not production
public APIs.

## 25. Provenance

| Item | Identity |
| --- | --- |
| Transform | `renameByRegex` |
| Package | `@grafana/data@13.2.3` |
| Pinned source commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Source path | `packages/grafana-data/src/transformations/transformers/renameByRegex.ts` |
| Compiled entry | `dist/esm/transformations/transformers/renameByRegex.mjs` |
| Emitted isolated chunk | `assets/renameByRegex-BN223a0P.js` |
| Emitted chunk SHA-256 | `122fba21a37ed0253bb32d4d57c37d99474359de3420eab8d609c896fdbcacd8` |
| Conformance cases | Physical cohort, capability, execution, performance, bundle, and real-browser suites |

No licensing conclusion is made here. The exact package/source boundary remains
subject to the existing Phase 1 licensing and provider-distribution decisions.

## 26. Required Phase 2 transformation contract

Phase 2 must preserve:

1. an immutable manifest that declares exact transform ID, Grafana/Data cell,
   topic/input profile, options profile, maximum chain length, execution mode,
   provenance, and conformance evidence;
2. full dashboard transformation preflight before scene activation;
3. an empty pipeline that loads nothing;
4. a closed logical loader map with no arbitrary import construction;
5. operator preparation after compatibility/bootstrap admission and before
   scene construction;
6. object-identity verification against any registry mirror;
7. exact ordered execution with cancellation and generation ownership;
8. panel-local typed runtime failure with a fail-closed series policy;
9. provider-private Grafana DataFrame and operator types; and
10. version-cell conformance tests and bundle/provenance guards.

## 27. Limitations

- Only the verified cell and `renameByRegex` series profile passed.
- The selected operator entry is a version-coupled deep package path.
- The capability artifact still includes a material shared utility closure.
- Network-level lazy absence for an empty real dashboard was not exercised.
- The fail-closed subclass is experiment evidence, not production code.
- The inherited #45 full-suite style-rule count remains order-sensitive even
  though its isolated stress case and this experiment's presentation checks
  pass.
- Heap measurements and production performance limits were not established.
- No other transform, chain, topic, frame shape, Grafana version, or Scenes
  version is covered.

## 28. Decision

Adopt the closed provider-owned capability catalogue and lazy exact operator
loader as the Phase 2 starting architecture for this verified cell. Admit an
empty pipeline or one exact `renameByRegex` only. Retain the one-entry registry
as an execution mirror, never as the compatibility authority.

Require a provider-owned fail-closed adapter around Scenes transformation error
behavior before the capability can become production-supported.

## 29. Architecture impact

The experiment closes the transformation-conformance blocker for the initial
Phase 2 scope and validates the transformation compatibility strategy's Model
B plus Model C combination. It also adds one required production responsibility
that research alone did not expose: preventing Scenes' errored raw series from
reaching the visualization.

The provider manifest can now make a precise, test-backed transformation claim
without claiming registry parity.

## 30. Inputs to final Phase 1 synthesis

- The verified provider cell may declare `renameByRegex` version 13.2.3 with
  series input and exact options.
- The deep entry and shared utility closure must be tracked in provider
  provenance and bundle budgets.
- Transformation preparation must follow bootstrap/admission ordering.
- Registry and operator object identity must be checked.
- Scenes 8.13.5 requires explicit fail-closed error containment.
- No-transform and transformed dashboards can share the provider without making
  the registry the support authority.

## 31. Follow-up

Phase 2 should convert the experiment contracts into private provider modules,
add an empty-dashboard browser chunk assertion, establish a bundle budget, and
repeat the conformance suite for every admitted Grafana version cell or newly
supported transformation. No new transform should enter the manifest without
equivalent operator, input, lifecycle, failure, provenance, and visualization
evidence.

Issue #47 is ready to close after human review. This completes the remaining
bounded technical Phase 1 conformance experiment, but final Phase 1 approval
issue #20 still depends on synthesis of all merged workstreams, existing legal
approval dependencies, and explicit maintainer approval. This experiment does
not perform that approval.

## 32. Final status

**PASS**

PASS is limited to:

- empty transformation pipelines;
- one exact `renameByRegex` transformation;
- exact `regex` and `renamePattern` string options;
- maximum chain length one;
- the verified series DataFrame profile; and
- Grafana/Data 13.2.3 with Scenes 8.13.5 and React/ReactDOM 19.2.8.

No broader Grafana transformation parity is claimed.
