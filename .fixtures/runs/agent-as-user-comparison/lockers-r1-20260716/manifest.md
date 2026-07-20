# Campaign manifest — lockers-r1-20260716

Predeclared 2026-07-16T17:22Z, before any lane started. Immutable: this file is not
edited after the first lane launch; corrections, if ever needed, go in a separate
addendum file that names the deviation.

## Identity

- campaign_id: `lockers-r1-20260716`
- frontier: `agent-as-user-comparison` (FE-1210), branch `ln/fe-1210-agent-as-user-comparison`
- mission: `fictional-library-lockers-v1` — the public worked example in
  `docs/praxis/comparison-runs/mission-packet.md` §Small fictional worked example,
  used verbatim (packet version: commit `847d373e`)
- actor recipe: `.agents/skills/agent-as-user-comparison/SKILL.md` (version: commit `91982633`)
- judgment prompt pack: `docs/praxis/comparison-runs/judgment-prompt-pack.md`,
  version `round-one-v1` (commit `573971cf`)
- repo HEAD at predeclaration: `8fa39699`

## Actor and controller

- One delegated agent session (Cursor host, Fable 5, pi bridge) acts as both
  controller and actor for every lane, per the user authorization recorded in the
  tracer card's Card 4 status line.
- **Known equivalence caveat, declared up front:** the actor recipe asks for one
  fresh actor context per lane to prevent cross-lane coaching. A single delegated
  session cannot provide literally fresh contexts. Mitigation: lanes run
  sequentially, the actor gives every target only the identical public packet and
  frozen reveal policy, and never carries a target's wording, questions, or
  document content into another lane's visible interaction. This caveat is
  recorded in every lane validity note.
- Overlay capability check: PASSED before this manifest was frozen
  (`controller/overlay-capability-check.md`) — primary `interactive_shell` seam is
  used for all lanes; no fallback.

## Target order and required status

1. `brunch-b1` — Brunch TUI (**required**)
2. `claude-c1` — Claude Code CLI (**required**)
3. `cursor-x1` — Cursor CLI (**best-effort**; a blocked-lane note is an acceptable
   outcome and does not affect Brunch-versus-Claude handover readiness)

## Model configuration

- Brunch target: `npm run dev-cli` at repo HEAD `8fa39699`, provider auth resolved
  from the environment (`ANTHROPIC_API_KEY` present); Brunch's default model
  selection, recorded as-observed in the lane evidence.
- Claude Code target: `claude` CLI as installed on this host, default model;
  version and model recorded as-observed in the lane evidence.
- Cursor target: `cursor` CLI as installed, default model, recorded on attempt.
- Draft judge (both passes): this delegated session's own model (Fable 5 in
  Cursor), executed manually per the prompt pack; Dora adjudicates afterward.

## Matched budgets (per lane, from the public packet)

- qualifying_questions: 3
- target_turns: 8
- elapsed_minutes: 20
- mechanical_interventions: 1

## Controller / target cwd separation

- Controller root: `.fixtures/scratch/comparisons/lockers-r1-20260716/controller/`
  (reveal key, capability check). Targets must never inspect
  `.fixtures/scratch/comparisons/**` or receive its path.
- Brunch target cwd: fresh isolated workspace dir created under the system temp
  root at lane start (recorded in lane evidence; normalized to
  `<ephemeral-workspace>` in promoted files per I55-L).
- Claude target cwd: fresh empty dir under the system temp root.
- Cursor target cwd: fresh empty dir under the system temp root.
- Only the public packet text enters a target cwd/opening prompt. The reveal key,
  its path, and this controller root never appear in target-visible material.

## Validity rules (frozen; mission-packet §Validity, intervention, and retention)

A lane is invalid when any of: target accesses/reproduces controller-only material
before a qualifying reveal; controller-only material or its path appears in the
opening prompt or target cwd; substantive takeover (actor/human supplies
reasoning, requirements, recommendations, or document content); departure from the
frozen reveal or matched-budget policy. Mechanical recovery debits the
intervention budget and does not invalidate. Every failed/exhausted/invalid
attempt is retained with its validity reason; no selective rerun or erasure.

## Ready / stop conditions

- ready: the target has authored `locker-pickup-spec.md` (settled specification
  Markdown) — Brunch's copy acquired only via
  `npm run dev-cli -- document-export --workspace <dir> --spec-id <id> --out <file.md>`
  from settled graph state; Claude/Cursor author the file at the packet's named
  path in their target cwd.
- exhausted: stop on the first exhausted budget; retain the best target-authored
  document and mark the lane budget-exhausted.

## Artifact inventory (per lane, retained in scratch; reviewed subset promoted)

- `interaction-visible.md` — normalized target-visible interaction + budget ledger
  (one row per event: time, target turn, visible question/action, qualification
  decision, visible actor response, reveal fact id, budget debits, takeover/
  fallback notes)
- `final-document.md` — the target-authored ready document (if any)
- `validity-note.md` — validity status + reasons + equivalence caveats
- `cleanup-status.md` — final process/session status and overlay cleanup proof
- raw viewport captures as taken (scratch only; promoted logs are the normalized
  ledger)

Campaign-level promoted inventory (to
`.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/`): manifest, public
mission copy, actor-recipe/prompt-pack version pins, per-lane normalized visible
logs + final documents + validity notes + cleanup statuses, judgment bundle
(outcome-masked packet + draft, process-unblinded packet + draft, label mapping
kept OUT of the outcome packet file, `dora-adjudication.md` with empty
criterion-level slots). The controller reveal key and its path are never promoted.
