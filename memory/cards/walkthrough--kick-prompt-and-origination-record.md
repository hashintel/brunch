# Kick turn must carry the composed foreground prompt; origination record must be written at decision time

Frontier: n/a (walkthrough doctor-pass fixes; see TESTING_FINDINGS.md F1, F2)
Status:   active
Mode:     slices
Created:  2026-07-02

Build order: Card 1 then Card 2. Both live in the origination/kick seam; Card 2's write site is adjacent to Card 1's test surface.

---

## Card 1 (full) — F1: kick turn bypasses `before_agent_start`, so the elicitor prompt never reaches the kick provider call

### Target Behavior

The kick turn's provider request contains the composed Brunch foreground prompt (elicitor persona + skills manifest + graph context), identically to a user-prompted turn.

### Full-card cold-start reads

```
- memory/SPEC.md      — D78-L, I46-L, I47-L (honest origination, kick + context seeding), D98-L (mode→role→prompt), D40-L (tool allowlist)
- TESTING_FINDINGS.md — F1 (symptom + evidence)
- src/.pi/extensions/agent-runtime/system-prompts/index.ts — registerBrunchPrompting (the before_agent_start append + "must-wire" comment)
- src/app/pi-extensions.ts — registration order; registerBrunchContinuityGuard (before_provider_request precedent)
- src/session/originate-assistant-turn.ts — completeAssistantKick / kickTurnMessage
- node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js — prompt() ~line 780–835 (emitBeforeAgentStart) vs sendCustomMessage triggerTurn path ~line 1003 (_runAgentPrompt direct, no emit)
```

### Root cause (traced 2026-07-02)

`completeAssistantKick` triggers the turn via `sendCustomMessage(kickTurnMessage, { triggerTurn: true })`. Pi's `triggerTurn` path calls `_runAgentPrompt` directly and never calls `emitBeforeAgentStart`, which is the only place `registerBrunchPrompting`'s system-prompt append runs. The kick turn therefore runs on Pi's base "expert coding assistant" prompt. Ordinary user turns go through `session.prompt()` and DO get the append — so the defect is scoped to assistant-originated turns (kick today; any future FTR-reboot kick inherits the same hazard).

### Design direction

Brunch-side guard, not a pi fork: register the same foreground-prompt composition on `before_provider_request` (precedent: `registerBrunchContinuityGuard` in `src/app/pi-extensions.ts`), detecting when the outgoing payload's system prompt lacks the composed Brunch prompt and repairing it. Keep the `before_agent_start` handler as the primary path; the guard is the safety net for turn paths that bypass it. Do NOT reroute the kick through `session.prompt()` — that fabricates a user turn and violates I46-L/I47-L. If the guard proves awkward, an upstream pi change (emit `before_agent_start` on triggerTurn) is the alternative; note it in the PR rather than blocking on it.

### Boundary Crossings

```
→ completeAssistantKick (src/session/originate-assistant-turn.ts)
→ pi AgentSession.sendCustomMessage triggerTurn → _runAgentPrompt (no before_agent_start)
→ before_provider_request guard (new/extended, src/.pi/extensions/agent-runtime/system-prompts/)
→ provider payload (observable in .brunch/debug/system-prompt.md)
```

### Risks and Assumptions

```
- RISK: double-append when both before_agent_start and the guard run on the same turn
  → MITIGATION: idempotence check — detect the composed prompt (stable sentinel/prefix) before appending; test both paths.
- RISK: before_provider_request payload shape differs from event.systemPrompt (provider-serialized)
  → MITIGATION: read the pi extensions doc §before_provider_request; assert against a captured real payload fixture.
- ASSUMPTION: setActiveTools took effect for the kick turn via registerBrunchOperationalModePolicy (evidence: present_question was callable in the live kick)
    → IMPACT IF FALSE: kick turn also runs with wrong toolset; widen the guard to tools
    → VALIDATE: acceptance criterion below asserts active tools on the kick turn
```

### Posture check (earned)

Closes: the F1 defect and the latent hazard class "assistant-originated turns skip prompt composition" — which the FTR-reboot direction (TESTING_PLAN goal 6) will multiply. Locks in: "every provider request carries the composed foreground prompt" as an invariant candidate.

### Acceptance Criteria

```
✓ kick-turn prompt — a triggerTurn-originated turn's provider payload system prompt contains the elicitor persona and Brunch skills manifest
✓ user-turn unchanged — an ordinary prompted turn still gets exactly one composed append (no duplication)
✓ guard idempotence — when before_agent_start already appended, the guard makes no second append
✓ kick-turn tools — the kick turn's provider payload tool list matches the elicitor active-tool policy
✓ debug mirror — .brunch/debug/system-prompt.md after a seeded kick contains the elicitor persona (manual/tier-2 check)
```

### Verification Approach

```
- Inner: vitest against a fake pi ExtensionAPI replaying both turn paths (extend src/.pi/extensions/__tests__/agent-runtime-system-prompts.test.ts)
- Middle: tier-2 harness seeded kick run asserting the captured provider prompt (src/dev/tier-2-harness.ts)
- Outer: live TUI kick + .brunch/debug/system-prompt.md inspection (walkthrough thread re-checks)
```

### Cross-cutting obligations

- I46-L/I47-L: origination stays honest — no fabricated user turns.
- D40-L tool-policy discipline: guard must not widen or narrow the active toolset; it only repairs the prompt.

### Expected touched paths (tentative)

```
src/.pi/extensions/agent-runtime/system-prompts/
├── index.ts                                   ~
src/.pi/extensions/__tests__/
├── agent-runtime-system-prompts.test.ts       ~
src/app/pi-extensions.ts                       ~   (wire guard registration)
```

---

## Card 2 (light) — F2: origination record written only at kick-turn outcome

### Objective

The origination *decision* record is mirrored to `.brunch/debug/origination.md` at decision time (boot), with the *outcome* appended when the kick turn completes — so a hung, abandoned, or killed kick still leaves a decision record.

### Light-card cold-start reads

```
- memory/SPEC.md      — D78-L (origination choreography)
- TESTING_FINDINGS.md — F2 (symptom: record absent while request_response pends; confirmed timing, not missing writer)
- src/app/brunch-tui.ts — ~465–523 (originateAssistantTurn call, seed-entry mirror, completeAssistantKick onOutcome)
- src/.pi/extensions/dev-mode/introspection/debug-cache.ts — appendOriginationRecordToDebugCache
```

### Acceptance Criteria

```
✓ decision-time record — after boot with debugCache enabled, origination.md exists containing the decision (origin, evidence) before any provider response
✓ outcome append — when the kick turn completes, the same file gains an outcome block correlated to the decision
✓ no-kick paths — resume/idle/no-model decisions also produce a decision record (the current onOutcome path only covers completed kicks)
```

### Verification Approach

```
- Inner: vitest over the boot mirror (extend src/.pi/extensions/__tests__/dev-mode-introspection.test.ts)
- Outer: live seeded boot; check origination.md exists while the first question is still pending
```

### Cross-cutting obligations

- TESTING_PLAN audit rule stays true: "missing debug file is a failure only if its trigger happened" — decision is the trigger for the decision record; outcome for the outcome block.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/app/brunch-tui.ts                                  ~   (mirror decision at boot, outcome in onOutcome)
src/.pi/extensions/dev-mode/introspection/debug-cache.ts ~   (accept decision-only / outcome-append shapes)
src/.pi/extensions/__tests__/dev-mode-introspection.test.ts ~
```

### Promotion checklist

All no — stays light. (No requirement/assumption/decision change; single settled seam; write sites named.)
