# Prompt-resource topology + format realignment to the Agent Skills standard

Frontier: prompt-skill-topology (provisional — new frontier, needs ln-plan + Linear issue + branch)
Status:   active
Mode:     single
Created:  2026-06-19

## Orientation

- **Seam:** the D58-L prompt-resource manifest layer — `src/.pi/skills/` (resource bodies) + `src/.pi/extensions/runtime/state.ts` (code-owned `{name, description, location}` manifest) + `src/.pi/extensions/system-prompts/compose.ts` (emits the `<available_*>` blocks the agent reads).
- **What changes:** adopt the [Agent Skills standard](https://agentskills.io/specification.md) topology and format for Brunch's prompt resources — each skill becomes a directory `skills/<family>/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`) + markdown body, optional `references/`, and the composed manifest is emitted as a skills block that **copies pi-coding-agent's own skill format**. The bet (user, this pass): the standard "skill" naming + topology + frontmatter activates LLM training priors and is more reliably used, even though Brunch still generates the manifest into the system prompt rather than relying on ambient discovery.
- **The governing instruction (user, this pass):** copy how pi-coding-agent parses and injects ambiently-discovered skills — **the only divergence is that the skill set is code-owned, not filesystem-discovered.** Concretely: pi exports `loadSkills`, `formatSkillsForPrompt`, and `parseFrontmatter` from `@earendil-works/pi-coding-agent`. `loadSkills({ skillPaths, includeDefaults: false })` loads *only* an explicit path list (no `agentDir`/`.pi/skills` scan) — so Brunch reuses pi's parsing/validation/format directly, passing the code-owned enumeration as `skillPaths`. Description is **file-owned** (read from SKILL.md frontmatter); the path/legal-set enumeration stays **code-owned** in `state.ts`. Reuse pi's functions where possible rather than reimplementing (stay on the dependency's happy path; minimize Brunch-owned parsing/format surface).
- **This is a NEW frontier item, not an FE-861 slice.** It reverses the D85-L / `alpha-hardening` *deferral* of the `SKILL.md + references/` shape ("deferred until a skill needs sub-references") and changes the D58-L manifest contract (`<available_strategies|lenses|methods>` → `<brunch-skills>`; description ownership). Because it changes durable decisions and is a distinct concern from capture conduct, it needs: its own Linear issue (FE) + Graphite branch stacked on the recon-need branch, an `ln-plan` frontier definition, and an `ln-spec` revision of D58-L/D85-L. This card scopes the implementation; the planning/issue/branch setup happens at pickup.
- **Sequencing:** immediately follows the FE-861 `reconciliation-need-outlet` build (user request). Stacks on `ln/fe-861-generalized-capture-2`.
- **Main risk:** the `description`-ownership fork below — it determines whether D39-L sealing is preserved.

Posture: proving (new frontier; the standard-format-helps-the-LLM claim is a fitness bet, unmeasured). Confirmed against `.pi/POSTURE.md` (`certainty: proving`, `migration: free-rewrite`, `audience: internal`). Under `free-rewrite`: move/rename the skill files directly and let test/golden breakage enumerate the fix list — **no alias or back-compat for the old flat `<family>/<id>.md` paths**.

**Resolved decisions (user, this pass):**

1. **`description` is file-owned; the path/legal-set is code-owned (D39-L preserved).** Move `description` into SKILL.md frontmatter and read it via pi's `parseFrontmatter` / `loadSkills` over the **code-owned enumerated paths** in `state.ts` (`includeDefaults: false`, explicit `skillPaths`). Sealing holds because the legal set + locations stay code-owned (adding a SKILL.md does not advertise it); only the description *text* is read from the sealed file — single source of truth, no code/body drift. Records as a **D58-L refinement**: "advertised set + locations code-owned; name/description read from the sealed SKILL.md frontmatter via pi's loader."
2. **No `capabilities/` rename** — incidental sketch; keep `strategies/ | lenses/ | methods/` (avoids the live `CapabilityId` collision, D74-L).
3. **No skill-name prefixing** — keep current ids (`intent`, `capture`, …); `name` frontmatter == parent dir == current id.
4. **Skills block copies pi's `formatSkillsForPrompt`** — same read-tool preamble + `<skill><name><description><location></skill>` element structure. Brunch's posture filtering (AUTO/pin/capability-gating in `manifestsForState`) still decides *membership*; the block lists the legal posture-filtered set.

**One remaining micro-decision (resolve at build; optional `ln-design`):** the block *wrapper* + axis grouping. Reusing `formatSkillsForPrompt` verbatim yields a flat `<available_skills>` with no axis distinction. Brunch's strategy/lens axes are mutually-exclusive-per-axis (pick one) while methods compose freely — that selection guidance must survive. **Recommended:** a thin Brunch formatter mirroring pi's element structure but wrapped as `<brunch-skills>` (marks the sealed/curated set; avoids colliding with pi's own `<available_skills>` machinery on the appended base prompt), with axis carried per-skill (e.g. a `<kind>` element) and the "pick one strategy + one lens, compose methods" guidance in the router note. Verbatim-flat `<available_skills>` is the alternative if the user prefers a literal copy and is willing to fold axis-selection guidance entirely into the router note + descriptions.

**Out of scope (named, not scoped):** agent bodies (`.pi/agents/<agent>/SYSTEM.md`) keep their convention — the standard is about skills, not agent roles. No family rename, no id-prefixing.

## Target Behavior

Every Brunch prompt-resource skill is a standard Agent Skills directory (`skills/<family>/<name>/SKILL.md` with YAML frontmatter), parsed by pi's own loader and advertised through a pi-format skills manifest block, with D39-L sealing preserved (code-owned path list, no ambient scan).

## Full-card cold-start reads

```
- https://agentskills.io/specification.md — the target format (frontmatter fields, name↔dir rule, references/, progressive disclosure)
- @earendil-works/pi-coding-agent dist/core/skills.js — loadSkills / loadSkillFromFile / formatSkillsForPrompt (the parse + inject source to copy; note loadSkills({skillPaths, includeDefaults:false}) = no scan); dist/utils/frontmatter.js — parseFrontmatter
- memory/SPEC.md   — D58-L (manifest/compose contract — being refined), D85-L (deferred-shape decision — being superseded), D39-L (sealing: no ambient discovery), D52-L (.pi topology)
- memory/PLAN.md    — frontier: prompt-skill-topology (to be added via ln-plan); Recently Completed prompt-skill-consolidation (FE-893) + the alpha-hardening deferral being reversed
- src/.pi/extensions/runtime/state.ts — resource(), promptResourceLocation(family,id), MethodId/AgentLensId/AgentStrategyId, METHOD_RESOURCES/STRATEGY_RESOURCES/LENS_RESOURCES, manifestsForState
- src/.pi/extensions/system-prompts/compose.ts — renderManifestFamily + the three available_* blocks + router note
- src/.pi/extensions/system-prompts/__tests__/compose.test.ts — manifest-name lists, the ≥700-char readability invariant, the COMPOSE goldens
- src/.pi/__tests__/prompting.test.ts — the "no Pi resource discovery / no filesystem inference" sealing test
- src/.pi/skills/README.md — body-lock ledger to rewrite for the new topology
```

## Boundary Crossings

```
→ src/.pi/skills/<family>/<name>/SKILL.md   (13 resources: move + add frontmatter)
→ state.ts promptResourceLocation           (`skills/${family}/${id}.md` → `skills/${family}/${id}/SKILL.md`)
→ state.ts resource() + manifest records    (description sourced per decision 1)
→ compose.ts                                 (reuse pi loadSkills/formatSkillsForPrompt; skills block replaces the three `<available_*>` blocks)
→ compose.test.ts + prompting.test.ts        (readability path → SKILL.md; block-name assertions; sealing test)
→ COMPOSE goldens (__previews__/elicitor--*.md ×4)  (regenerate)
→ memory/SPEC.md D58-L / D85-L               (manifest-shape refinement + supersede the deferral)
```

## Risks and Assumptions

```
- RISK: moving description into frontmatter quietly re-introduces filesystem-driven availability (D39-L breach)
    → MITIGATION: call pi's loader with includeDefaults:false and an explicit code-owned skillPaths list (never loadSkillsFromDir over a family dir, which recurses/discovers). Keep prompting.test.ts's "no ambient discovery / advertised-set-is-code-owned" assertion green and extend it to prove adding an unlisted SKILL.md under skills/ still does not advertise.
- RISK: reusing formatSkillsForPrompt verbatim flattens the strategy/lens/method axes (loses pick-one-per-axis semantics)
    → MITIGATION: keep posture filtering in manifestsForState as the membership gate; use a thin Brunch formatter mirroring pi's element structure that retains axis info + selection guidance (see the micro-decision above).
- RISK: the realignment churns goldens + name lists in many tests at once (large diff)
    → MITIGATION: free-rewrite posture — land it atomically; the golden + name-list breakage IS the fix list. Scope stays one seam (the manifest layer); do not widen into agent bodies or renames.
- ASSUMPTION: SKILL.md bodies keep the existing prose (just gain frontmatter); the readability ≥700-char invariant still holds on the body
    → IMPACT IF FALSE: trivial — bodies are already >700 chars; frontmatter only adds.
    → VALIDATE: compose.test.ts readability invariant green against the SKILL.md paths.
- ASSUMPTION: `name` frontmatter == parent dir name (standard rule) and matches the existing manifest id
    → IMPACT IF FALSE: only if decisions 2–3 (renames) are taken; this card keeps ids stable so name==dir==current id holds.
```

## Posture check

Proving. This is a **materialize-a-decision** closure move: it takes the now-reversed D85-L deferral (adopt the standard shape) and writes it into topology + the D58-L manifest contract. It scores on **invariants** (canonicalizes the prompt-resource topology to a recognized standard; locks the sealed-set-vs-frontmatter-description boundary) and carries a **fitness bet** (standard format → better LLM use) that stays unmeasured/outer-loop. The deterministic surface (goldens, readability, sealing) makes the realignment itself fully verifiable; the LLM-use payoff is the proving bet behind adopting it. Build it.

## Acceptance Criteria

```
✓ every skill resolves at skills/<family>/<name>/SKILL.md with valid frontmatter (name == parent dir == current id, kebab ≤64; non-empty description) + the existing body
✓ name + description are read from frontmatter via pi's loader (loadSkills/parseFrontmatter); state.ts owns only the enumerated skill paths + axis/legality metadata (no description string in code)
✓ the manifest advertises the same legal set as before (no skill added or dropped by the move); posture filtering (manifestsForState) still gates membership
✓ compose emits the skills block in pi's format (read-tool preamble + <skill><name><description><location></skill>); wrapper/axis-grouping per the micro-decision; the "do not infer from the filesystem" router note stays
✓ D39-L sealing proven: pi's loader is called includeDefaults:false over the code-owned path list; prompting.test.ts shows an unlisted SKILL.md under skills/ is NOT advertised
✓ readability invariant green against SKILL.md paths; skills/README.md body-lock ledger rewritten for the new topology
✓ COMPOSE goldens regenerated and reviewed (human eyeball before lock)
✓ SPEC D58-L refined (manifest shape + file-owned description via pi loader) and D85-L deferral superseded; npm run verify green
```

## Verification Approach

```
- Inner: vitest — compose.test.ts (block name + readability + goldens), prompting.test.ts (sealing/no-discovery, extended); oxlint/oxfmt via npm run verify
- Middle: none new — manifest legality is the existing contract, re-shaped not re-invented
- Outer: fitness — does the standard format actually improve the agent's skill selection/use? manual + .brunch/debug/system-prompt.md (named, the proving bet; not gated)
```

## Cross-cutting obligations

```
- D39-L sealing: advertised set + locations stay code-owned; no ambient Pi skill discovery re-enabled
- D58-L: composition stays projection (name/description/location metadata only; bodies are not inlined/transformed) — frontmatter description is read, not rewritten
- free-rewrite: no alias/shim for old flat paths; the migration is the rewrite, not an expand/contract bridge
- keep the slice to the manifest seam — do not pull agent bodies or family/id renames in for symmetry
```

## Expected touched paths (tentative)

```
src/.pi/skills/
├── strategies/
│   ├── freestyle/SKILL.md                  + (from freestyle.md)
│   ├── step-wise-decision-tree/SKILL.md     +
│   └── step-wise-disambiguate/SKILL.md      +
├── lenses/{intent,design,oracle}/SKILL.md   + (from <id>.md)
├── methods/{capture,commit-graph,read-context,generate-proposal,review-for-gaps,
│            run-structured-exchange,elicit-by-question,ingest-paste,
│            read-referenced-documents,explore-and-characterize}/SKILL.md  +
├── (old flat <family>/<id>.md)              -  (deleted by the move; free-rewrite)
├── {strategies,lenses,methods}/README.md    ~  (family layout notes)
└── README.md                                ~  (body-lock ledger → new topology)
src/.pi/extensions/runtime/state.ts                         ~  (skill-path enumeration + axis/legality metadata; drop code-owned description; promptResourceLocation -> SKILL.md dir)
src/.pi/extensions/system-prompts/compose.ts                ~  (reuse pi loadSkills/formatSkillsForPrompt; emit the skills block + router note)
src/.pi/extensions/system-prompts/__tests__/compose.test.ts ~  (paths, block name, goldens)
src/.pi/extensions/system-prompts/__previews__/elicitor--*.md ~ (regenerate ×4)
src/.pi/__tests__/prompting.test.ts                         ~  (sealing/no-discovery, extended)
memory/SPEC.md                                              ~  (D58-L refine, D85-L supersede)
```
