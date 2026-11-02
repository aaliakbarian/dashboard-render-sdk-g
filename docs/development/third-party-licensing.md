# Third-party licensing workflow

The third-party licensing gate inventories the exact code and assets entering
the current SDK provider and host bundles. It preserves authoritative evidence
for human and legal review; it does not provide legal advice or by itself
authorize a public release.

## Current result

The generated inventory records five exact review questions. The production
`releaseGate` is currently `blocked-legal-review` for three components:

- `@grafana/i18n@13.2.3` and `@grafana/schema@13.2.3`: their published package
  metadata and `LICENSE_APACHE2` files say `Apache-2.0`, but the pinned Grafana
  repository exception list does not name those source directories.
- `dangerously-set-html-content@1.1.1`: the manifest declares MIT, but neither
  the published artifact nor the exact upstream source revision contains the
  complete license terms.

Two additional `inventoryReview` questions remain visible but are installed
only and therefore do not block publication of the current production closure:

- `get-document@1.0.0`: the installed artifact and exact upstream revision do
  not contain a license declaration or license terms.
- `@visx/vendor@3.12.0`: its manifest uses the non-SPDX string
  `MIT and ISC`; the normalized `MIT AND ISC` expression and retained vendored
  terms require review. This installed-only package is not in the current
  production bundle graph.

This status is different from missing, unclassified, or changed evidence.
Those conditions make generation or validation fail. An inventory review
question becomes a publication blocker only when that exact component is
reachable from a production distribution scope.

## Authoritative inputs

The generator reconciles all of the following:

- `yarn.lock`, the declared workspaces, and every physical installed package;
- the provider-13 and SDK-host bundle module graphs and emitted files;
- package manifests plus package-local LICENSE, NOTICE, copyright, and
  attribution material;
- the exact Grafana source checkout at commit
  `6193dc03311b631b9727b560d24369e683dc396e`, including its `LICENSE`,
  `LICENSING.md`, and `NOTICE.md`;
- the reviewed policy and checked-in authoritative upstream evidence under
  `compliance/third-party/`.

Grafana's repository default is `AGPL-3.0-only`. Only exact paths covered by
the pinned licensing evidence are classified under an `Apache-2.0` exception.
Do not infer that every `@grafana/*` package or every Grafana source file has
the same license.

Evidence files are copied byte-for-byte. SPDX expressions preserve upstream
AND/OR/WITH structure. Dual-license alternatives are recorded without silently
selecting one. NOTICE and attribution files remain separate and discoverable.

## Distribution scopes

The machine inventory distinguishes provider-bundled, host-bundled, external
peer, generated-helper, source-derived, and asset scopes from `test-only`,
`development-only`, `demo-only`, and `installed-not-distributed` material.
Nonproduction reachability follows exact dependency and optional-dependency
edges from reviewed workspace roots using the nearest physical Node resolution;
cycles are bounded. Production scopes are derived independently from bundle,
peer, helper, and asset evidence, and may overlap nonproduction scopes.
Installed or top-level dependency status alone does not make a component part
of the distributed notice set.

## Container-first commands

Run the workflow through the existing development container:

```bash
docker compose --env-file dev/grafana/.env exec -T dev yarn test:licenses
docker compose --env-file dev/grafana/.env exec -T dev yarn licenses:generate
docker compose --env-file dev/grafana/.env exec -T dev yarn licenses:check
```

Generation is deterministic and works offline once the pinned checkout,
installed packages, bundle evidence, and checked-in review evidence are
present. `licenses:check` recomputes expected outputs and rejects missing,
extra, stale, or hand-edited files without rewriting them.

Do not edit generated `THIRD_PARTY_NOTICES.md` or `licenses/**` files by hand.
Change the authoritative evidence or reviewed policy, add a focused regression
test, regenerate, and review the resulting diff.

## Updating the inventory

When a dependency, bundle module, Grafana source path, or asset changes:

1. Build the provider and SDK host so their bundle evidence is current.
2. Add a failing test for the new license or boundary case.
3. Verify the exact physical package/source identity and authoritative terms.
4. Update `compliance/third-party/policy.json` with the narrow evidence-backed
   decision; never invent or paraphrase third-party license text.
5. Run generation twice and confirm byte-identical output.
6. Run `test:licenses`, `licenses:check`, package boundary guards, production
   builds, and bundle provenance inspection.
7. Review production/nonproduction scopes, local notice links, evidence hashes,
   unresolved decisions, and the complete tracked/untracked file inventory.

Qualified review is required for conflicting, absent, or ambiguous license
evidence. A scanner success proves only that repository policy and generated
artifacts are internally consistent.

## Boundary with issue #65

This gate does not satisfy AGPL source-availability obligations and does not
make the project public-release ready. Issue #65 must separately define and
verify the corresponding-source delivery mechanism, reproducible release
procedure and artifacts, SBOM, distribution verification, and release
packaging controls. Both gates must pass before a publication decision.
