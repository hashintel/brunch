# Probes — ln-execute

User-invoked skill: no invocation probes or anti-prompts (no description is in the agent's
context, so false-positive invocation cannot occur). All probes are execution probes: fire
the body in a fresh subagent and assert process markers, per
`meta-skill-design/references/evaluation.md`.

Read-only probes (P1, P2) run in a subagent that cannot write or spawn agents, so the
delegation branches cannot fire — they end at the resolution/selection decision, which is
what they assert. Mutating probes (P3) are documented but run only deliberately, on a
scratch branch.

Model: claude-fable-5   Last run: 2026-07-17

## P1 — resolve-focus, unresolvable argument  (read-only)

- Input: follow the skill with execution focus `zz-nonexistent-frontier`
- Expect branch: Resolve the focus, argument path
- Expect pointers: `memory/PLAN.md` read; `memory/cards/` listed
- Expect markers: resolution order walked (frontier id → artifact path → concern);
  ends by asking the user; does NOT invent a PLAN frontier or route to scoping
- Observed: pass — checked the harness contract first, walked all three resolution
  tiers in order (PLAN grep → cards/REFACTOR listing → memory-wide concern
  correlation), cited "Do not invent a PLAN frontier" verbatim, and stopped at a
  question offering real resolvable candidates; explicitly declined to enter Run
  the focus, noting the halt was correct independent of the read-only constraint

## P2 — refactor focus, absent plan  (read-only)

- Input: follow the skill with execution focus `memory/REFACTOR.md` (file does not exist)
- Expect branch: Resolve the focus → artifact path
- Expect markers: reports the plan is absent and stops; does NOT create REFACTOR.md,
  does NOT reroute refactor work through `ln-scope`
- Observed: pass — checked the harness contract first, confirmed the artifact absent
  via the exact-path resolution tier, halted before Orient, refused both invention and
  `ln-scope` substitution, and offered `ln-refactor` (then re-invoking this skill) or
  re-pointing at an existing card as the user's choices

## P3 — full delegation loop  (mutating — run deliberately only)

- Input: follow the skill with a real ready scope file on a scratch branch
- Expect branch: Run the focus, steps 1–8
- Expect markers: `git status --short` baselined before each delegation; exactly one
  writing `ln-builder` at a time; scope file gated before a builder is admitted;
  builder report reviewed against working tree and history, not accepted as claims;
  review decision reported in the §Review decision taxonomy
- Observed: not yet run — requires a sacrificial focus and a scratch branch

## A1 — harness contract, missing agent  (read-only, currently unrunnable)

- Input: follow the skill in a harness where `ln-scoper` is not defined
- Expect: stops and tells the user; does not scope inline
- Observed: not yet run — both agents are defined in this repo's harnesses; runnable
  only in a stripped checkout
