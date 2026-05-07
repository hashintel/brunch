# Scope Cards

## Frontier: FE-698 — Prompt/context scenario substrate

### Orientation

- Containing seam: server-side agent prompting and context construction (`src/server/interview.ts`, `src/server/observer.ts`, `src/server/context.ts`, `src/server/side-chat-prompt.ts`).
- Relevant frontier item: `memory/PLAN.md` Next #2, **Prompt/context scenario substrate**; Linear FE-698 is the parent boundary, with FE-635 as a later Pi harness spike.
- Volatile handoff state: prompts are currently embedded in TypeScript constants/functions, while context builders already exist as typed server functions; no markdown prompt inventory or prompt registry exists yet.
- Main open risk: moving prompt text can accidentally change model behavior or break package/bundle/runtime file resolution, so the first slice should preserve rendered prompt strings before introducing new scenario/context-pack semantics.

## Card 1 — Packaged markdown prompt registry

Status: done
Weight: full scope card

### Target Behavior

Existing interviewer, observer, and side-chat role prompts render from packaged markdown prompt assets through one typed server prompt registry without changing their effective text.

### Boundary Crossings

```text
→ server prompt markdown assets
→ prompt loader / registry module
→ interviewer, observer, and side-chat prompt call sites
→ existing prompt/unit tests plus new loader/packaging tests
```

### Risks and Assumptions

- RISK: Markdown asset resolution works in tests but fails in the built package → MITIGATION: add a packaging-oriented test or build-boundary assertion that reads a real prompt asset through the same registry path.
- RISK: Prompt migration introduces whitespace/text drift that changes LLM behavior unexpectedly → MITIGATION: preserve current rendered strings with snapshot/golden tests before and after migration, normalizing only deliberately chosen trailing whitespace.
- RISK: A too-clever prompt DSL becomes a new abstraction before scenario needs are proven → MITIGATION: keep the registry shallow: named prompt IDs, markdown loading, optional simple variable interpolation only where current prompt functions already interpolate values.
- ASSUMPTION: Current prompt call sites can be migrated without changing AI SDK message/tool contracts → VALIDATE: existing interviewer, observer, side-chat, and context tests still pass after prompt registry adoption → memory/SPEC.md A85.
- ASSUMPTION: Prompt files can be packaged as runtime assets without committing to the later scenario-runner shape → VALIDATE: build/package boundary test proves prompt files are available from server code → memory/SPEC.md A85.

### Acceptance Criteria

✓ `prompt-loader.test.ts` — named markdown prompt assets can be loaded through a typed registry, missing prompts fail with a clear error, and runtime interpolation is explicit rather than ad hoc string concatenation.
✓ `interview.test.ts` / prompt-focused unit coverage — `getSystemPrompt()` and brownfield/context-gathering prompt construction preserve the current effective interviewer instructions.
✓ `observer.test.ts` / prompt-focused unit coverage — observer system prompt construction preserves current ontology and relationship instructions while sourcing reusable text from prompt assets.
✓ `side-chat-prompt.test.ts` — side-chat role/background prompt text is sourced from the registry without changing prompt payload structure.
✓ build/package boundary test — prompt markdown assets are included/readable in the built server runtime path.

### Verification Approach

- Inner: unit/golden tests — prove prompt registry behavior, prompt-text preservation, and call-site compatibility.
- Inner: package/build boundary test — prove prompt markdown assets survive the distribution path.
- Gate: `npm run verify` once existing unrelated lint/type issues are resolved or explicitly accounted for.

### Promotion checklist

Already full scope: this establishes a new prompt-loading seam and protects `memory/SPEC.md` Requirement 40 / Decision D139 / Invariant I112.
