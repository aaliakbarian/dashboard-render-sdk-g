# Development Workflow

## Current phase

**Phase 2 — SDK Foundation and Experimental Package**

Source code, private workspaces, container tooling, tests, and disposable POC
implementations now exist. They are experimental research artifacts, not a
published or supported SDK. Phase 2 may implement the production-oriented SDK
foundation within the approved
[Phase 1 production architecture](../architecture/production/phase1-production-architecture-decision.md).
Implementation remains private and experimental; public package/provider
publication is not yet authorized.

## Project-control sources

- [`docs/project/roadmap.md`](roadmap.md) defines canonical phase names,
  numbering, goals, outcomes, and completion criteria.
- GitHub milestones group repository work for each roadmap phase.
- The
  [Dashboard Render SDK Roadmap project](https://github.com/users/aaliakbarian/projects/1)
  tracks cross-phase execution, status, and priority.
- GitHub issues represent individual workstreams and tasks.
- ADRs and architecture research documents contain durable technical decisions
  and reproducible evidence.

GitHub tracking should reference the roadmap rather than redefine phase
semantics. Detailed task status belongs in issues and the project, not in the
roadmap.

## Change workflow

1. Tie the work to a GitHub issue and the applicable milestone.
2. Read the project context, roadmap, relevant ADRs, and applicable research.
3. Create a focused, short-lived branch from the current default branch for
   normal Phase 2 and later changes.
4. Keep each change limited to one concern and define the evidence needed to
   validate it.
5. Add or update tests for implementation behavior.
6. Update durable architecture documentation or add/supersede an ADR when a
   decision changes.
7. Run the container-first verification applicable to the change.
8. Open a pull request that references the issue and records motivation,
   approach, alternatives, and validation results.
9. Merge only after review and required verification succeed.

Do not commit or push on behalf of a contributor unless they explicitly request it.

## Container-first execution

Docker and Docker Compose are the preferred project execution environment for
development, builds, and verification. The documented container workflow pins
the toolchain and keeps Node.js, Yarn, Playwright, browsers, and native build
dependencies out of the WSL host. See
[Local development](../development/local-development.md) for current commands.

Direct Node.js and Yarn execution in WSL is optional and is not required for
normal project work. Do not invent production release commands or workflows
that do not yet exist.

## Documentation conventions

- Use Markdown with descriptive headings and relative links.
- Distinguish facts, decisions, hypotheses, and open questions.
- Give research findings a Grafana version, reproduction procedure, and source.
- Keep roadmap items outcome-oriented; avoid unsupported dates or guarantees.
- Use one sentence per line only when a formatter is later adopted; do not create noisy formatting-only changes now.

## Architecture decisions

Create an ADR when a change sets or revises a durable constraint, public interface, dependency strategy, or component boundary. Use the next sequential identifier and include:

- status;
- context;
- decision;
- consequences; and
- alternatives considered.

Accepted ADRs are historical records. Supersede them with a new ADR rather than rewriting the original decision.

## Research changes

Research documents should state the question, environment, method, evidence, findings, limitations, and recommendation. A conclusion without reproducible evidence remains a hypothesis.

## Implementation workflow

The existing implementation is disposable POC code and does not automatically
become the production SDK. Phase 2 may implement the approved production
package structure, provider contract, provider-neutral core, exact-version
provider, and conformance infrastructure. Approved POC concepts must be
deliberately rewritten or productized behind those boundaries rather than
promoted wholesale.

Each authorized behavior change should include automated tests appropriate to
its boundary and preserve the project's evidence and import guardrails. Use
only commands documented by the repository; do not invent production release
procedures before they exist.

Phase 2 implementation and public publication are separate decisions. Keep all
Phase 2 packages private and experimental until the explicit release gates
pass, including
[#64](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64),
[#65](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65), and
applicable candidate-artifact conformance, provenance, security, bundle, and
maintainer release review.

## Pull requests and commits

- Keep pull requests reviewable and limited to one concern.
- Use clear, imperative commit subjects.
- Link related issues or research evidence.
- Call out compatibility and security implications.
- Never include secrets, credentials, dashboard exports containing sensitive data, or local environment files.
