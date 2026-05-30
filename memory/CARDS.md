<!-- CARDS.md — temporary scope-card queue for one frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Containing frontier: pi-ui-extension-patterns (FE-744). -->

# Scope Cards — FE-744 branded/themed chrome recovery

## Orientation

- **Containing seam:** Pi UI extension affordances, specifically Brunch-owned TUI chrome and workspace dialog visual identity under `src/tui-client/.pi/*`.
- **Frontier item:** `pi-ui-extension-patterns` / FE-744 on `ln/fe-744-pi-ui-extension-patterns`; these cards are slices inside that one frontier and do **not** imply new Linear issues or branches.
- **Volatile state:** no `HANDOFF.md`, prior `memory/CARDS.md`, or `memory/REFACTOR.md` was present when scoped. Recent sync edits in `memory/SPEC.md`, `memory/PLAN.md`, and `docs/architecture/pi-ui-extension-patterns.md` retire A10-L/A23-L and narrow FE-744 to visual chrome closeout + A18-L containment residue.
- **Main open risk:** a full Brunch-host visual proof is host/PTY-sensitive; keep deterministic assertions to textual/ANSI-stripped brand markers and record any irreducible manual visual judgment explicitly.

## Frontier-level obligations carried by every card

- Preserve `I19-L`: no branch creation/navigation, no mid-turn mutation, no parallel chat/turn store.
- Preserve `I22-L`: no prior transcript rendering or agent loop before explicit spec/session activation; the picker remains decision-only and the coordinator owns activation/binding.
- Preserve `D35-L`: Brunch chrome goes through `renderBrunchChrome` or its successor; do not scatter raw `ctx.ui.*` calls; do not publish a `brunch.chrome` status key.
- Preserve the public-RPC/product boundary: RPC fixtures may assert widget/title/notification events that Pi actually emits, not TUI-only header/footer internals.
- Keep product visual assets private to Brunch code; do not expose Brunch prompt packs, themes, or assets through ambient Pi resource discovery.
- Keep strict built-in command suppression out of these slices; A18-L remains an accepted/residual Pi API risk unless separately scoped.

## Queue

| Order | Card | Weight | Status |
| --- | --- | --- | --- |
| 1 | Shared Brunch TUI identity primitives | Full | next |
| 2 | Persistent chrome uses Brunch identity | Light | queued |
| 3 | Brunch-host chrome visual evidence | Light | queued |
| 4 | FE-744 closeout reconciliation | Light | queued |

---

## Card 1 — Shared Brunch TUI identity primitives

**Status:** next  
**Weight:** full scope card

### Target Behavior

The startup dialog's Brunch visual identity is provided by a reusable TUI identity module.

### Boundary Crossings

```text
→ src/tui-client/.pi/components/workspace-dialog/component.ts inline logo / wordmark / palette helpers
→ src/tui-client/.pi/components/<identity module> reusable Brunch visual primitives
→ workspace-dialog render output and build asset packaging
```

### Risks and Assumptions

- RISK: moving or sharing logo helpers can break asset resolution under `dist/` because the current reader resolves assets relative to the workspace-dialog component module.
  → MITIGATION: either keep assets in their current directory and pass the asset URL into the reusable helper, or update `build:pi-assets` with a test/build proof.
- RISK: visual helpers can accidentally shell out to Chafa or depend on ambient terminal state in tests.
  → MITIGATION: keep generated ANSI assets as static inputs; make truecolor/240/plain fallback choices injectable or directly unit-testable.
- ASSUMPTION: a small Brunch-owned component helper is enough for product branding without using Pi theme/resource discovery.
  → IMPACT IF FALSE: FE-744 would need a sealed-profile/theme slice before chrome closeout, delaying `sealed-pi-profile-runtime-state` and `graph-data-plane`.
  → VALIDATE: unit-test the helper with dark/light/no-color projections and prove workspace-dialog still renders through product imports only.

### Tracer-bullet check

- **Invariants:** locates the private visual-identity boundary so future chrome and dialog code do not duplicate branding logic.
- **Proof of life:** workspace-dialog still renders its existing branded startup surface from the extracted helper.

### Acceptance Criteria

✓ `workspace-dialog` tests — the rendered picker still contains Brunch product copy, version/Pi lines, and no user-created workspace wording.  
✓ new identity-helper tests — compact wordmark/logo fallback, dark/light palette wrapping, and no-color/plain fallback are deterministic without invoking runtime Chafa.  
✓ `npm run build` or a targeted build-assets assertion — required static logo assets are present wherever the shared helper resolves them at runtime.

### Verification Approach

- Inner: unit tests — prove the identity module and workspace-dialog integration are deterministic.
- Middle: build asset check — prove compiled/runtime asset layout still supports the identity module.
- Outer: none for this card; visual judgment lands in Card 3.

### Cross-cutting obligations

- Do not expose Brunch visual identity as ambient Pi themes/resources.
- Do not persist startup/logo visuals into Pi JSONL.
- Preserve the picker as pure decision rendering; coordinator activation remains outside visual components.

---

## Card 2 — Persistent chrome uses Brunch identity

**Status:** queued after Card 1  
**Weight:** light scope card

### Objective

Make `renderBrunchChrome` present compact Brunch-branded chrome through the shared identity module.

### Acceptance Criteria

✓ `chrome.test.ts` — header/footer/widget snapshots include the compact Brunch identity plus activated spec/session/runtime facts without fabricating missing fields.  
✓ wrapper-call test — `renderBrunchChrome` still calls only `setHeader`, `setFooter`, `setWidget`, and `setTitle`; it never calls `setStatus`.  
✓ RPC-compatible projection assertion — diagnostic `setWidget` and `setTitle` remain plain/product-shaped enough for RPC observers while header/footer stay TUI-only.

### Verification Approach

- Inner: chrome unit tests and typecheck — prove product-state projection and Pi UI call shape.
- Middle: none; Card 3 supplies host-level evidence.

### Cross-cutting obligations

- Preserve `D35-L`: chrome remains one stateless projection wrapper over a supplied product-state snapshot.
- Preserve status-key discipline: do not publish or echo `brunch.chrome` as a footer status contribution.
- Do not use Pi theme discovery or ambient `.pi` resources for Brunch branding.

### Assumption dependency

None — A10-L has been retired into `D35-L` / `I22-L`; A18-L command containment is deliberately out of scope.

### Promotion checklist

- [x] Does this change a requirement? **No**.
- [x] Does this create, retire, or invalidate an assumption? **No**.
- [x] Does this slice depend on an unvalidated high-impact assumption? **No**.
- [x] Does this make or reverse a non-trivial design decision? **No**; it applies the identity boundary from Card 1.
- [x] Does this establish a new seam-level invariant? **No**.
- [x] Does this change a frontier-level obligation or verification layer? **No**.
- [x] Does it cross more than two major seams? **No**.
- [x] Is this the first touch in an unfamiliar seam? **No** after Card 1.
- [x] Can you not name the containing seam/current rationale? **No**; `D35-L` and FE-744 govern it.

---

## Card 3 — Brunch-host chrome visual evidence

**Status:** queued after Card 2  
**Weight:** light scope card

### Objective

Capture Brunch-host evidence that the final chrome reads as Brunch-branded in a real TUI launch.

### Acceptance Criteria

✓ pty/script oracle — a host-sensitive probe captures a Brunch TUI startup screen and asserts ANSI-stripped brand markers, version/Pi line, spec/session selection copy, and absence of stale transcript text.  
✓ activated-chrome evidence path — either the probe drives explicit activation to capture persistent chrome markers or `docs/architecture/pi-ui-extension-patterns.md` records why that step remains manual on this host.  
✓ manual checklist — the documented walkthrough names the exact observations required for full-screen startup feel, persistent header/footer feel, active session id/label, and no Pi-branded primary surface leakage.  
✓ no CI overreach — any host-sensitive pty probe stays outside `npm run verify` unless it is stable enough for ordinary local/CI execution.

### Verification Approach

- Inner: probe script unit/source checks where practical — prove assertions target product-shaped markers.
- Middle: pty/script probe — prove durable textual markers for the startup surface and, if feasible, activated chrome.
- Outer: manual TUI checklist — prove qualitative visual recovery that text oracles cannot fully encode.

### Cross-cutting obligations

- Preserve `I22-L`: startup proof must still show no stale transcript before explicit activation.
- Do not assert TUI-only header/footer through RPC fixtures; RPC proof is widget/title only.
- Keep manual evidence in `docs/architecture/pi-ui-extension-patterns.md`, not in ad hoc scratch reports.

### Assumption dependency

None — this card verifies a frontier closeout condition rather than building against a live SPEC assumption.

### Promotion checklist

- [x] Does this change a requirement? **No**.
- [x] Does this create, retire, or invalidate an assumption? **No**.
- [x] Does this slice depend on an unvalidated high-impact assumption? **No**.
- [x] Does this make or reverse a non-trivial design decision? **No**.
- [x] Does this establish a new seam-level invariant? **No**.
- [x] Does this change a frontier-level obligation or verification layer? **No**; it instantiates the existing probe-oracle layer.
- [x] Does it cross more than two major seams? **No**; TUI host/probe/docs only.
- [x] Is this the first touch in an unfamiliar seam? **No** after Cards 1–2.
- [x] Can you not name the containing seam/current rationale? **No**; FE-744 visual closeout governs it.

---

## Card 4 — FE-744 closeout reconciliation

**Status:** queued after Card 3  
**Weight:** light scope card

### Objective

Reconcile FE-744 visual evidence into the live docs and retire stale provisional planning residue.

### Acceptance Criteria

✓ `docs/architecture/pi-ui-extension-patterns.md` — Current verdicts, evidence inventory, open evidence gaps, and downstream posture reflect final branded/themed chrome evidence.  
✓ `memory/PLAN.md` — `pi-ui-extension-patterns` status/current execution pointer no longer says chrome recovery is missing; any remaining A18-L command-containment residue is explicitly accepted, deferred, or routed to a future frontier.  
✓ `docs/architecture/pi-ui-extension-patterns-provisional-plan.md` — deleted if all durable structured-exchange facts are already reconciled into SPEC/PLAN/evidence docs, or trimmed only if a still-live residue remains.  
✓ `memory/CARDS.md` — this queue is marked done or deleted once exhausted.

### Verification Approach

- Inner: markdown/document consistency review plus `npm run fix` for repository convention.
- Middle: grep/reference audit — no stale claims that structured-exchange public relay or web observation are pending; no stale claim that chrome recovery is the current missing seam after closeout.
- Outer: none beyond Card 3 visual evidence.

### Cross-cutting obligations

- Do not archive handoffs/scope queues; delete exhausted derivative artifacts rather than preserving them as history.
- Keep PLAN at frontier granularity; do not turn these slices into new frontier items.
- Preserve cross-skill truth from `ln-design`/`ln-oracles`: public-RPC parity, probe artifact path, structured-exchange schema split, and chrome wrapper obligations must remain visible in SPEC/PLAN/evidence docs.

### Assumption dependency

None — this is canonical reconciliation and garbage collection after the scoped evidence lands.

### Promotion checklist

- [x] Does this change a requirement? **No**.
- [x] Does this create, retire, or invalidate an assumption? **No**; assumption retirement already occurred in sync.
- [x] Does this slice depend on an unvalidated high-impact assumption? **No**.
- [x] Does this make or reverse a non-trivial design decision? **No**.
- [x] Does this establish a new seam-level invariant? **No**.
- [x] Does this change a frontier-level obligation or verification layer? **No**.
- [x] Does it cross more than two major seams? **No**; docs/queue cleanup only.
- [x] Is this the first touch in an unfamiliar seam? **No**.
- [x] Can you not name the containing seam/current rationale? **No**; FE-744 closeout governs it.
