# Handoff

> Generated at 2026-07-16T19:20Z after the Card 4 live witness. Read this file to resume work.
> This file is volatile transfer state only. After its contents are reconciled into canonical docs or superseded by a newer handoff, overwrite or delete it.

## Goal

FE-1210 round one: the live Brunch-vs-Claude comparison witness is **done**. Remaining before Friday 2026-07-17: Dora's adjudication of the retained judgment drafts, and scoping + authoring the Dora-runnable handover distillation from the actual run evidence.

## Session State

- **Last completed skill:** `ln-build` Card 4 outer witness (coordinator-run, user-authorized) — campaign `lockers-r1-20260716` executed end to end.
- **Flow position:** plan ✓ → scope ✓ → build ✓ (proof gates; tracer Cards 1–4) → **handover distillation not yet scoped**.
- **Tracer card:** `memory/cards/agent-as-user-comparison--round-one-tracer.md` — Status `complete`, all four cards `done`.

## What the witness produced (campaign `lockers-r1-20260716`)

Promoted immutable bundle: `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/` (committed `20e5236c`; `check:promoted-run-paths` green; reveal key never promoted). Raw scratch retained at `.fixtures/scratch/comparisons/lockers-r1-20260716/`.

- **Brunch lane** — ready. Attempt `brunch-b1` budget-exhausted by actor observation error (retained); `brunch-b2` (declared by addendum-01) reached settlement in ~12.5/20 min, 5/8 turns; document acquired via the frozen `document-export` seam.
- **Claude Code lane** — ready. Attempts `claude-c1`–`c4` were launch/auth environment failures (cmux shim on PATH; first-run onboarding; API-key approval persistence), all retained and declared by addendum-02; `claude-c5` reached ready in ~11/20 min, 4/8 turns, target-authored 13.4 KB spec.
- **Cursor lane** — skipped with evidence (broken `cursor-agent` symlink, no installed builds; provisioning is outside the frozen actor remit).
- **Split judgment** — both predeclared prompts executed against fresh single-packet judge contexts; drafts retained verbatim (`judgment/outcome-draft.md`, `judgment/process-draft.md`). Outcome draft (masked): Document A strong on 5 criteria, withheld-fact criterion effectively split. Process draft (unblinded): Brunch stronger on elicitation breadth (4/5 reveal conditions vs 2/5), Claude stronger on budget discipline; both strong on readiness. Label mapping is in `judgment/label-mapping.md` — **A = Claude, B = Brunch** (do not read before an independent outcome review if preserving blinding).
- **Declared validity caveats to know before adjudicating:** compound-question crediting favored Brunch's fact haul; an actor error volunteered the `hold-window` fact to Claude without a matching question; the Claude lane's one mechanical intervention was actor-caused (form-widget decline mishap). All declared in the lane validity notes and both judgment packets.

## Next steps

1. **Dora adjudication** — fill `judgment/dora-adjudication.md` (criterion-level YAML blocks, outcome pass before consulting `label-mapping.md` if she wants self-blinding). Dora is the comparison authority; the drafts are evidence-referenced input only.
2. **Scope the handover distillation** (`ln-scope`) — now legitimate: the card's anti-speculation gate required witnessed evidence, which exists. Deliverable per plan: `docs/praxis/comparison-runs.md` update + one Dora entry point, derived from the promoted bundle (esp. the launch-recovery lessons for Claude and the observe-act cadence discipline that broke `brunch-b1`).
3. Then `ln-sync` to reconcile PLAN.md frontier state (tracer complete; distillation is the remaining round-one item) and retire this handoff.

## Repo state

- **Branch:** `ln/fe-1210-agent-as-user-comparison`; HEAD `20e5236c` (promoted bundle + card closure). Working tree clean except this file.
- Operationally reusable facts: real Claude binary `~/.local/bin/claude` (PATH shim broken); seeded `CLAUDE_CONFIG_DIR` bypasses onboarding/auth (`<controller-config>` pattern in the bundle); overlay cadence 60–70 s per observe-act cycle, tail-only viewport reads.

## Open questions

- Does Dora adjudicate before or after the handover distillation is authored? (Independent work; distillation teaches process, adjudication settles this run's verdict.)
- Should `/tmp` target cwds and the seeded Claude config be deleted now that the bundle is promoted? (Retained pending user confirmation per file-safety rule.)
