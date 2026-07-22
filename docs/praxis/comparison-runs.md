# Comparison Runs

For the short operator introduction, start with [Compare Brunch and Claude Code](comparison-guide.md).

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

## Immutable run-start provenance

Every new elicitation, execution, or end-to-end comparison captures `provenance.json` immediately after the operator approves the setup and before the first lane starts. The snapshot records the root package release, exact tag when present, full controller commit and URL, branch, dirty state, run identity, and capture time:

```sh
npx tsx src/dev/comparison-provenance.ts capture \
  --run-directory <unused-or-approved-run-directory> \
  --comparison-kind <elicitation|execution|end_to_end> \
  --run-id <run-id>
```

The writer is intentionally collision-failing. Never overwrite this file, recapture it after a checkout changes, or infer historical provenance from the checkout used to publish a report. Keep the snapshot when promoting a run from scratch to `.fixtures/runs/`. Existing historical runs without a retained snapshot remain unchanged and must not be backfilled from memory or current Git state.

After the run is complete and its retained `report.md` is final, publish explicitly:

```text
/comparison-publish <run-directory>
```

The publication skill validates `report.md`, `provenance.json`, and the available kind-specific contracts; produces a validity-first, controller-safe copy; and upserts the existing Notion Comparison Reports database by `Run ID + Phase`. A repeated invocation updates the same report row, while duplicate matching rows stop publication for operator resolution. Publication never infers the release or commit from the publisher's checkout.

## Quick start: compare execution

From a trusted top-level project Pi session, run:

```text
/compare-execution minimal-petri-net-editor
```

The project-local operator displays the frozen specification, public contract, selected Brunch/Claude
executors, exact framing, run identity, and output paths before asking for approval. It then runs one
fresh isolated lane at a time, cleans up each live shell before continuing, and applies the unchanged
controller-owned browser oracle to every retained outcome. With no case id,
`/compare-execution` lists eligible cases under `testing/execution-comparisons/cases/`.

This is developer/evaluation tooling under `.pi/prompts/`, not a shipped Brunch product command.
Brunch stops at `promotion_prepared`; the operator never invokes `/brunch:land`, scores a lane, chooses
a winner, or treats Brunch-only run/Petri/debug evidence as common comparison evidence.

### Petrinaut historical setup preflight

Before spending a provider turn on the frozen Petrinaut case, run the controller-only preflight with
an explicit real HASH source checkout and three disjoint scratch roots:

```sh
npx tsx src/dev/execution-comparison-operator.ts petrinaut-preflight \
  --source-repository /absolute/path/to/hash \
  --parent-target /absolute/disposable-work/parent \
  --reference-target /absolute/disposable-work/reference \
  --output-root /absolute/retained-evidence
```

The command accepts no provider, reference commit, dependency command, manifest command, or oracle
plugin. It prepares the frozen parent through D137-L, calibrates only the code-owned merged PR #9051
reference with the same compiled immutable install and unchanged
`petrinaut-optimization-oracles-v1`, writes one path-redacted receipt plus bounded write-once
`parent-dependency.json`, `reference-dependency.json`, and `oracle-summary.json` files for each reached
phase, and removes both owned workspaces. Receipt evidence entries contain only fixed relative
filenames, SHA-256, byte count, and truncation state. The receipt is evidence, not an admission token.
`setup_failed` or `assertion_failed` blocks historical provider work; never bypass the failed phase or
replace an invalid receipt.

The 2026-07-22 diagnostic run proved both immutable installs, tracked-source checks, and all six
focused builds, then exposed that fixture-authored labels were stronger than PR #9051's public UI.
The frozen packet, typed addresses, and synthetic rivals were rebaselined to source-backed semantics
before any provider attempt. PR #362 deliberately shipped without rerunning the expensive real
post-rebaseline preflight, so no passing merged-reference receipt exists. Before a future first
Petrinaut provider attempt, rerun the command above and require a passing receipt under D138-L; the
waiver used to close the implementation PR is not reusable as campaign evidence.

## End-to-end comparison tracer

The end-to-end tracer composes the rigorous elicitation recipe with the execution-comparison contracts
without changing either stage's evidence policy. One frozen mission and disclosed shared baseline
produce two independently approved specifications. Each exact byte sequence crosses a content-addressed
handoff into both Brunch and Claude, yielding the closed
`{brunch_spec, claude_spec} × {brunch, claude_code}` matrix.

The controller contract lives under
`testing/end-to-end-comparisons/cases/minimal-petri-net-editor/`; the dev-only parsers, adapters, matrix,
traceability ledger, and redaction boundary live under `src/dev/end-to-end-comparison/`. Controller
oracle material remains outside target workspaces, and each matrix leaf references the existing
immutable `ExecutionAttempt` format. Reports must present elicitation validity, exact handoff identity,
execution validity, and requirement-level output evidence separately. This one-case tracer supports
within-executor/spec contrasts only—not a winner, reliability estimate, or causal claim.

After the complete end-to-end setup is approved, capture `end_to_end` provenance in its scratch run root before starting either elicitation lane. Promote that exact snapshot beside the handoffs, attempts, ledger, and report; the later execution matrix does not recapture it.

The first promoted witness is
[`petri-editor-e2e-20260721T132600Z`](../../.fixtures/runs/end-to-end-comparison/petri-editor-e2e-20260721T132600Z/).
It retains both exact handoffs, all four valid failed execution cells, portable common evidence, the
audience-safe requirement ledger, and the bounded validity-first report.
This historical witness predates Alpha 10 provenance capture. Keep it as evidence and an example, but
do not backfill `provenance.json` or publish it through the current publication skill.

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

Cross-product comparison starts from a **mission**, not a Brunch seed. There are two deliberately different procedures.
For a plain-language introduction and operator walkthrough, start with the
[Elicitation Testing Guide](elicitation-testing.md).

### Approachable operator workflow

Invoke `/compare-specs` in one trusted top-level project Pi session. That session alone receives the private saved mission, acts as the simulated user, and drives selected comparison harnesses sequentially. It opens exactly one direct `interactive_shell` harness at a time at normal host dimensions, sends only approved minimal framing plus natural mission-grounded messages, and fully cleans up that harness before starting another. All choices and approvals work through ordinary typed text.

This path favors an understandable operator experience. Harness order and the shared top-level actor context are disclosed; it does **not** claim fresh-per-harness actor isolation, matched budgets, blinding, or structured adjudication. Future retained setup snapshots use `harness-setup.md`; historical `contender-setup.md` files remain immutable.

Use the rigorous procedure below when those stronger controls matter.

### Rigorous campaign procedure

The rigorous FE-1210 recipe gives Brunch, Claude Code, and Cursor the same product-neutral public packet, controller-only reveal policy, effort budget, and ready-document condition. A fresh Pi actor drives each live interface; opaque competitor internals never count against a target.

The round-one materials remain useful for focused improvement and regression studies that need frozen inputs, matched budgets, explicit validity rules, and structured human judgment. The prepared Dora-adjudication and second-operator shells in the historical run were not completed and are not required closure evidence; they remain untouched as part of the retained bundle.

The rigorous campaign loop is:

1. instantiate [`comparison-runs/mission-packet.md`](comparison-runs/mission-packet.md), keeping the reveal key outside every target cwd;
2. after setup approval, capture immutable `elicitation` provenance under `.fixtures/scratch/comparisons/<campaign-id>/` before the first lane;
3. drive one fresh lane with [the actor recipe](../../.agents/skills/agent-as-user-comparison/SKILL.md);
4. retain target-visible interaction, validity/intervention notes, cleanup status, and the target-authored ready document under `.fixtures/scratch/comparisons/<campaign-id>/`;
5. when the study needs structured judgment, run the masked-outcome and unblinded-process passes from the judgment prompt pack and have the named human adjudicator review the drafts; and
6. after review, promote the portable bundle, including unchanged `provenance.json`, to `.fixtures/runs/agent-as-user-comparison/<campaign-id>/` and run `npm run check:promoted-run-paths` before commit.

Use push-driven hands-free control: project config lowers the query fallback floor to 5 seconds, forwards quiet output after roughly 3 seconds, and prunes superseded viewport reads before each LLM call. Send input and end the turn; act on the pushed quiet update. Query only when no push arrives or the incremental tail is ambiguous, and then read the current tail—never page historical scrollback.

Target adapters:

- Brunch: real `npm run dev-cli` TUI; acquire the ready document from settled graph state with `document-export`.
- Claude Code: `spawn: { agent: "claude" }`; if a host shim intercepts it, record the launch failure before using the real installed binary.
- Cursor: `spawn: { agent: "cursor" }`, mapped by pi-interactive-shell to `agent --model composer-2-fast`. Safehouse must allow the symlink target under `~/.local/share/cursor-agent`.

The promoted example [`lockers-r1-20260716`](../../.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/) proves Brunch and Claude required lanes, failure retention, split judgment, and artifact promotion. Its Cursor lane was historically skipped; [`addendum-03-cursor-availability.md`](../../.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/addendum-03-cursor-availability.md) records the later sandbox fix without rewriting the run.

Do not substitute seeds for missions. Competitor products cannot consume Brunch graph/specification state, so a seeded start would make the runs incomparable. Seed-based intra-product testing and mission-driven cross-product comparison remain separate use cases.
