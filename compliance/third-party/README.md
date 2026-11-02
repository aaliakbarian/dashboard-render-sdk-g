# Third-party license gate policy

`scripts/third-party-license-gate.mjs` is an offline, dependency-free Node
scanner for the provider and SDK host distribution. Run Node through the
existing Compose dev service:

```sh
docker compose --env-file dev/grafana/.env exec -T dev node --test scripts/third-party-license-gate.test.mjs
docker compose --env-file dev/grafana/.env exec -T dev node scripts/third-party-license-gate.mjs generate
docker compose --env-file dev/grafana/.env exec -T dev node scripts/third-party-license-gate.mjs check
```

Task 1 supplied the engine and controlled fixtures. Task 2 populated the
checked-in policy from the reviewed provider and SDK-host bundle graphs, the
exact pinned Grafana source closure, the emitted assets, installed manifests,
and the Yarn lockfile. Regenerate and review the policy whenever that closure
changes; do not use an installation-wide license summary as a substitute for
bundle evidence.

## Contract and outputs

The CLI accepts `generate` or `check`, optional `--root directory`, and optional
`--policy repository-relative-file`. The module exports
`runGate({root, mode, policyPath, limits})`,
`scanInventory({root, policy, limits})`, `validateSpdxExpression(expression)`,
`SPDX_IDENTIFIERS`, and `LIMITS`. The SPDX validator returns a bounded expression
tree with `license`, `with`, `and`, and `or` nodes, retaining license IDs,
exception grants and operator grouping. Equivalent redundant parentheses and
associative/commutative operands share a canonical tree; the original declaration
string remains in the inventory.

`scanInventory` returns a fully rendered `artifacts` Map of relative paths to
Buffers plus the three inventories. It performs no writes. `runGate` additionally
hashes the policy and either writes the map (`generate`) or compares it with
disk (`check`). Check mode never creates directories or repairs files.

Artifacts are `THIRD_PARTY_NOTICES.md`, `licenses/dependency-inventory.json`,
`licenses/source-inventory.json`, `licenses/asset-inventory.json`,
`licenses/README.md`, and exact upstream bytes under `licenses/evidence/`.
Object keys, components, locations and evidence references use stable ordering;
there are no timestamps or machine-local roots. Input manifests, policy,
lockfile, evidence graphs, emitted files, source files and copied evidence have
SHA-256 fingerprints. Evidence output names include the full safe source
reference beneath a stable physical-package or asset identity, preserving
distinct same-basename files and separate physical package copies. The artifact
Map rejects conflicting bytes for an existing destination.

Both modes reject unexpected files inside the generated `licenses` tree.
Generation does not delete orphaned evidence: review and explicitly remove
obsolete generated files when updating the closure, then regenerate.

## Policy schema (version 1)

Paths below are relative to the repository unless explicitly described as
relative to the source checkout. Absolute paths, backslashes, traversal,
control characters and symlink escapes are rejected. Every existing segment of
every generated destination is checked before the first write; all output
symlinks are rejected, including aliases to unrelated files inside the
repository. Policy records have strict allowed fields and types. In particular,
source decisions cannot set scanner-owned `path`, `scopes`, hashes or bundles.
Keep policy entries as
classifications and evidence references; never put rewritten license prose in
the policy.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Must be `1`. |
| `outputDir` | Defaults to `licenses`; must be a safe relative generated directory. |
| `noticesPath` | Must be `THIRD_PARTY_NOTICES.md`. |
| `bundles` | Both provider and host records are required. Each has `path` to the real JSON evidence, `outputDir` for emitted files, `scope` (`provider-bundled` or `host-bundled`), and descriptive `workspace` manifest path. |
| `workspaces` | Explicit manifest paths used to reconcile direct dependencies, optional dependencies and peers against installed locations and lock descriptors. Include production workspaces and the root; workspace protocol dependencies are first-party. |
| `firstPartyPaths` | Reviewed directory prefixes for first-party bundle modules, including the prebuilt provider consumed by the host. These paths do not override package, Grafana-source, asset, or generated-helper handling. |
| `packages` | Allowlist keyed by exact `name@version`. An empty object enables default package-local evidence discovery; production identities absent here fail. |
| `externalPeers` | Records with `name`, exact `version`, and `workspace`. The peer must be declared there and resolve to that installed version. Scope applies to the resolved physical copy. Bare bundle imports must match an approved external peer. |
| `generatedHelpers` | Exact virtual module keys, e.g. `rolldown/runtime.js`, with `{ "package": "rolldown@exact-version" }`; optional `location` disambiguates physical copies. The owning package must be allowlisted and licensed. |
| `assets` | Explicit records described below. Emitted asset graph entries, files on disk and inline CSS/font/image modules must be classified. |
| `classifications` | Exact direct workspace dependency identities classified as `test-only`, `development-only`, or `demo-only`. Unreachable installed components default to `installed-not-distributed`. |
| `source` | `null` until reviewed, otherwise the exact Grafana source configuration below. |

The bundle reader consumes actual `chunks[].fileName`, `chunks[].modules`,
`chunks[].imports`, `chunks[].dynamicImports`, and `assets[].fileName` fields.
Module paths use the existing `<repo>/` and `<grafana-source>/` markers. Query
suffixes such as `?inline` are removed for physical file/evidence lookup. The
reader uses emitted chunk module lists, rather than the larger build resolver
module list that may include tree-shaken inputs. Every emitted file must appear
as a chunk, an explicit asset, or one of the configured bundle evidence files.
When the SDK host consumes a prebuilt provider chunk, its reviewed module graph
is expanded so the enclosed components also retain the host-bundled scope.

The scanner enumerates root, declared-workspace and ancestor `node_modules`,
including nested installations and exact versions. Workspace links themselves
are excluded from the third-party inventory while their local installations
are discovered. Physical realpaths deduplicate aliases; nearest workspace
resolution takes precedence over a different root copy. From reviewed
nonproduction workspace roots, the scanner follows exact physical
`dependencies` and installed `optionalDependencies`, retaining distinct
`test-only`, `development-only`, and `demo-only` scopes with bounded cycle
handling. Missing required physical edges fail; absent optional edges do not.
Peer ownership is not inferred as a transitive dependency edge. Every
production copy is checked;
components group exact identities but retain `physicalComponents` with each
location's own scopes and evidence. Undistributed physical copies do not inherit
a bundled/peer copy's evidence duties. Directness is recorded in `directIn` and
`relationship`; a dependency can have several distribution scopes.

The generated dependency inventory has two separate decisions:
`inventoryReview` lists every unresolved question retained for human or legal
review, while `releaseGate` contains only review-required components reachable
from the current production distribution. Installed-only review questions stay
visible without becoming publication blockers.

Lockfile parsing supports the repository's Yarn modern lock format: top-level
quoted descriptor blocks, exact `version`, and npm `resolution` identities.
Every direct descriptor, version and resolution must match the same lock entry.
Duplicate descriptors or repeated identity fields are rejected as ambiguous.
Unknown identities and inconsistent direct descriptor resolutions fail. This
does not attempt to implement a generic YAML or semver engine.

### Package evidence decisions

By default the scanner reads package-root `LICENSE*`, `LICENCE*`, `COPYING*`,
`NOTICE*`, `COPYRIGHT*`, and `ATTRIBUTION*` files. License bytes must contain
recognized distinguishing clauses/titles and agree with the validated SPDX
declaration. NOTICE, attribution and copyright files are copied verbatim and
linked from the notices. A manifest declaration alone is never enough.

An exact package decision may contain:

```json
{
  "license": "(MPL-2.0 OR Apache-2.0)",
  "sourceUrl": "https://example.invalid/project",
  "requiredFiles": ["NOTICE", "ATTRIBUTION"],
  "reason": "Explain the reviewed authoritative evidence decision.",
  "evidence": [
    {
      "path": "upstream-evidence/component/LICENSE",
      "kind": "license",
      "license": "Apache-2.0"
    }
  ]
}
```

`evidence` adds to default discovery or overrides the matching path's metadata.
Its `kind` is `license` or `attribution`; `license` is an explicit reviewed SPDX
classification for authoritative prose the bounded detector cannot identify.
An explicit evidence list requires `reason`; it cannot erase a clearly
conflicting license detected in that file. `requiredFiles` paths are relative
to every production physical copy's package root and fail if missing.
`sourceUrl` accepts reviewed GitHub shorthand or an absolute `http`, `https`,
`git`, or `git+https` URL with an authority/hostname. Credentials, query
parameters, fragments, hostless Git paths, local paths, and Windows paths are
rejected so generated metadata cannot retain secrets or machine locations.

A differing manifest/evidence declaration additionally requires a `conflict`
object with exact `manifest`, `evidence`, `reason`, and `status`. Status
`unresolved` always creates an inventory-review question and blocks publication
when the exact component is in a production scope; `resolved` records an
explicit, reviewed decision. The exact tension remains visible in the generated machine inventory. Review
references and notes may be retained in policy metadata and are pinned by its
fingerprint; they do not themselves establish authoritative license evidence.

The checked-in SPDX identifier subset is exported from the scanner. It includes
the expected MIT/BSD/ISC, Apache, AGPL/GPL/LGPL, MPL, BlueOak, CC0, Unlicense,
OFL and other reviewed cases. Supported grammar is case-sensitive identifiers,
parentheses, `AND`, `OR`, and `WITH` for the checked-in exception subset.
`NOASSERTION`, `LicenseRef-*`, unknown names and malformed expressions fail.
The tool preserves the complete expression and checks explicit evidence
operator declarations by comparing the complete canonical AST; it does not
choose a dual-license alternative. `WITH` requires an authoritative matching
SPDX declaration or an explicit reviewed evidence classification with a reason.
A base-license file alone does not establish an exception grant. The same
structured declaration and exception checks apply to package, source and asset
evidence; matching only the set of base-license IDs is insufficient.

`@grafana/schema@13.2.3` and `@grafana/i18n@13.2.3` deliberately retain the
published Apache manifest/file versus pinned source licensing-boundary tension
as complete evidence requiring qualified legal review. The generated release
gate is therefore `blocked-legal-review`; this differs from missing or unknown
evidence, which fails generation. DOMPurify retains
`(MPL-2.0 OR Apache-2.0)`; a single MPL file does not silently replace that dual
expression. No general Grafana exception is inferred.

### Grafana source

```json
{
  "root": ".grafana-source/grafana-v13.2.3",
  "revision": "exact-forty-character-git-commit",
  "url": "https://github.com/grafana/grafana",
  "licensing": ["LICENSING.md"],
  "paths": {
    "public/app/exact/path.ts": {
      "license": "AGPL-3.0-only",
      "evidence": ["LICENSE"]
    },
    "packages/grafana-ui/exact/path.tsx": {
      "license": "Apache-2.0",
      "evidence": ["LICENSE_APACHE2"]
    }
  }
}
```

`root` is repository-relative. All `licensing`, `paths` keys and path-specific
`evidence` entries are relative to that checkout. The commit must match Git
HEAD; file hashes detect local source/evidence drift. Every emitted upstream
module must match an exact path entry. `public/app` is required to carry
`AGPL-3.0-only`; exception paths are explicitly listed under `packages/` and
require licensing-boundary evidence plus matching authoritative license bytes.
The policy author must verify that the exact package path is covered by the
pinned boundary document. No blanket `packages/**` exception is inferred.

### Assets

Each asset has a safe `path`, `type` (`css`, `font`, `icon`, `image`, `worker`,
or `other`), and `use` (`runtime` or `static`). For package-owned assets, use
`package: "name@version"` and optional exact physical `location`; the package's
validated evidence supplies the license. Other assets require `license` and an
`evidence` array of authoritative repository-relative license paths. Source and
asset evidence entries can also be `{ "path": "...", "license": "...",
"reason": "..." }` objects for explicit reviewed classifications, including
exception grants. Source evidence paths remain relative to the pinned checkout.

`included: false` requires `reason` and records an installed/non-distributed
candidate without claiming it is shipped. An excluded record cannot satisfy
an emitted-file or inline-module classification. Asset bytes and independent
license evidence are fingerprinted and copied when included.

## Resource bounds

The scanner enforces these generous hard ceilings per invocation. The optional
programmatic `limits` object can lower named limits for constrained callers or
fixtures; it cannot raise or disable them. Limits are invocation-local, including
concurrent calls. Policy JSON and CLI flags cannot override them.

| Limit key | Default ceiling |
| --- | --- |
| `fileBytes` | 64 MiB per regular input file |
| `jsonBytes` | 16 MiB per JSON input, also subject to `fileBytes` |
| `inputBytes` | 1 GiB aggregate bytes read, counting repeated reads |
| `artifactBytes` | 512 MiB aggregate unique rendered artifact bytes |
| `items` | 1,000,000 visited JSON values, directory entries, lock descriptors, module visits and artifact entries combined |
| `traversalDepth` | 128 package/directory traversal levels |
| `jsonDepth` | 128 JSON object/array/value levels |
| `spdxChars` | 8,192 characters per SPDX expression |
| `spdxTokens` | 2,048 tokens per SPDX expression |
| `spdxDepth` | 64 parenthesized SPDX levels |
| `gitTimeoutMs` | 10,000 ms for source Git verification; output is also capped at 64 KiB |

Inputs are opened without blocking on FIFOs, checked as regular files, checked
against their size limit and read in bounded chunks. Directory enumeration is
incremental and charged against the item budget. JSON structure is checked
iteratively before policy interpretation, traversal has explicit depth guards,
and SPDX rejects excess size/depth before recursive parsing can exhaust the
stack. Violations report deterministic `Resource limit: ...` errors; validation
diagnostics are capped at 2,048 characters. Artifact collisions fail before
replacement, and resource/policy/evidence errors occur before output writes.

## Review boundary

The gate rejects missing or conflicting evidence rather than inventing text.
Its bounded recognition rules and explicit policy decisions support an
inspectable inventory; they are not a legal opinion. Passing this gate alone
does not authorize public release or meet AGPL source-availability obligations.
Source-availability, reproducibility and SBOM work remain in issue #65.
