# Live graph observer mise en place

Frontier: live-graph-observer | n/a
Status:   active — Card 2 is the only remaining open card
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: product launch/setup around the `live-graph-observer` frontier; these cards prepare the branch identity and local manual loop without touching graph/RPC/web core paths.
- Frontier item: `live-graph-observer` (FE-795). This is branch-local mise en place, not a separate Linear issue or Graphite branch.
- Current card state: Card 1 is done; Card 2 remains open and may be filled from the final browser smoke loop rather than built first.
- Main open risk: feedback-loop tooling can sprawl into a dev-platform project. Keep the workbench/tooling concrete enough to launch and observe the POC only.
- Cross-cutting obligations: preserve `.brunch/` as cwd-scoped durable state; do not commit generated `.brunch/data.db` or sessions; do not add compatibility aliases unless explicitly requested.

## Card 1 — done — CLI identity and local workbench

### Objective

The project installs and launches as `brunch-cli` from a reusable in-repo POC workbench cwd.

### Acceptance Criteria

✓ `package.json` — package name is `brunch-cli`, version is at least `0.1.0`, and the only bin command is `brunch-cli`.
✓ `bin/brunch-cli.js` — the executable bin shim launches the built CLI, with no `brunch-next` bin alias left behind.
✓ `.fixtures/workbenches/live-graph-observer/` — contains a small committed README or marker explaining how to launch `brunch-cli` there and let `.brunch/` + `data.db` scaffold locally.
✓ `npm run build` or focused package/bin test — proves the renamed bin target is included and executable after build.

### Verification Approach

- Inner: focused package/bin test or build assertion — proves package identity and bin path.
- Middle: manual command from `.fixtures/workbenches/live-graph-observer/` — `brunch-cli --mode print` or `npm run dev -- --mode print` scaffolds `.brunch/` in that directory.

### Cross-cutting obligations

- `.brunch/` remains cwd-scoped and ignored; generated DB/session artifacts are not committed.
- Identity is singular: no `brunch-next` compatibility alias unless the user asks.

### Assumption dependency

None — this is setup identity work, not a product architecture claim.

### Expected touched paths (tentative)

```pseudo
package.json                         ~
package-lock.json                    ~
bin/
├── brunch.js                        -
└── brunch-cli.js                    +
src/brunch.test.ts                   ?
.fixtures/workbenches/live-graph-observer/
└── README.md                        +
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 2 — open — Browser feedback loop decision

### Objective

The branch has one documented, runnable browser feedback loop for the web observer work.

### Acceptance Criteria

✓ Feedback-loop choice is explicit in the workbench README: recommended command(s), expected port/URL shape, and how to inspect browser console/network/accessibility state.
✓ If using Chrome DevTools tooling, the command is verified locally against a running `brunch-cli --mode web` or TUI-started observer host.
✓ Browser automation/inspection tooling and `agentation` are treated as complementary: Chrome/CDP-style tooling observes the browser; `agentation` annotates the running browser so the agent can fetch annotations through its CLI.
✓ If `agentation` is enabled, this card records the required dependency/import change and stops for the web architecture card to own any `src/web/*` edit.
✓ No feedback-loop tool becomes product runtime behavior or a required POC dependency.

### Verification Approach

- Inner: file-scoped lint/build for changed package/web files if a dev dependency or import is added.
- Middle: manual smoke in the workbench — launch host, open browser tooling, confirm the page is observable.

### Cross-cutting obligations

- Keep feedback tooling out of canonical product state and out of `.brunch/` artifacts.
- Use Chrome/CDP-style tooling for browser inspection/automation and `agentation` for human/agent annotations when a running browser needs annotated UI feedback.

### Assumption dependency

None — if the tooling choice reveals a missing dev-server or MCP requirement, stop and rescope before adding a larger dev-platform seam.

### Expected touched paths (tentative)

```pseudo
.fixtures/workbenches/live-graph-observer/README.md  ~
package.json                                         ?
package-lock.json                                    ?
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
