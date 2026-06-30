# Elicitor Project Closeout

Frontier: elicitor-project
Status:   active
Mode:     slices
Created:  2026-06-30

## Orientation

- Containing seam: the live Brunch skill surface under `src/agents/skills/`, plus the existing `present_candidates -> request_response -> present_review_set -> request_response` exchange path and the current `map` / review-set commitment boundary.
- Relevant frontier item: `elicitor-project` / FE-1085 from `memory/PLAN.md`; branch boundary stays this frontier's branch (`ln/fe-1085-elicitor-project-prep`).
- Volatile handoff state: this branch already retired the old strategy/lens runtime model, flattened the live skill topology, un-stubbed `present_candidates`, and promoted `generate` as a first-level live skill. The remaining open question is no longer broad design exploration; it is materializing the branch-implied `project` shape into canon and the live manifest.
- Main open risk: accidentally turning `project` into a new product tool/schema seam or a hidden `generate` sub-mode instead of a distinct live move with existing exchange and commitment boundaries.

Posture: proving (inherited from `elicitor-project`)

## Scope Premise

This scope treats the FE-1085 design closure as already implied by the branch:

- `project` is a **distinct first-level live skill home**, not a `generate` branch.
- `project` reuses the existing structured-exchange path (`present_candidates`, `request_response`, `present_review_set`) and the existing `map` / review-set graph commitment boundary.
- FE-1085 does **not** introduce a new product tool, new exchange schema family, or direct graph-write path.

The remaining work is to materialize that shape into canonical docs, the live skill manifest, authored project guidance, and the minimal witness layer that proves the new home is live.

---

## Card 1 — Canonicalize The Project Shape [status: next]

### Target Behavior

Brunch canon states that cross-plane derivation is a distinct live `project` move with no new tool/schema seam, retiring A33-L as an open design question.

### Full-card cold-start reads

- `memory/SPEC.md` — assumptions / decisions / invariants: A33-L, D95-L, D96-L, D97-L, I51-L, D53-L
- `memory/PLAN.md` — frontier: `elicitor-project`
- `src/agents/skills/TOPOLOGY.md` — live first-level skill topology and routing rules
- `src/agents/subagents/TOPOLOGY.md` — current background projector ownership

### Boundary Crossings

```text
→ memory/SPEC.md assumption + decision register
→ memory/PLAN.md frontier definition / execution pointer
→ src/agents/skills/TOPOLOGY.md live skill topology
→ src/agents/subagents/TOPOLOGY.md projector role statement
```

### Risks and Assumptions

- RISK: the card quietly reopens FE-1085 into broad `ln-design` exploration again → MITIGATION: lock the choice explicitly: distinct first-level `project` home, existing exchange triad, existing review-set commitment path, no new tool/schema seam.
- RISK: canon says `project` is distinct but leaves `generate` / `project` ownership fuzzy → MITIGATION: name the split concretely: `generate` fans out alternatives from context; `project` derives downstream plane material from accepted graph anchors and routes exact drafts back through `map` / review-set.
- ASSUMPTION: the current branch has already retired enough prompt-axis ambiguity that FE-1085 no longer needs a separate `ln-design` round.
    → IMPACT IF FALSE: later implementation cards would discover a competing module shape and invalidate the pre-scoped sequence.
    → VALIDATE: acceptance requires explicit no-new-tool/no-new-schema/no-hidden-submode wording in canon.
    → `memory/SPEC.md` A33-L

### Posture check

This proving slice retires the frontier's load-bearing unknown directly rather than studying it. It scores on uncertainty by collapsing A33-L into a chosen shape, and on invariants by stating that `project` reuses I51-L's no-write recognition surface plus the existing review-set commitment path instead of inventing a new one.

### Acceptance Criteria

✓ `memory/SPEC.md` no longer treats A33-L as an open shape question; the chosen `project` shape is recorded as durable architecture.
✓ `memory/PLAN.md` frontier text describes FE-1085 as materializing a distinct first-level `project` home, not running a fresh design pass.
✓ `src/agents/skills/TOPOLOGY.md` and `src/agents/subagents/TOPOLOGY.md` state the same ownership split: `project` is live first-level skill guidance; `projector` remains an optional background variant generator, not the public seam itself.
✓ No new `TOPOLOGY.md` file deeper than the third `src/` path segment is introduced.

### Verification Approach

- Inner: targeted doc/link consistency check by reading the updated canon together (`memory/SPEC.md`, `memory/PLAN.md`, `src/agents/skills/TOPOLOGY.md`, `src/agents/subagents/TOPOLOGY.md`)
- Middle: `npm run verify`

### Cross-cutting obligations

- Preserve D97-L provenance: canon must point at schema/render surfaces rather than copying ontology tables into skill docs.
- Preserve I51-L: `present_candidates` remains recognition only.
- Respect the topology-depth ceiling from `AGENTS.md`: update parent topology homes instead of adding `src/agents/skills/project/TOPOLOGY.md`.

### Expected touched paths (tentative)

```text
memory/
├── SPEC.md                                   ~
├── PLAN.md                                   ~
└── cards/
    └── elicitor-project--closeout.md         +
src/
└── agents/
    ├── skills/
    │   └── TOPOLOGY.md                       ~
    └── subagents/
        └── TOPOLOGY.md                       ~
```

---

## Card 2 — Materialize The Live Project Home [status: next]

### Objective

The live Brunch skill manifest includes a first-level `project` skill whose guidance teaches cross-plane derivation from accepted graph anchors while reusing existing exchange and review-set seams.

### Light-card cold-start reads

- `memory/SPEC.md` — A33-L successor decision, D95-L, D96-L, D97-L, I51-L
- `memory/PLAN.md` — frontier: `elicitor-project`
- `src/agents/skills/TOPOLOGY.md` — live skill routing and boundary rules

### Acceptance Criteria

✓ `src/agents/skills/project/SKILL.md` exists as a first-level live home and is listed in `LIVE_BRUNCH_SKILL_IDS`.
✓ The `project` skill teaches derivation from accepted upstream graph anchors into downstream plane candidates/drafts without inventing a new product tool or commit path.
✓ The authored guidance distinguishes at least the two live projection lanes: intent → design and design → oracle.
✓ `project` hands exact graph expression back to current `map` / review-set guidance rather than duplicating ontology tables or commit rules.

### Verification Approach

- Inner: focused manifest/runtime checks (`src/agents/prompts/__tests__/registry.test.ts`, prompt composition tests/snapshots, skill metadata load path)
- Middle: `npm run verify`

### Cross-cutting obligations

- Do not add `src/agents/skills/project/TOPOLOGY.md`; reconcile only the parent [src/agents/skills/TOPOLOGY.md](file:///Users/lunelson/Code/hashintel/brunch-next-omega/src/agents/skills/TOPOLOGY.md).
- Keep `project` as prompt-resource guidance only; no new `.pi/extensions` or session/schema work in this card.

### Assumption dependency

Depends on: A33-L successor decision from Card 1; that choice is validated enough because this branch already implies a distinct first-level live move rather than a new tool/schema seam.

### Expected touched paths (tentative)

```text
src/
└── agents/
    ├── skills/
    │   ├── registry.ts                       ~
    │   ├── TOPOLOGY.md                       ~
    │   └── project/
    │       ├── SKILL.md                      +
    │       └── references/
    │           ├── intent-to-design.md       +
    │           └── design-to-oracle.md       +
    └── subagents/
        └── projector.md                      ~
```

---

## Card 3 — Prove The Home Is Live [status: next]

### Objective

Brunch's live prompt manifest and prompt evidence visibly expose the new `project` home, and stale FE-1085 design-gate wording is gone from the touched runtime surfaces.

### Light-card cold-start reads

- `memory/SPEC.md` — D95-L, D96-L, D97-L, I38-L, I51-L
- `memory/PLAN.md` — frontier: `elicitor-project`
- `HANDOFF.md` — None

### Acceptance Criteria

✓ The live prompt witness includes the `project` skill in the rendered `<brunch-skills>` block.
✓ Existing manifest/prompt tests pass with the new home and no stale FE-1085 "design-gated" wording remains in the touched prompt-resource/runtime surfaces.
✓ Any projector wording changed by Card 2 now talks about derivation / plane framing rather than the retired lens taxonomy.

### Verification Approach

- Inner: prompt snapshot/test updates around the live skill manifest and composed elicitor prompt
- Middle: `npm run verify`

### Cross-cutting obligations

- Preserve the existing fixed-body + load-on-demand manifest model; do not widen runtime prompt assembly beyond adding the new live home.

### Assumption dependency

Depends on: the distinct first-level `project` shape from Cards 1–2.

### Expected touched paths (tentative)

```text
src/
└── agents/
    ├── prompts/
    │   └── __tests__/
    │       └── registry.test.ts                     ~
    └── runtime/
        └── elicitor/
            ├── __tests__/
            │   └── compose-live-prompt.test.ts      ~
            └── __snapshots__/
                └── live-elicitor-prompt.md          ~
src/dev/
└── __tests__/
    └── faux-harness.test.ts                         ~
```
