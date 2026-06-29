# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence.

## Setup

1. **TUI + web sidecar**: use `/cli-cmux` to open a terminal pane and launch Brunch there (see workflow below). The web UI is served as a sidecar of the TUI; standalone `--mode web` is not supported.
2. **Browser**: use `agent-browser` (`/cli-agent-browser`) as the primary observer — daemon-backed Chrome with AX-tree snapshots, clicks, and screenshots. CDP tools (`/cli-cdp`) remain useful for console/network detail.

This keeps the dev process and browser observable without leaving the agent session.

## Seeded walkthrough workflow

Manual testing happens in a **workbench** — a launchable cwd under `.fixtures/workbenches/` whose `.brunch/` is gitignored local runtime state (see `.fixtures/README.md` for the four-role tree). Never use the repo root as the test workspace, and never rely on implicit seeding: `npm run dev` only opens the named workspace.

```bash
# 1. Seed one named fixture into one named workbench.
#    --reset wipes the workbench's runtime state first — data.db (+ -wal/-shm),
#    sessions/, debug/, workspace.json — so the relaunch starts a fresh session
#    (seed + kick) instead of resuming a stale one. Unknown files in .brunch/
#    and the directory itself survive.
npm run seed -- --seed workspace-alpha-grounding/base --reset

# 2. Launch the TUI (plus web observer sidecar) against that workbench.
npm run dev -- --workspace .fixtures/workbenches/workspace-alpha-grounding
```

Then:

1. Open the sidecar URL the host prints (via `agent-browser` when an agent is driving).
2. Confirm the seeded spec appears with the expected graph state.
3. Walk through the slice-specific checks named in the active scope card.
4. To test resume, quit and relaunch against the same workbench — state is per-cwd in `.brunch/data.db`.
5. To switch scenarios, stop the process and re-run step 1 with a different `--seed` (keep `--reset`).

For non-interactive smoke, `npm run dev -- --workspace <workbench> --mode print` projects the workspace and exits; `npm run dev -- rpc <method> [params-json] --workspace <workbench>` gives one-shot RPC reads; `npm run dev -- mutate --workspace <workbench> --params-file <file>` is the explicit local curation seam.

## Choosing a seed

Tracked seeds live under `.fixtures/seeds/<name>/<variant>.json`; each family has a README describing its intent. Current sets:

- `workspace-alpha-grounding/base`, `workspace-beta-commitments/base` — small workspace-oriented smoke fixtures
- `bilal-code-health/base`, `bilal-explorer-ui/base`, `bilal-macro-view/base` — rich Bilal-derived workbench seeds
- `bilal-macro-view/grounded-intent` — the curated Bilal probe starting state
- `edge-category-directions/base`, `edge-hub-neighborhood/base`, `kind-coverage-matrix/base` — synthetic coverage fixtures
- `cook-parallel-utils/base`, `cook-layered-todo/base`, `cook-resilient-pipeline/base` — compact shape-focused intent fixtures
- `brunch-self/base`, `dumpchat/base`, `fable/base`, `rd-loop/base`, `yamlbase/base` — faithful project ports used for realistic preview coverage

Validate a seed against the current command layer with `npx tsx src/graph/validate-fixture.ts <name>/<variant>`.

## Capturing evidence from a manual session

Durable evidence follows the harness/probe-first, JSONL-backed model (`docs/architecture/probes-and-transcripts.md`):

- Live dev-loop output lands in gitignored `.fixtures/scratch/<loop>/<run-id>/`.
- Promote a reviewed run deliberately: move it under `.fixtures/runs/<probe-id>/<run-id>/`, add the probe report and source `session.jsonl` artifacts, then track it.
- In source/dev launches and faux-harness boots, the workspace's `.brunch/debug/` mirrors the latest system prompt, Brunch tool contents, origination records, and optional `transcript.md` debug rendering — an ephemeral inspection cache, not committed evidence.

Do not hand-author golden JSON or copy rows out of a workbench DB; workbench `.brunch/` state is local runtime, never canonical fixture truth.

## What to check

Each slice's scope card names its outer-loop verification needs. Common checks:

- **Rendering correctness**: do the TUI and web sidecar render the seeded graph state correctly (nodes, edges, readiness bands)?
- **Continuity**: do graph writes from the TUI session surface in the web observer, and do foreign writes surface in the session as `worldUpdate` notices?
- **Resume**: relaunch against the same workbench — is graph and session state intact?
- **Elicitation quality**: are agent prompts and structured exchanges well-formed against the seeded gaps? (tracked, not gated — see SPEC §Verification Design)
