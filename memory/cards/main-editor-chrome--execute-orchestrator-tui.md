# Main Editor Chrome Execute Orchestrator TUI

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-09

## Orientation

- Seam: executor tool `details` payloads -> Pi tool `renderCall` / `renderResult` hooks -> Brunch transcript card components in the TUI.
- Frontier: `main-editor-chrome` (FE-1169) already owns TUI component UX and details-driven transcript rendering; this is a bounded execute-mode slice inside that frontier, not a new frontier.
- Posture: proving (inherited from `main-editor-chrome`).
- Main risk: Pi's tool rendering seam supports collapsed/expanded result views but not true nested transcript hierarchy, so the orchestrator card must present staged sections honestly without inventing child transcript objects.
- Cross-cutting obligations this slice must preserve: D35-L keeps chrome/transcript rendering as a Brunch-owned projection over Pi UI primitives; D111-L/D112-L/I58-L keep executor semantics, step order, and side-effect boundaries unchanged while the TUI becomes richer.

## Scope Sequence

1. Slice A (`next`): render `execute_orchestrate` as one rich parent card with status-first collapsed summary and staged expanded sections.
2. Slice B (`queued`): give standalone `execute_*` tools concise status-first summaries and light structured expansion without competing with the orchestrator card.

## Slice A: Rich Orchestrator Card

### Target Behavior

The TUI renders `execute_orchestrate` as a single expandable parent card whose collapsed line is status-first and whose expanded view groups run status, timeline, subtool activity, and outcome from structured tool details.

### Full-card cold-start reads

- `memory/SPEC.md` — D22-L, D35-L, D104-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — frontier: `main-editor-chrome`.
- `src/executor/TOPOLOGY.md` — run-driver facts and the guarantee that UI work must not reshape executor semantics.
- `src/.pi/components/TOPOLOGY.md` — bordered-card and render-only component ownership.
- `src/.pi/extensions/chrome/TOPOLOGY.md` — chrome/transcript projection discipline.

### Boundary Crossings

```text
execute_orchestrate tool details
-> .pi/extensions/executor tool renderer
-> .pi/components card/box primitives
-> Pi transcript expanded/collapsed render path
```

### Risks and Assumptions

- RISK: the existing `onUpdate` stream arrives as independent partial updates, so the renderer may only see one payload at a time. -> MITIGATION: scope the first slice to honest per-update rendering plus final-result expansion, and only aggregate within the tool-render seam if the current Pi render context already supports that state safely.
- RISK: a wide ASCII timeline may become unreadable at narrow terminal widths. -> MITIGATION: favor short status markers and single-line transitions over dense tables; wrap into labeled sections before adding more columns.
- ASSUMPTION: the current Pi tool rendering seam can render a meaningfully richer expanded result for `execute_orchestrate` without new runtime plumbing. -> IMPACT IF FALSE: this slice collapses into a smaller formatter pass and the richer grouped card needs a follow-up seam change under FE-1169. -> VALIDATE: start with a targeted renderer test/probe before extracting shared helpers.

### Posture Check

This is a proving slice: it lights up a new transcript presentation path for execute-mode runs while preserving the already-proven lifecycle emission order. The slice retires the local uncertainty about whether `execute_orchestrate` details are rich enough to drive a grouped TUI card without changing executor core behavior.

### Acceptance Criteria

✓ `src/.pi/extensions/executor/__tests__/execute-orchestrate-rendering.test.ts` — collapsed rendering shows a short status-first summary such as running slice/halt/completed rather than a raw multiline log dump.
✓ `src/.pi/extensions/executor/__tests__/execute-orchestrate-rendering.test.ts` — expanded rendering groups the orchestrator output into `Run Status`, `Timeline`, `Subtool Activity`, and `Outcome` using progress, worker-stream, verify-stream, and outcome details.
✓ `src/.pi/extensions/executor/__tests__/execute-orchestrate-updates.test.ts` — existing step-order and worker/verify stream emission remains green, proving the UI slice did not perturb executor behavior.

### Verification Approach

- Inner: targeted Vitest for execute-orchestrate renderer output and existing update-emission tests.
- Middle: optional `dev:components` / focused transcript harness only if direct renderer tests cannot witness the expanded formatting honestly.
- Gate: `npm run verify` before commit.

## Slice B: Standalone Execute Tool Summaries

### Target Behavior

Standalone `execute_*` tools render concise status-first transcript summaries when collapsed and simple structured detail when expanded, while staying visually lighter than the `execute_orchestrate` parent card.

### Full-card cold-start reads

- `memory/SPEC.md` — D22-L, D35-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — frontier: `main-editor-chrome`.
- `src/executor/TOPOLOGY.md` — execute-tool domain vocabulary and side-effect boundaries that the summaries must reflect honestly.
- `src/.pi/components/TOPOLOGY.md` — card/rounded-box ownership and render-only rules.

### Boundary Crossings

```text
execute_* result details/content
-> shared execute render helper (if introduced)
-> tool-specific renderResult hooks
-> Pi transcript collapsed/expanded rows
```

### Risks and Assumptions

- RISK: forcing every execute tool into the orchestrator layout will blur important differences between snapshot/check/run tools. -> MITIGATION: keep this slice to status-first summaries plus tool-specific minimal sections.
- ASSUMPTION: a small shared helper can cover summary formatting without coupling all execute tools to one rigid card schema. -> IMPACT IF FALSE: keep renderers inline per tool and accept a little duplication instead of overfitting a helper.

### Posture Check

This remains a proving slice, but a lower-risk follow-through: it extends the same transcript legibility improvement to direct execute-tool use without changing contracts or frontier shape.

### Acceptance Criteria

✓ `src/.pi/extensions/executor/__tests__/execute-tool-rendering.test.ts` — collapsed summaries for representative standalone tools (`execute_snapshot`, `execute_plan_check`, `execute_status`) are short, status-first, and no longer default to raw multiline content.
✓ `src/.pi/extensions/executor/__tests__/execute-tool-rendering.test.ts` — expanded summaries for those tools expose only their relevant structured fields and do not reuse the full orchestrator timeline layout.
✓ Existing execute-tool behavior tests remain green for the touched tools, proving the slice is presentation-only.

### Verification Approach

- Inner: targeted Vitest around standalone execute renderer output.
- Gate: `npm run verify` before commit.

## Cross-cutting Obligations

- Preserve executor core purity and side-effect honesty: no new executor state, no run-lifecycle changes, and no UI-driven mutations under `src/executor/`.
- Keep the TUI honest about source of truth: summaries and sections must be derived from structured result details or canonical tool content, not inferred from hidden state.
- Keep the orchestrator card visually primary; standalone execute tools should remain lighter so transcript scanning still centers on the parent run object.

## Expected Touched Paths (Tentative)

```text
src/.pi/extensions/executor/
├── execute-orchestrate/
│   └── index.ts                               ~
├── execute-plan-check/
│   └── index.ts                               ?
├── execute-snapshot/
│   └── index.ts                               ?
├── execute-status/
│   └── index.ts                               ?
├── index.ts                                   ?
├── rendering.ts                               +
└── __tests__/
    ├── execute-orchestrate-rendering.test.ts  +
    ├── execute-orchestrate-updates.test.ts    ~
    └── execute-tool-rendering.test.ts         +
src/.pi/components/
├── cards.ts                                   ?
└── rounded-box.ts                             ?
memory/cards/
└── main-editor-chrome--execute-orchestrator-tui.md +
```
