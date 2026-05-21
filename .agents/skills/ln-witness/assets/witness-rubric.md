# Witness Rubric

The rubric `ln-witness` measures tests against. Two parts: the **progressive-checkability ladder** (how strong is this test as evidence?) and the **per-kernel proof obligations** (what must be witnessed for each active kernel?).

Source synthesis: `docs/design/BEHAVIORAL_KERNELS.md` (kernel taxonomy, example tests), `archive/docs/archive/design/INTENT_SPEC_EVOLUTION.md` §2 (Progressive Checkability).

## Progressive-checkability ladder

A test's evidentiary strength is named by its rung, not scored 0–100. Higher rungs subsume lower ones; do not double-count.

| # | Rung | What it proves | Typical shape |
| --- | --- | --- | --- |
| 1 | **Positive example** | One concrete input produces an expected output. | `expect(f(x)).toBe(y)` |
| 2 | **Counterexample** | One concrete input is correctly rejected. | `expect(() => f(bad)).toThrow()` |
| 3 | **Regression test** | A previously-broken case stays fixed. Same shape as 1 or 2 plus provenance. | Named after the bug/issue it captures |
| 4 | **Property test** | A relation holds across many generated inputs (round-trip, idempotence, metamorphic, invariant, model-based). | `fc.assert(fc.property(...))` |
| 5 | **Runtime contract** | A predicate is enforced at the boundary every time the boundary is crossed in production, not only in tests. | `assert`, schema validation at I/O, type-narrowing guard |
| 6 | **State-machine rule** | A transition is permitted iff its guard holds; forbidden transitions are rejected by construction. | State-machine library, exhaustive transition test |
| 7 | **Invariant** | A property holds across *all* reachable states and mutations, enforced structurally (types, schema, encapsulation). | "Cannot construct an invalid X" — illegal states unrepresentable |
| 8 | **Proof obligation** | A formal property a verifier (Dafny / Lean / TLA+ / property-based with adversarial generators) discharges. | Discharged spec, model-checked transition system |

### Reading the ladder

- A test at rung 1 is not a defect — most tests live at rungs 1–3. The question is whether the *claim* deserves a higher rung. A claim labeled "invariant" in `memory/SPEC.md` witnessed only at rung 1 is the gap to surface.
- Rungs 5–7 are about *structural enforcement*: the system makes the bad state hard or impossible to reach, not just detected after the fact. Promotion from 4 to 5 is often the highest-leverage move.
- Rung 8 is rare in product code. It belongs in the audit only when the spec explicitly names a `proof_candidate` claim.

## Per-kernel proof obligations

For each behavioral kernel, the canonical mutations a sufficient test suite must witness. Drawn from `BEHAVIORAL_KERNELS.md` Proof obligations / Example tests sections; phrased as binary checks the audit can apply.

### Structural

**Identity & reference**
- Every entity has a stable identifier preserved across mutations.
- Dangling references are rejected at the boundary that creates them.
- Reference equality is distinguishable from value equality where it matters.

**Containment & topology**
- `add` preserves the topological invariant (acyclicity, single-parent, ordering, uniqueness — whichever apply).
- `move` preserves the invariant; an item appears in exactly one place after move.
- `delete` preserves the invariant; the declared cascade policy fires.
- `reorder` preserves the invariant; order is well-defined.

**Validation & normalization**
- Valid inputs accepted; canonical form is what reaches downstream code.
- Invalid inputs rejected at the boundary with a diagnosable error.
- Equivalent-but-non-canonical inputs normalize to the same canonical form (round-trip).

### Behavioral

**State & lifecycle**
- Every declared state is reachable from the initial state.
- Every declared transition is exercised under its guard.
- Terminal states are sinks (no transition leaves them, or only declared escape transitions do).
- Forbidden transitions are rejected, not silently no-op'd.

**Temporal history**
- Operations declared monotonic do not regress.
- Undo restores the prior state exactly; redo restores the post-state exactly.
- Audit / expiration policies fire on the declared schedule.

**Optimization & preference**
- The chosen outcome is valid (satisfies constraints) before it is optimal.
- Tie-breaking is deterministic and matches the declared rule.

### Multi-actor

**Authority & capability**
- Permitted action by an authorized actor succeeds.
- Same action by an unauthorized actor is rejected (not silently dropped).
- Delegated capability flows to the delegatee; bounded scope is enforced.
- Revocation propagates; previously-permitted actions are now rejected.

**Concurrency & collaboration**
- Concurrent compatible operations both succeed and converge to the same state.
- Concurrent conflicting operations resolve per the declared policy (LWW / FWW / conflict surface / merge), not by accident.
- Stale operations (based on outdated state) are detected and handled per policy.

### System

**Transactions & atomicity**
- A multi-object update either lands entirely or not at all.
- Partial failure leaves no observable intermediate state.
- Concurrent transactions do not interleave observably.

**Resource accounting**
- Conservation holds: sum of accounts before equals sum after, for every operation that claims to conserve.
- Limits are enforced at the boundary that creates demand, not only at observation time.
- Capacity exhaustion is rejected with a diagnosable error, not silently dropped.

**Derived data & views**
- After any source mutation, the derived view reflects it within the declared freshness window.
- Cache / index / projection cannot diverge from source without detection.

**Error & recovery**
- Declared retry policy fires under the declared trigger.
- Compensation runs when rollback is impossible (external effect already issued).
- Degraded mode is reachable and exits when health returns.

**External effects**
- Outbound call shape matches the contract the boundary declares.
- Inbound payload is validated before reaching domain code.
- Side effects are at-least-once / at-most-once / exactly-once per the declared guarantee.

### Evolution

**Change & migration**
- Old-format data round-trips through the migration without loss.
- Forward and backward compatibility hold for the declared compatibility window.

**Observability & evidence**
- Every operation the spec declares auditable produces a log/event with sufficient provenance.
- Logs do not contain prohibited content (secrets, PII per declared policy).

## How `ln-witness` uses this rubric

1. **Audit mode** maps each test to a ladder rung (column 3 of the audit table) and to the kernel obligations it satisfies (step 3 of the procedure).
2. **Rivalry mode** uses each kernel's obligations as the source of contrastive scenarios: a missing obligation often *is* the rival the tests fail to rule out, expressed as a discriminating scenario rather than as a checklist line.

A kernel obligation may be acceptably unwitnessed — but only with an explicit note in `memory/SPEC.md` §Verification Design saying *why* and *when to revisit*. The rubric does not produce a score; it produces a structured set of named gaps the user has to either close or knowingly defer.
