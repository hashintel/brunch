<!-- CARDS.md — prepared scope-card queue for ONE frontier item (ln-scope).
     Frontier: toolchain-profile-expansion (FE-843, ka/fe-843-toolchain-profiles).
     Delete when exhausted. -->

# Cards — toolchain-profile-expansion (FE-843)

## Card 1 (light) — Data-driven profile registry + TS profiles — `done` (2026-06-10)

### Objective

`project-profile.ts` defines profiles as data literals (path templates + argv template + conventions prose) compiled into the existing `Toolchain` interface, and the registry grows `node-vitest`, `node-test`, `node-jest`, `deno` — all six consumers untouched.

### Acceptance Criteria

```
✓ registry invariants — every profile's sliceTarget/epicTarget contain exactly one {id};
  testCommand contains exactly one {target}; conventions non-empty (one enumerable test)
✓ command shapes — node-vitest → ['npx','vitest','run',t]; node-test → ['node','--test',t];
  node-jest → ['npx','jest','--runTestsByPath',t]; deno → ['deno','test','--allow-all',t]
✓ consumers untouched — bun/brunch behavior identical; existing suites green without edits
✓ conventions prose per new profile is greenfield-complete (names scaffold files + install step)
```

### Verification

- Inner: vitest unit (project-profile.test.ts) — registry invariants + command shapes
- Middle: existing consumer suites unchanged

## Card 2 (full) — Selection live and strict — `done` (2026-06-10; cook-side strictness lives in `resolveToolchain` itself, pinned by project-profile tests — no separate cook-cli harness needed. I130-K refinement + agent-install assumption → SPEC at ln-sync tie-off.)

### Target Behavior

Every emitted `plan.yaml` carries an explicitly resolved profile id, chosen at plan time (`--profile` flag ≫ `snapshot.profile` ≫ `bun`), and cook fails loudly on an unknown id instead of silently defaulting.

### Boundary Crossings

```
→ brunch plan CLI (parsePlanArgs: new --profile=<id> flag, plan-runner.ts)
→ plan-emitter (resolve once; stamp resolved id onto emitted Plan — never absent)
→ plan.yaml (persisted resolved profile; loader spreads it through)
→ brunch cook (cook-cli.ts strict resolve: unknown id → UnknownProfileError listing valid ids;
  absent → lenient bun, for hand-authored fixtures)
```

### Risks / Assumptions

```
- ASSUMPTION: agent-side install suffices for node profiles (no harness install verb)
  → VALIDATE: outer-loop greenfield cook smoke on node-vitest → SPEC §Assumptions
- RISK: jest greenfield needs ts-jest config → MITIGATION: conventions prose names it; experimental
- RISK: strict-on-unknown breaks hand-edited plans → MITIGATION: error lists valid ids;
  absent stays lenient (mirrors checkPlan base/emitted split)
```

### Acceptance Criteria

```
✓ emitter stamps profile — absent snapshot.profile → emitted plan carries profile: 'bun'
✓ flag wins — --profile=node-vitest overrides snapshot.profile; unknown flag errors at plan time
✓ cook strict — unknown plan profile → UnknownProfileError (valid ids listed); absent → bun
✓ I130-K agreement — emitted targets and cook runner derive from the same persisted id
```

### Verification

- Inner: plan-runner.test.ts (flag), plan-emitter.test.ts (stamp), cook-cli.test.ts (strict/lenient)
- Middle: plan-contract/plan-eval suites unchanged

## Card 3 (light) — Architect classifies the profile from spec prose — `next`

### Objective

`architectPlan`'s output schema gains an optional profile enum (registry ids, null when the spec is silent); the resolved chain becomes flag ≫ snapshot.profile ≫ architect-classified ≫ bun, with the architect rung skipped on the deterministic fallback path (I133-K).

### Acceptance Criteria

```
✓ schema — architect output accepts profile: 'deno' | … | null; prompt instructs classification
  from spec prose only (D160-K: no host introspection)
✓ chain — mock RunModel returns profile → emitted plan carries it; flag still wins;
  snapshot.profile still beats architect
✓ fallback — architect throw/malformed → chain skips rung (flag ≫ snapshot ≫ bun)
```

### Verification

- Inner: plan-architect.test.ts (schema), plan-emitter.test.ts (chain precedence + fallback)
- Outer (follow-on, not gating): greenfield cook smoke --profile=node-vitest (conventions oracle)
