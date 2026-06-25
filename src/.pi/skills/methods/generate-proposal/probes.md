# Probes - generate-proposal

Model: GPT-5.5   Last run: 2026-06-24

These probes assert process markers, not golden wording. Run each in a fresh session or subagent with the Brunch elicitor manifest visible, then inspect whether the branch, reference pointer, and commit discipline fired.

Static review 2026-06-24: branch/pointer/marker coverage is present in the skill pack. P3 has a promoted live Brunch-manifest observation; the other probes remain pending.

## P1 - intent-pick  (should fire)

- Input: "Generate a few alternative product framings for this spec so I can choose the one that best fits."
- Expect branch: intent-pick.
- Expect pointers: `SKILL.md`, then `references/intent.md`.
- Expect markers: fans out coherent territory candidates; uses `present_candidates`; calls `request_response`; treats the pick as recognition/provenance; does not write the picked candidate to graph truth.
- Observed: pending - probe file stood up with the slice; run in an uncontaminated outer loop before claiming behavioral pass.

## P2 - design-synthesize  (should fire)

- Input: "Generate two or three design shapes for this accepted intent and synthesize the strongest direction into reviewable graph material."
- Expect branch: design-synthesize.
- Expect pointers: `SKILL.md`, then `references/design.md`.
- Expect markers: proposes meaningfully different module/interface shapes; compares depth/locality/leverage and misuse risk; uses `present_candidates -> request_response`; synthesizes in reasoning; presents a structurally valid `present_review_set` before any commit.
- Observed: pending - probe file stood up with the slice; run in an uncontaminated outer loop before claiming behavioral pass.

## P3 - oracle-compose  (should fire)

- Input: "Generate oracle ensembles for this plan. I want a composed verification strategy, not just one test."
- Expect branch: oracle-compose.
- Expect pointers: `SKILL.md`, then `references/oracle.md`.
- Expect markers: diagnoses observability/reproducibility/controllability; proposes additive oracle ensembles; names loop tier, blind spots, false-positive shape, and fixture/probe commitments; uses `present_candidates -> request_response`; composes in reasoning; commits only through `present_review_set -> request_response -> acceptReviewSet`.
- Observed: passed in promoted run `.fixtures/runs/generate-fan-out/2026-06-24T16-51-13-704Z/` using `openai-codex/gpt-5.5`: oracle lens pinned, `generate-proposal/SKILL.md` read, `references/oracle.md` read after the skill, `present_candidates` emitted, no pre-prompt `brunch.kick`, graph unchanged, no `mutate_graph`, and no approved review result. This witnesses fan-out and I51-L no-write only; fan-in completion remains a separate manual-TUI proof.

## A1 - extractive oracle lens  (should NOT fire)

- Input: "Ask me what evidence would convince me that this requirement holds."
- Expect: `generate-proposal` stays silent; route to the extractive `oracle` lens plus a question method, because the user asks for interrogation rather than generated reviewable candidates.
- Observed: pending.

## A2 - extractive design lens  (should NOT fire)

- Input: "Help me understand the design implications of this requirement by asking one focused question."
- Expect: `generate-proposal` stays silent; route to the extractive `design` lens plus a question method, because the user asks for interpretation and questioning rather than generated alternatives.
- Observed: pending.

## A3 - extractive intent lens  (should NOT fire)

- Input: "Ask me a step-by-step question to clarify the protagonist and pain."
- Expect: `generate-proposal` stays silent; route to the extractive `intent` lens plus a question method, because the user asks to establish grounding rather than generate framings.
- Observed: pending.
