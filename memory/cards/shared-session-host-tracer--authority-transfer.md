# Writer authority under contention, then transfer

Frontier: shared-session-host-tracer
Status:   active
Mode:     slices
Created:  2026-08-07

## Orientation

- **Containing seam:** the production session-runtime-contract PTY witness family in `src/app/__tests__/`. Three witnesses (`…-tracer.slow.test.ts`, `…-companion.slow.test.ts`, `…-structured-ask.slow.test.ts`) already share one choreography module (`session-runtime-contract-pty-journey.ts`), one vocabulary module (`…-tracer-support.ts`), and one child entry (`…-tracer-child.ts`). This scope file extends all three; it forks none of them.
- **Frontier item:** `shared-session-host-tracer` (FE-1321), branch `ln/fe-1321-shared-session-host-tracer`, clean at `d0d9f5abb`. These are the last two automated limbs A51-L names. After they land, only the colleague walkthrough (A51-L, owner: the user, carrying `TESTING_FINDINGS.md` SA1/SA2) remains — explicitly **out of scope here**, as is every `shared-session-host-cutover` deletion.
- **Volatile state:** PLAN's frontier definition says `Live scope files: none`; this file becomes the live pointer. The carried 2026-08-07 finding — Pi's `InteractiveMode` ends interactive quits with `process.exit(0)`, so the writer lock is released by a synchronous `process.on('exit')` hook in `brunch-tui.ts` rather than by `runBrunchTui`'s `finally` — is exactly the mechanism these two slices put under load.
- **Main open risk:** the incumbent-versus-rival claim is currently proved only by calling `acquireSessionWriter` directly from an in-process test (`…-tracer.slow.test.ts:118`) and by asserting the lock is gone after Ctrl-D. Neither exercises the *production standalone-web refusal path*, and nothing proves a released target is actually re-openable. Slice 1 and slice 2 close those two gaps in that order.

**Posture: proving (inherited from `shared-session-host-tracer`).**

### Cross-cutting obligations (both slices)

- Canonical `/rpc` stays semantic-only; `/rpc/driver` stays transitional. Neither slice changes an RPC contract.
- `src/dev/tui-driver/**` remains the sole PTY surface — every spawn goes through the shared journey module's `startProductionTui`.
- One shared child entry (`session-runtime-contract-tracer-child.ts`, argv `<cwd> <reportPath>`) with a minimal readiness report. Do not add a second child, a second report channel, or a launcher override.
- No detachable TUI, no remote terminal protocol, no second truth store. The canonical JSONL is the only durable transfer medium.
- New test support lives under `src/**/__tests__/**`.
- **Never name the jsdom vitest-environment docblock directive in any file that spawns the PTY.** Vitest scans the file text for it, and it switches Vite to the client transform, which rewrites `src/dev/tui-driver`'s `new URL('./driver.exp', import.meta.url)` into a served asset URL and breaks the spawn. Neither slice needs a DOM at all — do not import `@testing-library/react` or `builtinEnvironments` here. See the header of `session-runtime-contract-companion.slow.test.ts` for the full explanation (written there without naming the directive, for the same reason).
- Extend the shared journey/support/child modules; never fork a variant.

### Why `Mode: slices` and not two files

Both limbs are shape-determined now, and both need the *same live PTY* at different moments: the rival probe must run while the TUI holds the lock, the reopen must run after the TUI has exited. Booting the real product under a PTY is the expensive part of every witness in this family (240s `beforeAll` budget), so one journey serving both limbs is strictly cheaper than two. They therefore write-overlap on the same new test file, the same journey module, and the same support module — the overlap-as-independence-test says merge, not split.

The anti-speculation gate holds: slice 2's shape derives from the already-landed standalone-web production pattern (`src/dev/__tests__/standalone-web-session-host.real-entry.test.ts` — `runBrunchWeb` + production RPC client + `session.open` / `session.presentation` / `session.driveTurn`), not from anything slice 1 will discover. Slice 2's assertions are written against "whatever the journey's canonical JSONL held at quit time," so they stay valid however slice 1's turn count settles.

### Overlap test against active scope files

Checked against `capture-ledger-tracer--conduct-falsifier.md`, `execution-comparison-tracer--brunch-oracle-smoke.md`, `greenfield-secure-drop-demo--mission-and-witness.md`, `tooling--conditional-comparison-gate.md`, `walkthrough-remediation-2--consolidated-outer-checkpoint.md`, `walkthrough-remediation-2--provider-conduct-evidence.md`. No write-path collision: none of them touches `src/app/__tests__/session-runtime-contract-*`, `src/session/**`, or `src/dev/tui-driver/**`.

Two adjacency notes for the builder:

- `capture-ledger-tracer` declares `src/app/brunch-tui.ts` and `src/app/__tests__/brunch-tui.test.ts` as write targets; `greenfield-secure-drop-demo` declares `src/app/TOPOLOGY.md`. **Neither slice here expects to modify production source.** If a slice turns out to need a `brunch-tui.ts` change, stop and report the collision before editing.
- `memory/PLAN.md` is a declared `~` target of two other cards. Canonical reconciliation here is confined to the `shared-session-host-tracer` frontier definition block and the `Dependencies` entry for it.

---

## Slice 1 — rival standalone-web refusal under live TUI ownership

Status: **done** (2026-08-07) · Weight: **full scope card**

Divergences from the tentative plan, all inside the declared manifest: the child's rival branch
had to be ordered *above* the probe branch rather than merely above the opening-reply fallback,
because the responder is content-addressed over accumulated context and the probe prompt is still
present when the rival turn arrives. The journey module gained `typeAndSubmit` and
`readSessionWriterOwnerRecord` (with `sessionWriterLockExists` re-expressed over the latter);
`session-runtime-contract-structured-ask.slow.test.ts` still holds a private `typeAndSubmit` copy
that a later touch of that file should collapse onto the shared helper. `QUEUED_RESPONSES` stayed
at 12 — no turn went unanswered.

### Target Behavior

While a real TUI PTY holds writer authority for a durable target, a standalone-web composition in a second process is refused that target by the production writer guard before any second runtime is constructed.

### Full-card cold-start reads

```
- memory/SPEC.md   — A51-L; D141-L, D125-L; I64-L, I65-L; §Verification Design
                     "Session runtime contract convergence oracle"
- memory/PLAN.md   — frontier: shared-session-host-tracer (definition, carried finding,
                     Dependencies `next:` pointer)
- src/session/TOPOLOGY.md — targeted live-session hosting; writer guard placement
- src/app/__tests__/session-runtime-contract-pty-journey.ts — the choreography to extend
- src/app/__tests__/session-runtime-contract-tracer.slow.test.ts — the journey-per-file
  shape (one `beforeAll`, many leaves) and the existing in-process guard assertion this
  slice supersedes with a production-path one
- src/dev/__tests__/standalone-web-session-host.real-entry.test.ts — how a production
  standalone host is stood up and driven over RPC
```

No `HANDOFF.md` dependency.

### Boundary Crossings

```
→ vitest parent: startProductionTui (src/dev/tui-driver PTY spawn)
→ PTY child: runBrunchTui → acquireSessionWriter → real Pi InteractiveMode
→ vitest parent: inspectCanonicalSessionFiles(cwd) → durable (specId, sessionId)
→ vitest parent: runBrunchWeb({ cwd, coordinator, agentServices }) → startWebHost
→ production transport: createWebSocketRpcClient → ws → /rpc
→ session.open → LiveSessionHost.open → createStandaloneSessionRuntime
→ acquireSessionWriter → SessionWriterConflictError
→ JSON-RPC failure (-32020) back to the parent; lock owner record untouched
→ PTY child: a further ordinary turn still completes
```

### Risks and Assumptions

```
- RISK: the refusal could come from something other than the writer guard (target lookup,
  schema, host wiring) and still look like a passing test
    → MITIGATION: assert the error identity, not just its presence — JsonRpcClientError with
      code -32020 and a message matching /already has a writer/. A different message is a red.
- RISK: a stale lock from an earlier failed run poisons the probe
    → MITIGATION: fresh mkdtemp cwd per journey (the family's existing discipline); the guard
      is deliberately fail-closed and must never be "cleaned up" by the test.
- RISK: the parent's runBrunchWeb resolves getAgentDir() from the developer's real machine
  state, unlike the PTY child which is given a scratch PI_CODING_AGENT_DIR
    → MITIGATION: set PI_OFFLINE=1 and a scratch PI_CODING_AGENT_DIR around the rival leg and
      restore them afterwards, mirroring what startProductionTui gives the child.
- RISK: two turns through the child's content-addressed responder collide by substring
    → MITIGATION: the new rival prompt/reply must share no substring with TRACER_PROBE_PROMPT
      or the ask constants; add the branch above the opening-reply fallback. QUEUED_RESPONSES
      is 12 and covers a third turn — raise it only if a turn is observed going unanswered.
- ASSUMPTION: a standalone composition constructed inside the vitest parent process is an
  honest rival, because the writer guard is filesystem-based and the incumbent genuinely runs
  in the separate PTY child process.
    → IMPACT IF FALSE: the rival limb proves less than I64-L claims, and slice 1 would need a
      second child process (and a second report channel, which the frontier forbids by default).
      Blast radius is this slice only; slice 2 is unaffected.
    → VALIDATE: the owner-record leaf below makes cross-process incumbency explicit —
      owner.json's pid must be neither process.pid nor missing. If that leaf cannot hold,
      stop and escalate to a child-process rival rather than weakening the leaf.
    → [→ memory/SPEC.md §Assumptions A51-L]
```

### Posture check

Proving, scoring on **uncertainty** and **invariants**. It retires A51-L's "rival-process rejection before a second runtime is constructed" clause and closes the gap I64-L's evidence column names outright ("The real-process rival … and release-under-contention proofs remain future witness leaves"). It also locates the guard seam under real contention rather than under a direct in-process function call. Landing it breaks loudly if the `process.exit(0)` release hook or the pre-construction guard placement is wrong — a tracer bullet, not a study step.

### Acceptance Criteria

All leaves live in the new `src/app/__tests__/session-runtime-contract-authority.slow.test.ts`, fed by one shared `driveAuthorityJourney()` in `beforeAll`.

```
✓ `rival — a standalone web host may start against a TUI-owned cwd`
    — runBrunchWeb resolves to a RunningWebHost and a production createWebSocketRpcClient
      connects to its /rpc. Starting a host is not itself a writer claim (D141-L: two
      legitimate compositions); only opening the target is refused.
✓ `rival — session.open on the TUI-owned target is refused by the writer guard`
    — the request rejects with JsonRpcClientError, code -32020, message /already has a writer/.
✓ `rival — no second runtime and no second session are constructed`
    — inspectCanonicalSessionFiles(cwd) returns exactly one available session both before and
      after the probe, and the canonical JSONL byte length is unchanged across the probe.
✓ `rival — the incumbent lock is neither stolen nor re-acquired`
    — the lock's owner.json is byte-identical before and after the probe, and its pid is a
      defined value other than process.pid.
✓ `contention — the TUI completes a further ordinary turn afterwards`
    — after the refusal the PTY types TRACER_RIVAL_PROMPT, the screen renders
      TRACER_RIVAL_REPLY, and both messages appear in the canonical JSONL read after quit.
✓ `cleanup — Ctrl-D still ends the PTY and releases the target writer lock`
    — quitAndAwaitExit reports not-alive and sessionWriterLockExists is false.
✓ existing suites stay green — `npm run test` (default lane) and `npm run test:slow:core`
  (which runs the three landed sibling witnesses that share the modules this slice edits).
```

### Invariants preserved

```
- Ctrl-D releases the per-target writer lock (the carried process.exit(0) finding) — guarded
  by this file's cleanup leaf plus the landed bounded-cleanup leaves in
  session-runtime-contract-{tracer,companion,structured-ask}.slow.test.ts.
- The guard never steals an ownerless or stale-looking lock — guarded by
  src/session/__tests__/session-writer-guard.test.ts. STOP-THE-LINE: if making this slice pass
  requires relaxing fail-closed recovery, that is a respec signal, not a fixture to update.
- src/dev/tui-driver stays the sole PTY surface — guarded by routing every spawn through
  session-runtime-contract-pty-journey.ts; no new spawn/expect path in this file.
- The three landed witnesses keep passing against the edited shared modules — guarded by
  `npm run test:slow:core`.
- Ambient: no jsdom environment directive in this file. Its only guard is that naming it
  breaks the PTY spawn — state the constraint in the file header (without naming the
  directive) so the next reader does not rediscover it by failure.
- The rival host and RPC client are closed in the journey's `finally`, so a failed probe
  strands neither a port nor a lock — guarded by the journey's teardown block.
```

### Verification Approach

```
- Inner: unit guard contracts — src/session/__tests__/session-writer-guard.test.ts stays
  green; proves same-target conflict, distinct-target independence, and release.
- Middle: production PTY witness — the new slow file above; proves the guard refuses the real
  standalone-web path cross-process, before runtime construction, without disturbing the
  incumbent.
- Outer: none added by this slice. The product judgment ("is a refused rival the right
  behaviour for a user with two windows open?") is owned by A51-L's colleague walkthrough on
  this same frontier, owner: the user, re-entry trigger: the walkthrough itself. That
  walkthrough also carries TESTING_FINDINGS.md SA1/SA2.
```

### Cross-cutting obligations

See the shared block in §Orientation — all of it applies. Slice-specific emphasis:

- The rival must exercise the production refusal path (`runBrunchWeb` → `session.open`), never a re-implementation and never a direct `acquireSessionWriter` call. The direct-call assertion at `session-runtime-contract-tracer.slow.test.ts:118` stays where it is; this slice adds the production-path proof beside it rather than moving it.
- Use the production browser transport (`src/web/rpc-client.ts`'s `createWebSocketRpcClient` over `ws`), not `src/dev/__tests__/web-driver-streaming-support.ts`'s `RpcSocket` — the dev helper is coupled to `BRUNCH_SESSION_EVENT_METHOD`, which `shared-session-host-cutover` deletes.

### Expected touched paths (tentative)

```
src/app/__tests__/
├── session-runtime-contract-authority.slow.test.ts   +
├── session-runtime-contract-pty-journey.ts           ~   (owner-record read; optional
│                                                          shared "type one ordinary turn"
│                                                          helper)
├── session-runtime-contract-tracer-support.ts        ~   (TRACER_RIVAL_PROMPT / _REPLY)
└── session-runtime-contract-tracer-child.ts          ~   (one respond() branch)
memory/SPEC.md                                        ~   (A51-L, I64-L evidence columns)
memory/PLAN.md                                        ~   (frontier status + live scope file)
memory/cards/shared-session-host-tracer--authority-transfer.md ~
```

Production source is **not** an expected write target. If it becomes one, see the collision note in §Orientation.

---

## Slice 2 — standalone-web takeover of the released target

Status: **next** (sequential, after slice 1) · Weight: **full scope card**

### Target Behavior

After a normal TUI Ctrl-D releases ownership, standalone web takes over the same durable target through the one canonical JSONL.

### Full-card cold-start reads

```
- memory/SPEC.md   — A51-L; D141-L; I64-L, I65-L; §Verification Design
                     "Session runtime contract convergence oracle"
- memory/PLAN.md   — frontier: shared-session-host-tracer
- src/session/TOPOLOGY.md — targeted live-session hosting; openTargetSession semantics
- src/app/brunch-web.ts — createStandaloneSessionRuntime: guard → openTargetSession →
                     createAgentSessionRuntime → dispose releases the writer
- src/dev/__tests__/standalone-web-session-host.real-entry.test.ts — the production
                     standalone driving pattern this slice reuses
- src/app/__tests__/session-runtime-contract-authority.slow.test.ts — the journey slice 1
                     built; this slice appends a leg to it rather than booting a second PTY
```

### Boundary Crossings

```
→ (continues driveAuthorityJourney after quitAndAwaitExit — no second PTY boot)
→ parent: inspectCanonicalSessionFiles(cwd) → durable target, file path, JSONL snapshot
→ parent: scratch PI_CODING_AGENT_DIR + faux provider registration
→ createWorkspaceSessionCoordinator({ cwd }) → runBrunchWeb → startWebHost
→ production transport: createWebSocketRpcClient → /rpc
→ session.open → createStandaloneSessionRuntime → acquireSessionWriter (now free)
→ coordinator.openTargetSession → SessionManager.open(<the TUI's file>)
→ session.presentation → projectSessionPresentationFile
→ session.driveTurn → runtime prompt → append to that same JSONL
→ host.close() → runtime dispose → writer.release()
```

### Risks and Assumptions

```
- RISK: session.open on a standalone host emits its own startup orientation turn (the landed
  real-entry tests wait for exactly such a turn after open), which would appear in the resumed
  transcript between the TUI-era turns and the driven turn
    → MITIGATION: assert prefix-extension and ordered membership, never an exact final message
      list or count. An orientation turn appended after the TUI-era turns is acceptable and
      should be recorded as observed behaviour in the SPEC evidence note.
    → STOP-THE-LINE: if reopening *rewrites* or truncates TUI-era history rather than appending,
      that falsifies the single-truth-store half of D141-L. Do not adjust the assertion —
      report it and route to ln-spec.
- RISK: the presentation-equality leaf is near-tautological, because brunch-web.ts's project()
  calls the same inspectCanonicalSessionFiles + projectSessionPresentationFile the parent would
    → MITIGATION: make the load-bearing leaves about *file identity and content* (same path as
      before quit; pre-quit JSONL is a prefix of post-reopen JSONL; TUI-era messages present in
      order in what RPC returns), and treat projection equality as a supporting check only.
- RISK: getAgentDir() in the parent resolves the developer's real agent directory
    → MITIGATION: same as slice 1 — scratch PI_CODING_AGENT_DIR and PI_OFFLINE around the leg,
      restored afterwards.
- RISK: the parent's faux provider api name collides with another registration in the same
  vitest process
    → MITIGATION: a file-unique api suffix, and unregister in the journey's `finally`.
- ASSUMPTION: SessionManager.open resumes the existing session file and appends, so a reopened
  target continues one JSONL rather than starting a second.
    → IMPACT IF FALSE: D141-L's "JSONL truth transfers the target" premise is false on the
      shutdown/reopen path, A51-L cannot retire, and shared-session-host-cutover's aggregate
      DoD loses a precondition — rework well beyond this slice.
    → VALIDATE: this slice's prefix-extension leaf is the cheapest possible proof; no spike is
      cheaper than the slice itself.
    → [→ memory/SPEC.md §Assumptions A51-L]
```

### Posture check

Proving, scoring on **proof of life** and **uncertainty**. It lights up an end-to-end path nothing currently exercises — real TUI writes canonical truth, exits, and a production standalone-web composition picks that exact target up and continues it — and it retires A51-L's last automated clause ("successful standalone reopen after TUI shutdown"). Combined with slice 1, the only A51-L evidence still owed is the human colleague walkthrough.

### Acceptance Criteria

Leaves appended to the same file and fed by the same `driveAuthorityJourney()`.

```
✓ `reopen — the released target is acquirable by a standalone web composition`
    — session.open resolves { status: 'opened' }; while the standalone host is up, the lock
      exists again and its owner.json pid equals process.pid.
✓ `reopen — the standalone opened the TUI's own session file, not a new one`
    — inspectCanonicalSessionFiles(cwd) still returns exactly one available session, and its
      file path equals the path captured before Ctrl-D.
✓ `reopen — the TUI-era transcript survives the transfer`
    — every message the quit-time JSONL held (both TUI turns, user and assistant) appears in
      the same order in session.presentation's entries.
✓ `reopen — a driven turn appends to that same JSONL`
    — after session.driveTurn with TRACER_REOPEN_PROMPT, the file's message list still opens
      with the TUI-era messages in order and now ends with the user prompt plus an assistant
      TRACER_REOPEN_REPLY; the pre-reopen JSONL text is a prefix of the post-reopen text; the
      workspace still holds exactly one session.
✓ `reopen — session.presentation equals a parent-computed fresh projection at settlement`
    — supporting convergence check over the same file (I65-L), not the primary evidence.
✓ `reopen — closing the standalone host releases the writer lock again`
    — after host.close(), sessionWriterLockExists is false.
✓ existing suites stay green — `npm run test` and `npm run test:slow:core`.
```

### Invariants preserved

```
- One truth store: the reopen must append to the TUI's file. Guarded by the path-identity and
  prefix-extension leaves. STOP-THE-LINE if violated (see the risk above).
- Writer release on standalone disposal — guarded by the final leaf plus
  src/session/__tests__/session-writer-guard.test.ts.
- Slice 1's leaves keep passing against the extended journey — guarded by running the whole
  new file, not just the appended leaves.
- The three landed sibling witnesses keep passing — guarded by `npm run test:slow:core`.
- Ambient: the parent process must not write into the developer's real Pi agent directory —
  guarded by the scratch PI_CODING_AGENT_DIR set around the reopen leg; state it in a comment
  because nothing else enforces it.
```

### Verification Approach

```
- Inner: none new. Guard and projection unit contracts already exist
  (src/session/__tests__/session-writer-guard.test.ts,
  src/projections/session/__tests__/session-presentation.test.ts).
- Middle: production PTY + standalone-web witness — the appended leg above; proves durable
  target transfer through canonical JSONL across a real process boundary.
- Outer: none added. A51-L's colleague walkthrough on this frontier judges whether
  shutdown-and-reopen is acceptable product behaviour versus surviving TUI detach; owner: the
  user; re-entry trigger: the walkthrough.
```

### Cross-cutting obligations

See §Orientation. Slice-specific emphasis:

- Reopen must go through the production standalone composition (`runBrunchWeb` + `/rpc`), not by calling `createStandaloneSessionRuntime` or `SessionManager.open` directly.
- Do not add a second report channel or make the child entry aware of the reopen; the durable target is discovered by the parent from canonical files, exactly as the landed witnesses do.

### Expected touched paths (tentative)

```
src/app/__tests__/
├── session-runtime-contract-authority.slow.test.ts   ~   (reopen leg + leaves)
├── session-runtime-contract-pty-journey.ts           ?   (only if the reopen leg needs a
│                                                          journey-level helper)
└── session-runtime-contract-tracer-support.ts        ~   (TRACER_REOPEN_PROMPT / _REPLY)
memory/SPEC.md                                        ~   (A51-L, I64-L, I65-L evidence;
                                                           §Verification Design oracle entry)
memory/PLAN.md                                        ~   (frontier status; Dependencies
                                                           `next:` pointer → walkthrough only)
memory/cards/shared-session-host-tracer--authority-transfer.md -  (delete when both slices land)
```

`session-runtime-contract-tracer-child.ts` is **not** expected to change in slice 2: the reopen turn is served by the parent's faux provider, not the child's.

---

## Traceability

- Retires, on completion of both slices: A51-L's two remaining automated clauses (rival-process rejection before second-runtime construction; successful standalone reopen after TUI shutdown). A51-L itself stays **open** until the colleague walkthrough lands — do not close it here.
- Updates evidence columns for I64-L ("The real-process rival, post-TUI-shutdown standalone reopen, and release-under-contention proofs remain future witness leaves" — replace with the landed witness) and I65-L (reopen convergence).
- Confirms D141-L's two-composition shape at the seam it was least proved: cross-process authority handoff.
- PLAN: update the `shared-session-host-tracer` status line, `Live scope files`, and the `Dependencies` block's `next:` pointer. After both slices, the frontier's only open item is the colleague walkthrough.
- No new frontier item, Linear issue, or branch: both slices stay on FE-1321 / `ln/fe-1321-shared-session-host-tracer`.
