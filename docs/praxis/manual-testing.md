# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence.

## Setup

1. **TUI + web sidecar**: use `/cli-cmux` to open a terminal pane and launch Brunch there (see workflow below). The web UI is served as a sidecar of the TUI; standalone `--mode web` is not supported.
2. **Browser**: use `agent-browser` (`/cli-agent-browser`) as the primary observer — daemon-backed Chrome with AX-tree snapshots, clicks, and screenshots. CDP tools (`/cli-cdp`) remain useful for console/network detail.

This keeps the dev process and browser observable without leaving the agent session.

### Sandboxed-agent fallback: tui-driver

Agent sandboxes that deny socket binds break every daemon-backed terminal tool (cmux, agent-tui, shellwright). The in-repo fallback is `npm run tui-driver` (`src/dev/tui-driver.ts`): an `expect`-pumped PTY per named session, with true screen rendering through a headless xterm and wait-for-text instead of sleep-and-hope. Sessions live under gitignored `.fixtures/scratch/tui-driver/<name>/`.

```bash
# Launch the TUI under a named driver session.
npm run tui-driver -- start --name walk --cols 120 --rows 40 -- \
  npm run dev-cli -- --workspace .fixtures/workbenches/<workbench>

# Observe → interact → observe. wait blocks until the text renders (exit 1 on timeout,
# printing the last screen); screen prints the current viewport.
npm run tui-driver -- wait --name walk --text "Choose a specification"
npm run tui-driver -- send --name walk --key Down --key Enter
npm run tui-driver -- send --name walk --type "My spec title" --key Enter
npm run tui-driver -- screen --name walk

# Tear down when the beat is witnessed.
npm run tui-driver -- stop --name walk
npm run tui-driver -- rm --name walk
```

Keys: `Enter Esc Up Down Right Left Tab Space Backspace C-c C-d`. `send` fails fast with a named error when the driver is gone (no silent fifo blocking); `list` shows every session with liveness. The raw PTY byte stream is in each session's `output.log` (`log` subcommand) when the rendered screen isn't enough.

## Seeded walkthrough workflow

Manual testing happens in a **workbench** — a launchable cwd under `.fixtures/workbenches/` whose `.brunch/` is gitignored local runtime state (see `.fixtures/README.md` for the four-role tree). Never use the repo root as the test workspace, and never rely on implicit seeding: `npm run dev-cli` only seeds when the seed/reset path is chosen explicitly.

```bash
# 1. Seed one named fixture into one named workbench.
#    --reset wipes the workbench's runtime state first — data.db (+ -wal/-shm),
#    sessions/, debug/, workspace.json — so the relaunch starts a fresh session
#    (seed + kick) instead of resuming a stale one. Unknown files in .brunch/
#    and the directory itself survive.
npm run seed -- --seed workspace-alpha-grounding/base --reset

# 2. Launch the TUI (plus web observer sidecar) against that workbench.
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding
```

Then:

1. Open the sidecar URL the host prints (via `agent-browser` when an agent is driving).
2. Confirm the seeded spec appears with the expected graph state.
3. Walk through the slice-specific checks named in the active scope card.
4. To test resume, quit and relaunch against the same workbench — state is per-cwd in `.brunch/data.db`.
5. To switch scenarios, stop the process and re-run step 1 with a different `--seed` (keep `--reset`).

For non-interactive smoke, `npm run dev-cli -- --workspace <workbench> --mode print` projects the workspace and exits; `npm run dev-cli -- rpc <method> [params-json] --workspace <workbench>` gives one-shot RPC reads; `npm run dev-cli -- mutate --workspace <workbench> --params-file <file>` is the explicit local curation seam.

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

## Findings ledger discipline

Walkthrough observations are recorded in `TESTING_FINDINGS.md` (structured entries: concern, file-cited evidence, observation, expected, disposition — the template is pinned at the bottom of that file). The ledger is canonical walkthrough memory, and it is governed: a finding is **dispositioned** only when its `Disposition:` line reaches one of these terminal states:

- **fixed** — names the commit/PR and the oracle that now guards it
- **promoted** — names the owning frontier or Linear issue that carries it forward
- **retired** — explicit no-action, with the reason recorded

**`deferred` and design-question dispositions are not terminal.** A deferral must name an owner — a live frontier id, a Horizon row with a re-entry trigger, or a SPEC decision/assumption id — plus a one-line plain-language cost/value estimate so the deferral judgment stays legible to the user. "Needs a dedicated design session when prioritized" with no named owner is an **open finding**, not a disposition; `ln-sync`'s drift check sweeps the ledger for exactly this state and forces promotion or explicit retirement.

Higher-level design questions surfaced during walkthroughs get the same treatment as defects: they enter the ledger as findings and leave it only by promotion (a frontier/Horizon entry via `ln-plan`, or a SPEC decision via `ln-spec`) or explicit retirement. Advisory limbo is the failure mode this section exists to prevent.

## What to check

Each slice's scope card names its outer-loop verification needs. Common checks:

- **Rendering correctness**: do the TUI and web sidecar render the seeded graph state correctly (nodes, edges, readiness bands)?
- **Continuity**: do graph writes from the TUI session surface in the web observer, and do foreign writes surface in the session as `worldUpdate` notices?
- **Resume**: relaunch against the same workbench — is graph and session state intact?
- **Elicitation quality**: are agent prompts and structured exchanges well-formed against the seeded gaps? (tracked, not gated — see SPEC §Verification Design)
