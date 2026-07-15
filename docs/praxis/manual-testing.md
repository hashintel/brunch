# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence.

## Setup

1. **Interactive TUI control**: prefer Pi with `pi-interactive-shell` loaded temporarily when the host permits overlays. It gives the agent a real PTY and bounded terminal queries while a human watches, takes over by typing, and presses `Ctrl+G` to return a hands-free session to the agent. Do not install it into Brunch's sealed profile or package manifest.
2. **TUI + web sidecar**: `/cli-cmux` remains useful for a dedicated terminal pane. The web UI is served as a sidecar of the running TUI process.
   - **Standalone web** (`brunch --mode web`): also supported since FE-1200. It starts a combined cwd-scoped host without `InteractiveMode`, prints its loopback URL on stdout, and serves the target-addressed React session route (`/session/$specId/$sessionId`) directly. Use this when driving a browser chat without a TUI process.
3. **Browser**: use `agent-browser` (`/cli-agent-browser`) as the primary observer — daemon-backed Chrome with AX-tree snapshots, clicks, and screenshots. CDP tools (`/cli-cdp`) remain useful for console/network detail.

For an isolated candidate launch, retain the temporary Pi home path, create its session directory, expose existing user auth by symlink (never copy credentials into the repo or scratch), disable resource discovery and project trust, and explicitly load only the candidate extension:

```bash
AGENT_DIR="$(mktemp -d)"
mkdir -p "$AGENT_DIR/sessions"
ln -s "$HOME/.pi/agent/auth.json" "$AGENT_DIR/auth.json"
PI_CODING_AGENT_DIR="$AGENT_DIR" pi \
  --no-extensions \
  --no-skills \
  --no-prompt-templates \
  --no-themes \
  --no-context-files \
  --no-approve \
  -e npm:pi-interactive-shell@0.13.0
```

If the selected provider supports API-key environment authentication, exporting that key instead of creating the auth symlink is also acceptable. The pinned npm candidate remains process-local and is not a Brunch dependency, but its first launch may fetch package contents from the network.

### Shared-host transition evidence

The current TUI sidecar and standalone web host are separate runtime compositions. Do not mistake running each successfully for proof that the new architecture replaced the old one. Work under PLAN arc `shared-session-host-convergence` must capture one compound outer witness against the **same durable target and sole writable runtime**:

1. start the independent host and record its process/runtime target identity;
2. attach the real TUI presentation and React client;
3. drive an ordinary turn plus one structured ask from the active driver;
4. observe the same target-addressed semantic stream and fresh JSONL settlement in React;
5. detach/restart one client without terminating or duplicating the hosted runtime;
6. exercise driver conflict or explicit handoff; and
7. confirm the TUI's editor, chrome, command/extension UI, and transcript remain useful.

Record the current/desired path and exact deletion evidence in the frontier's walkthrough artifact. The cutover is not witnessed while `SessionEventRelay`, `brunch.sessionEvent`, or `/rpc/driver` remains load-bearing. See [`docs/design/WEB_UI_ARCHITECTURE.md`](../design/WEB_UI_ARCHITECTURE.md).

Before relying on it, confirm the extension loads, starts a trivial command, accepts input, resizes, reports final status, and leaves no background session. Then ask the agent to run these in hands-free mode:

```text
npm run dev:components -- tui-lab
npm run seed -- --seed workspace-alpha-grounding/base --reset
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding --no-webui
```

Use structured `input`, `inputKeys`, `inputPaste`, status, and kill operations rather than embedding terminal escapes. Candidate 0.13.0 was witnessed on Pi 0.80.x, Node v24.18.0, and macOS 26.5.2 arm64 with its resolved `zigpty` 0.1.6 `darwin-arm64` prebuild. It declares `zigpty ^0.1.6` while upstream was on 0.2.1; re-run the health check after candidate, Pi, Node, OS, architecture, or resolved-`zigpty` changes. macOS is the witnessed platform; Linux remains unproven here.

### Sandboxed/headless fallback: tui-driver

If overlays or socket-backed tooling cannot bind (for example `listen EPERM .../*.pipe`), use `npm run tui-driver` (`src/dev/tui-driver.ts`). It is an `expect`-pumped PTY per named session, with true screen rendering through a headless xterm and wait-for-text instead of sleep-and-hope. Sessions live under gitignored `.fixtures/scratch/tui-driver/<name>/`. It does not provide human overlay takeover, runtime resize, or bracketed/multiline paste; switch back to the temporary extension when those are acceptance requirements and the host permits it.

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

# Tear down when the beat is witnessed, remove its scratch session, and prove no residue.
npm run tui-driver -- stop --name walk
npm run tui-driver -- rm --name walk
npm run tui-driver -- list
```

For the temporary extension, query the session to a final status, kill it if still running, dismiss its background record, and verify its background-session list is empty. After Pi exits, remove the auth symlink and temporary home using the retained variable:

```bash
rm "$AGENT_DIR/auth.json"
rm -rf "$AGENT_DIR"
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
