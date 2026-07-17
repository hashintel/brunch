# Saved comparison missions

This directory holds editable, product-neutral **private user missions** for `/compare-specs`. Start with `/compare-specs`, or use `/compare-specs [mission-id-or-path]` to review, revise, or run an existing mission.

A mission belongs exclusively to the fresh Pi actor playing the simulated user/PM. In readable ordinary-language Markdown it defines:

- the user's objective and natural opening request;
- relevant context, priorities, and preferences;
- constraints and known facts;
- uncertainties, including what is unknown or undecided;
- decision latitude—what the actor may decide and what requires the operator; and
- conversational and disclosure posture.

It may also identify the requested review-ready specification document, its purpose, filename, and useful completion condition. It is not controller YAML or a Brunch seed, and it contains no contender selection, lane order, shared/per-harness framing, adapter details, run ids, scoring rubric, or automation instructions.

`/compare-specs` gives the complete approved mission wholesale only to a separately identifiable fresh Pi actor. The actor opens each target conversation naturally, answers from mission truth, weighs recommendations and tradeoffs as the PM would, decides only within granted latitude, and says unknown or undecided rather than inventing. A contender never receives the mission text, file, or path. It sees only its separately approved minimal harness framing, the actor's opening user message, and subsequent actor-chosen answers and decisions.

Contender setup is separate, intentionally small, and run-specific. `/compare-specs` selects from Brunch, Claude Code, Codex, Cursor/agent, and Pi; shows the exact per-contender framing for operator approval; and snapshots that setup with the run, never in the reusable mission. Brunch uses built-in Specify mode plus only necessary output instruction. Generic harnesses receive a small instruction to conduct a question-led specification conversation and author the requested review-ready document.

Missions remain editable. A revision changes only the mission and future runs; it never rewrites an existing run directory, private mission snapshot, contender-setup snapshot, transcript, target output, or report. Ephemeral assembly belongs under `.fixtures/scratch/comparisons/`; deliberately retained immutable evidence belongs under `.fixtures/runs/agent-as-user-comparison/`.

The retained operator-only report may reproduce the complete private mission as its baseline. It must visibly separate that actor-only baseline from each lane's exact target-visible initial framing and transcript, outcomes, and unchanged target-authored document so elicitation and leakage remain legible. It does not choose a winner or impose a fixed rubric.
