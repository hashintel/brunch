# Plan History

This file is the active POC-line plan archive for `memory/PLAN.md`.
Legacy pre-`next` history was moved out of the live docs tree with the old archived implementation.

## 2026-05-28 Sync archive

Archived from `memory/PLAN.md` so the live plan only carries active, next, horizon, and recent-completion state.

### walking-skeleton

- **Name:** Walking skeleton — `brunch` binary + TUI over pi
- **Linear:** [FE-729](https://linear.app/hash/issue/FE-729) (sub-issue of FE-702)
- **Branch:** `ln/fe-729-walking-skeleton` (off `next`)
- **Kind:** structural
- **Status:** done (bootstrap slice landed on `next` as commit `b104fc40`; coordinator/runbook and TUI boot/chrome slices landed on the frontier branch; manual M0 smoke + store-only runbook oracle passed)
- **Objective:** Prove the wrapping model works at all: a `brunch` binary launches a pi-backed TUI session through the `WorkspaceSessionCoordinator`, scopes durable state to `.brunch/`, hardcodes Brunch's prompt and curated toolset, and mounts the persistent TUI chrome and spec-selector gate.
- **Why now / unlocks:** First architectural proof of D1-L (depend on `pi-coding-agent`) and D2-L (opinionated product, not pi shell). Unlocks every subsequent milestone. Also doubles as the Phase-3 infra bootstrap (package.json, tsconfig, oxlint/oxfmt, vitest).
- **Acceptance:** `brunch` launches a TUI session in a project directory; `.brunch/` is created; boot routes through a `WorkspaceSessionCoordinator` that returns `ready | select_spec | needs_human`; the spec-selector is presented before any agent loop runs when no bound spec is ready; the selected spec is written as the session's `brunch.session_binding`; `/new` creates another session bound to the same spec rather than mutating the current session's spec; the chrome region displays cwd / spec / phase / runtime bundle at all times; `npm run verify` is green.
- **Verification:** Inner — `npm run fix` / `npm run verify` plus coordinator state/unit tests. Middle — M0 runbook oracle: manual TUI smoke against a scratch project paired with artifact/query postconditions for `.brunch/`, `brunch.session_binding`, same-spec `/new`, and chrome/workspace state (SPEC §Probe Oracle Design). Outer — defer; first replay-regression fixture lands in M1.
- **Cross-cutting obligations:** Preserve the `cwd → spec → session` hierarchy, one-spec-per-session binding, and persistent chrome region as durable product surfaces, not temporary bootstrapping hacks. Do not let TUI, RPC, or fixture code create/open Pi sessions or write `brunch.session_binding` directly; route boot, spec selection, and `/new` through the workspace-session seam.
- **Traceability:** R1, R2, R3, R4, R19 / D1-L, D2-L, D6-L, D11-L, D21-L / I8-L, I13-L / A1-L, A10-L
- **Design docs:** [prd.md §M0](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §3](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** complete; proceed to `mode-shell-and-fixture-driver`.

### mode-shell-and-fixture-driver

- **Name:** Mode shell (print + rpc) and first fixture driver
- **Linear:** [FE-735](https://linear.app/hash/issue/FE-735/mode-shell-and-fixture-driver-m1) (sub-issue of FE-702)
- **Branch:** `ln/fe-735-mode-shell-fixture-driver` (stacked on `ln/fe-729-walking-skeleton`)
- **Kind:** structural
- **Status:** done
- **Objective:** Add `--mode print` and `--mode rpc` transport dispatchers over the same Brunch host and named RPC method-family handlers; land the agent-as-user JSON-RPC stdio driver; prove transcript projection of elicitation exchanges; and capture the first replay-regression fixtures for at least briefs #1–#3. For M1, print mode is a snapshot renderer/proof-of-life, not a single-turn agent run.
- **Why now / unlocks:** Proves D5-L (JSON-RPC primary) and unlocks the fixture-driven feedback loop. Without this milestone, every downstream milestone has only manual TUI evidence.
- **Acceptance:** `brunch --mode print` and `brunch --mode rpc` boot from the same host setup; the first `session.*` / `workspace.*` RPC handlers are named product methods rather than a generic read gateway; an agent-as-user driver completes at least one brief end-to-end over stdio by responding to elicitation prompts; captured JSONL can be projected into prompt/response elicitation exchanges; a `.jsonl` + `.meta.json` bundle is written under `.fixtures/`; the first three curated briefs are captured.
- **Verification:** Inner — verify gate plus projection-handler unit tests for elicitation exchange ranges. Middle — deterministic first captured run, stdio RPC handler contract tests, replay-regression fixture(s) asserting transcript reproduction/projection parity, and `./src/probes/scripts/verify-m1.sh` for store/projection/manual-smoke evidence (SPEC §Oracle Strategy by Loop Tier). Outer — the three-layer fixture model is established in skeleton form here; property and adversarial layers come online as later milestones supply graph/coherence substrates; brief quality and golden-capture representativeness remain explicit human review prompts in the probe.
- **Cross-cutting obligations:** Keep transport mode distinct from agent roles/lenses; do not make print mode select or imply an agent strategy in M1. Keep the captured-run format forward-compatible with later `.graph.json` and `.coherence.json` artefacts; establish exchange projection over Pi JSONL without creating canonical chat/turn tables; keep read/subscription architecture thin — named RPC method families and projection handlers over canonical stores, not a generic read-model platform; this frontier establishes the first layer of the canonical replay/property/adversarial fixture architecture rather than a one-off harness.
- **Traceability:** R4, R5, R11, R16, R17, R20 / D5-L, D12-L, D13-L, D18-L, D19-L / I3-L, I10-L, I13-L / A1-L, A5-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)
- **Current execution pointer:** complete after M1 review fixes; proceed to `jsonl-session-viability`.

### jsonl-session-viability

- **Name:** JSONL session viability proof
- **Linear:** [FE-736](https://linear.app/hash/issue/FE-736/jsonl-session-viability-proof)
- **Branch:** `ln/fe-736-jsonl-session-viability` (stacked on `ln/fe-735-mode-shell-fixture-driver`)
- **Kind:** structural
- **Status:** done
- **Objective:** Prove whether pi `SessionManager` JSONL in `.brunch/sessions/` is rich enough to carry raw assistant/user payloads, Brunch session binding (`brunch.session_binding`), structured elicitation prompt/response entries when needed, other custom entries (`brunch.lens_switch`, `brunch.side_task_result`, `worldUpdate`, `brunch.mention`, `brunch.mention_staleness_hint`), and session-scoped continuity metadata (`lastSeenLsn`, interest sets, compaction anchors) through reload.
- **Why now / unlocks:** Validated the JSONL-first transcript strategy and pinned D6-L for Brunch-supported linear sessions. If JSONL had been insufficient, M2 would have produced a sharply scoped fallback proposal that all later milestones could plan against.
- **Acceptance:** Round-trip reload of a captured linear session preserves raw payloads byte-equivalent (modulo timestamps); session binding and structured elicitation entries survive; elicitation exchanges can be re-projected after reload; all named Brunch custom entries survive, including side-task-result delivery entries when present; continuity metadata survives. Defensive branch-shape tests document Pi substrate behavior, but branch-aware Brunch sessions are not product-supported per D24-L. If core linear-session viability fails, the failure is sharply documented and a fallback path is proposed (project richer substrate / mirror JSONL into richer records / propose pi upstream change).
- **Verification:** Inner — verify gate plus synthetic JSONL projection tests. Middle — JSONL round-trip/property tests for raw payloads, `brunch.session_binding`, structured elicitation entries, defensive branch-shape projection behavior, coordinator-created `/new` sessions, and M1 fixture replay parity. Outer — fixture replay parity across the transcript-first run bundle; no new human review was required because brief content and scripted user notes did not change.
- **Cross-cutting obligations:** This frontier is the transcript-side proof for the shared event substrate that later carries structured elicitation entries, session binding, lens switches, side-task results, mentions, and `worldUpdate` without inventing a parallel channel or canonical chat/turn store. JSONL viability must validate sessions created through the `WorkspaceSessionCoordinator`, including the first-entry binding and `/new` same-spec behavior.
- **Traceability:** R7, R8, R16, R17, R19 / D6-L, D11-L, D12-L, D13-L, D18-L, D24-L / I3-L, I8-L, I10-L, I19-L
- **Design docs:** archived [jsonl-session-viability-note](file:///Users/lunelson/Code/hashintel/brunch-next/archive/archive/docs/architecture/jsonl-session-viability-note.md)
- **Current execution pointer:** complete; proceed to `web-shell`.

### web-shell

- **Name:** Web shell over the same host (M3)
- **Linear:** [FE-737](https://linear.app/hash/issue/FE-737/web-shell-over-the-same-host-m3)
- **Branch:** `ln/fe-737-web-shell`
- **Kind:** structural
- **Status:** done
- **Objective:** `brunch --mode web` serves a native Brunch React app (TanStack Router + Query) over one WebSocket-backed JSON-RPC client; no second backend API, REST read model, or browser-owned product runtime is invented; `pi-web-ui` is not used. The web surface is initially a read-only visual dashboard/client attachment over explicit spec/session resources, so a TUI can remain the interactive writer while the browser renders richer projections.
- **Why now / unlocks:** Proves D10-L. Unlocks parallel UI work and visualises graph + coherence state. Sequenced after M2 so the transcript substrate is pinned before clients depend on it.
- **Acceptance:** Web client connects via one persistent WebSocket RPC client, lists specs and workspace state through `session.*` / `workspace.*` projection handlers, can attach read-only views to explicit spec/session resources, renders a transcript and the persistent chrome region, and does not treat the WebSocket connection or `.brunch/state.json` default as the durable Brunch session. Structured elicitation prompts/responses plus freeform user input remain deferred until a write-lease or equivalent concurrency policy is designed.
- **Verification:** Inner gate plus WebSocket/handler contract tests. Middle — manual browser smoke paired with projection/query postconditions for `session.*` / `workspace.*`, linear transcript-policy guards, transcript rendering state, and structured elicitation round-trip. Outer — at least one fixture replays into the web renderer; qualitative UX remains manual checklist.
- **Cross-cutting obligations:** Preserve the single command/event substrate: the browser is a thin remote head over the same elicitation/transcript/session machinery, not a second data plane, REST-backed read client, generic read gateway, or custom interaction contract. Treat WebSocket connections as ephemeral client attachments, not Brunch sessions; session-consuming RPC methods should target explicit spec/session resources or a deliberate attachment handshake. Carry D24-L linear transcript policy forward before adding another session-consuming surface: block Brunch-controlled `/tree`/`/fork`/`/clone` branch flows where Pi hooks permit, and make transcript readers fail fast on non-linear JSONL rather than adapting it. If/when `brunch.establishment_offer` entries are present, browser chrome should project the latest offer as ambient orientation rather than inventing a browser-only strategy menu.
- **Traceability:** R4, R8, R11, R12, R16, R17 / D5-L, D10-L, D12-L, D13-L, D19-L, D24-L, D33-L / I19-L, I21-L
- **Design docs:** [prd.md §M3, §Frontend Architecture](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)
- **Current execution pointer:** complete. M3 tied off with shared JSON-RPC protocol helpers/dispatch semantics, `ws`-backed `/rpc` transport, persistent browser RPC client with protocol-failure hardening, canonical built asset serving with traversal-safe asset resolution, stable React runtime, explicit read-only session projection by durable session id through a canonical Brunch session-envelope reader with strict self-description validation, explicit transcript custom-entry classifiers, and read-only browser transcript rendering of assistant/user rows plus transcript-native prompt display rows from typed `{ sessionId, specId }` targets. Automated verification and direct HTTP/WebSocket projection postconditions pass. Accepted outer-loop deferral: qualitative browser-open smoke remains environment-blocked because `agent-browser` cannot create its socket directory under the current macOS sandbox (`Operation not permitted`); this does not block M3 tie-off because static HTML serving, absence of HTTP product reads, explicit `{ sessionId, specId }` WebSocket RPC reads, transcript-display text including custom prompt rows, and exchange projection were rechecked directly against the host.
