# Scope mode: sweep (coverage-frontier ledger)

Disclosed reference for [`ln-scope`](../SKILL.md). Load when authoring or revising a `Mode: sweep` ledger.

A **coverage frontier** is the plan-level container (owned by `ln-plan`); a **sweep** is its execution pass — the closed ledger this file describes. Establish the frontier in `ln-plan` first.

A `Mode: sweep` scope file is the execution artifact for a **coverage frontier** (see [`ln-plan`](../../ln-plan/SKILL.md) §Coverage sweeps / coverage frontiers). Where `single` / `chain` files group vertical slices, a sweep file holds a **closed enumerated ledger** of one capability layer, and its definition of done is *aggregate*: every required row closed.

Before writing or revising a sweep file, load [`../../ln-plan/references/coverage.md`](../../ln-plan/references/coverage.md).

Write one only when `ln-plan` has established a coverage frontier whose admission gate is satisfied. If you cannot close the enumeration, do not use sweep mode; write ordinary vertical cards instead.

### Sweep preflight

Before you write the ledger or scope one row-sized fill, answer these explicitly:

1. **What is the boundary?** Name what belongs in the layer and what explicitly does not.
2. **What are the source-of-truth inputs for each open required row?** If the row's promised derivation/ranking/legality cannot be justified from those inputs, the row is wrongly scoped.
3. **Who owns each required row, and what closes it?** Name the canonical owner and the closure oracle.
4. **What class is this frontier?** Buildable-now, evidence-gated, or wait-gated. Rows that depend on missing product state stay deferred/tripwired; they are not hidden required work.
5. **Is the inventory still closed?** If scoping reveals more than one genuinely-missing row or a new sub-seam, stop and route back through `ln-plan` instead of quietly growing the ledger.

### Ledger shape

The file body is a sweep ledger — one table per sub-seam if the layer splits:

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| *one capability the layer must contain* | `have` \| `partial` \| `spec` \| `new` \| `built` | `●` \| `○` | `proving` \| `earned` | *card / decision / pointer* | *links* |

- **Status:** `have` (in code) · `partial` (exists, incomplete vs target) · `spec` (designed, not built) · `new` (beyond spec, needs a decision first) · `built` (closed this push).
- **Req:** `●` required for the DoD · `○` deferred. The DoD is "every `●` row is `have` or `built`."
- **Fill:** the posture each row's build inherits — `proving` if the row still carries an unknown, `earned` if it is settled-but-unbuilt. A `new` row usually needs a micro-decision (`ln-disambiguate` / `ln-spec`) before it can be filled.

`Owner / next` must point to a real owner — module, card, frontier, or decision — not a vague intention. Use `Notes` to record the source-of-truth inputs and closure oracle when they are not obvious from the row label. For non-buildable rows, `Notes` must also name the evidence gate or wait-state tripwire.

### Each row is still a vertical fill

The file is horizontal; each **row** is built as an ordinary thin slice under its declared fill posture. `ln-build` implements rows and flips their Status to `built`; the row's target *is* the acceptance criterion. A row whose scope turns out to need its own full card may spawn a sibling `single` file — leave a pointer in that row's Owner / next cell rather than fattening the ledger.

### Anti-sprawl boundary

The ledger is a **closed list**, not a generative one. "Fill the layer" means *close these enumerated rows*, never "do everything that rhymes" (global `AGENTS.md` §completionist sprawl; named failure modes in [`../../ln-plan/references/coverage.md`](../../ln-plan/references/coverage.md) §Anti-patterns). Add a row mid-flight only when a genuinely-missing capability is discovered — record it with Status `new` and a one-line justification, never as completionist symmetry.
