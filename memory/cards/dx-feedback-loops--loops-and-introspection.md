# DX feedback loops: latest-pi alias, dev front door, introspection capture

Frontier: dx-feedback-loops
Status:   active
Mode:     chain
Created:  2026-06-09

## Orientation

- **Seam:** the Brunch↔pi integration surface — `package.json` pi deps, build/test resolution config (`vite.config.ts`, `tsconfig.json`, no `vitest.config.ts` today; vitest reads `vite.config.ts`), `src/.pi/` extension bundle, and the nascent `src/dev/` dir (only `workspace-rpc.ts` so far).
- **Frontier:** `dx-feedback-loops` (FE-825, branch `ln/fe-825-dx-feedback-loops`). Retires A25-L; stabilizes the D68-L dev-loop seam and the D69-L read-only introspection contract.
- **Volatile state:** pi deps pinned at `^0.75.5`; sibling `pi-mono` checkout is at `0.79.0`. Existing ad hoc faux wiring lives in `src/probes/structured-exchange-ordering-proof.ts`; `src/.pi/brunch-pi-settings.ts` already uses `SettingsManager.inMemory`. Brunch runs probes via `tsx` (tsconfig paths) and tests via `vitest` (vite.config resolve).
- **Main open risk:** dual-resolution gating — the dev source-alias must reach `tsx` + `vitest` + `vite` without leaking into the published build (`tsc -p tsconfig.build.json`, `dist`).

Posture: proving (inherited from dx-feedback-loops)

Frontier cross-cutting obligations (all three cards):
- Preserve the D39-L sealed-profile boundary: introspection loads only via the explicit static bundle, observes but never mutates payloads, and its offline-lift + extension inclusion are dev-gated, never product defaults.
- Dev loops stay distinct from `src/probes/` product-verification runs; durable evidence lands as a probe run under the `.fixtures/runs/` contract, not a parallel artifact path (D68-L).
- Pi version bumps are routine adaptation; keep the dev alias mirroring pi's own `tsconfig.json` paths list and do not pin back (D67-L).

---

## Card 1 — Latest pi + dev source-alias (full · land-early shared unblocker)

Status: done

### Target Behavior

Brunch depends on the latest pi line and a dev-gated source-alias resolves `@earendil-works/pi-{ai,agent-core,tui,coding-agent}` to the sibling `pi-mono` `src/` checkout under `tsx`, `vitest`, and `vite`, while the published build keeps resolving installed `dist`.

### Boundary Crossings

```
→ package.json pi dep versions
→ vite.config.ts resolve.alias (covers vitest + web build) — dev-gated
→ tsconfig.json paths (covers tsx dev/probes) — dev-gated, absent from tsconfig.build.json
→ exit: a faux import (`@earendil-works/pi-ai` → faux) resolves from pi-mono source under the flag
```

### Risks and Assumptions

```
- ASSUMPTION: tracking latest pi via dep bump + source-alias lands without sealed-profile regression
    → IMPACT IF FALSE: every later dx-loop card and the trio's pi-facing churn inherit a broken/old surface
    → VALIDATE: this card IS the proof — bump + alias + a resolution smoke test
    → [→ memory/SPEC.md §Assumptions A25-L]
- RISK: alias leaks into published build → dist consumers break
    → MITIGATION: gate the alias on an explicit env flag (e.g. PI_SOURCE) and keep tsconfig.build.json paths-free; assert dist path unchanged
- RISK: 0.75.5→0.79.0 has breaking API changes in the small Brunch pi surface
    → MITIGATION: typecheck (oxlint typeAware) + existing probe/test suite catch drift; fix call sites as routine adaptation, do not pin back
- ASSUMPTION: pi-mono lives at a stable sibling path (/Users/lunelson/.pi/pi-mono)
    → IMPACT IF FALSE: alias resolution fails on other machines
    → VALIDATE: resolve the alias base from an env var or repo-relative lookup, document in src/dev/README.md
- GOTCHA: the alias MUST include @earendil-works/pi-agent-core even though Brunch never imports it directly.
  Brunch directly imports only pi-coding-agent + pi-ai (pi-tui is a declared dep, no src import), but
  pi-coding-agent's *source* imports pi-agent-core (agent-session.ts, sdk.ts). Aliasing coding-agent to
  source without also aliasing agent-core yields a mixed source/dist graph (duplicate module identities).
  All four packages are published at 0.79.0 (npm latest), so the bump + four-package alias are both clean.
```

### Posture check (proving)

Scores on **uncertainty** (retires A25-L) and **invariants** (locates the dual-resolution seam). A tracer that breaks if latest-pi or the gating is wrong. Build it.

### Acceptance Criteria

```
✓ pi deps bump — package.json @earendil-works/pi-{ai,coding-agent,tui} resolve to the latest line (0.79.0)
✓ source-alias under flag — with PI_SOURCE set, a resolution smoke test imports a pi symbol and gets the pi-mono src/ module (not dist)
✓ dist unchanged — without the flag, the same import resolves installed dist; tsconfig.build.json carries no source paths
✓ suite green — npm run verify (lint typeAware + test + build) passes after the bump
```

### Verification Approach

```
- Inner: oxlint typeAware over the touched config + any drifted pi call sites — proves API compatibility
- Inner: a resolution smoke test (vitest) asserting source vs dist module identity under/without the flag
- Middle: npm run build — proves published resolution path still emits against dist
```

### Cross-cutting obligations

```
- Mirror pi's own tsconfig.json paths list; do not pin back (D67-L)
- Gating must not weaken the D39-L product/dist default
```

### Expected touched paths (tentative)

```
package.json            ~
vite.config.ts          ~
tsconfig.json           ~
tsconfig.build.json     ?
src/dev/
├── README.md           +
└── pi-source-alias.test.ts  +
```

### Build result

Done 2026-06-09 (builder + review correction). Bumped pi deps to `^0.79.0`. The source-alias is **runtime-only and `PI_SOURCE`-gated**, living in [src/dev/pi-source-alias.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/dev/pi-source-alias.ts) and consumed by `vite.config.ts` (covers `vite` + `vitest`). Added the `pi-source-alias` smoke test. `npm run verify` passes (598 tests, tsc build, web build). Drift absorbed during bump: the sealed-settings audit now covers pi 0.79.0 `getWebSocketConnectTimeoutMs`; the ordering probe uses the `$ENV` provider api-key form with an explicit faux key.

**Review correction (what the first build got wrong):** the builder had added pi-source `paths` + `allowImportingTsExtensions` to base `tsconfig.json` and neutralizers (`paths:{}`, `allowImportingTsExtensions:false`) to `tsconfig.build.json`. That made a personal source checkout the *unconditional* type-resolution default for everyone (tsconfig paths cannot be env-gated) and was unnecessary — the published 0.79.0 packages ship `dist/index.d.ts`. Both were reverted. **Types resolve from installed `dist`; only runtime resolution is aliased, gated by `PI_SOURCE`.** `src/dev` is also excluded from `tsconfig.build.json` (dev-only substrate, must not ship to app `dist`).

---

## Notes for Cards 2 & 3 (carry-forward from Card 1)

1. **Type vs runtime split is the load-bearing rule.** Types + default resolution = installed `dist` `.d.ts` (no `tsconfig` `paths`, ever). No-rebuild source iteration = the `PI_SOURCE`-gated alias in `src/dev/pi-source-alias.ts`. Do not reintroduce pi `paths` into `tsconfig.json`.
2. **The alias only covers `vite` + `vitest`.** The faux launcher (Card 2) and any introspection capture tests (Card 3) should run under **vitest**, so they get source resolution for free under `PI_SOURCE=1`. The **`tsx`** loops (`npm run dev` TUI, and Card 3's subjective real-provider launcher if run via tsx) do *not* read `vite.config.ts`. When a tsx loop first needs live pi-source edits, add an opt-in `tsconfig.dev.json` (extends `./tsconfig.json`, adds pi `paths` + `allowImportingTsExtensions`) and run `tsx --tsconfig tsconfig.dev.json`. Deferred until actually exercised — do not add speculatively.
3. **`src/dev/` is excluded from the production build** (`tsconfig.build.json`). Card 2's front door (`index.ts`, `faux-harness.ts`, `faux-launcher.ts`) lives here and stays out of app `dist`. Anything that must ship to product must not live in `src/dev/`.
4. **Import convention:** inside `src/`, import sibling modules with `.js` specifiers (NodeNext resolves to `.ts`) — e.g. `./pi-source-alias.js`. `exactOptionalPropertyTypes` is on, so pass omitted optionals as absent (`{}`), not `{ key: undefined }`. `vite.config.ts` is the one exception: it's loaded by vite's esbuild loader and imports `src/dev` with a `.ts` specifier.
5. **0.79.0 faux-provider shape (Card 2 factory):** provider `apiKey` uses the `$ENV_VAR` interpolation form (set the env var + reference it as `"$VAR"`), not a bare literal key — see the migrated `structured-exchange-ordering-proof.ts`. The shared faux-harness factory should encode this form once.

---

## Card 2 — `src/dev/` front door + shared faux-harness factory + faux launcher (full)

Status: done

### Target Behavior

A single `src/dev/` front door owns a shared faux-harness factory and a faux launcher that boots an in-memory pi `AgentSession` over the faux provider and runs a scripted turn end-to-end with no network, keys, or tokens.

### Boundary Crossings

```
→ src/dev/ front door (public entry: index.ts)
→ faux-harness factory: registerFauxProvider + AuthStorage/ModelRegistry/SessionManager/SettingsManager inMemory
→ pi createAgentSession (source, via Card 1 alias)
→ exit: a scripted faux turn completes and is asserted
```

### Risks and Assumptions

```
- ASSUMPTION: the harness mapping (ModelRegistry.inMemory + faux provider registration) matches pi 0.79.0
    → IMPACT IF FALSE: faux launcher won't boot
    → VALIDATE: factory boot test against pi source
- RISK: existing probe faux wiring (structured-exchange-ordering-proof.ts) diverges from the factory
    → MITIGATION: migrate it onto the factory or explicitly justify in place; keep it a probe (product-verification), not a dev loop
- ASSUMPTION: src/dev/workspace-rpc.ts coexists under the same front door without reshaping its contract
    → IMPACT IF FALSE: front-door consolidation widens scope
    → VALIDATE: front door re-exports workspace-rpc; do not refactor it in this card
```

### Posture check (proving)

Scores on **proof of life** (first first-class faux iteration surface end-to-end) and **invariants** (establishes the D68-L dev-loop seam). Build it.

### Acceptance Criteria

```
✓ factory boot — the shared faux-harness factory returns a usable in-memory AgentSession over the faux provider
✓ scripted turn — the faux launcher runs a scripted prompt→assistant turn with no network/keys/tokens and asserts the output
✓ migration — structured-exchange-ordering-proof.ts faux setup is rebuilt on the factory or its in-place wiring is explicitly justified in the card
✓ front door — src/dev/index.ts is the single import surface for the faux launcher + factory (+ re-exports workspace-rpc)
```

### Verification Approach

```
- Inner: factory boot unit test — proves in-memory session construction against pi source
- Middle: faux launcher scripted-turn smoke — proves the end-to-end loop with no I/O
```

### Cross-cutting obligations

```
- Dev loop stays distinct from src/probes/ product-verification runs (D68-L); shared infra is fine, shared identity is not
- No new artifact path; reuse the .fixtures/runs/ contract if the launcher emits evidence
```

### Expected touched paths (tentative)

```
src/dev/
├── index.ts                      +
├── faux-harness.ts               +
├── faux-harness.test.ts          +
├── faux-launcher.ts              +
└── faux-launcher.test.ts         +
src/probes/structured-exchange-ordering-proof.ts  ~
src/.pi/brunch-pi-settings.ts                      ?
```

### Build result

Done 2026-06-09. Added the `src/dev/index.ts` front door, a shared in-memory faux `AgentSession` factory, and a scripted faux launcher. The factory encodes pi 0.79's `$ENV` api-key provider config and bridges the installed-package split where `pi-coding-agent` may use its nested `pi-ai` registry while Brunch imports top-level `pi-ai` faux helpers. `structured-exchange-ordering-proof.ts` now reuses the shared faux provider config while remaining a product-verification probe. `src/dev/README.md` documents the faux loop. `npm run verify` passes (601 tests, tsc build, web build).

---

## Card 3 — Read-only introspection extension + paired run-artifact (full)

Status: next

### Target Behavior

One read-only, dev-gated introspection extension — loaded only through the explicit `brunch-pi-extensions.ts` bundle — captures exactly what the model receives and writes one paired `.fixtures/runs/introspection/<run-id>/` run, with mechanical and subjective capture correlated by turn.

### Boundary Crossings

```
→ src/.pi/extensions/introspection/ (new read-only extension)
→ mechanical (a): passive before_provider_request/before_agent_start tap — records the FINAL post-mutation payload the model receives
→ mechanical (b): on-demand /introspect — reports BASE system-prompt inputs via ctx.getSystemPromptOptions() (base only) + the latest passive capture
→ subjective: src/dev/ real-provider launcher driving session.prompt(...)
→ dev-gated inclusion point in createBrunchPiExtensions (src/.pi/brunch-pi-extensions.ts) — registered LAST in the extensions[] list
→ exit: .fixtures/runs/introspection/<run-id>/ holds mechanical payload + subjective answer, correlated by turn
```

> Capture-exactness contract (verified in pi 0.79.0 source): `before_provider_request` is a registration-ordered transformation chain (`runner.ts emitBeforeProviderRequest` threads `currentPayload` through each extension), so only a tap registered *after* all Brunch mutators sees the final payload. `ctx.getSystemPromptOptions()` returns pi's `_baseSystemPromptOptions` — base inputs only; it does **not** reflect later `before_agent_start`/`before_provider_request` mutations. "Exactly what the model receives" therefore belongs to the passive tap, not `/introspect`.

### Risks and Assumptions

```
- ASSUMPTION: before_provider_request / before_agent_start / getSystemPromptOptions exist and carry the full payload in pi 0.79.0
    → IMPACT IF FALSE: capture is partial or impossible
    → VALIDATE: mirror pi example examples/extensions/provider-payload.ts; assert captured payload shape in a test
- RISK: an introspection hook mutates the payload (returning a modified object)
    → MITIGATION: extension is observation-only — never returns a payload; a test asserts payloads pass through unchanged
- RISK: dev-gated inclusion leaks into product runs
    → MITIGATION: include only via an explicit dev flag in the bundle; sealed-profile test asserts absence + offline default under product mode
- ASSUMPTION: run-artifact shape can reuse the .fixtures/runs/ contract
    → IMPACT IF FALSE: parallel artifact path violates D68-L
    → VALIDATE: shape the run under .fixtures/runs/introspection/ and assert it
```

### Posture check (proving → earned closure)

Scores on **invariants** (locks in the D69-L read-only capture contract) and **proof of life** (first real-provider introspection loop). The artifact shape is the named closure target. Build it.

### Acceptance Criteria

```
✓ pass-through — a test asserts the extension returns every captured payload unchanged (observation-only)
✓ registered-last — the introspection registrar is appended after all Brunch mutators in createBrunchPiExtensions; a test asserts its before_provider_request tap sees the post-mutation payload
✓ mechanical capture — passive tap records the final provider payload; /introspect reports base getSystemPromptOptions inputs + the latest passive capture (no claim of exactness for /introspect)
✓ subjective capture — the real-provider launcher's session.prompt answer is captured and correlated to the same turn
✓ paired run — a well-formed .fixtures/runs/introspection/<run-id>/ holds mechanical payload + subjective answer keyed by turn
✓ sealed-profile — outside dev/introspection mode the extension is absent and the D39-L offline default holds
```

### Verification Approach

```
- Inner: pass-through unit test (payloads unchanged) — proves observation-only contract
- Inner: sealed-profile test — extension absent + offline default intact under product mode
- Middle: run-artifact shape assertion under .fixtures/runs/introspection/
- Outer: manual real-provider introspection session — ask a live model to enumerate/critique tools & skills, eyeball the paired capture (I38-L discretionary-loading fitness check; tracked, not gated)
```

### Cross-cutting obligations

```
- D39-L: explicit static bundle only, never ambient discovery; observe never mutate; dev-gated lift + inclusion
- D68-L: durable evidence lands as a probe run under .fixtures/runs/, not a parallel path
- D69-L: mechanical and subjective modes share one run
```

### Expected touched paths (tentative)

```
src/.pi/extensions/introspection/
├── index.ts                  +
├── index.test.ts             +
└── README.md                 +
src/.pi/brunch-pi-extensions.ts   ~
src/dev/
├── introspection-launcher.ts      +
└── introspection-launcher.test.ts +
.fixtures/runs/introspection/      ? (artifact dir, created at run time)
```

---

## Chain notes

- Card 1 is the shared unblocker — land and ideally submit before the trio's pi-facing churn.
- Card 3 reuses Card 2's `src/dev/` front door for subjective mode and Card 1's alias for source resolution, but its scope (hooks, modes, artifact contract) is independent of Cards 1–2 *implementation findings*. If the front-door API shape surprises during Card 2, stop and rescope Card 3 before building it.
- Existing product probes (`capture-quality-loop.ts`, `fixture-curation-loop.ts`) remain probes — do not collapse them into the dev substrate.
