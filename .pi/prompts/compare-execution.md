---
description: Run one approachable frozen execution comparison through Brunch and Claude Code
argument-hint: "[case-id]"
---

Conduct one approachable, operator-led execution comparison. This is project-local developer/operator tooling, not a shipped Brunch product command. Do not register, propose, or imply a production `/compare-execution` command.

The optional case reference is: `$ARGUMENTS`.

## Fixed boundaries

The invoking top-level project Pi session is the controller. Keep exactly one executor lane live at a time. Every lane gets a fresh isolated target cwd, but that cwd and its output remain retained evidence after process cleanup.

Use these repository-relative homes:

- Cases: `testing/execution-comparisons/cases/`
- Ephemeral assembly: `.fixtures/scratch/execution-comparisons/<run-id>/`
- Immutable attempt records: `.fixtures/scratch/execution-comparisons/<run-id>/attempt-records/`

Resolve cases only through the project wrapper. Never interpret a supplied value as a filesystem path, follow a symlink, search outside the cases home, or accept an absolute path, traversal, ambiguity, or anything under `controller/`.

Before a lane terminates, load only its lane-visible `spec.md` and `public-contract.json`. Do not load, display, copy, mention paths to, or expose the case's `controller/` directory, oracle manifest, hidden journeys, fixtures, expected states, controller paths, or oracle implementation to either target. The controller may invoke the fixed oracle wrapper only after the target lane has terminated.

The initial executor roster is exactly **Brunch** and **Claude Code**. Do not add an adapter registry, parallel execution, elicitation, landing, or new oracle semantics.

## Select and inspect the case

If `$ARGUMENTS` is empty, run:

```sh
npx tsx src/dev/execution-comparison-operator.ts list-cases
```

List the returned eligible directory ids and public case ids. If exactly one case is eligible, select it and continue in this turn using its directory id. Only ask the operator to choose when more than one case is eligible, and stop until they do. If no case is eligible, report that and stop.

For a supplied or selected id, run:

```sh
npx tsx src/dev/execution-comparison-operator.ts inspect --case <case-id>
```

This is the only pre-approval case read. It validates the public case loader and returns only the exact frozen specification, exact public contract, packet hash, repository requirement, compiled oracle identity, and shared framing. If resolution or validation fails, report the error and stop; never guess, repair, normalize, or fall back to another case.

For a case whose inspection reports `requiresSourceRepository: true`, ask for the absolute path to a trusted local checkout containing the pinned commit. This path is controller setup and is never target-visible. Greenfield cases require no source checkout.

Ask which executors to run: **Brunch**, **Claude Code**, or both, and in which disclosed order. The default recommendation is both in the operator's chosen order. This approachable procedure does not claim order blinding, matched private reasoning, or statistical reliability.

Create a collision-safe run identity in the form `<directory-id>-<UTC-basic-timestamp>-<short-random-suffix>`. Confirm that neither its scratch path nor any attempt id already exists. Do not create or overwrite them before approval.

## Display the complete setup

Display all of the following together before any target preparation or launch:

1. the complete frozen `spec.md`, byte-for-byte;
2. the complete frozen `public-contract.json`, byte-for-byte;
3. selected executors and disclosed order;
4. the exact shared target-visible framing returned by `inspect`;
5. the run identity, case directory id, public case id, and public-packet hash;
6. exact scratch, attempt-record, per-lane target, process-log, final-tree, final-diff, browser-report, and visible-interaction output paths;
7. Brunch's pinned TUI entrypoint and Claude Code's structured adapter;
8. the case's compiled post-lane oracle identity returned by `inspect`;
9. whether preparation is greenfield or a pinned remote-free brownfield snapshot; and
10. the limits: sequential lanes, unchanged inputs, no substantive intervention, no landing, no score, no winner, and no reliability or parity claim.

Ask through ordinary typed text for explicit **approve**, **revise**, or **reject**. Ambiguity, questions, qualifications, partial approval, or silence are not approval. Revise and redisplay the complete setup, or reject and stop. Do not prepare a target, start a shell, invoke an executor, or invoke the oracle before explicit approval.

Immediately after approval and before saving snapshots or preparing the first lane, capture the controller checkout once:

```sh
npx tsx src/dev/comparison-provenance.ts capture \
  --run-directory .fixtures/scratch/execution-comparisons/<run-id> \
  --comparison-kind execution \
  --run-id <run-id>
```

Treat an existing `provenance.json`, malformed metadata, or capture failure as a setup collision/failure and stop. Never overwrite it or reconstruct provenance from the checkout used later for reporting.

Then save byte-identical `spec.md`, `public-contract.json`, and `run-setup.md` snapshots under the same scratch run identity. Keep the two frozen inputs separate and unchanged.

## Run approved lanes

Run lanes sequentially with exactly one executor lane live at a time. For each lane, use a fresh isolated target cwd and a fresh collision-safe attempt id. Show `ready`, `running`, and `waiting` while active; terminate as `successful`, `failed`, `exhausted`, or `invalid`.

Give both executors the exact same frozen specification and public contract without normalization or repair. Send the exact shared target-visible framing unchanged. Do not add implementation advice, framework suggestions, expected states, hidden test hints, or lane-specific quality coaching.

### Brunch

Prepare through the case-aware workspace adapter. For greenfield cases omit `--source-repository`; for pinned brownfield cases include the approved absolute source checkout:

```sh
npx tsx src/dev/execution-comparison-operator.ts prepare \
  --case <case-id> \
  --lane brunch \
  --target <fresh-target-cwd> \
  [--source-repository <absolute-source-checkout>]
```

From the Brunch repository root, open one direct `interactive_shell` using the pinned project-local entrypoint reported by preparation:

```sh
npx tsx src/dev/execution-comparison-brunch.ts \
  --workspace <fresh-target-cwd> \
  --spec-id <spec-id>
```

Use normal host dimensions and bounded rendered-state control. Send only the approved shared framing. Through ordinary visible Brunch controls, switch to Execute mode, compile the frozen plan, and execute it. Let the real product own planning, workspace creation, worker execution, verification, Petri export, and run-local promotion.

Brunch must stop at `promotion_prepared`. Never invoke `/brunch:land`, never accept or simulate host landing, and never treat `landed` as success. A `landed` status makes the attempt invalid and must still be retained. The retained application output is the run metadata's existing `worktreeDir`; do not reconstruct it from transcript text or copy controller material into it. If no worktree exists, retain the target and classify the missing output honestly.

Keep Brunch run metadata, Petri journal/projection, JSONL, and `.brunch/debug/` material in a separate `brunch-diagnostics/` appendix. It is diagnostic-only and must not enter common outcomes, compensate for missing common evidence, or be used to infer parity.

### Claude Code

Prepare through the same case-aware wrapper, using the same source checkout rule:

```sh
npx tsx src/dev/execution-comparison-operator.ts prepare \
  --case <case-id> \
  --lane claude_code \
  --target <fresh-target-cwd> \
  [--source-repository <absolute-source-checkout>]
```

Open one direct `interactive_shell` from the fresh target cwd through Claude Code's normal structured adapter:

```text
spawn: { agent: "claude" }
```

Send only the approved shared framing. Do not substitute a raw binary, another model, another adapter, or a nested shell. Claude Code works in that isolated target cwd and stops after its visible completion, failure, or budget exhaustion.

## Termination, oracle, retention, and cleanup

After every lane terminates, first capture its final process status and all target-visible interaction evidence. Kill any still-running executor process, query the shell to a final status, dismiss the completed shell record, and verify that no executor process or interactive session remains.

Record every controller takeover immediately in `<attempt-staging>/intervention-ledger.json`, including a
mechanical selection of an already-proposed action. The ledger has schema `{ "schemaVersion": 1,
"interventions": [...] }`; each intervention uses the `ExecutionAttempt` index, kind, description, and
timestamp fields. The visible-interaction summary must be derived from this ledger rather than independently
authored. No unledgered controller takeover is permitted.

Then run the unchanged controller-owned oracle identity returned by `inspect` against the retained output:

```sh
npx tsx src/dev/execution-comparison-operator.ts oracle \
  --case <case-id> \
  --app <retained-output-cwd> \
  --out <attempt-staging>/browser/report.json
```

Do this after every lane terminates, including failed, exhausted, and invalid lanes. Let the case-owned oracle run its fixed command, build, Git, TUI, or browser checks and close all resources. Do not edit the frozen case, controller files, oracle manifest, fixtures, expected states, journey implementation, or report to make a lane pass. If the unchanged oracle cannot start, retain that setup failure and do not invent a product verdict.

After the oracle exits, verify cleanup again. Retain the target cwd; cleanup means no live process or session, not deletion of evidence. Do not launch the next lane until the prior executor shell and oracle resources are both fully clean.

For every successful, failed, exhausted, and invalid attempt, retain immutably:

- the validated `ExecutionAttempt` record and public/oracle hashes;
- final executor and oracle process status, stdout, stderr, and exit codes;
- validity status and reasons;
- elapsed and intervention ledgers;
- cleanup status and any residue;
- the final tree and complete base-to-tip diff, plus honest notes for uncommitted or unavailable material;
- common case-owned command and oracle results;
- normalized visible interaction evidence; and
- the unchanged retained output itself.

Stage evidence under the fresh attempt path, construct an `ExecutionAttempt` JSON using the existing FE-1230 schema, and validate/store its record with:

```sh
npx tsx src/dev/execution-comparison-operator.ts retain-attempt \
  --attempt-file <attempt-staging>/attempt.json \
  --intervention-ledger <attempt-staging>/intervention-ledger.json \
  --attempts-root .fixtures/scratch/execution-comparisons/<run-id>/attempt-records
```

The immutable writer rejects an existing attempt id and rejects a ledger that does not exactly match the attempt's
intervention list. Never overwrite, delete, replace, or silently retry a poor-output attempt. A replacement is
permitted only for provider, adapter, or mechanical invalidity under the unchanged packet, and both attempts remain retained.

## Report

After all selected lanes terminate and cleanup is proven, write `report.md` beside the unchanged run-start `provenance.json` under the run scratch root. Present study design and run identity, then validity before outcomes for each lane, factual terminal state, cleanup, produced output, common command results, unchanged oracle results, requirement findings, limitations, and recommendations. Keep every referenced path repository-relative so `/comparison-publish` can validate the retained bundle.

Keep common evidence and Brunch-only diagnostics visibly separate. Use `not_assessable` for unavailable common evidence. Do not score, rank, choose a winner, claim reliability, infer parity from unavailable or product-private evidence, or let Brunch-only run/Petri/debug data improve its common result. Do not turn ordinary visual hierarchy, clarity, or drag feel into an automatic mechanical verdict.

After `report.md` is complete, generate the terminal summary from the immutable attempt records:

```sh
npx tsx src/dev/execution-comparison-operator.ts summary \
  --run-directory .fixtures/scratch/execution-comparisons/<run-id>
```

Return that command's stdout verbatim as the final response. Do not prepend or append commentary, recreate the summary from memory, or finish with only transcript or directory filenames. The deterministic summary must include the case and run ids, each attempt's terminal and validity state, invalidity reason when applicable, command and browser results, cleanup result, and absolute report, oracle, and attempt-record paths. Keep remaining human-witness details and retained output paths in `report.md`.
