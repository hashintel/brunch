# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence. For audience-specific seed walkthroughs, deterministic reads, trajectory evidence, and the separate cross-product approach, see [Comparison Runs](comparison-runs.md).

## Setup

1. **Interactive TUI control**: use the project-local `pi-interactive-shell` package when the host permits overlays. It gives the agent a real PTY and bounded terminal queries while a human watches, takes over by typing, and presses `Ctrl+G` to return a hands-free session to the agent. Root `.pi/settings.json` declares this permanent developer extension; it remains outside Brunch's shipped package manifest, sealed `src/.pi` profile, and runtime dependency graph.
2. **Sandboxed/headless TUI control**: when host-capable overlay execution is unavailable, use the project-owned `npm run tui-driver` fallback described below. The web UI is served as a sidecar of the running TUI process.
   - **Standalone web** (`brunch --mode web`): also supported since FE-1200. It starts a combined cwd-scoped host without `InteractiveMode`, prints its loopback URL on stdout, and serves the target-addressed React session route (`/session/$specId/$sessionId`) directly. Use this when driving a browser chat without a TUI process.
3. **Browser observation**: use `agent-browser` (`/cli-agent-browser`) as the primary observer — daemon-backed Chrome with AX-tree snapshots, clicks, and screenshots. Use CDP tools (`/cli-cdp`) for console and network detail.

Install or reconcile the pinned project package from the repository root, then confirm Pi reports it under `Project packages`:

```bash
pi install -l npm:pi-interactive-shell@0.13.0
pi list
```

Pi packages execute with full system access: review and trust this repository before enabling the extension. After project trust is granted, Pi automatically installs a missing declared package on startup; this can fetch package contents from the network into ignored `.pi/npm/` cache state. The declaration and cache-ignore rule are committed, but installed cache contents are not. Do not install the extension into Brunch's root `package.json`, `src/.pi`, or runtime graph. Brunch reaches `zigpty` only indirectly through the pinned `pi-interactive-shell` package; it has no direct integration.

### Session runtime contract convergence evidence

The normal TUI and standalone web host are two legitimate runtime compositions. Work under PLAN arc `shared-session-host-convergence` must prove that they share one target-addressed semantic contract, JSONL truth, and per-target writer authority rather than forcing both presentations onto an independent host. Capture one compound outer witness against the **same durable target and sole writable runtime**:

1. start the normal TUI and record its durable target identity and writer authority;
2. attach companion React to the TUI-owned runtime through Brunch's semantic session contract;
3. drive an ordinary turn plus one structured ask from the active driver;
4. observe the same target-addressed semantic stream and fresh JSONL settlement in React;
5. while the TUI owns the target, confirm a rival standalone-web process is refused before constructing a second runtime or writing the transcript;
6. shut down the TUI normally, then confirm standalone web can acquire the same target and continue from fresh JSONL; and
7. confirm the TUI's editor, chrome, command/extension UI, and transcript remain useful, and judge whether companion React is useful without surviving TUI exit (A51-L).

Record the current/desired path and exact deletion evidence in the frontier's walkthrough artifact. The cutover is not witnessed while `SessionEventRelay`, `brunch.sessionEvent`, or `/rpc/driver` remains load-bearing. See [`docs/design/WEB_UI_ARCHITECTURE.md`](../design/WEB_UI_ARCHITECTURE.md).

Before relying on it, use `interactive_shell` to start a trivial command, accept input, resize, report a final status, and prove no background session remains. Repeat this health check after any pinned package, Pi, Node, OS, architecture, or resolved-`zigpty` change. Then ask the agent to run these in hands-free mode:

```text
npm run dev:components -- tui-lab
npm run seed -- --seed workspace-alpha-grounding/base --reset
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding --no-webui
```

Use structured `input`, `inputKeys`, `inputPaste`, status, and kill operations rather than embedding terminal escapes. Keep model-visible queries bounded; use status to capture the final exit result. Version 0.13.0 was witnessed on Pi 0.80.x, Node v24.18.0, and macOS 26.5.2 arm64 with its resolved `zigpty` 0.1.6 `darwin-arm64` prebuild. It declares `zigpty ^0.1.6` while upstream was on 0.2.1. macOS is the witnessed platform; Linux remains unproven here.

### Sandboxed/headless fallback: tui-driver

If overlays or socket-backed tooling cannot bind (for example `listen EPERM .../*.pipe`), use `npm run tui-driver` (`src/dev/tui-driver.ts`). It is an `expect`-pumped PTY per named session, with true screen rendering through a headless xterm and wait-for-text instead of sleep-and-hope. Sessions live under gitignored `.fixtures/scratch/tui-driver/<name>/`. It does not provide human overlay takeover, runtime resize, or bracketed/multiline paste; switch back to the project-local extension when those are acceptance requirements and the host permits it.

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

For the project-local extension, query every session to a final status, kill any session still running, dismiss completed background records, and verify its background-session list is empty. Cleanup applies to sessions, not the committed package declaration or ignored package cache.

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
