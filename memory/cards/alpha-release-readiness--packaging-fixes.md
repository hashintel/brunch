# Packaging fixes + release verification loop

Frontier: alpha-release-readiness
Status:   active
Mode:     slices
Created:  2026-07-07

Three sequential light cards closing the two spike-witnessed release-blocking defects and installing the check that keeps them closed. Posture: earned (inherited from `alpha-release-readiness` thread 1/5 — spike-witnessed defects, closure-shaped).

Spike evidence (2026-07-07): packed tarball installed into an isolated prefix crashes at boot from a foreign cwd — first on missing `drizzle-orm`, then on missing `dist/agents/prompts/registry.js`. With both patched, `brunch --mode print` works from `/tmp`.

---

## Card 1 — `build:pi-assets` must not clobber compiled output [done]

### Objective

`npm run build` (and therefore `prepack`) produces a `dist/` where compiled JS and copied markdown assets coexist — `dist/agents/prompts/registry.js` survives the asset copy.

### Light-card cold-start reads

```
- memory/SPEC.md   — req 1, req 29 (context only; no decision change)
- memory/PLAN.md    — frontier: alpha-release-readiness (Objective thread 1)
- package.json      — the `build` + `build:pi-assets` scripts (the rm -rf … cp chain)
```

### Defect mechanics

`build` runs `tsc` → `build:pi-assets`. The asset script does `rm -rf dist/agents/prompts dist/agents/subagents dist/agents/references` then copies only `.md` files back — deleting `dist/agents/prompts/registry.{js,d.ts,js.map,d.ts.map}` that tsc emitted from `src/agents/prompts/registry.ts`. tsc incremental build info then prevents re-emission on the next build, so the defect is sticky across rebuilds.

### Acceptance Criteria

```
✓ after a clean `npm run build` (rm -rf dist + tsbuildinfo first), dist/agents/prompts/ contains BOTH elicitor.md/executor.md AND registry.js
✓ after a SECOND consecutive `npm run build` (incremental), registry.js is still present
✓ no other compiled module under dist/agents/{prompts,subagents,references} is deleted by build:pi-assets (subagents/references currently have no .ts sources — assert the prompts case, verify the others by inspection)
```

### Verification Approach

```
- Inner: shell assertion in the card's build run (ls dist/agents/prompts/registry.js after double build)
- Middle: card 3's release smoke makes this class of defect a standing check
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
package.json                      ~   (build:pi-assets — stop rm -rf'ing dirs that hold compiled output; delete/copy only the md payload)
scripts/copy-skill-resources.mjs  ?   (if the fix consolidates asset copying there)
```

Done 2026-07-07: changed `build:pi-assets` to delete only copied markdown payloads instead of removing whole compiled-output directories. Verified clean build and second incremental build preserve `dist/agents/prompts/registry.js`; inspection also showed `dist/agents/references/registry.js` is preserved (the scope note saying references had no TS source was stale).

---

## Card 2 — drizzle runtime deps belong in `dependencies` [done]

### Objective

A fresh `npm install` of the published tarball resolves every runtime import of `dist/**`.

### Light-card cold-start reads

```
- memory/SPEC.md   — req 1 (context only)
- memory/PLAN.md    — frontier: alpha-release-readiness (Objective thread 1)
```

### Acceptance Criteria

```
✓ drizzle-orm and drizzle-typebox are in dependencies (same versions currently pinned in devDependencies)
✓ import-scan check: no bare-specifier import in dist/**/*.js resolves outside package.json dependencies (the spike's scan found exactly these two; assert the closed result)
```

### Verification Approach

```
- Inner: npm install in a scratch dir from the packed tarball; node -e "import('...')" boot of dist/app/brunch.js resolves
- Middle: card 3's release smoke exercises the real bin path
```

### Assumption dependency

None. (drizzle-kit / drizzle-typebox usage in dist is runtime-real: `dist/db/connection.js` imports drizzle-orm; the schema modules import drizzle-typebox.)

### Expected touched paths (tentative)

```
package.json  ~   (move drizzle-orm, drizzle-typebox to dependencies)
```

Done 2026-07-07: moved `drizzle-orm` and `drizzle-typebox` from `devDependencies` to `dependencies` and refreshed `package-lock.json`. Verified the built `dist/**/*.js` bare-import scan has no imports outside package dependencies, and a scratch install from the packed tarball can import `@hashintel/brunch` with both drizzle packages installed.

---

## Card 3 — release smoke: pack → isolated install → foreign-cwd boot [next]

### Objective

One command proves the packed artifact installs and boots from a foreign directory, so the clobber/dependency class of release defect cannot silently return.

### Light-card cold-start reads

```
- memory/SPEC.md   — req 1, req 29; I59-L (planned — this check is a sibling oracle, not the juncture gate)
- memory/PLAN.md    — frontier: alpha-release-readiness (Objective thread 5)
```

### Acceptance Criteria

```
✓ `npm run check:release-pack` (name negotiable at build): packs the tarball, installs it into a temp prefix (scripts allowed for better-sqlite3), runs `<prefix>/bin/brunch --mode print` in a temp foreign cwd, asserts the "Brunch workspace state" output, and cleans up
✓ the check fails loudly if the installed CLI crashes at import time (exit code propagated)
✓ the check asserts dist/agents/prompts/registry.js and all 8 live SKILL.md files exist in the tarball listing (fast structural pre-check before the slow install)
✓ documented in package.json scripts; NOT added to `npm run verify` (too slow for the gate) — noted as a release/CI step in the script header comment
```

### Verification Approach

```
- Inner: run the check itself; it is the oracle
- Outer: run it against the pre-fix HEAD~ state (or with the fix reverted) to witness it catching both spike defects — red/green for the check itself
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
scripts/check-release-pack.mjs  +
package.json                    ~   (check:release-pack script)
```

---

Chain discipline: cards are independent-in-findings (gate holds — card 3's assertions were fixed by the spike, not by cards 1–2). Delete this file when all three cards land.
