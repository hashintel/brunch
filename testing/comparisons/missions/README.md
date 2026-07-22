# Saved comparison missions

This directory holds editable, product-neutral **private user missions** for
`/compare-specs`. Start with `/compare-specs`, or use
`/compare-specs [mission-id-or-path]` to review, revise, or run an existing
mission.

Current library:

- [`minimal-petri-net-editor.md`](minimal-petri-net-editor.md) — Petri-editor
  elicitation and end-to-end origin mission
- [`brunch-host-landing.md`](brunch-host-landing.md) — Brunch host-landing brownfield mission
- [`petrinaut-optimization.md`](petrinaut-optimization.md) — Petrinaut optimization brownfield mission
- [`prospect-research-workspace.md`](prospect-research-workspace.md) — full-stack prospect
  research elicitation and end-to-end origin mission

This `README.md` is the directory's reserved control file, not a mission. `/compare-specs` must exclude it from mission listing, resolution, revision, and creation.

A mission belongs exclusively to the invoking top-level project Pi session acting as the simulated user. In readable ordinary-language Markdown it defines:

- the user's objective and natural opening request;
- relevant context, priorities, and preferences;
- constraints and known facts;
- uncertainties, including what is unknown or undecided;
- decision latitude—what the simulated user may decide and what requires the operator; and
- conversational and disclosure posture.

It may also identify the requested review-ready specification document, its purpose, filename, and useful completion condition. It is not controller YAML or a Brunch seed, and it contains no comparison-harness selection, order, framing, adapter details, run ids, scoring rubric, or automation instructions.

`/compare-specs` keeps the complete approved mission only in the top-level session. That session opens each harness conversation naturally, answers from mission truth, weighs recommendations and tradeoffs as the user would, decides only within granted latitude, and says unknown or undecided rather than inventing. A comparison harness never receives the mission text, file, or path. It sees only its separately approved minimal framing, the natural opening message, and subsequent mission-grounded answers and decisions.

Harness setup is separate, intentionally small, and run-specific. `/compare-specs` selects from Brunch, Claude Code, Codex, Cursor/agent, and Pi; shows the exact per-harness framing for operator approval; and snapshots future setup as `harness-setup.md`, never in the reusable mission. Historical setup snapshots retain their existing names and bytes. Brunch uses built-in Specify mode plus only the necessary output instruction. Generic harnesses receive a small instruction to conduct a question-led specification conversation and author the requested review-ready document.

The top-level session drives exactly one direct `interactive_shell` comparison harness at a time and cleans it up before starting another. Each harness gets a fresh isolated target cwd/session, but that target is distinct from the controller process cwd: Brunch's shell launches from the Brunch repository root and passes the target through `--workspace <fresh-target-cwd>`, while a generic harness's structured spawn uses the fresh target cwd as its process cwd. It never launches another simulated-user process or nests an interactive shell. Every operator choice and approval works through ordinary typed text; a structured question tool is optional presentation only. The shared top-level context and harness order are disclosed, so this approachable workflow makes no fresh-per-harness actor-isolation claim.

Missions remain editable. A revision changes only the mission and future runs; it never rewrites an existing run directory, private mission snapshot, harness-setup snapshot, transcript, target output, or report. Ephemeral assembly belongs under `.fixtures/scratch/comparisons/`; deliberately retained immutable evidence belongs under `.fixtures/runs/agent-as-user-comparison/`.

Each mission with a matching directory under `testing/execution-comparisons/cases/` may also be run as an execution-only comparison through `/compare-execution <mission-id>`. That path freezes `spec.md` and `public-contract.json`, captures `provenance.json` before the first lane, retains validated attempts and case-owned oracle reports, and writes the validity-first `report.md` consumed by `/comparison-publish`. Elicitation and execution remain separate phases unless an explicitly retained end-to-end matrix is run.

The retained operator-only report may reproduce the complete private mission as its baseline. It must visibly separate that top-level-session-only baseline from each harness's exact visible framing and transcript, outcomes, and unchanged harness-authored document so elicitation and leakage remain legible. It does not choose a winner or impose a fixed rubric.
