# Build execution: sweep mode (`Mode: sweep`)

Disclosed reference for [`ln-build`](../SKILL.md). Load when the selected scope file is `Mode: sweep` (a coverage-frontier ledger).

When a scope file is `Mode: sweep` (see [`ln-scope`](../../ln-scope/SKILL.md) §Sweep scope files), it holds a closed enumerated ledger of one capability layer rather than a sequence of full cards. The build loop is row-driven:

Before taking a row, reload [`../../ln-plan/references/coverage.md`](../../ln-plan/references/coverage.md) if you have not read it in this thread.

1. take the next open required (`●`) row — one whose Status is `spec`, `new`, or `partial`
2. **sweep re-orient checkpoint** — verify the row still fits the declared layer boundary, that its named owner is still the right owner, and that its promised behavior is derivable from the row's source-of-truth inputs. If any of those fail, stop and route back through `ln-scope` / `ln-plan`
3. build it under the **fill mode declared in that row** (`proving` → tracer that retires the row's unknown; `earned` → land and lock the settled capability). A `new` row needs its micro-decision resolved (`ln-disambiguate` / `ln-spec`) before it can be built
4. run red → green → refactor and the verification harness for that row
5. flip the row's Status to `built` in the ledger and reconcile canonical state
6. commit the row-sized change
7. continue until **no `●` row remains in `spec` / `new` / `partial`** — that aggregate DoD, not any single row, completes the coverage frontier

The [sliced-mode stop conditions and Stale-downstream re-orient](sliced-execution.md) apply per row. Sweep-specific rules:

- **Do not add rows as you go** except to record a genuinely-missing capability (Status `new`, one-line justification). The ledger is a closed list; filling it never means "do everything that rhymes" (global `AGENTS.md` §completionist sprawl).
- **One new row maximum.** If implementation discovers a second new row or a new sub-seam, the inventory was not actually closed; stop and route back through `ln-plan`.
- **A row that grows past ledger-row size** spawns its own `single` scope file; replace the row's Owner / next cell with a pointer rather than fattening the ledger.
- **Do not silently change frontier class.** If the row turns out to be evidence-gated or wait-gated rather than buildable-now, stop and reconcile the classification instead of forcing a ceremonial build.
- **Do not launder ownership.** If the build wants to move single-owner logic into a shared layer (or pull shared logic back into a single owner), stop and re-scope the row explicitly rather than smuggling a topology decision through sweep execution.
