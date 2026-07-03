# Provider Payload Prompt Contract

Frontier: n/a
Status:   done
Mode:     single
Created:  2026-07-03

## Orientation

- Containing seam: `.pi/extensions/agent-runtime/system-prompts/` appends the Brunch foreground prompt into provider payloads; `.pi/extensions/dev-mode/introspection/` mirrors the final provider payload for debug observability.
- Relevant branch context: scoped for the current `ln/fe-1123-exchange-rendering` branch as branch-local hardening from `/ln-induct`, not as a new PLAN frontier and not as an `exchange-rendering` sweep row.
- Volatile handoff state: no `HANDOFF.md`; protect the existing unrelated working-tree edit in `src/.pi/__tests__/support/virtual-terminal.ts`.
- Main open risk: fixing one provider payload key while leaving the append/extract shape lists split, so the next provider adapter shape reintroduces prompt/debug drift.

Posture: earned (category hardening inside settled D69-L/D98-L prompt and introspection seams)

## Target Behavior

Provider system-prompt carrier shapes are owned by one shared contract used by both Brunch prompt appending and debug prompt mirroring.

## Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants: D39-L, D40-L, D69-L, D98-L, I38-L.
- `memory/PLAN.md` — current branch context: `exchange-rendering`; this card remains a category concern, not a frontier row.
- `src/.pi/extensions/TOPOLOGY.md` — adapter-only ownership and agent-runtime/dev-mode layout.
- `src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md` — passive tap ordering and debug-cache observability contract.
- `.agents/skills/ln-review/references/contract-lenses.md` — graduated provider-payload shape lens.

## Boundary Crossings

```text
→ Pi `before_provider_request` provider payload
→ `.pi/extensions/agent-runtime/system-prompts/` Brunch prompt append adapter
→ shared provider system-prompt carrier contract
→ `.pi/extensions/dev-mode/introspection/` final-payload mirror
→ `.brunch/debug/system-prompt.md` dev observability output
```

## Risks and Assumptions

- RISK: A shared helper becomes a second prompt composer instead of a carrier-shape utility → MITIGATION: keep it local to provider-payload append/extract mechanics; prompt content still comes from `agents/runtime/foreground-policy`.
- RISK: The debug mirror starts rewriting provider payloads while sharing code with the appender → MITIGATION: preserve the introspection topology rule that passive taps return `undefined` and never replace payloads.
- RISK: Tests bless only `systemPrompt` and miss the larger split-brain class → MITIGATION: add a table/parity test over every supported carrier shape.
- ASSUMPTION: Supported prompt carriers are enumerable enough for a shared local contract today.
    → IMPACT IF FALSE: the right fix would be a provider-adapter owned normalizer with per-provider registration, wider than this branch-local hardening card.
    → VALIDATE: parity tests exercise all current carrier shapes from append and mirror behavior.

## Posture check

This is an earned closure slice. It canonicalizes one duplicated contract, locks the contract with a regression oracle, and retires the split-brain prompt-carrier lists that produced the `/ln-induct` finding. It does not change product prompt policy, tool policy, or the exchange-rendering sweep.

## Acceptance Criteria

✓ Provider payloads with `systemPrompt` receive the Brunch foreground prompt through the same `before_provider_request` append path as `system`, `systemInstruction`, `instructions`, `messages`, and `input`.
✓ The debug mirror extracts the same final system prompt text from every supported carrier shape that the appender can modify.
✓ The passive introspection extension still records final provider payloads without replacing them.
✓ Regression coverage fails if a prompt carrier shape is added to append behavior but omitted from debug extraction, or vice versa.

## Verification Approach

- Inner: focused Vitest coverage in the agent-runtime prompt tests and dev-mode introspection tests.
- Middle: `npm run check:skills` if the lens catalog edit changes skill references; `npm run fix` after implementation if source files are edited.
- Gate: `npm run verify` before tying off the branch.

## Cross-cutting obligations

- Preserve D39-L/D40-L sealed prompt/tool-policy discipline: no ambient provider discovery or broad prompt rewriting.
- Preserve D69-L dev-introspection observability: passive tap only, final-payload capture, debug cache is evidence for humans and never product input.
- Preserve D98-L foreground runtime ownership: prompt content and active tool policy stay in `agents/runtime/foreground-policy` and runtime policy, not in the carrier helper.

## Expected touched paths (tentative)

```text
memory/
└── cards/
    └── dev--provider-payload-prompt-contract.md                 +
src/
└── .pi/
    └── extensions/
        ├── agent-runtime/
        │   ├── system-prompts/
        │   │   └── index.ts                                     ~
        │   └── __tests__/
        │       └── agent-runtime-system-prompts.test.ts         ~
        ├── dev-mode/
        │   └── introspection/
        │       ├── debug-cache.ts                               ~
        │       └── __tests__/ or parent dev-mode test file       ~
        └── shared/
            └── provider-system-prompt.ts                         +
.agents/
└── skills/
    └── ln-review/
        └── references/
            └── contract-lenses.md                               ~
```
