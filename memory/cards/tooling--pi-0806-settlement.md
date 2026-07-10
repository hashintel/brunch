# Pi 0.80.6 dependency and settlement adoption

Frontier: n/a
Status:   active
Mode:     slices
Created:  2026-07-10

## Orientation

- Containing seams: the sealed Pi profile in `src/app/` and the Pi lifecycle adapters in `src/.pi/extensions/session-orientation/` and `src/.pi/extensions/chrome/`.
- Category concern: dependency housekeeping; this is not a new product frontier and does not change the active FE-1187 auth/model-policy decisions.
- Volatile handoff state: none inherited. The root `HANDOFF.md` describes superseded FE-1180 transfer state and is outside this concern.
- Main risk: treating `agent_end` or `turn_end` as full-run completion can open the abort juncture or clear kick-scoped chrome before Pi has exhausted retries, compaction retries, and queued continuations.

Posture: proving (inherited from the repository default; no containing frontier override).

Cross-cutting obligations:

- Preserve D39-L's sealed Brunch Pi Profile: no ambient project/global Pi resources become product inputs.
- Preserve D35-L's single Brunch-owned chrome projection and D109-L's deterministic orientation-juncture semantics.
- Keep FE-1187's D113-L–D115-L auth/model-policy reversal unresolved; this concern must not decide model choice, login, or thinking policy.
- Keep `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui` on the same release.

## Slice 1 — Upgrade the sealed Pi substrate

Status: done
Weight: light

### Objective

Brunch compiles and runs against the aligned `0.80.6` Pi packages without widening its sealed resource or model-policy surfaces.

### Cold-start reads

- `memory/SPEC.md` — D1-L, D2-L, D39-L, D67-L, D113-L–D115-L; A25-L
- `memory/PLAN.md` — category concern only; FE-1187 boundary must remain untouched
- `src/.pi/TOPOLOGY.md` — sealed Pi runtime surface
- `src/.pi/extensions/TOPOLOGY.md` — current extension ownership and dependency direction
- `docs/praxis/pi-types.md` — installed package declarations are executable truth

### Acceptance Criteria

- ✓ `package.json` and `package-lock.json` — all three direct `@earendil-works/pi-*` dependencies resolve to `0.80.6` in lockstep.
- ✓ `src/app/__tests__/brunch-tui.test.ts` settings-policy audit — every public Pi settings getter in `0.80.6`, including `getShowCacheMissNotices`, is explicitly acknowledged while ambient resource discovery stays sealed.
- ✓ `npm run verify` — lint/fmt, the complete test suite, and the production build pass against installed `0.80.6` declarations and runtime code.
- ✓ `npm-check --skip-unused` — none of the three Pi packages remains reported as outdated after installation.

### Verification Approach

- Inner: focused app/settings tests plus TypeScript-aware lint through `npm run fix` on the touched manifest.
- Middle: existing Pi seam tests, structured-exchange runtime-mount tests, subagent tests, compaction/session tests, and build resolution through `npm run verify`.
- Outer: none; this slice changes the installed substrate without changing intended product behavior.

### Cross-cutting obligations

- Do not adopt project-local resources, lower-level agent-core session storage, unrestricted model resolution, or `max` thinking policy as incidental update work.
- Preserve the existing theme fallback: `thinkingMax` may continue to inherit `thinkingXhigh` while Brunch pins a lower thinking level.

### Assumption dependency

Depends on: A25-L — continuous minor Pi upgrades remain routine adaptation work; the full gate is the validating tracer.

### Expected touched paths (tentative)

```text
package.json                                      ~
package-lock.json                                 ~
src/app/pi-settings.ts                            ?
src/app/__tests__/brunch-tui.test.ts              ?
docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md ?
```

## Slice 2 — Use full settlement for run-final effects

Status: next
Weight: light

### Objective

Abort orientation and kick-scoped working-message cleanup occur only after Pi reports that the session-level agent run is fully settled.

### Cold-start reads

- `memory/SPEC.md` — D35-L and D109-L; A1-L and A25-L
- `src/.pi/extensions/TOPOLOGY.md` — J4 orientation wiring and gate contract
- `src/.pi/extensions/chrome/TOPOLOGY.md` — working-message lifecycle and footer refresh
- Pi `v0.80.6` extension docs — `agent_end`, `agent_settled`, and `turn_end` semantics

### Acceptance Criteria

- ✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — an aborted low-level `agent_end` does not open J4 before `agent_settled`.
- ✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — a later retry/continuation run that supersedes the abort prevents an abort juncture at settlement.
- ✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — the J5 suppression flag still consumes a product-initiated abort and no J4 dialog appears when the run settles.
- ✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — one terminal Esc abort followed by `agent_settled` opens exactly one J4 dialog and preserves the existing gate/kick rules.
- ✓ `src/.pi/extensions/__tests__/chrome.test.ts` — `turn_end` continues to refresh footer telemetry but does not clear the kick-scoped working message before settlement.
- ✓ `src/.pi/extensions/__tests__/chrome.test.ts` — `agent_settled` clears the kick-scoped working message and requests the final footer refresh.
- ✓ `npm run verify` — the complete gate passes with no skipped-test increase.

### Verification Approach

- Inner: table-driven extension-hook tests with a fake Pi event registrar, proving event order rather than elapsed time.
- Middle: full Pi extension/runtime and build gate via `npm run verify`.
- Outer: none required; the behavioral distinction is deterministically observable at the hook boundary.

### Cross-cutting obligations

- Keep `turn_end` as the per-turn telemetry refresh point; move only effects whose contract is whole-run completion.
- Do not remove the orientation ownership claim/resolution window: `agent_settled` closes retry ambiguity but does not replace coordination among J1–J6.
- `agent_settled` carries no messages; retain only the minimum session-scoped abort candidate needed to decide J4, and clear it after settlement.
- Do not add persisted-entry renderers in this slice; orientation transcript visibility remains a separate design question.

### Assumption dependency

None — Pi `0.80.6` documents `agent_settled` as the full session-level completion event, and the slice directly witnesses that contract at Brunch's two consumers.

### Expected touched paths (tentative)

```text
src/.pi/extensions/
├── TOPOLOGY.md                                      ~
├── chrome/
│   ├── TOPOLOGY.md                                  ~
│   └── index.ts                                     ~
├── session-orientation/
│   ├── registrar.ts                                 ~
│   └── __tests__/registrar.test.ts                  ~
└── __tests__/chrome.test.ts                         ~
```

## Sequence discipline

1. Complete and verify Slice 1 before Slice 2 so the implementation compiles against the real `agent_settled` API.
2. Slice 2's behavior and touched paths are already determined by the published API contract; it does not depend on migration findings from Slice 1.
3. Stop and rescope if the dependency bump requires a product decision, a persisted-session migration, or edits to FE-1187's auth/model-policy contract.
4. Delete this scope file after both slices are committed and the sequence is exhausted.
