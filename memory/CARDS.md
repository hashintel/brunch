# Scope Cards

## Orientation

- Containing seam: Track C distribution hardening at the package-release boundary, where the compiled CLI runtime and curated tarball are already the trusted artifact.
- Frontier item: `Publishable npm release path for brunch` in `memory/PLAN.md`; the remaining work is the final `release-it` automation layer around that artifact.
- Volatile handoff state: `package.json` already declares the public package boundary and `src/server/cli.test.ts` proves `npm pack` plus extracted-install runtime startup from the built artifact.
- Main open risk: release automation could accidentally reintroduce source-root assumptions or sprawl into CI/trusted-publishing workflow work that is not yet an established seam in this repo.

## Card 1 — next

### Objective

Wire `release-it` so the repo has one dry-runnable npm release command that versions and publishes the already-proven packaged artifact without bespoke manual packaging steps.

### Acceptance Criteria

✓ A repo-root release command backed by `release-it` exists and its dry-run shows the intended versioning and npm publish flow for `@hashintel/brunch`.
✓ The release flow rebuilds or verifies the package artifact before publish so it cannot drift from the tarball boundary already proven by `npm pack` coverage.
✓ Non-publishing coverage proves the configured release path targets the packaged runtime artifact rather than source-only execution paths, and operator-facing docs make the remaining auth prerequisite explicit.

### Verification Approach

- Inner: `npm run fix` plus focused release-flow coverage exercising the `release-it` command in dry-run/non-publish mode.
- Middle: `npm run verify`.
- Outer: manual `release-it --dry-run` walkthrough from a clean repo state to confirm prompts, hooks, and npm-targeted steps align with the intended artifact contract.

### Promotion Checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Stays light: all answers are currently no. If implementation requires adding CI trusted-publishing workflow ownership rather than repo-local release automation, promote back to `ln-spec` or `ln-plan` instead of widening this card in place.
