# Minimal POC authority shell — audit and guard

Frontier: minimal-authority-shell
Status:   active
Mode:     single
Created:  2026-06-08

## Orientation

- **Containing seam:** the POC authority surface over current graph/session write paths —
  `CommandExecutor` result discriminants in
  [src/graph/command-executor.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/command-executor.ts),
  the `elicit` tool policy in
  [src/projections/session/runtime-policy.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/projections/session/runtime-policy.ts)
  applied by [src/.pi/extensions/runtime/index.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/extensions/runtime/index.ts),
  the D34-L command containment in
  [src/.pi/extensions/commands/policy.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/extensions/commands/policy.ts),
  and the public RPC mutation surfacing in
  [src/rpc/methods/session.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/rpc/methods/session.ts).
- **Relevant frontier item:** `minimal-authority-shell` (FE-810) in
  [memory/PLAN.md](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md) §Frontier Definitions
  (`Status: next` / now active, `Kind: hardening`, `Certainty: proving`). Branch to create:
  `ln/fe-810-minimal-authority-shell`.
- **Volatile state (pre-audited during scoping — start informed, not cold):**
  - The `CommandResult` union **already defines** `success | structural_illegal | needs_human |
    policy_blocked | version_conflict`; mutation paths already return `success` / `structural_illegal`.
  - `needs_human` is **defined but never produced** by any current path — no `return { status:
    'needs_human' }` exists. So criterion (3) is mostly "confirm it is representable end-to-end and
    no path assumes a TUI-only dialog," not a large build.
  - `elicit` policy **already blocks** `bash | edit | write` (allow-list `read | grep | find | ls`)
    via the `tool_call` and `user_bash` hooks; `setActiveTools` hides the rest.
  - D34-L command containment **already exists** at `.pi/extensions/commands/policy.ts`.
  - Public RPC mutations (`session.submitExchangeResponse`) **already surface** structured
    discriminants (`captured | no_capture | structural_illegal | accepted | request_changes |
    rejected`) rather than throwing for expected outcomes.
- **Main open risk:** **over-building.** Most criteria are already met; the real work is an audit +
  regression guard + naming the A18-L residue, NOT inventing M6 RBAC, a new authority service, or a
  `needs_human` producer that no POC path actually needs.

Posture: **proving** (inherited from `minimal-authority-shell`). Reshaped to score on the
**invariants** axis: landing this slice locks the "CommandExecutor discriminants are the only graph
mutation outcome surface" invariant with a guard test and ratifies the elicit tool-authority
contract, so accidental future bypass fails a test rather than silently shipping.

Frontier-level cross-cutting obligations:

- **D20-L:** `CommandExecutor` result discriminants are the only graph mutation outcome surface for
  agent, RPC, and capture writes — no path throws for an expected authority/validation outcome.
- **D34-L:** keep command containment in `.pi/extensions/commands/policy.ts`; do not reintroduce a
  branch-only module or treat command-name collisions as allowlisting.
- **D40-L:** tool authority is a pure derivation over the shared projected runtime policy; do not add
  a second authority list. **Do not modify `src/.pi/agents/state.ts`** in this slice — import its
  `activeToolNamesForPosture` read-only; the manifest/legality file is reserved for other streams.
- **A18-L:** strict interactive built-in suppression remains a Pi upstream/API limit; name it
  explicitly as accepted residue, do not pretend to close it.

### Target Behavior

The current POC graph/session write and tool-authority paths are proven by a single authority-matrix
guard test to route every mutation outcome through `CommandExecutor` discriminants, block the
identified side-effecting tools in `elicit`, and represent `needs_human` as a structured headless/RPC
result rather than a TUI-only dialog — with the A18-L residue named, not closed.

### Boundary Crossings

```
→ src/graph/command-executor.ts          (CommandResult discriminants — the outcome vocabulary)
→ src/projections/session/runtime-policy.ts (elicit allow/block policy — read/confirm)
→ src/.pi/extensions/runtime/index.ts     (policy application hooks — read/confirm)
→ src/rpc/methods/session.ts              (discriminant → RPC shape mapping; needs_human representable)
→ a new authority-matrix guard test       (asserts the four criteria over current POC paths)
```

### Risks and Assumptions

```
- RISK: the slice balloons into full M6 RBAC / a standalone authority service.
    → MITIGATION: acceptance is audit + guard + residue-naming; the frontier explicitly forbids a new
      authority service. If the audit finds a genuine missing producer/blocker, fill ONLY that one
      concrete gap; anything larger routes back to ln-plan, it does not expand this card.
- RISK: adding a needs_human producer the POC does not actually reach (speculative).
    → MITIGATION: only assert needs_human is representable end-to-end (type + RPC/headless mapping +
      no TUI-dialog assumption). Do not invent a POC path that produces it unless one already reaches
      a human-only action; the audit determines this.
- ASSUMPTION: the elicit block-list (bash/edit/write) is the complete set of "side-effecting tools
  identified as unsafe for the POC."
    → IMPACT IF FALSE: a side-effecting tool stays callable in elicit; small, additive fix to the
      shared policy block-list.
    → VALIDATE: the audit enumerates registered tools vs the elicit allow/block sets and asserts no
      side-effecting tool is reachable.
    → [→ memory/SPEC.md A18-L, D34-L]
```

### Posture check

Proving posture, invariants axis. Landing this slice **locates and locks** the authority seam: the
guard test makes the D20-L "discriminants are the only mutation outcome" and the elicit tool-authority
contract executable, so the next person who adds a bypassing write path or an unguarded
side-effecting tool fails a test. It tells us something concrete — it converts "the POC looks safe"
into "the POC's authority contract is asserted." No high-impact assumption is left unretired; the one
assumption (block-list completeness) is validated by the audit the card performs.

### Acceptance Criteria

```pseudo tree
minimal authority shell
├── discriminant surface (D20-L)
│   ├── ✓ every current graph mutation path (agent graph tool, capture write, review accept)
│   │     returns a CommandResult discriminant; none throws for an expected authority/validation outcome
│   └── ✓ RPC/headless maps each discriminant to a structured response shape (no TUI-only assumption)
├── elicit tool authority (D40-L)
│   ├── ✓ elicit blocks every identified side-effecting tool (bash/edit/write) via tool_call + user_bash
│   ├── ✓ no registered side-effecting tool is reachable in elicit (allow-list is complete for the POC)
│   └── ✓ tool authority derives from the shared projected policy only (no second list; state.ts untouched)
├── needs_human representability (criterion 3)
│   ├── ✓ a needs_human CommandResult maps to a structured headless/RPC result, not a thrown TUI dialog
│   └── ✓ if no current POC path produces needs_human, that is recorded as intended (representable, unused)
└── scope discipline
    ├── ✓ no new standalone authority service introduced
    └── ✓ A18-L strict-built-in-suppression residue is named explicitly, not silently treated as closed
```

### Verification Approach

```
- Inner: an authority-matrix guard test (new) over current POC paths — asserts discriminant coverage,
  elicit block/allow completeness, and needs_human structured representability. Existing
  command-executor / runtime-policy / rpc handler tests still pass.
- Inner (gate): `npm run verify` (fix → test → build).
- Outer: manual smoke ONLY if a TUI-visible policy path changes (likely none; this is audit + guard).
```

### Cross-cutting obligations

```
- D20-L: discriminants are the only mutation outcome surface; no throw for expected outcomes.
- D34-L: command containment stays in .pi/extensions/commands/policy.ts.
- D40-L: tool authority is a pure derivation; DO NOT modify src/.pi/agents/state.ts (read-only import).
- A18-L: name strict built-in suppression as accepted Pi-upstream residue.
- This is a minimal shell, not M6: no RBAC, no permissions matrix, no authority service.
```

### Expected touched paths (tentative)

```pseudo tree
src/.pi/extensions/runtime/
└── authority-matrix.test.ts          +   (the guard test — primary deliverable)
src/projections/session/runtime-policy.ts ?   (read/confirm; touch only if block-list incomplete)
src/.pi/extensions/runtime/index.ts        ?   (read/confirm; touch only if a hook gap is found)
src/graph/command-executor.ts              ?   (read-only unless a discriminant gap is found)
src/rpc/methods/session.ts                 ?   (touch only if needs_human mapping is missing)
```

Lane discipline for parallel worktrees:
- **Does not** write `src/.pi/skills/**` (the `resource-body-depth` builder owns that).
- **Does not** write `src/graph/README.md`, `src/rpc/README.md`, `src/web/README.md`, or
  `src/graph/observed-shapes-coverage.test.ts` (the `graph-observed-shapes` ledger owns those).
- **Does not** write `src/.pi/agents/state.ts` (reserved single-writer file; import read-only).

### Traceability

- **SPEC:** D20-L (command-result discriminants), D34-L (command containment), D40-L (projected tool
  authority), A18-L (strict-built-in-suppression residue), A3-L.
- **Requirements:** R5, R6, R10.
- **Frontier:** satisfies the `minimal-authority-shell` acceptance leaves via audit + guard; any
  concrete gap the audit surfaces is filled in-place, anything larger routes back to `ln-plan`.
- **Design docs:** `memory/SPEC.md` D20-L/D34-L/D40-L; `docs/reference/pi-extensions.md`.
