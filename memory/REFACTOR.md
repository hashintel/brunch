# Refactor: review-fix remediation — close the gaps the build pass papered over

Created: 2026-06-11 · Temporary execution aid; delete when complete or superseded.
Context: post-build audit of commits ac84abb2..bbc4b4e6 against the (now-deleted)
review-fix scope cards. Verified findings, not speculation.

## Problem Statement

The build pass delivered the continuity chain and new-session kick well, but left
five classes of debt, two of them dishonest rather than merely incomplete:

1. **Claimed-done work that is todo.** PLAN marks `kick-and-context-seeding` done,
   but the four I46 resume-origination scaffold rows and two I47 idempotence rows
   remain `it.todo` in the Tier-2 suite (`src/dev/tier-2-harness.test.ts:345-377`)
   — including the behaviors PLAN's pointer explicitly claims proven (request-result
   terminal statuses idle; resume-tail classification ignores continuity notices).
2. **The silent-fallback lens rebuilt in new clothes.** The gap-legality fix made
   `getElicitationGaps` required on `GraphReaders` but left `graphReads` optional on
   the prompt context, falling back to `?? []`; an out-of-card commit then absorbed
   the empty case with quiet empty-manifest/empty-options early-returns at two more
   layers. Missing-wiring is again invisible — three layers deep now. The Tier-2
   real-boot legality assertion the card required does not exist.
3. **A placeholder swapped for a placeholder.** The runtime-switch append adapter
   returns a hardcoded string instead of `''`; the helper's declared contract
   (returns the created entry id) is still violated. The footer still has no
   re-render trigger after a posture switch, so the stale-footer bug survives.
4. **Half-state env scoping.** `runWithScopedBrunchOfflineDefault` still accepts a
   `dev` flag it never reads, and still saves/restores `PI_SKIP_VERSION_CHECK`
   without ever setting it.
5. **Silently narrowed acceptance.** The predicate-semantics "one exhaustive
   never-checked owner" was not built (if-chains; a new union arm without semantics
   still compiles), and migration 0004 + seeds were not regenerated; PLAN's pointer
   was rewritten to omit both rather than flag them.

```pseudo graph (current — gap legality)
brunch-tui reads ──required──▶ GraphReaders.getElicitationGaps ✓
prompt context ──optional?──▶ gapsForPrompt ──?? []──▶ legality layers
                                            └─ gaps.length===0 → quiet empty posture (×2 layers)
Tier-2 suite ──╳ no real-boot legality assertion
```

```pseudo graph (desired — gap legality)
brunch-tui reads ──required──▶ GraphReaders.getElicitationGaps ✓
prompt context ──required──▶ gapsForPrompt (no fallback)
empty gaps on a seeded spec ──▶ loud invariant error (wiring bug, not a posture)
Tier-2 suite ──✓ real boot: seeded coverage drives manifests/tool legality
```

## Solution

Every claim in PLAN matches the test suite; every wiring absence is a compile error
or a loud runtime error, never a quiet posture; every declared contract is honored
by its adapters; the six remaining scaffold rows run live through the real
boot/resume harness (the resume chassis `resumeTier2Fixture` already exists).

## Commits

Ordered by safety: doc honesty → contract/structural alignment → small behavioral →
type-contract tightening → live proofs (riskiest last, since they may reveal the
resume kick path needs product fixes).

1. **PLAN honesty.** Revert the kick-and-context-seeding frontier to active with a
   pointer naming exactly what remains (the six todo rows); amend the
   turn-boundary-reconciliation pointer to note the I47 idempotence residue it
   shares. Doc-only.
2. **Honest entry-id contract.** Either thread the real entry id from the Pi append
   API through the runtime-switch adapter, or — if Pi does not return one — change
   the helper signature and its session-manager interface to void and delete the
   return-value expectation everywhere. No placeholder values of any kind survive.
3. **Predicate-semantics single owner.** Extract one exhaustive switch over the
   predicate kind (never-checked) that both boundary validation and coverage
   derivation ride, preserving current behavior exactly (presence implemented;
   field/coverage rejected loudly; manual pass-through). Adding a union arm without
   semantics becomes a compile error. Pure structure, no behavior change.
4. **Env-scoping pick-one.** Remove the dead dev flag from the scoped-offline
   helper (no caller branches on it); make the offline default also set the
   version-check skip variable — or, if the version-check noise is judged not real,
   delete its save/restore instead. Both env-scope test cases assert the chosen
   end state. No half-state.
5. **Footer refresh on posture switch.** After a runtime switch the chrome footer
   re-renders from re-projected state, via the existing footer render-request
   binding seam. A test pins switch-then-render shows the new strategy/lens.
6. **Loud gap-legality contract.** Make the graph readers required on the prompt
   context for the production composition path (harness/test constructors that
   genuinely lack a reader use an explicitly named narrowed type, not optionality);
   delete the empty-array fallback; replace the two quiet empty-gaps early-returns
   with a loud invariant error (a seeded spec always has floor gaps — empty means
   wiring bug); document on the context type which optional members are
   intended-optional and why. Compiler finds every construction site.
7. **Tier-2 live-legality assertion.** Real-boot test: a session over a seeded spec
   derives prompt/tool legality from that spec's actual gap coverage, and covered
   floor gaps unlock posture that uncovered gaps keep locked. This is the missing
   card acceptance and the durable oracle for commit 6.
8. **Flip the I46 resume rows live.** The four todo rows through the existing
   resume-fixture chassis: pre-reconcile user tail still earns a kick behind
   continuity notices; request/system leaves stay idle — proven against the real
   exchange result envelope as the exchanges extension writes it, settling the
   response-status question; crash-after-notice still kicks on unresolved debt;
   trailing drains neither manufacture nor mask debt. Fold in whatever product
   fixes the tests force (this commit may split if they do).
9. **Flip the I47 idempotence rows live.** Repeated boot does not duplicate seed or
   world-update entries (dedupe derived from transcript projection); the dedicated
   no-redundant-world-update-after-seed row asserts through real boot; the
   sets-and-properties meta-row either becomes a real assertion helper used by the
   suite or is retired as a stated suite convention rather than a phantom todo.
7b. **(Discovered during commit 7) Runtime-switch tool posture from real gaps.**
    `applyRuntimeSwitch` recomputes active tools with a hardcoded empty gap
    register, so a posture switch floor-locks capability-gated tools until the
    next turn boundary corrects it — the same optional-wiring fault family.
    Thread a selected-spec gap reader into the commands extension from the
    composition root (mirroring the chrome-refresh handle) and derive the
    post-switch tool set from real coverage.

10. **Migration coherence — SUSPENDED (2026-06-11).** Another agent is fixing the
    0004 migration on the branch stacked on top of this one. Do not touch drizzle/
    in this refactor; the derive-with-'context'-fallback vs read-side-throw concern
    is handed to that branch. Re-check on reintegration that the concern was
    actually covered there before deleting this line.

## Decisions

- Runtime-switch append contract: real id or void — resolved by what the Pi API
  returns; recorded when commit 2 lands.
- Prompt-context reader optionality: production path requires readers; narrowed
  harness type is the only sanctioned readerless construction.
- Empty gaps on a seeded spec is an invariant violation (loud), not a legal posture
  (quiet). Reverses the out-of-card "handle absent gaps safely" patch.
- Predicate semantics get exactly one exhaustive owner module/function; validate
  and derive are its two riders.
- Migration 0004: regenerate vs waive — explicit user call in commit 10.
- Topology READMEs: none expected to change (no files move); if commit 3's
  extraction adds a module under the graph schema sub-tree, that directory has no
  README to update.

## Testing Decisions

- The Tier-2 suite is the oracle of record for resume origination, idempotence,
  and live legality — real boot/resume, set/property assertions over
  `{specId, lsn}`, never payload-order goldens (suite convention).
- The request-idle proof must use a fixture carrying the exchange result envelope
  exactly as the exchanges extension writes it — that fixture IS the test of the
  response-status classifier; a hand-built shape would re-prove nothing.
- Commit 3 is behavior-preserving: existing predicate unit tests must pass
  unchanged; only their organization may move.
- Prior art: the live I45 rows and the new-session seed-then-kick test show the
  established real-boot assertion style to follow.

## Out of Scope

- The ln-sync canonical-doc pass: D35-L vs startup-header behavior, the stale
  `memory/cards/tooling--runtime-state-commands.md` card, the live-vs-harness
  blind-spot row for SPEC, and graduating the two induct lenses into ln-review.
- Any restacking or editing of parent branches (user decision: fix at top of stack).
- Drains live production: no side-task/reviewer drain producer exists yet; the
  optional supplier stays, but commit 8's drain row documents that intent where the
  classifier consumes it.
- New product behavior beyond what flipping the scaffold rows forces.
