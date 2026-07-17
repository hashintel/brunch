---
description: Create, revise, review, or run a saved cross-product comparison mission
argument-hint: "[mission-id-or-path]"
---

Conduct one approachable, operator-led specification comparison. This prompt is the complete operating procedure; do not replace it with a parser, controller schema, helper state machine, generic runner, campaign framework, or automatic judge.

The optional mission reference is: `$ARGUMENTS`.

## Artifact boundaries

Use these repository-relative homes and no substitutes:

- Editable, product-neutral missions: `testing/comparisons/missions/`
- Ephemeral lane work and report assembly: `.fixtures/scratch/comparisons/`
- Deliberately retained, immutable run snapshots and reports: `.fixtures/runs/agent-as-user-comparison/`

Missions are ordinary-language Markdown, not controller YAML and not Brunch seeds. Never use `.fixtures/seeds/` as mission input. Never put controller-only reveal material in a target cwd, target-visible packet, or retained report. Do not write comparison artifacts outside the three roles above, except for each selected target's fresh isolated cwd while it authors its requested document. Keep paths in retained artifacts repository-relative; do not retain workstation-absolute paths.

A saved mission is editable. An approved run is historical evidence: never overwrite an existing run directory or its approved mission/setup snapshot. Later mission revisions affect future runs only.

## Choose the operation

If `$ARGUMENTS` is empty, offer exactly these starting choices: **create**, **revise**, or **run**. For revise or run, ask the operator to select a saved mission.

If a mission id or path was supplied, resolve it only inside `testing/comparisons/missions/`. Reject traversal, an absolute path, or any reference resolving outside that home. Show which mission was resolved, then offer **review**, **revise**, or **run**. If it does not resolve unambiguously to one Markdown file, ask the operator to correct it; do not guess.

Review displays the complete saved mission and does not launch anything.

## Create or revise a mission

Ask one material question at a time. Explain ambiguity and keep asking until these six input groups are explicit:

1. **Opening ask** — the identical product-neutral task each target receives.
2. **Simulated-user knowledge and reveal policy** — what the actor knows privately, which facts begin public, and the exact target-visible question or condition permitting each private fact to be revealed. Private material stays controller-only.
3. **Useful-document expectation** — the requested document's purpose, ready condition, Markdown filename, and what would make it useful to the operator. Do not turn this into a scoring rubric.
4. **Contenders** — the selected lanes among Brunch, Claude Code, and Cursor.
5. **Shared framing** — exact instructions visible to every selected target, including the ready-document request and any common effort or stopping guidance the operator wants.
6. **Per-harness additions** — the exact additional target-visible instruction for each selected harness. Record an explicit empty addition when none is intended; do not silently substitute “equivalent instructions.”

Before saving, display the complete proposed mission. Save it as readable Markdown under `testing/comparisons/missions/<mission-id>.md`; choose a clear collision-safe id with the operator. Include all six groups, with exact shared and per-harness text directly visible. Do not encode controller YAML, a fixed rubric, a winner, statistics, or automation instructions.

For revision, first display the current complete mission, then change only the editable mission after the operator confirms the edit. State explicitly that existing run directories and snapshots remain unchanged. Revision never launches a run unless the operator subsequently chooses run and approves the complete setup below.

## Review and approve a run

Before any launch:

1. Preflight the actual environment: selected adapters, filesystem access, provider/model access, the pinned `pi-interactive-shell` package and push/prune extensions, and cleanup capability.
2. Require a real mechanism for a separately identifiable **fresh harness-level Pi actor process/session** and a **fresh isolated target cwd** for every selected lane. A new target cwd, this coordinator context, or a promise not to share information is not fresh actor isolation. If fresh actor identity cannot be demonstrated, report the block and do not launch.
3. Display the complete saved mission, the exact shared framing, and every selected harness's exact addition together. Also display the proposed mission id, run id, lane order, target document path, scratch path, retained run path, and adapter for each lane.
4. Ask for an explicit **approve**, **revise**, or **reject** decision.

Treat ambiguity, edits, qualifications, questions, or anything short of explicit approval as not approved. Revise and redisplay the complete setup, or reject and stop. Do not launch partially.

## Run the approved mission

After explicit approval, allocate collision-safe identities under `.fixtures/scratch/comparisons/<run-id>/` and `.fixtures/runs/agent-as-user-comparison/<run-id>/`. Fail rather than reuse or overwrite an existing run identity. Copy the exact approved mission and complete contender setup into scratch as the immutable run input before the first lane starts. That copy, unchanged, is the snapshot later retained with the run.

Selected lanes may run sequentially. For each lane:

1. Show status **ready** while preflighting, then **running** after launch. Use **waiting** when the actor is waiting for target output or an operator-owned action. End only as **finished** or **failed**.
2. Start the separately identifiable fresh harness-level Pi actor context and a fresh isolated target cwd. Give the target only the approved opening ask, shared framing, its exact harness addition, and facts allowed by the reveal policy. Keep controller-only knowledge and reveal material outside the target cwd.
3. Follow the existing FE-1210 rendered-state actor cadence: observe bounded rendered output, send named-key or pasted input, end the turn, act on push-driven quiet updates, and use a bounded current-tail query only when a push is absent or ambiguous. Do not inspect opaque target internals.
4. Use the selected target adapter without changing the mission:
   - **Brunch:** launch the real TUI with `npm run dev-cli -- --workspace <fresh-target-cwd>`; navigate rendered choices; acquire the document only from settled graph state with `npm run dev-cli -- document-export --workspace <fresh-target-cwd> --spec-id <id> --out <requested-file.md>`.
   - **Claude Code:** use `spawn: { agent: "claude" }` and instruct it to author the requested Markdown file in its fresh target cwd.
   - **Cursor:** first verify `agent --version`; use `spawn: { agent: "cursor" }` and instruct it to author the requested Markdown file in its fresh target cwd. Record an adapter or availability mismatch as the lane result.
5. Reveal a private fact only when its approved condition is visibly met. Record target-visible exchanges and reveal decisions honestly.
6. Acquire and copy the target-authored document if it exists. Never author, reconstruct, complete, rewrite, or improve a target document. Missing or partial output remains missing or partial.
7. On success, failure, expiry, invalid conduct, or adapter failure, retain the lane outcome, target-visible interaction notes, document that actually exists, actor/session and target-cwd identities, final process status, and cleanup notes. Kill remaining actor/target processes, dismiss completed overlay records, and verify no lane process remains. Preserve failures rather than selectively erasing or rerunning them.

Do not notify completion while any selected lane is ready, running, or waiting. After **every** selected lane is finished or failed, give one aggregate completion notification and assemble the retained run. Promotion is deliberate: review the scratch assembly, then copy it to the unused immutable run identity without changing the approved snapshot or target-authored documents.

## Retained run and report

The retained run must contain:

- the exact approved mission and contender-setup snapshot;
- every target-authored document that exists, unchanged;
- each lane's outcome, actor/session and target-cwd identity, and cleanup notes;
- an explanation for every missing output; and
- `report.md`.

Write `report.md` for a cold reader with:

1. **Setup** — mission id, run id, approval, shared framing, each harness's exact addition, lane order, and adapters.
2. **Outcomes** — finished/failed state and concise factual account for every lane.
3. **Produced documents** — repository-relative links to every retained target-authored document, plus its content inline when that improves cold readability; state plainly when none exists.
4. **Operator observations** — an empty, free-form section for the operator, unless the operator supplies observations.

Do not add a fixed rubric, score, scripted or API judge, statistics, recommendation, automatic winner, or inferred winner. Report what happened and preserve the products for human comparison.

Finish by reporting the saved mission path, scratch path, immutable run path, lane terminal states, cleanup result, and `report.md` path. Do not claim the comparison was useful or correctly conducted merely because these instructions were followed; that judgment belongs to the operator reviewing the real interaction and artifacts.
