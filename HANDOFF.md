# Handoff

> Generated at 2026-07-16T19:20Z after the Card 4 live witness. Read this file to resume work.
> This file is volatile transfer state only. After its contents are reconciled into canonical docs or superseded by a newer handoff, overwrite or delete it.

## Goal

FE-1210 round one: the live Brunch-vs-Claude comparison witness is **done**. Remaining before Friday 2026-07-17: Dora's adjudication of the retained judgment drafts, and scoping + authoring the Dora-runnable handover distillation from the actual run evidence.

## Session State

- **Last completed skill:** `ln-build` Card 4 outer witness (coordinator-run, user-authorized) — campaign `lockers-r1-20260716` executed end to end.
- **Flow position:** plan ✓ → scope ✓ → build ✓ (proof gates; tracer Cards 1–4) → **handover distillation not yet scoped**.
- **Tracer scope:** complete and retired after reconciliation; durable evidence lives in the promoted run and current procedure docs.

## What the witness produced (campaign `lockers-r1-20260716`)

Promoted immutable bundle: `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/` (committed `20e5236c`; `check:promoted-run-paths` green; reveal key never promoted). Raw scratch retained at `.fixtures/scratch/comparisons/lockers-r1-20260716/`.

- **Brunch lane** — ready. Attempt `brunch-b1` budget-exhausted by actor observation error (retained); `brunch-b2` (declared by addendum-01) reached settlement in ~12.5/20 min, 5/8 turns; document acquired via the frozen `document-export` seam.
- **Claude Code lane** — ready. Attempts `claude-c1`–`c4` were launch/auth environment failures (cmux shim on PATH; first-run onboarding; API-key approval persistence), all retained and declared by addendum-02; `claude-c5` reached ready in ~11/20 min, 4/8 turns, target-authored 13.4 KB spec.
- **Cursor lane** — historically skipped in this run. Post-run correction: the binary was installed, but Safehouse allowed `~/.local/bin` without its target under `~/.local/share/cursor-agent`; after adding that read-only path, direct `agent --version` and `interactive_shell` dispatch both succeeded (`2026.07.08-0c04a8a`). The immutable run stays two-lane; future campaigns attempt Cursor normally (see `addendum-03-cursor-availability.md`).
- **Split judgment** — both predeclared prompts executed against fresh single-packet judge contexts; drafts retained verbatim (`judgment/outcome-draft.md`, `judgment/process-draft.md`). Outcome draft (masked): Document A strong on 5 criteria, withheld-fact criterion effectively split. Process draft (unblinded): Brunch stronger on elicitation breadth (4/5 reveal conditions vs 2/5), Claude stronger on budget discipline; both strong on readiness. Label mapping is in `judgment/label-mapping.md` — **A = Claude, B = Brunch** (do not read before an independent outcome review if preserving blinding).
- **Declared validity caveats to know before adjudicating:** compound-question crediting favored Brunch's fact haul; an actor error volunteered the `hold-window` fact to Claude without a matching question; the Claude lane's one mechanical intervention was actor-caused (form-widget decline mishap). All declared in the lane validity notes and both judgment packets.

## Next steps

1. **Dora adjudication** — fill `judgment/dora-adjudication.md` (criterion-level YAML blocks, outcome pass before consulting `label-mapping.md` if she wants self-blinding). Dora is the comparison authority; the drafts are evidence-referenced input only.
2. **Scope the handover closure** (`ln-scope`) — `docs/praxis/comparison-runs.md` now documents the executable loop; the remaining card should make one concise Dora/PM entry point and witness a second operator completing one push-driven rendered exchange.
3. After that witness, `ln-sync` closes the frontier if Dora's adjudication is also dispositioned; retain the larger automation items only under their existing triggers.

## Repo state

- **Branch:** `ln/fe-1210-agent-as-user-comparison`; latest actor-loop commit `8eecc375` before this sync.
- Operationally reusable facts: push-driven overlay sanity passed 3/3 without polling at 13.183–<18.859s; quiet updates are forwarded by `.pi/extensions/interactive-shell-push.ts` and superseded reads pruned by `interactive-shell-prune.ts`. Real Claude binary is `~/.local/bin/claude`; Cursor adapter maps to `agent --model composer-2-fast` and now executes after the Safehouse allow-list fix.

## Open questions

- Does Dora adjudicate before or after the operator handover witness? They are independent, but both must be dispositioned before frontier closure.
