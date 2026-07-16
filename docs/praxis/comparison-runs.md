# Comparison Runs

Brunch has two distinct evaluation use cases. Seeded runs inspect Brunch against known Brunch state. Cross-product runs compare what different products produce from the same product-neutral mission. A seed cannot serve both purposes.

## PM door: inspect a seeded Brunch scenario

From the repository root, run:

```sh
npm run dev-cli
```

In the menu, choose a seed-derived instance, select a tracked seed, and confirm the reset. The launcher creates or resets its workbench, starts the Brunch TUI, and opens the web observer sidecar. Use the TUI for the conversational workflow and the web sidecar to inspect the graph as it changes.

Richness appears in three places:

- the seed's existing specifications, propositions, relationships, and settlement state;
- the TUI's questions, proposals, and review interactions over that state;
- the web sidecar's spatial graph and detail views, which expose structure that a transcript alone cannot show.

For a repeatable direct launch after choosing a scenario, use:

```sh
npm run dev-cli -- --seed workspace-alpha-grounding/base --reset
```

Seeds are Brunch fixtures. They encode Brunch graph and specification state, so they are useful for intra-product walkthroughs and regression probes—not for comparison with another product.

## Developer deterministic-read cheatsheet

Keep reads and fixture curation explicit:

```sh
# Read one public RPC projection.
npm run dev-cli -- rpc workspace.state --workspace <workspace>
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace <workspace>

# Print the projected workspace and exit.
npm run dev-cli -- --workspace <workspace> --mode print

# Curate fixture state through the product command layer.
npm run dev-cli -- mutate --workspace <workspace> --params-file <mutations.json>

# Export one specification as a candidate seed.
npm run dev-cli -- export --workspace <workspace> --spec-id 1 --out <seed.json>
```

`rpc` and `print` are deterministic observations. `mutate` is the explicit local write seam. `export` turns reviewed workbench state into a candidate fixture; review it before tracking it.

## Agent recipe: drive, then join evidence

On an overlay-capable host, drive the real TUI with the pinned project-local `pi-interactive-shell` package. In a sandbox or headless environment, use `npm run tui-driver` as the fallback. Follow the bounded observation, named-key input, and deterministic cleanup protocol in [Manual Testing](manual-testing.md).

After a run has produced `<workspace>/.brunch/debug/trajectory.ndjson`, join it to Pi's active session branch:

```sh
npm run dev-cli -- trajectory \
  --workspace <workspace> \
  --session <workspace>/.brunch/sessions/<session>.jsonl \
  --run-id <run-id> \
  --viewport <optional-bounded-viewport.txt>
```

Read `<workspace>/.brunch/debug/trajectory-report.md` and retain `trajectory.json` when structured inspection is useful. These latest-wins files are diagnostic evidence, not product truth or a causality claim.

## Agent-as-user cross-product comparison

Cross-product comparison starts from a **mission or concept catalog**, not a Brunch seed. Give each target harness—Brunch, Claude Code, or Cursor—the same product-neutral mission and a matched effort budget. An agent-as-user drives each real interface until an explicit **ready** stop condition is met: it holds a specification or plan document ready for human comparison. Compare those final documents for comprehensiveness and detail; opaque competitor internals do not count against them.

The general actor and reliable ready-stop policy are **not built**. They are owned by the `agent-as-user-comparison` frontier in [`memory/PLAN.md`](../../memory/PLAN.md#agent-as-user-comparison). Until that frontier lands, this section is an approach, not an executable campaign.

Do not substitute seeds for the mission catalog. Competitor products cannot consume Brunch's graph/specification state, so a seeded starting point would make the runs incomparable. Seed-based intra-product testing and mission-driven cross-product comparison remain separate use cases.
