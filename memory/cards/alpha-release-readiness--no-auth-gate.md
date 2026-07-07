# No-auth gate: workspace-dialog warning + juncture/kick suppression

Frontier: alpha-release-readiness
Status:   active
Mode:     single
Created:  2026-07-07

Full scope card. Posture: proving (inherited from `alpha-release-readiness` thread 3 — first product surface for the D115-L no-auth state).

## Target Behavior

When no allowlisted model resolves, the user sees a non-blocking login warning at the workspace entry dialog and no orientation juncture or kick fires anywhere in the session.

## Full-card cold-start reads

```
- memory/SPEC.md   — D115-L, D113-L, D114-L, I59-L, req 29; D109-L (dismissed-is-inert juncture semantics)
- memory/PLAN.md    — frontier: alpha-release-readiness (Objective thread 3)
- src/app/model-policy.ts — BRUNCH_MODEL_ALLOWLIST, resolveBrunchModelPolicy (the single allowlist source)
- src/.pi/extensions/session-orientation/registrar.ts + juncture.ts — the juncture gate contract
  (J1–J6, ownership gate, JunctureContext.modelRegistry already present)
- src/.pi/components/workspace-dialog/preflight.ts + component.ts — the entry surface
- src/session/originate-assistant-turn.ts — the existing no_model_available backstop (keep, do not rebuild)
```

## Boundary Crossings

```
→ src/app/brunch-tui.ts / workspace launch — compute model availability (resolveBrunchModelPolicy over
  the live registry) and thread it to the workspace-dialog preflight
→ src/.pi/components/workspace-dialog — render the warning line/banner (non-blocking; spec/session
  creation stays fully usable)
→ src/.pi/extensions/session-orientation — upstream gate: when getAvailable() is empty, junctures J1–J6
  do not show a dialog and do not kick; a visible in-chrome notice (same copy source) replaces the J1 boot beat
→ origination — unchanged; no_model_available skip remains the backstop (assert, don't touch)
```

## Risks and Assumptions

```
- RISK: auth can appear mid-session (/login writes auth.json) but availability was computed at boot —
  a stale gate would suppress junctures forever. → MITIGATION: read availability live at each juncture
  trigger (ctx.modelRegistry.getAvailable() is already in JunctureContext — use it at fire time, not a
  boot-time boolean). The workspace-dialog banner may be boot-time (it renders once, pre-session).
- RISK: RPC/print/no-UI modes — gate must not regress the existing "no dialog, no orientation entry"
  behavior. → MITIGATION: extend the existing degradation tests; the no-auth gate composes with, not
  replaces, the hasUI gate.
- ASSUMPTION: the model registry reaching the orientation extension is the Brunch allowlist registry
  (wired by the FE-1159 tracer), so "getAvailable() empty" ≡ "no allowlisted model resolves".
    → IMPACT IF FALSE: gate reads Pi-wide availability and under-warns. → VALIDATE: wiring assertion in
    the extension test (inject a registry with non-allowlisted auth only; expect gate closed).
```

## Posture check (proving)

Scores on **proof of life** (first user-visible no-auth product surface) and **invariants** (materializes I59-L — the planned juncture-gate oracle — as executable tests). Build it.

## Acceptance Criteria

```
✓ dialog-banner — workspace entry dialog shows the login warning when availability is false; absent when true;
  spec/session creation works identically in both states
✓ juncture-suppressed — with an empty-available registry, no juncture (J1 boot, J2–J6 event-driven) shows a
  dialog or writes a brunch.session_orientation entry; an in-chrome notice with login instructions appears
  at the J1 beat instead
✓ juncture-live-read — auth added mid-session (registry becomes non-empty) → next juncture fires normally
✓ backstop-intact — originate-assistant-turn no_model_available skip still covered by its existing tests
✓ copy-single-source — banner + notice copy come from one helper beside the allowlist (model-policy.ts),
  naming `brunch login` and /login and the allowlist display names (D113-L one-list-three-consumers)
✓ no-ui-modes — print/json/RPC-no-UI behavior unchanged (existing degradation test family extended)
✓ I59-L — SPEC invariant status flipped from planned to covered, naming the test files
```

## Verification Approach

```
- Inner: session-orientation extension test family (injected junctures over empty vs populated fake
  registry); workspace-dialog component/preflight test with availability flag
- Middle: Tier-2 boot harness — no-auth boot shows banner, no kick, session remains usable
- Outer: manual TUI walkthrough with a scratch PI_CODING_AGENT_DIR (no auth.json) — see login card's
  shared outer loop
```

## Cross-cutting obligations

```
- D109-L: esc/dismissed stays inert on all menus — the gate must not introduce a new kick path
- I59-L is this card's completion test; reconcile SPEC oracle status on landing
- One allowlist source: guidance copy helper lives beside BRUNCH_MODEL_ALLOWLIST; the login card reads it
- Add the deferred `ceiling:` comment on createBrunchModelRegistry (wrapper must forward any base method
  that mutates registry state; unforwarded pi-upgrade mutators shadow-write onto the wrapper)
```

## Expected touched paths (tentative)

```
src/app/
├── model-policy.ts                        ~   (guidance-copy helper + ceiling comment; no mechanism change)
├── model-policy.test.ts                   ~
└── brunch-tui.ts                          ~   (thread availability to preflight)
src/.pi/components/workspace-dialog/
├── component.ts                           ~   (banner render)
├── preflight.ts                           ~   (availability option)
└── __tests__ or existing test home        ~
src/.pi/extensions/session-orientation/
├── registrar.ts                           ~   (fire-time availability gate + J1 notice)
├── juncture.ts                            ?
└── __tests__/…                            ~   (I59-L gate tests)
memory/SPEC.md                             ~   (I59-L planned → covered)
```
