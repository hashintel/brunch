---
description: Create, revise, review, or run a saved cross-product comparison mission
argument-hint: "[mission-id-or-path]"
---

Conduct one approachable, operator-led specification comparison. This prompt is the complete operating procedure; do not replace it with a parser, controller schema, helper state machine, generic runner, campaign framework, or automatic judge.

The optional mission reference is: `$ARGUMENTS`.

## Artifact and information boundaries

Use these repository-relative homes and no substitutes:

- Editable, product-neutral private user missions: `testing/comparisons/missions/`
- Ephemeral lane work and report assembly: `.fixtures/scratch/comparisons/`
- Deliberately retained, immutable run snapshots and reports: `.fixtures/runs/agent-as-user-comparison/`

A mission is ordinary-language Markdown for the fresh Pi actor playing the simulated user/PM. It is not controller YAML, a Brunch seed, contender selection, or harness configuration. Never use `.fixtures/seeds/` as mission input. Give the complete mission only to the actor—never to a contender—and never put the mission text, file, or path in a target's context or cwd.

A saved mission is editable. An approved run is historical evidence: never overwrite an existing run directory, private mission snapshot, contender-setup snapshot, transcript, target output, or report. Later mission revisions affect future runs only. Keep retained paths repository-relative; do not retain workstation-absolute paths.

## Choose the operation

If `$ARGUMENTS` is empty, offer exactly these starting choices: **create**, **revise**, or **run**. For revise or run, ask the operator to select a saved mission.

If a mission id or path was supplied, resolve it only inside `testing/comparisons/missions/`. Reject traversal, an absolute path, or any reference resolving outside that home. Show which mission was resolved, then offer **review**, **revise**, or **run**. If it does not resolve unambiguously to one Markdown file, ask the operator to correct it; do not guess.

Review displays the complete saved mission and does not launch anything.

## Create or revise a private user mission

Ask one material question at a time in ordinary product language; do not ask the operator to engineer a technical prompt. Explain ambiguity and continue until the mission privately defines the simulated user/PM's:

- objective and natural opening request;
- relevant context, priorities, and preferences;
- constraints and known facts;
- uncertainties, including what is unknown or undecided;
- decision latitude: what the actor may decide and what requires the operator; and
- conversational and disclosure posture: how forthcoming, questioning, decisive, or cautious the PM should naturally be.

The mission may name the requested review-ready specification document, its purpose, filename, and useful completion condition. Do not turn usefulness into a fixed scoring rubric. Do not put contender names, lane selection, shared/per-harness framing, adapter details, run ids, or automation instructions in the mission.

Before saving, display the complete proposed mission and require explicit approval. Ambiguity, questions, qualifications, or partial approval are not approval. Save readable Markdown under `testing/comparisons/missions/<mission-id>.md`; choose a clear collision-safe id with the operator.

For revision, first display the current complete mission, then change only the editable mission after approval. State that existing run directories and every saved snapshot remain unchanged. Revision never launches a run unless the operator subsequently chooses run and separately approves its setup.

## Prepare and approve a separate run setup

Run setup is intentionally small, run-specific, and never written into the reusable mission.

1. Ask the operator to select lanes from the concrete roster: **Brunch**, **Claude Code**, **Codex**, **Cursor/agent**, and **Pi**. Cursor/agent is one contender.
2. Draft the minimum exact target-visible framing for each selected lane:
   - **Brunch:** use built-in Specify mode, plus only the output instruction needed to identify the requested review-ready document and path.
   - **Generic harnesses:** use a small instruction to conduct a question-led specification conversation and author the requested review-ready Markdown document. Do not preload mission facts or prescribe the conclusions.
3. Preflight each selected adapter, filesystem and provider/model access, the pinned `pi-interactive-shell` package and push/prune extensions, and cleanup capability. If an adapter is unavailable, do not substitute another harness; let the operator revise selection or retain the approved lane as failed.
4. Require a separately identifiable fresh harness-level Pi actor process/session and fresh isolated target cwd for every lane. A new cwd, this coordinator context, or a promise not to share information is not fresh actor isolation. If identity cannot be demonstrated, report the block and do not launch.
5. Display together: the complete private mission; selected lanes and order; exact per-contender target-visible framing; mission id; collision-safe run id; requested target document path; scratch and retained paths; and each adapter. Clearly label the mission **actor-only** and the framing **target-visible**.
6. Ask for explicit **approve**, **revise**, or **reject**. Revise and redisplay the complete setup, or reject and stop; do not launch partially.

Before the first lane, copy the exact approved private mission and separate contender setup into the unused scratch run identity as distinct immutable input snapshots. They are retained with the run but never merged into one target packet.

## Run the approved mission

Selected lanes may run sequentially. For each lane:

1. Show **ready** while preflighting, **running** after launch, and **waiting** while awaiting target output or an operator-owned action. End only as **finished** or **failed**.
2. Start a separately identifiable fresh harness-level Pi actor and fresh isolated target cwd. Give the actor the complete approved private mission wholesale. Give the contender only its minimal approved framing and then the actor's user messages—never the mission text, file, or path.
3. The actor performs what the PM would manually do: open naturally with the mission's request; answer questions from mission truth and disclosure posture; consider recommendations and tradeoffs; decide only within granted latitude; and explicitly say unknown or undecided when the mission does not authorize an answer. The actor must not invent facts or decisions to keep the conversation moving.
4. Follow FE-1210's rendered-state cadence: observe bounded rendered output, send named-key or pasted input, end the turn, act on push-driven quiet updates, and use a bounded current-tail query only when a push is absent or ambiguous. Do not inspect opaque target internals.
5. Use the selected adapter:
   - **Brunch:** launch `npm run dev-cli -- --workspace <fresh-target-cwd>` in built-in Specify mode; acquire the document only from settled graph state with `npm run dev-cli -- document-export --workspace <fresh-target-cwd> --spec-id <id> --out <requested-file.md>`.
   - **Claude Code:** `spawn: { agent: "claude" }`.
   - **Codex:** `spawn: { agent: "codex" }`.
   - **Cursor/agent:** verify `agent --version`, then `spawn: { agent: "cursor" }`.
   - **Pi:** `spawn: { agent: "pi" }`.

   Generic targets author the requested Markdown file themselves in their cwd. An unavailable or mismatched adapter makes the lane failed; never substitute, silently drop it, or reconstruct output.
6. Retain the exact target-visible initial framing and transcript, including every actor answer and decision. This is the disclosure record: any mission fact visible to the target must have arrived through the actor's natural opening or subsequent answer.
7. Acquire the target-authored document if it exists. Never author, reconstruct, complete, rewrite, or improve it. Missing or partial output remains missing or partial.
8. On every outcome, retain lane state, target-visible interaction, actor/session and target-cwd identities, final process status, document that exists, and cleanup notes. Kill remaining processes, dismiss completed overlay records, and verify no lane process remains. Preserve failed or invalid attempts rather than selectively rerunning or erasing them.

Do not notify completion while any lane is ready, running, or waiting. After every selected lane is finished or failed, give one aggregate notification. Review scratch assembly, then deliberately copy it to the unused immutable run identity without changing snapshots, transcripts, or target-authored documents.

## Retained run and operator-only report

The retained run contains distinct private-mission and contender-setup snapshots, every exact target-visible transcript, every target-authored document that exists, lane identities/outcomes/cleanup, explanations for missing output, and `report.md`.

Write `report.md` for an operator-only cold reader. It may reproduce the full private mission, but must keep these sections visibly separate:

1. **Private mission baseline (actor-only)** — full approved mission and mission id.
2. **Target-visible setup and interaction (per lane)** — exact initial framing, actor opening message, subsequent transcript, adapter, and lane identity. Make elicitation and any leakage legible by comparison with the private baseline.
3. **Outcomes** — finished/failed state, cleanup, and concise factual account for every lane.
4. **Produced documents** — repository-relative links to unchanged target-authored documents, with inline content when useful; state plainly when none exists.
5. **Operator observations** — empty and free-form unless the operator supplies observations.

Do not add a fixed rubric, score, scripted/API judge, statistics, recommendation, automatic winner, or inferred winner.

Finish by reporting the saved mission path, scratch path, immutable run path, lane terminal states, cleanup result, and `report.md` path. Do not claim runtime correctness, isolation, actor consistency, notification timing, or usefulness merely because static instructions or checks passed; those judgments belong to the operator reviewing the real interaction and artifacts.
