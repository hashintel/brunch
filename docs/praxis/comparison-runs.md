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

Cross-product comparison starts from a **mission**, not a Brunch seed. Give Brunch, Claude Code, and Cursor the same product-neutral public packet, controller-only reveal policy, effort budget, and ready-document condition. A fresh Pi actor drives each live interface; opaque competitor internals never count against a target.

### PM/Dora closure door

Use the canonical sources below as two independent routes; do not merge judgment with the operator smoke or duplicate their procedures here.

- **Dora adjudication:** follow the [`judgment prompt pack`](comparison-runs/judgment-prompt-pack.md) in order: review the identity-masked outcome packet and draft first, consult the separately held label mapping only if needed after that review, then adjudicate the explicitly unblinded normalized-process packet and draft. Keep criterion-level outcome and process conclusions separate.
- **Second-operator Cursor smoke:** from a fresh harness-level Pi session, follow the [actor recipe's push-driven cadence and Cursor adapter](../../.agents/skills/agent-as-user-comparison/SKILL.md): verify the root interactive-shell config, launch `spawn: { agent: "cursor" }`, send one named input, end the turn without querying, and distinguish any startup-only wake from the first pushed post-input output. Use at most one bounded current-tail read after that wake if redraw ambiguity requires it, then perform the final-status, kill/dismiss, and empty-background-session checks in [Manual Testing](manual-testing.md). Record the independent operator's uncoached attestation and observations in the promoted run's blank [`addendum-04-second-operator-handover.md`](../../.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/addendum-04-second-operator-handover.md).

The round-one campaign loop remains:

1. instantiate [`comparison-runs/mission-packet.md`](comparison-runs/mission-packet.md), keeping the reveal key outside every target cwd;
2. drive one fresh lane with [the actor recipe](../../.agents/skills/agent-as-user-comparison/SKILL.md);
3. retain target-visible interaction, validity/intervention notes, cleanup status, and the target-authored ready document under `.fixtures/scratch/comparisons/<campaign-id>/`;
4. run the masked-outcome and unblinded-process passes from the judgment prompt pack; Dora adjudicates the drafts; and
5. after review, promote the portable bundle to `.fixtures/runs/agent-as-user-comparison/<campaign-id>/` and run `npm run check:promoted-run-paths` before commit.

Use push-driven hands-free control: project config lowers the query fallback floor to 5 seconds, forwards quiet output after roughly 3 seconds, and prunes superseded viewport reads before each LLM call. Send input and end the turn; act on the pushed quiet update. Query only when no push arrives or the incremental tail is ambiguous, and then read the current tail—never page historical scrollback.

Target adapters:

- Brunch: real `npm run dev-cli` TUI; acquire the ready document from settled graph state with `document-export`.
- Claude Code: `spawn: { agent: "claude" }`; if a host shim intercepts it, record the launch failure before using the real installed binary.
- Cursor: `spawn: { agent: "cursor" }`, mapped by pi-interactive-shell to `agent --model composer-2-fast`. Safehouse must allow the symlink target under `~/.local/share/cursor-agent`.

The promoted example [`lockers-r1-20260716`](../../.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/) proves Brunch and Claude required lanes, failure retention, split judgment, and artifact promotion. Its Cursor lane was historically skipped; [`addendum-03-cursor-availability.md`](../../.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/addendum-03-cursor-availability.md) records the later sandbox fix without rewriting the run.

Do not substitute seeds for missions. Competitor products cannot consume Brunch graph/specification state, so a seeded start would make the runs incomparable. Seed-based intra-product testing and mission-driven cross-product comparison remain separate use cases.
