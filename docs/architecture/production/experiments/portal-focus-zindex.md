# Portal Focus and Z-Index Containment Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Portal focus and z-index containment (GitHub issue #43) |
| Status | Bounded technical experiment complete |
| Created | 2026-10-17 |
| Last Updated | 2026-10-17 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Runtime cell | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5; Chromium from Playwright 1.56.1 |
| Presentation baseline | Experiment E provider; issue #40 scoped light DOM; issue #41 Emotion ownership |
| Final status | **PASS** |

This report uses the canonical terminology from the
[project roadmap](../../../project/roadmap.md). Generated evidence under
`artifacts/experiments/portal-focus-zindex/` is ignored. The result is limited
to the verified client-side provider cell above.

## 2. Hypothesis

One explicit provider-owned portal root can preserve React context, provider
styling, synthetic event propagation, accessible modal/non-modal behavior,
host-coordinated stacking, multi-dashboard isolation, and cleanup without an
iframe, Shadow DOM, Grafana shell, uncontrolled `document.body` fallback, or an
unbounded z-index.

## 3. Predeclared criteria

All 30 predeclared PASS criteria were retained. The test suite required a
marked and reference-counted root; no implicit body fallback; React/theme/
Emotion context; distinct synthetic/native/outside-click evidence; correct
non-modal and modal focus behavior; deterministic layering; clipping escape;
two owners; bounded nesting; cleanup; one React identity; issue #40/#41
regressions; and no iframe, Shadow DOM, Grafana application shell, navigation,
or SystemJS.

All required criteria passed. This means **the tested keyboard/focus/ARIA
contract passed**. It is not a claim about every assistive technology,
third-party overlay library, browser, or Grafana version.

## 4. Portal ownership inventory

| Surface | Owner | Behavior | Classification |
| --- | --- | --- | --- |
| `#grafana-portal-container` creation/removal | Experiment provider root lease | Creates and marks a body child at provider mount, retains it across zero-dashboard states, removes it at final provider release | **PROVIDER OWNED** |
| Dashboard portal references | POC runtime portal manager | Acquires the compatible existing root per dashboard scope without owning final removal | **DASHBOARD INSTANCE OWNED REFERENCES** |
| Root ownership markers and layer band | Experiment provider | Adds provider, runtime, surface, theme, reference, and z-index-token evidence before overlays open | **PROVIDER OWNED** |
| Grafana `Portal` resolution | Published `@grafana/ui` | Uses explicit root, nested portal context, otherwise falls back to `document.body` | **GRAFANA LIBRARY OWNED; FALLBACK FORBIDDEN** |
| Grafana `Popover` placement | Published `@grafana/ui` and Floating UI | Fixed-position portal child with provider-owned open/close glue | **GRAFANA LIBRARY OWNED + PROVIDER ENVIRONMENT** |
| Grafana `Modal` and focus manager | Published `@grafana/ui`, React Aria, Floating UI | Dialog/focus trap/dismissal routed into controlled root | **GRAFANA LIBRARY OWNED + PROVIDER ENVIRONMENT** |
| Overlay logical identity | Experiment provider | `data-grsdk-overlay-owner` associates content/root children with a dashboard instance | **DASHBOARD INSTANCE OWNED** |
| Direct body overlay insertion | None on PASS path | Missing or incompatible root throws `portal.body-fallback`/`portal.root-conflict` | **REJECTED** |

Pinned upstream evidence:

- [`Portal.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/packages/grafana-ui/src/components/Portal/Portal.tsx)
  defines the fixed ID, nested portal context, and body fallback.
- [`ModalBase.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/packages/grafana-ui/src/components/Modal/ModalBase.tsx)
  uses React Aria `OverlayContainer`, Floating UI focus management, and
  `getPortalContainer()`.
- [`AppWrapper.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/public/app/AppWrapper.tsx)
  supplies `UNSAFE_PortalProvider` around Grafana's application tree. The
  experiment reproduced only that published React Aria container context, not
  `AppWrapper` or any shell provider.

## 5. Provider portal root

**PASS.** The root is an intentional child of `document.body`. Controlled body
placement is required for the tested light-DOM model because it escapes panel
stacking and clipping ancestors. The provider creates the root before
Runtime/dashboard acquisition and validates:

- fixed root identity;
- `data-grsdk-provider="grafana-13.2.3"`;
- `data-grsdk-runtime="portal-focus-zindex-v1"`;
- `data-grsdk-surface="portal"`;
- compatible theme/layer values; and
- provider-lifetime reference ownership.

Every normal browser observation reported `controlledBodyChild: true` and
`directBodyFallbacks: 0`. The unit contract rejects a missing root before an
overlay renders. A controlled root is therefore required; direct body fallback
can and should be forbidden.

The identifiers are experiment evidence, not final public DOM names.

## 6. React portal behavior

**PASS.** Portal content retained the provider context sentinel
`context-portal-primary`, Grafana theme context, the provider React Emotion
cache, and the provider `@emotion/css` path.

Event evidence deliberately separates:

- **React synthetic propagation:** clicking portal content incremented the
  provider logical-parent counter;
- **native DOM propagation:** the document listener independently observed the
  physical body/portal event path; and
- **outside-click classification:** clicks inside any compatible provider
  overlay/control were internal, while a real host action incremented the
  outside counter and dismissed the non-modal overlay.

The unrelated host action remained at zero after the portal action. React-tree
bubbling and native ancestry are not treated as equivalent.

## 7. Non-modal overlay result

**PASS.** A published Grafana `Popover` rendered through the controlled root.
Opening it retained trigger focus, set no `aria-modal`, did not inert the host,
allowed its action, closed on Escape/outside interaction, and removed its
portal child. The provider supplied only state, dismissal classification,
logical owner evidence, and the tested layer value.

## 8. Modal result

**PASS WITH EXPLICIT ENVIRONMENTAL GLUE.** The published Grafana `Modal`
provided the dialog, accessible name, close control, Floating UI focus trap,
Escape dismissal, and React Aria overlay container. The provider supplied:

1. `UNSAFE_PortalProvider` with the validated root getter;
2. background `inert`/`aria-hidden` lifetime while genuinely modal;
3. owner marking and deterministic focus fallback; and
4. `aria-modal="true"` while the real modal is mounted.

The fourth item is required because the pinned `@grafana/ui` 13.2.3 dialog
rendered `role="dialog"` and an accessible label but did not emit
`aria-modal`. The bridge adds it only after focus trapping and background
inerting make the interaction genuinely modal. Non-modal overlays are never
modified this way.

The measured focus sequence stayed inside the dialog over forward and reverse
Tab traversal. Escape removed the dialog, restored trigger focus, and cleared
background inerting.

## 9. Focus failure cases

| Case | Result | Fallback |
| --- | --- | --- |
| Invoker survives normal close | PASS | Original modal trigger |
| UID replacement removes keyed owner/invoker | PASS | Provider surface |
| Dashboard owner unmounts | PASS | Provider surface |
| Final provider unmount | PASS | Host resumes normal focus ownership; no stale sentinel/content |

The provider surface is the logical fallback because it remains the nearest
stable, provider-owned region after a dashboard instance disappears. It is
programmatically focusable and avoids accidental focus on `document.body`.

## 10. Host overlay matrix

| Host case | Evidence | Result |
| --- | --- | --- |
| Fixed header | Separate document-level layer at 900 | Coexists |
| Low host overlay | Document-level layer at 1500 | Relative outcome changed predictably with tested provider model |
| High host overlay | Document-level layer at 5000 | Remained above all bounded test bands |
| Positioned context | Ancestor `position: relative; z-index: 3` | Did not contain body-child portal |
| Transform context | Ancestor transform matrix | Did not contain body-child portal |
| Opacity/isolation context | `opacity: .99; isolation: isolate` | Did not contain body-child portal |
| Dashboard `overflow: hidden` | Owner top 154.375 px; overlay top 72 px | Overlay escaped without changing panel containment |

This matrix compares values only where the elements share a comparable
document-level stacking context. Child numeric z-index values are not treated
as globally comparable through unrelated contexts.

## 11. Stacking-context analysis

The dashboard owner intentionally combined overflow clipping and a transformed
ancestor. Host ancestors also created positioned, transform, opacity, and
isolation contexts. A portal under `document.body` escaped all of them.

The portal root forms the provider's external host-facing layer. Grafana's
internal portal/modal/popover values preserve relative ordering inside that
root. Consequently, host/provider negotiation belongs on the portal root band,
not on every Grafana child.

## 12. Z-index policy models

| Model | Test band | Matrix result | Assessment |
| --- | --- | --- | --- |
| A — fixed provider numeric levels | portal 1061; nested 1090 | Deterministic but below host overlay 1500 | Insufficient embedding contract |
| B — provider-owned token scale | portal 2000; nested 2030 | Above low host overlay, below high host overlay | Viable but host cannot allocate the band explicitly |
| C — host-supplied base + provider-relative levels | portal 4000; nested 4030 | Above host 1500 and below reserved host 5000 as configured | **SELECTED CANDIDATE** |

**Recommendation: Model C.** The evidence favors host-supplied base plus
provider-relative levels because the same bounded provider ordering can be
placed intentionally between host bands. Values 4000/4010/4020/4030 are test
inputs, not public defaults. Admission must reject missing, late-changing, or
unbounded values. Model B can be a documented default profile only if the host
accepts that band; Model A is not sufficient for general embedding.

## 13. Overflow/clipping result

**PASS.** The real popover was physically outside the transformed,
positioned, grid/flex, and overflow-hidden dashboard path. Its measured top was
72 px while its owning dashboard began at 154.375 px. Panel content remained
contained; only the semantically overlayed surface escaped.

## 14. Two-dashboard result

**PASS.** Two compatible dashboards acquired one runtime and one portal root.
Both opened independently owned popovers. Clicking the second compatible
trigger did not dismiss the first. Removing primary dashboard A removed only
A's overlay; B remained visible, and runtime evidence reported one active
dashboard portal reference. Removing B reduced dashboard references to zero
and left the provider-owned root empty. Final provider unmount removed it.

## 15. Nested-overlay result

**PASS for the bounded case.** A Grafana Modal opened a Grafana Popover using
the same controlled root. The nested surface used the tested nested level
4030, retained the modal as focus owner, closed first on Escape, restored focus
to the nested trigger, and left the modal open. A second Escape closed the
modal. Cleanup order was nested child, modal child, then instance/root lifetime.

This is not a general nested-overlay manager or conformance claim.

## 16. Event isolation

Provider portal actions followed the provider React tree and native document
path separately. Compatible provider overlay/control clicks were treated as
internal for dismissal. A host action was treated as outside and executed only
when deliberately clicked. The experiment did not suppress normal native
document propagation.

## 17. Accessibility evidence

Automated Chromium assertions passed for:

- accessible dialog name and `role="dialog"`;
- `aria-modal="true"` only during modal state;
- initial focus inside;
- forward/reverse focus containment;
- visible focus outline on project-owned controls;
- keyboard-operable close action;
- Escape;
- background inerting;
- normal and missing-invoker restoration; and
- absence of modal semantics/inerting for the popover.

This proves the tested keyboard/focus/ARIA contract only. Manual assistive-
technology coverage remains future compatibility work.

## 18. Emotion regression

**PASS.** The host `grsdk-host`, provider `grsdk-provider`, and Grafana `css`
caches remained distinct. Portal content retained provider styling. Before and
after provider remount, style evidence was exactly one tag for each owner with
rule counts 1, 1, and 143. No new style-tag growth occurred.

## 19. Host CSS regression

**PASS.** The targeted issue #40 profiles A–F regression passed. In the #43
lifecycle evidence the Time series `LegendLabel` retained `padding: 0px` and
`border: 0px` before and after remount. This work did not reopen or redesign
the issue #40 containment policy.

## 20. Lifecycle result

The tested sequence was:

```text
mount -> open/close -> UID replacement -> open -> resize
  -> two owners -> owner removal -> provider unmount -> remount
```

**PASS.** Real Text, Stat/TestData, transformed Time series, responsive resize,
scene/query cleanup, portal children, focus state, listeners, observers,
timers, and provider/runtime leases returned to their expected baselines. The
root survived a zero-dashboard state while the provider remained mounted and
was removed after final provider release. Issue #45 remains the full
production-lifecycle integration gate.

## 21. Ownership/lifetime model

```text
document realm
  -> one admitted provider/runtime cohort
     -> one provider-lifetime portal lease
        -> one marked body-child portal root while provider references > 0
           -> dashboard-scope references and dashboard-owned overlay children
              -> optional bounded nested child
```

React owns children. The provider owns root admission, theme/style markers,
layer band, React Aria routing, and final cleanup. Dashboard instances own their
overlay state and owner tags. The host owns the external z-index allocation.

## 22. Collision catalogue

| Collision/failure | Evidence | Resolution/candidate |
| --- | --- | --- |
| Implicit Grafana UI body fallback | Upstream `getPortalContainer()` | Validate marked root and throw before open |
| Grafana UI imported before Runtime boot | Initial browser red test | Load published UI after runtime boot/cohort initialization |
| Inline converter catalogue recreated on overlay state | Root was released/recreated unmarked during modal open | Stable provider catalogue identity |
| Pinned Modal lacks `aria-modal` | Browser DOM showed role/name but no attribute | Bounded semantic bridge while genuinely modal |
| Dashboard B trigger dismissed A overlay | Owner-local outside classifier treated compatible control as outside | Treat marked compatible provider controls/overlays as internal |
| Floating transform defeated clipping probe coordinate | Fixed top/left competed with Floating UI transform | Test-only placement normalization; production keeps normal placement |
| Fixed Grafana z scale conflicts with host bands | Model A below host 1500 | Host-supplied external base, provider-relative internal levels |

## 23. Required production contract

Phase 2 provider work should require:

1. exact provider/runtime/style/React admission before portal creation;
2. one marked compatible root per document realm;
3. root creation before any overlay import/use can fall back to body;
4. a provider-lifetime root lease plus reference-counted compatible dashboard
   leases;
5. stable catalogue/provider identities across overlay state;
6. published React Aria portal-container context owned by the provider;
7. project-owned modal background isolation, semantic completion, and focus
   fallback where pinned Grafana UI does not supply them;
8. owner evidence for cleanup/isolation;
9. host-supplied bounded base plus provider-relative levels;
10. explicit non-modal versus modal behavior;
11. local overlay failure isolation and fatal root-conflict rejection; and
12. diagnostics for root, owners, reference count, focus fallback, and leaks.

## 24. Limitations

- One Chromium version and one exact Grafana/React/Scenes cell were tested.
- Only Grafana `Popover` and `Modal`, plus one nested combination, were probed.
- Screen-reader combinations, mobile/touch, menus/selects/drawers, RTL, dark
  theme, and arbitrary third-party overlays were not tested.
- Different/incompatible providers in one document remain unsupported.
- The POC runtime manager still requires a production rewrite.
- The clipping probe normalizes test placement; normal Grafana Floating UI
  placement was separately exercised by the non-modal and nested tests.
- No CSP compatibility claim is made.

## 25. Decision

**PASS.** The selected scoped-light-DOM provider can use one controlled
body-child portal root. Direct body fallback is forbidden. React context,
Emotion, synthetic events, native propagation, outside classification,
non-modal behavior, real modal focus/ARIA behavior, bounded nesting, clipping
escape, two-dashboard isolation, and cleanup passed.

The z-index production candidate is **Model C: host-supplied bounded base plus
provider-relative levels**.

## 26. Architecture impact

This confirms and narrows the portal decision in the
[styling containment strategy](../styling-containment-strategy.md): the portal
root is a provider-runtime resource, while overlays are instance resources.
It adds concrete provider contracts for React Aria routing, modal semantic
completion, background inerting, focus fallback, and host layer allocation.

Bundle provenance remained controlled: the Grafana application-source list is
identical to issue #41 (22 known panel/datasource files), SystemJS count is
zero, and React remains host-external. Published overlay dependencies include
`@grafana/ui`, `@floating-ui/react`, and `@react-aria/overlays`. Compared with
issue #41, the provider artifact increased from 4,553,239 to 4,561,362 raw
bytes (+8,123) and from 1,150,014 to 1,152,601 gzip-estimated bytes (+2,587).

## 27. Inputs to #42/#45

### Issue #42 — Strict CSP

New inputs, not conclusions:

- the controlled root requires a deterministic DOM target;
- the experiment sets root CSS custom properties/z-index through inline style;
- Grafana Popover supplies inline Floating UI placement styles;
- Grafana Modal/Emotion continue existing generated-style paths;
- no new font, worker, icon, or other portal asset request was introduced; and
- CSP nonce behavior was not changed or validated.

### Issue #45 — lifecycle integration

Partially unblocked inputs:

- stable catalogue identity is required across overlay state;
- dashboard reference count follows compatible scopes while final root
  ownership follows the provider lifetime;
- owner removal must precede final provider-root release;
- missing-invoker fallback targets the provider surface;
- modal isolation must always be restored during UID/unmount failure paths; and
- diagnostics must distinguish provider-lifetime infrastructure from
  dashboard-owned children.

Issue #45 remains responsible for the final integrated lifecycle contract.

## 28. Follow-up

- Carry the portal/root/focus/z-band contract into Phase 2 provider design.
- Give issue #42 the inline-style, root-target, React Aria, and Emotion inputs
  above without claiming CSP support.
- Give issue #45 the reference-count, stable-identity, fallback, and teardown
  requirements above.
- Issue #44 may proceed independently; this experiment introduced no new
  runtime portal assets.
- Consider upstreaming or version-gating the missing pinned-Modal
  `aria-modal` behavior rather than silently retaining a permanent DOM patch.

## 29. Final status

**PASS**

Issue #43 has sufficient bounded evidence to close after human review. The
result does not begin or decide issues #42, #44, #45, or #47.
