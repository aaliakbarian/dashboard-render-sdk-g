# Contributing

Thank you for helping shape Dashboard Render SDK G. The repository contains an
experimental architecture POC, but there is no published SDK or stable public
API yet.

## Before contributing

Read the following documents first:

- [Project context](docs/project/project-context.md)
- [Vision](docs/project/vision.md)
- [Architecture overview](docs/architecture/architecture-overview.md)
- [Roadmap](docs/project/roadmap.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

For substantial changes, open a discussion or issue before investing in implementation. Describe the use case, the relevant Grafana OSS 13 behavior, and how the proposal respects the project's constraints.

## Current contribution scope

Contributions are currently most useful when they:

- document concrete React embedding use cases;
- verify the behavior and public support status of candidate Grafana packages;
- identify compatibility, authentication, styling, or lifecycle risks;
- improve the proof-of-concept plan; or
- correct and clarify project documentation.

Do not treat the disposable POC as the production SDK. Production package and
runtime work must follow the phase boundaries and approved decisions in the
roadmap.

## Proposing a change

1. Start from an up-to-date branch.
2. Keep the change focused on one concern.
3. Add or update documentation that explains user-visible or architectural effects.
4. Add an Architecture Decision Record (ADR) for a durable decision that changes project constraints or component boundaries.
5. Verify links, formatting, and any applicable tests or checks.
6. Open a pull request explaining the problem, the chosen approach, alternatives considered, and validation performed.

Follow the commit and pull-request conventions documented in the [development workflow](docs/project/development-workflow.md).

## Architecture decisions

ADRs live in `docs/architecture/decisions/`. Existing accepted decisions are constraints, not suggestions. A proposal that changes one should add a new ADR that supersedes the earlier decision rather than silently editing its history.

Research notes live in `docs/architecture/research/`. Clearly distinguish verified findings from assumptions and include versions, reproduction steps, and source links when evidence becomes available.

## Pull request checklist

- The change stays within the stated project scope.
- Documentation and links are accurate.
- New architectural assumptions are recorded explicitly.
- Generated files, local configuration, and secrets are not included.
- Validation performed is listed in the pull request.
- The change follows the Code of Conduct.

## Reporting security issues

Do not report security vulnerabilities in a public issue. Use the repository host's private security-reporting feature when it is available. Security policy and contact details will be added before code is published.
