# Refactor: post-burst residue cleanup (FE-852 origination-native-elicitation)

> Temporary execution aid from the 2026-06-12 `ln-judo-review` of `3117df8d..89ca6d9e`.
> Delete this file when the refactor is finished or superseded.

## Problem Statement

The origination-native-elicitation burst was net-deletive and correct, but the
relocation left residue in three forms:

1. **An unnamed pi-private contract, copied five times.** The "flush a pi
   SessionManager's entries to its JSONL file" operation relies on pi's
   underscore-private `_rewriteFile()` (plus the public `setSessionFile`).
   That assumption is restated via `as unknown as` casts in five places —
   product RPC methods, the workspace session coordinator, the tier-2 dev
   harness, the new probe exchange script, and inline in an RPC handler test —
   two of them as literally identical helper functions. A pi rename breaks
   five sites at runtime; nothing names the contract once.
2. **A half-drawn module boundary.** The present-side synthetic-pair writers
   (mint a fake `present_*` call+result tuple) now have zero product callers —
   D78-L revised says the product never fabricates offers — yet they still
   live in the product structured-exchange module. Only a doc comment, not the
   module boundary, enforces "probe/dev fixture setup only." The session
   topology README also still describes that module with its pre-revision role.
3. **Duplicated composition and artificial optionality at the origination
   seam.** Both origination entry points (TUI boot factory, triggerExchange
   RPC) independently perform the identical workspace-overview
   inspect-then-render pair and thread the result as an *optional* string —
   though every caller always passes it. The optionality is a silent fallback
   that would let a future call site quietly produce a thinner seed than the
   walkthrough validated. The TUI-side wrapper around origination is now a
   near-identity pass-through.
4. **Harness boilerplate growth.** The tier-2 harness repeats the same
   BRUNCH_DEV env save/restore block three times; four tests each hand-roll
   faux-agent-services setup/teardown in triple-nested try/finally; and the
   harness test file sits at 979 lines (six describe suites) — one test away
   from the 1000-line threshold, with block 3 (generalized-capture) about to
   add more.
5. **Small lexicon drift.** A pass-through re-export shim survives where the
   canonical graph-overview renderer moved to the renderers tree, and a result
   schema's name still claims sole ownership of a method result it now only
   half-describes.

```pseudo graph — flush contract, current
copies: rpc-methods ─cast→ pi._rewriteFile
        coordinator ─cast→ pi._rewriteFile
        tier2-harness ─cast→ pi._rewriteFile
        probe-script ─cast→ pi._rewriteFile
        handler-test ─cast→ pi._rewriteFile
(5 nodes restate 1 contract; 0 canonical names)
```

## Solution

Name each contract once, finish the boundary the burst started, and collapse
the duplicated composition — all behavior-preserving moves.

```pseudo graph — flush contract, desired
session helper (FlushableSessionManager, named once) ─cast→ pi._rewriteFile
rpc-methods / coordinator / tier2-harness / probe-script / handler-test ─import→ session helper
(1 cast site; 5 imports)
```

```pseudo tree — synthetic present writers, current → desired
session/structured-exchange-loop      probes/deterministic-exchange-script
  present writers (probe-only) ──→      present writers (with their only callers)
  request/response writers (product)  session/structured-exchange-loop
  pending-exchange reader (product)     request/response writers (product)
                                        pending-exchange reader (product)
```

Origination seam: one helper owns "inspect workspace, render context section";
`workspaceContext` becomes a required input to origination and seed
composition, so a seed without the workspace section is unrepresentable. The
near-identity TUI wrapper folds into its single call site.

Harness: a scoped env-override helper replaces the three save/restore blocks;
a with-style wrapper owns faux-services setup/teardown; the harness test file
splits along its describe-suite seams into two files, local helpers moving
with their users.

## Commits

Each commit passes `npm run verify` on its own.

1. **Rename the trigger-exchange result schema** to reflect its role as the
   pending arm of the pending-exchange result union. Pure rename, no behavior.
2. **Delete the graph-overview re-export shim** in the graph extension's
   command adapter; point its two import sites (the extension registrar and
   the graph-tools test) directly at the canonical renderer, matching how the
   extension already imports the neighborhood renderer.
3. **Name the session-file flush contract once.** Extract one canonical
   "flush session manager to file" helper into the session layer (typed per
   the pi-types praxis: cast only for the private rewrite method, use the
   public setter otherwise; file path defaults to the manager's own). Replace
   all five copies/casts — RPC methods, coordinator, tier-2 harness, probe
   script, handler test — with imports of it.
4. **Move the present-side synthetic writers to probe land.** Relocate the
   present-pair minting functions from the product structured-exchange module
   into the probe deterministic-exchange script, their only caller. The shared
   synthetic tool-call primitives stay in the product module (the response
   path still uses them). Update the session topology README in the same
   commit — its structured-exchange row still describes the pre-revision
   "deterministic exchange loop" role.
5. **Deduplicate workspace-context composition and make it required.** Add a
   small helper beside the workspace inspector that owns inspect-then-render;
   both origination entry points call it. Make the workspace-context input
   required on the origination seam and on seed composition (tests updated to
   pass it); fold the near-identity TUI wrapper into its call site.
6. **Collapse tier-2 harness env boilerplate.** Extract a scoped BRUNCH_DEV
   override helper returning a restore function; replace the three duplicated
   blocks. Add a with-style faux-agent-services wrapper owning
   register/unregister; flatten the four triple-nested tests onto it.
7. **Split the tier-2 harness test file** along its describe-suite seams into
   two files (kick/boot-path suites vs coverage-first scaffold suites), local
   helpers moving with their users; both files land well under the threshold.
   Update the dev topology README in the same commit if it names the file.

## Decisions

- One canonical flush helper in the session layer becomes the single point of
  reliance on pi's private rewrite method; everywhere else imports it.
- Probe land owns all present-side synthetic exchange fabrication; the product
  structured-exchange module retains only the read path and the
  response-side writers it still uses in production.
- Workspace context is a required part of the context-seed payload contract —
  optionality removed at the origination seam and seed composition.
- No schema or wire-contract changes; the result-schema rename is internal
  (TypeBox constant name only).
- Topology READMEs touched: session README (structured-exchange row, commit 4);
  dev README if it names the harness test file (commit 7). The renderers and
  rpc READMEs were already updated in the burst and need no change.

## Testing Decisions

- This is a behavior-preserving refactor; the existing suites are the safety
  net — tier-2 harness suites (kick lifecycle, scaffold invariants), RPC
  handler tests, origination and context-seed unit tests, and the probe
  proofs. No new behavior tests needed.
- Signature changes (required workspace context) update test call sites, not
  assertions: tests asserting seed content gain a workspace section
  expectation only where they previously omitted the input.
- Good tests here assert transcript-observable behavior (entries, seed
  content, pending-exchange readback), never the location of a helper —
  which is what makes the moves safe.

## Out of Scope

- The "ultra compact" graph-overview renderer variant for very large graphs
  (persisted in SPEC D78-L / PLAN as future work).
- Debug-mirror widening to pi-side appends (`brunch.kick` in
  entry-contents.md) — optional, user never requested it.
- The `ln-induct` fixture-vs-real fault-family audit and `ln-sync` items
  (walkthrough pass recording, PLAN coherence check) — separate passes.
- Any change to origination decision logic, kick firing, seed content beyond
  the workspace-section requirement, or the exchange response path.
- The `expectNoKick` 200ms settle window (inherent to proving absence; not
  worth machinery now).
