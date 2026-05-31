# ADR 0030: Agents Must Use Graphite Stacked PRs for Contributions

## Context
As the repository moves towards automated agentic development, large, multi-file monolithic changes make code reviews and continuous integration complex and error-prone. Graphite's stacked branch architecture (`gt`) offers a robust framework to break down complex feature expansions into dependent, incremental, and highly-reviewable layers.

## Decision
All AI agents contributing to this codebase MUST use Graphite (`gt`) branch stacking workflow when preparing changes for commit, push, and PR submission.
- Standard monolithic `git push` on a single branch is deprecated for complex changes.
- Sequential features (e.g., API first, then Frontend UI integration) must be split into dependent stacked branches using `gt create`.
- Final submissions must use `gt submit --stack`.

## Consequences
- Keep pull requests exceptionally focused and atomic.
- Drastically improve merge velocity.
- Maintain a clean, traversable tree representation of repository changes.
- Allow parallel and incremental reviews of code additions.
