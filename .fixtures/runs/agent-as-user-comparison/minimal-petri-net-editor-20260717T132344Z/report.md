# Specification comparison report

Run id: `minimal-petri-net-editor-20260717T132344Z`

## 1. Private mission baseline (actor-only)

Mission id: `minimal-petri-net-editor`

# Minimal browser-based Petri-net editor

## Objective and opening request

The PM wants a review-ready product specification for a minimal Petri-net editor that runs in a web browser.

Open naturally with:

> We want to build a minimal Petri-net editor that runs in a web browser. Help me work through the product decisions and produce a review-ready specification.

## Product context and priorities

The first version should provide a point-and-click interface in which a user can:

- add places and transitions;
- draw arcs between them;
- move, rename, and delete places and transitions;
- set tokens and arc weights;
- run the Petri net; and
- save and load a Petri net.

The priority is a coherent, useful minimal experience rather than an exhaustive modeling environment.

## Constraints and known facts

- The product must run in a web browser.
- No other platform, collaboration, offline, technology, schedule, or delivery constraints are currently known.

## Uncertainties

The PM does not yet know the detailed interaction model or expected behavior beyond the capabilities above. In particular, the execution experience—such as highlighting enabled transitions, firing transitions manually, or advancing automatically—is undecided. Detailed choices about editing, persistence, validation, layout, and the boundaries of the minimal version are also open.

When information is not present here and has not been decided in conversation, say that it is unknown or undecided rather than inventing a fact.

## Decision latitude

Ask the PM about the most important product choices. When a choice is undecided, explain the meaningful tradeoffs and give a clear recommendation or a small set of recommended options. The PM may select among those recommendations and should become decisive once a clear direction has been established.

The PM may accept sensible low-consequence details that follow from an agreed direction. The PM should not independently invent consequential requirements merely to keep the conversation moving. If an important issue cannot be resolved from the contender’s recommendations, leave it explicitly open for later operator input.

## Conversational and disclosure posture

Be candid about uncertainty, answer directly from the facts above, and engage with questions. Do not volunteer a large requirements dump at the start. Let important details emerge naturally through the specification conversation. Once the contender has explained a clear recommendation and direction, respond decisively.

## Requested document

Ask for the completed specification to be written as `petri-net-editor-spec.md`. It should be a review-ready Markdown document that gives a product and implementation team a coherent account of the intended minimal experience, the decisions reached in conversation, and any genuinely unresolved questions. Usefulness and clarity matter more than exhaustive detail.

## 2. Target-visible setup and interaction (per lane)

### Brunch

- Adapter: Brunch built-in Specify mode via `npm run dev-cli -- --workspace <fresh-target-cwd>`
- Actor identity: `minimal-petri-net-editor-brunch-actor`
- Target identity: `minimal-petri-net-editor-brunch-target`
- Target cwd: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T132344Z/lanes/brunch/target/`

Exact approved initial framing:

> The requested review-ready document is `petri-net-editor-spec.md`.

Exact actor opening:

> We want to build a minimal Petri-net editor that runs in a web browser. Help me work through the product decisions and produce a review-ready specification.

The actor submitted the framing and opening together at the first input opportunity. No other mission fact, actor answer, or decision was sent. The only rendered target output observed was the Brunch startup splash; no acknowledgement, question, recommendation, or specification content became visible, and receipt could not be confirmed.

Two mechanical takeover/resume events occurred. Each was handled with `Ctrl+G`; neither supplied or changed substantive content. The complete lane record is in [`lanes/brunch/transcript.md`](lanes/brunch/transcript.md).

### Claude Code

- Adapter: `spawn: { agent: "claude" }`
- Actor identity: none; not launched
- Target identity: none; not launched
- Target cwd: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T132344Z/lanes/claude-code/target/`

Exact approved initial framing:

> Conduct a question-led specification conversation with me, then author the review-ready Markdown specification at `petri-net-editor-spec.md` in your current working directory. Ask before settling important product decisions; do not assume facts I have not provided.

This framing was never sent. No actor opening, target response, actor answer, or decision occurred because the operator stopped the comparison before this lane launched. The complete lane record is in [`lanes/claude-code/transcript.md`](lanes/claude-code/transcript.md).

## 3. Outcomes

### Brunch — failed

The isolated target launched but remained on the startup splash. After the approved first message, no response push arrived; a final bounded rendered-tail observation still showed only the splash and could not confirm receipt. No settled specification id became visible, so document export was not attempted. The target background record was dismissed, the actor exited, the background-session list was empty, and exact process inspection found no matching lane process.

### Claude Code — failed

The operator stopped the comparison after observing the Brunch lane. The selected Claude Code lane was deliberately not launched. No actor or target session/process existed to clean up.

## 4. Produced documents

### Brunch

No target-authored document exists.

### Claude Code

No target-authored document exists.

## 5. Operator observations

- The initial mission-capture workflow worked reasonably well. It took a few questions, which felt acceptable, and could probably remain substantially the same.
- The operator expects an ordinary Markdown file placed in `testing/comparisons/missions/` to be selectable as a mission when it contains roughly the same mission information; exact heading requirements should be clarified.
- The adapter/provider preflight checks were useful during development, but would be irritating if repeated for every mission launch.
- Testing Pi felt like a mismatch when the selected comparison target was Brunch. Pi was serving as the simulated-user actor rather than as a contender, but that distinction was not clear in the visible workflow.
- The real run launched a Pi harness which then launched Brunch through another interactive shell. This nested interactive-shell arrangement created a very small visible viewport.
- The Brunch TUI appeared stuck on its startup screen because the snapshot viewport was too small and the actual interactive portion of the view was no longer visible.
