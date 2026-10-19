# Dashboard Render SDK G Rename Migration

## Document status

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Status | Repository-content migration implemented; external GitHub rename pending |
| Created | 2026-10-19 |
| Branch | `phase1/rename-dashboard-render-sdk-g` |

This document records the controlled project-identity migration approved in
the [project-name and trademark decision](project-name-trademark-decision.md).
It does not rename the GitHub repository, create or reserve npm packages, or
change the project's license.

## Family naming model

- **Dashboard Render SDK** is the neutral family convention.
- **Dashboard Render SDK G** is the current display name for the
  Grafana-compatible implementation.
- `dashboard-render-sdk-g` is the selected repository slug.
- `@dashboard-render-sdk-g/*` is the provisional private workspace prefix.
- `dashboard-render-sdk-k` is an illustrative possible future
  Kibana-compatible sibling only. No repository or package with that identity
  exists or is created by this migration.
- `G` and `K` are provider-family discriminators. They do not grant trademark
  permission or imply affiliation, endorsement, sponsorship, or official
  status.

Grafana remains a factual upstream compatibility target. The selected project
name does not contain the Grafana mark.

## Old-to-new mapping

| Surface | Old | New | Migration state |
| --- | --- | --- | --- |
| Project display name | Grafana React SDK | Dashboard Render SDK G | Updated in current repository content |
| Neutral family | None | Dashboard Render SDK | Documented |
| Repository slug | `grafana-react-sdk` | `dashboard-render-sdk-g` | Selected; external GitHub rename pending |
| Root private workspace | `grafana-react-sdk-poc-root` | `dashboard-render-sdk-g-poc-root` | Updated |
| Private workspace prefix | `@grafana-react-sdk/*` | `@dashboard-render-sdk-g/*` | Updated; unpublished and provisional |
| Compose project | `grafana-react-sdk-poc` | `dashboard-render-sdk-g-poc` | Updated |
| Standalone Grafana-fixture Compose project | `grafana-react-sdk-poc-grafana` | `dashboard-render-sdk-g-poc-grafana` | Updated |
| Development image | `grafana-react-sdk-poc-dev:local` | `dashboard-render-sdk-g-poc-dev:local` | Updated |
| Development network | `grsdk-poc` | `dashboard-render-sdk-g-poc` | Updated as an active project-owned configuration name |
| Prior RenderWeft proposal | RenderWeft / `renderweft` / `@renderweft/*` | Not selected | Retained only in decision history |

## Package and workspace mapping

| Old private workspace | New private workspace |
| --- | --- |
| `@grafana-react-sdk/poc-host` | `@dashboard-render-sdk-g/poc-host` |
| `@grafana-react-sdk/poc-compat` | `@dashboard-render-sdk-g/poc-compat` |
| `@grafana-react-sdk/poc-grafana-bridge` | `@dashboard-render-sdk-g/poc-grafana-bridge` |

The package manifests, root scripts, workspace dependencies, source imports,
Playwright launch commands, Compose command, Docker default command, and Yarn
lockfile use the new private identities. All packages remain `private: true`;
this migration creates no public package or npm scope and changes no dependency
version.

## Source identifier mapping

| Identifier class | Decision |
| --- | --- |
| Explicit old project brand in active UI/configuration | Renamed to Dashboard Render SDK G |
| Private workspace imports | Renamed to `@dashboard-render-sdk-g/*` |
| Fixture titles, descriptions, folder names, datasource display name, and active test expectations | Renamed to Dashboard Render SDK G |
| `GrafanaDashboard` | Retained; it is a public compatibility-API candidate requiring a separate Phase 2 decision |
| `poc-grafana-bridge` | Retained as a descriptive internal compatibility term and package role |
| `grsdk-*` dashboard/datasource UIDs, fixture filenames, artifact paths, experiment data attributes, CSS classes, cache keys, and nonce names | Retained as stable historical/internal POC identifiers so the identity-only migration does not alter runtime behavior or reproducible evidence |
| Grafana application/runtime identifiers | Retained unchanged as upstream proper names |

## Retained Grafana terms

The migration intentionally does not rename:

- `@grafana/*` packages or imports;
- Grafana OSS, Grafana Runtime, Grafana Scenes, or Grafana provider references;
- `GrafanaDashboard`, `GrafanaApp`, or `grafanaBootData`;
- `dashboard.grafana.app` or Grafana API paths;
- Grafana panel plugin IDs or datasource type IDs;
- Grafana source paths, tags, commits, versions, or Docker images; or
- historical evidence describing Grafana application source and runtime
  behavior.

These are compatibility facts and upstream identifiers, not the project brand.

## Files changed

The migration changes the following repository surfaces:

- current identity and onboarding: `README.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, and current documents under `docs/project/`;
- current local-development wording in
  `docs/development/local-development.md`;
- current Phase 1 owner metadata under `docs/architecture/production/`;
- root and workspace manifests: `package.json`, `apps/poc-host/package.json`,
  `packages/poc-compat/package.json`, and
  `packages/poc-grafana-bridge/package.json`;
- dependency metadata: `yarn.lock`;
- development infrastructure: `compose.yaml`, `dev/grafana/compose.yaml`,
  `dev/container/Dockerfile`, `playwright.config.ts`, and the active Grafana
  provisioning files under `dev/grafana/provisioning/`;
- active host/import consumers under `apps/` and `experiments/`; and
- tests whose imports or active fixture display-name expectations consume the
  renamed identities under `packages/` and `tests/`.

No production runtime algorithm, supported Grafana version, dependency
version, or upstream import is changed.

## Historical references retained

The repository-wide post-migration search intentionally retains old-brand
text in these categories:

### Expected historical evidence

- `docs/development/poc-implementation-plan.md` records the names and fixture
  display values used by the original Phase 0 implementation plan.
- `docs/architecture/research/phase0-research-plan.md` retains its historical
  owner identity.
- Phase 1 licensing, compliance, and trademark research retains statements and
  questions about the then-current “Grafana React SDK” name because rewriting
  them would falsify the evidence and decision history.
- `docs/project/project-name-trademark-decision.md` retains the old name in its
  analysis, migration table, and historical-name policy.

### Migration follow-up

- The external GitHub repository URL remains
  `aaliakbarian/grafana-react-sdk` until the maintainer renames it after merge.
- Repository-scoped links in `README.md` and
  `docs/project/project-name-trademark-decision.md` continue to use the live
  old URL until that rename.
- Git remote `origin` remains
  `git@github.com:aaliakbarian/grafana-react-sdk.git` during this pull request.
- The GitHub Project display name must be changed manually after merge.

### Upstream Grafana reference

All other uses of “Grafana” identify upstream software, APIs, packages,
symbols, source, plugins, datasources, versions, or compatibility behavior and
must remain.

No unexplained active old-brand occurrence is accepted.

## GitHub URLs requiring post-merge update

After the GitHub repository rename, update these source-controlled URLs in a
small follow-up change:

1. `README.md` Phase 0 milestone link:
   `https://github.com/aaliakbarian/grafana-react-sdk/milestone/1`
2. `docs/project/project-name-trademark-decision.md` issue `#66` link:
   `https://github.com/aaliakbarian/grafana-react-sdk/issues/66`

GitHub normally redirects old repository URLs, but current-brand documentation
should use the canonical new URL after the rename is verified.

## Post-merge GitHub repository rename

The maintainer should perform the external rename only after this migration is
merged and the default branch is green.

```bash
gh repo rename dashboard-render-sdk-g --repo aaliakbarian/grafana-react-sdk
gh repo view aaliakbarian/dashboard-render-sdk-g --json nameWithOwner,url
```

The first command is intentionally not run by this change. Review GitHub's
confirmation prompt and repository-administration effects before accepting.

## Local remote update and verification

The current checkout uses SSH for `origin`. After the GitHub rename succeeds,
run:

```bash
git remote -v
git remote set-url origin git@github.com:aaliakbarian/dashboard-render-sdk-g.git
git remote get-url --all origin
git ls-remote --exit-code origin HEAD
git fetch --prune origin
git remote show origin
```

Expected canonical fetch/push URL after the update:

```text
git@github.com:aaliakbarian/dashboard-render-sdk-g.git
```

Contributors using HTTPS should replace their existing `origin` with
`https://github.com/aaliakbarian/dashboard-render-sdk-g.git` and run the same
read-only verification commands.

## GitHub Project rename instructions

The GitHub Project URL is user-scoped and does not change with the repository
rename. A maintainer should:

1. open `https://github.com/users/aaliakbarian/projects/1`;
2. open the project's settings;
3. change the display name from “Grafana React SDK Roadmap” to
   “Dashboard Render SDK Roadmap”;
4. update any project description that presents the old name as current;
5. retain issue, milestone, field, view, and status history; and
6. verify repository links and automations after the repository rename.

This migration updates source-controlled link labels but does not change the
GitHub Project automatically.

## Unresolved API-name questions

- Should the Phase 2 public component remain `GrafanaDashboard`, become the
  provider-neutral `Dashboard`, or expose both through a deliberate provider
  API?
- Should a future public provider artifact use a family-owned neutral package
  name while declaring Grafana compatibility only in its manifest and
  description?
- Which current `poc-*` names disappear when disposable Phase 0 code is
  replaced by Phase 2 packages?

These questions are outside this identity migration. `GrafanaDashboard` and
other compatibility names are not renamed automatically.

## Closure condition

The project-rename issue is ready to close after:

1. this repository-content migration is reviewed and merged;
2. the GitHub repository is renamed to `dashboard-render-sdk-g`;
3. `origin` and the two source-controlled repository URLs are updated and
   verified;
4. the GitHub Project display name is updated; and
5. the default branch passes the complete container-first verification suite.

