# Contributing to NitroCraft

Thanks for helping improve NitroCraft. We aim to keep contributions practical, secure, and easy to review.

## Before you start

0. Check for existing issues or pull requests before opening a new one.
0. Keep changes focused and scoped to one problem.
0. If you plan a larger change, open an issue first to align approach.
0. Use Node `24` (`.nvmrc` / `.node-version`) and pnpm `10.22.0`.

## Reporting issues

0. Use a clear title and describe expected vs actual behavior.
0. Include reproduction steps, relevant logs, and environment details.
0. Share version info (`node`, OS, runtime context such as Docker/Pterodactyl).
0. If applicable, include request URL examples and response codes.

## Pull request guidelines

0. Keep PRs small and reviewable.
0. Explain what changed, why it changed, and any risk/compatibility impact.
0. Update docs/config examples when behavior or configuration changes.
0. Follow existing project style and file organization.
0. Prefer root-cause fixes over temporary patches.

## Contributor recognition

0. Contributor Minecraft avatars can be added to the homepage jumbotron sample list.
0. Pinned contributor entries use `data-pinned="true"` and are always kept visible in the jumbotron, including on mobile.
0. If you want to be added, include your Minecraft username/UUID in your PR notes.

## Code style

0. Follow the existing style of the repository.
0. Keep code readable and consistent.
0. Prefer clear naming and simple, maintainable implementations.
0. Add comments only when behavior is non-obvious.

## Tests and validation

0. Add tests for new behavior when feasible (`test/unit/*.test.ts`).
0. If fixing a bug, add a test that would have caught it.
0. Run tests before opening a PR:
  - `pnpm test`
0. Ensure your change does not reduce overall reliability.

## Security and operations

0. Never commit secrets (`.env`, API keys, passwords).
0. Keep dependency and security changes intentional and documented.
0. Call out operational changes (cache, retention, Redis, routing, headers) in PR notes.

## Final checklist

0. Code is clean and follows style rules.
0. Tests/docs updated where needed.
0. PR description clearly explains impact.
0. Ready for maintainers to review and merge.
