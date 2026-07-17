---
description: Create, revise, review, or run a saved cross-product comparison mission
argument-hint: "[mission-id-or-path]"
---

Conduct one approachable, operator-led specification comparison. This prompt is the complete operating procedure; do not replace it with a parser, controller schema, helper state machine, generic runner, campaign framework, or automatic judge.

The optional mission reference is: `$ARGUMENTS`.

## Control, artifact, and information boundaries

The invoking top-level project Pi session is the sole simulated-user actor. It keeps the complete private mission in its own context and directly drives each selected comparison harness through `interactive_shell`. Never launch a separate simulated-user process or let one interactive shell own another. Keep at most one comparison-harness shell live at a time and use normal host dimensions.

Use these repository-relative homes and no substitutes:

- Editable, product-neutral private user missions: `testing/comparisons/missions/`
- Ephemeral harness work and report assembly: `.fixtures/scratch/comparisons/`
- Deliberately retained, immutable run snapshots and reports: `.fixtures/runs/agent-as-user-comparison/`

A mission is ordinary-language Markdown for the top-level session playing the simulated user. It is not controller YAML, a Brunch seed, comparison-harness selection, or harness configuration. Never use `.fixtures/seeds/` as mission input. Never put the mission text, file, or path in a harness context or cwd. A harness receives only its approved minimal framing and the natural opening and later answers that the top-level session chooses from mission truth.

A saved mission is editable. An approved run is historical evidence: never overwrite an existing run directory, private mission snapshot, `harness-setup.md` snapshot, transcript, target output, or report. Later mission revisions affect future runs only. Historical setup snapshots keep their existing names and bytes; never rename them. Keep retained paths repository-relative; do not retain workstation-absolute paths.

All operator choices and approvals must work through ordinary typed text. If a structured question tool happens to exist, it may improve presentation, but correctness and progress must never depend on it.

## Choose the operation

If `$ARGUMENTS` is empty, offer exactly these starting choices: **create**, **revise**, or **run**. For revise or run, ask the operator to select a saved mission. Exclude `testing/comparisons/missions/README.md` from every mission listing: it is a reserved control file, not mission payload.

If a mission id or path was supplied, resolve it only inside `testing/comparisons/missions/`. Reject traversal, an absolute path, any reference resolving outside that home, and any reference resolving to the reserved `README.md`. Never offer the reserved file for review, revision, or a run. Show which mission was resolved, then offer **review**, **revise**, or **run**. If it does not resolve unambiguously to one eligible Markdown mission file, ask the operator to correct it; do not guess.

Review displays the complete saved mission and does not launch anything.

## Create or revise a private user mission

Ask one material question at a time in ordinary product language; do not ask the operator to engineer a technical prompt. Explain ambiguity and continue until the mission privately defines the simulated user's:

- objective and natural opening request;
- relevant context, priorities, and preferences;
- constraints and known facts;
- uncertainties, including what is unknown or undecided;
- decision latitude: what the simulated user may decide and what requires the operator; and
- conversational and disclosure posture: how forthcoming, questioning, decisive, or cautious the user should naturally be.

The mission may name the requested review-ready specification document, its purpose, filename, and useful completion condition. Do not turn usefulness into a fixed scoring rubric. Do not put comparison-harness names, order, framing, adapter details, run ids, or automation instructions in the mission.

Before saving, display the complete proposed mission and require explicit approval. Ambiguity, questions, qualifications, or partial approval are not approval. Save readable Markdown under `testing/comparisons/missions/<mission-id>.md`; choose a clear collision-safe id with the operator. Never create or overwrite the reserved `testing/comparisons/missions/README.md`.

For revision, first display the current complete mission, then change only the editable mission after approval. State that existing run directories and every saved snapshot remain unchanged. Revision never launches a run unless the operator subsequently chooses run and separately approves its setup.

## Prepare and approve a separate run setup

Run setup is intentionally small, run-specific, and never written into the reusable mission.

1. Ask the operator to select comparison harnesses from the concrete roster: **Brunch**, **Claude Code**, **Codex**, **Cursor/agent**, and **Pi**.
2. Draft the minimum exact target-visible framing for each selected harness:
   - **Brunch:** use built-in Specify mode, plus only the output instruction needed to identify the requested review-ready document and path.
   - **Generic harnesses:** use a small instruction to conduct a question-led specification conversation and author the requested review-ready Markdown document. Do not preload mission facts or prescribe conclusions.
3. Preflight only each selected harness's filesystem and adapter prerequisites, including the pinned `pi-interactive-shell` package and cleanup capability where applicable. Do not launch a synthetic conversation to test provider/model access. Report provider/model failure honestly if the real harness launch fails. Check Pi's adapter only when Pi is selected.
4. Allocate a fresh isolated target cwd/session for each selected harness. This is the harness's comparison target, not necessarily the controller process cwd: Brunch's controller must launch from the Brunch repository root and address the fresh target through `--workspace <fresh-target-cwd>`, while a generic harness's structured spawn uses the fresh target cwd as its process cwd. The top-level session remains the shared simulated-user actor, so disclose harness order and shared actor context; do not claim fresh-per-harness actor isolation or equivalence to a rigorous campaign.
5. Display together: the complete private mission; selected harnesses and order; exact per-harness target-visible framing; mission id; collision-safe run id; requested target document path; scratch and retained paths; and each adapter. Clearly label the mission **top-level-session-only** and the framing **harness-visible**.
6. Ask through ordinary text for explicit **approve**, **revise**, or **reject**. Revise and redisplay the complete setup, or reject and stop; do not launch partially.

Before the first harness, copy the exact approved private mission and separate setup into the unused scratch run identity as `private-mission.md` and `harness-setup.md`. They are retained with the run but never merged into one target packet.

## Run the approved mission

Run selected harnesses sequentially. For each harness:

1. Show **ready** while checking its prerequisites, **running** after launch, and **waiting** while awaiting output or an operator-owned action. End only as **finished** or **failed**.
2. Confirm no other comparison-harness shell is live, then open exactly one direct `interactive_shell` from this top-level session. Keep the fresh target cwd/session as the isolated comparison target. For Brunch, launch the shell process from the Brunch repository root, where `package.json` and `npm run dev-cli` exist, and pass the target separately with `--workspace <fresh-target-cwd>`. For a generic harness, use the fresh target cwd as the structured spawn's process cwd. Never open a shell from inside that shell. Send only the approved minimal framing and the natural user message—not the mission text, file, or path.
3. Act as the mission's user: open naturally; answer from mission truth and disclosure posture; consider recommendations and tradeoffs; decide only within granted latitude; and explicitly say unknown or undecided when the mission does not authorize an answer. Do not invent facts or decisions to keep the conversation moving.
4. Use bounded rendered-state control: observe bounded output, send named-key or pasted input, end the turn, act on push-driven quiet updates, and use a bounded current-tail query only when a push is absent or ambiguous. Do not inspect opaque target internals.
5. Use the selected adapter:
   - **Brunch:** from the Brunch repository root, directly launch `npm run dev-cli -- --workspace <fresh-target-cwd>` in built-in Specify mode; from that same repository root, acquire the document only from settled graph state with `npm run dev-cli -- document-export --workspace <fresh-target-cwd> --spec-id <id> --out <requested-file.md>`. The shell/controller cwd is the Brunch repository root; `<fresh-target-cwd>` remains the isolated target workspace.
   - **Claude Code:** `spawn: { agent: "claude" }`.
   - **Codex:** `spawn: { agent: "codex" }`.
   - **Cursor/agent:** verify `agent --version`, then `spawn: { agent: "cursor" }`.
   - **Pi:** `spawn: { agent: "pi" }`.

   Generic harnesses author the requested Markdown file themselves in their cwd. An unavailable or mismatched adapter makes the harness failed; never substitute, silently drop it, or reconstruct output.
6. Retain the exact harness-visible initial framing and transcript, including every user answer and decision. This is the disclosure record: any mission fact visible to the harness must have arrived through a natural opening or subsequent answer.
7. Acquire the harness-authored document if it exists. Never author, reconstruct, complete, rewrite, or improve it. Missing or partial output remains missing or partial.
8. On every outcome, retain state, harness-visible interaction, target-cwd/session identity, final process status, document that exists, and cleanup notes. Kill remaining processes, dismiss the completed shell record, and verify no comparison-harness shell or process remains before starting another.

Do not notify completion while any harness is ready, running, or waiting. After every selected harness is finished or failed, give one aggregate notification. Review scratch assembly, then deliberately copy it to the unused immutable run identity without changing snapshots, transcripts, or harness-authored documents.

## Retained run and operator-only report

The retained run contains distinct `private-mission.md` and `harness-setup.md` snapshots, every exact harness-visible transcript, every harness-authored document that exists, target identities/outcomes/cleanup, explanations for missing output, and `report.md`.

Write `report.md` for an operator-only cold reader. It may reproduce the full private mission, but must keep these sections visibly separate:

1. **Private mission baseline (top-level-session-only)** — full approved mission and mission id.
2. **Harness-visible setup and interaction (per harness)** — exact initial framing, natural opening, subsequent transcript, adapter, and target identity. Make elicitation and any leakage legible by comparison with the private baseline.
3. **Outcomes** — finished/failed state, cleanup, and concise factual account for every harness.
4. **Produced documents** — repository-relative links to unchanged harness-authored documents, with inline content when useful; state plainly when none exists.
5. **Operator observations** — empty and free-form unless the operator supplies observations.

Do not add a fixed rubric, score, scripted/API judge, statistics, recommendation, automatic winner, or inferred winner.

Finish by reporting the saved mission path, scratch path, immutable run path, harness terminal states, cleanup result, and `report.md` path. Do not claim runtime correctness, isolation, user consistency, notification timing, or usefulness merely because static instructions or checks passed; those judgments belong to the operator reviewing the real interaction and artifacts.
