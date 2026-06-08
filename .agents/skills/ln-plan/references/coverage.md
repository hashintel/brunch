# Planning shape: coverage frontier

Load this reference whenever a frontier candidate is being classified as a **coverage frontier**, when scoping a `Mode: coverage` ledger, or when syncing a live coverage frontier against code and temporary ledgers.

Coverage is a **frontier shape**, not a third certainty posture. Each row still executes under `proving` or `earned`.

## Objective function

Optimize for **breadth closure** across one named load-bearing layer without widening the layer. A coverage frontier is valuable when the layer's value *is* its closed inventory, and vertical tracers keep leaving that inventory permanently shallow even though each tracer is locally correct.

## Admission gate

A frontier is coverage **only when all of these hold**:

1. **Named layer, load-bearing as a whole.** The thing being planned is a real layer or capability family whose value depends on its breadth (for example: an observed-shape inventory, a renderer family, a tool surface) rather than one vertical claim.
2. **Closeable inventory.** You can enumerate the layer up front without reading future implementation tea leaves. If the list is expected to keep growing as you build, it is not coverage.
3. **Required vs deferred marking.** Rows can be marked `●` vs `○` honestly.
4. **Owner + oracle per required row.** Every required row has one canonical owner and one closure oracle. If you cannot say who owns the row or how you would know it is closed, the row is still fog.
5. **Authority split is explicit.** If a temporary ledger exists outside `memory/PLAN.md`, it inventories rows only. `memory/PLAN.md` still owns frontier ids, sequencing, and promoted work.

If any gate fails, do **not** use coverage mode. Stay tracer-shallow, or route to `ln-spec`, `ln-design`, `ln-spike`, or ordinary `ln-plan` work first.

## Buildability classes

Every coverage frontier must be classified as exactly one of:

- **Buildable-now** — required rows are derivable from product state and source-of-truth inputs that already exist.
- **Evidence-gated** — the inventory is enumerable, but one or more required rows need a spike, measurement pass, or probe verdict before the frontier can honestly widen.
- **Wait-gated** — the inventory is enumerable, but one or more required rows depend on product state or a forcing function that does not exist yet. Do not scope cold.

Do not blur these classes.

- If the frontier needs measurement before widening, it is **evidence-gated**, not buildable-now.
- If the frontier needs a future UI/control/product-state seam to exist before rows can be derived honestly, it is **wait-gated**, not buildable-now.
- A ledger may carry **tripwired deferred rows** inside a buildable-now frontier, but those rows stay `○` and explicitly gated; they do not count as hidden required work.

## Required frontier content

Every coverage frontier definition must make these things explicit:

- **Boundary** — what is in the layer, and what is explicitly out.
- **Aggregate DoD** — usually "no required row remains in `spec` / `new` / `partial`."
- **Inventory authority** — where the closed ledger lives.
- **Classification** — buildable-now, evidence-gated, or wait-gated.
- **Why now / unlocks** — why this breadth pass belongs in sequence now.
- **Promotion / disposal rule** — how temporary-ledger rows escape into `PLAN`, and when the temporary ledger is actually exhausted.

## Row discipline

Each row is still a thin vertical fill, not a mini-frontier. Keep rows honest:

- **One row = one capability.** Not a grab-bag, not "and", not a disguised refactor plan.
- **Declare the canonical owner.** If the logic is single-owner, keep it in the owning domain. Shared layers earn existence only when the row is genuinely reusable or carries shared semantics.
- **Name the source-of-truth inputs.** If the proposed derivation or legality decision needs inputs the row does not actually have, the row is wrongly scoped.
- **Name the closure oracle.** Coverage without a closure oracle is category theatre.
- **Tripwire real product-state gates.** If a row depends on missing product state, mark it deferred/tripwired; do not smuggle it into required work.

Adding a missing row mid-flight is allowed only when it records a genuinely omitted capability with a one-line justification. If you discover **more than one** new row, or a new sub-seam, the inventory was not actually closed — stop and route back through `ln-plan`.

## Temporary-ledger protocol

Temporary ledgers are allowed for a bounded cross-cut, but their authority is narrow.

- `memory/PLAN.md` owns frontier ids, ordering, and dependency judgment.
- The temporary ledger owns only the row inventory and its aggregate DoD.
- A row that escapes row-sized work gets **promoted** into `PLAN`, but the row stays open in the temporary ledger until that promoted frontier actually lands.
- A temporary ledger is **not exhausted** while any required row is still `spec`, `new`, or `partial` — including a row whose owner cell says "promoted → PLAN <frontier>".
- If the last open required row has been promoted into `PLAN`, that promoted frontier gets **sequencing precedence** over new unrelated coverage frontiers unless the user explicitly chooses otherwise. Do not declare the temporary ledger "handled enough" and start fresh breadth work by inertia.

## Anti-patterns

- **Category laundering.** Calling something "coverage" because it feels broad, even though the inventory is not actually closeable.
- **Shape laundering.** Smuggling a new abstraction or topology decision under the safer-sounding label of "coverage ledger."
- **Consumer bleed-through.** Promoting a shape to every consumer because one consumer needs it.
- **Wrong-input derivation.** Scoping a shared derivation whose declared inputs cannot possibly justify the promised legality, ranking, or selection behavior.
- **Residue denial.** Declaring a cross-cut or temporary ledger exhausted while a required row is still open, merely because it has an owner now.
- **Sequencing leakage.** Opening a new coverage frontier while the previous temporary ledger's closing row is still the last open required work.
- **Symmetry regrowth.** Reintroducing deleted stubs or families because the layer "ought to have one of those," without a row that earned it.

## Skill handoffs

- **`ln-plan`** decides whether the coverage admission gate really passes, classifies the frontier, and sequences promoted rows honestly.
- **`ln-scope`** must name the row boundary, canonical owner, source-of-truth inputs, closure oracle, and any tripwire or gate before writing the ledger or a row-sized slice.
- **`ln-build`** must stop when a row changes class (buildable-now ↔ evidence-gated ↔ wait-gated), needs wider inputs than scoped, or discovers that the inventory was not actually closed.
- **`ln-sync`** must reconcile contradictions between `PLAN`, temporary ledgers, and code reality in the same pass — especially exhaustion claims, promoted-row ownership, and sequencing precedence.
