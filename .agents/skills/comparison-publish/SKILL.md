---
name: comparison-publish
description: Explicitly validate and idempotently publish one retained Brunch comparison report to the canonical Notion Comparison Reports database. Use only when the operator invokes /comparison-publish with a run directory.
argument-hint: "<run-directory>"
disable-model-invocation: true
---

# Comparison Publish

Publish one completed comparison run with `/comparison-publish <run-directory>`. This skill is operator-invoked post-run reporting; it never conducts an experiment, starts a lane, judges a live run, or publishes automatically.

Before proceeding, load [Comparison reporting](../comparison-reporting/SKILL.md) for validity-first evidence policy and [Notion reporting](../notion-reporting/SKILL.md) for safe mutation and verification. Comparison reporting owns the report grammar. Notion reporting owns formatting and the smallest safe mutation.

## Fixed destination and identity

- Hub: `brunch Testing Scenarios`, page id `3a53c81f-e024-8045-98e3-cf55aef279eb`.
- Database: `Comparison Reports`, data source `collection://01130dd8-6a1c-420a-b84d-166766550163`.
- Upsert key: the compound identity `Run ID + Phase`. Neither field alone is unique.
- One database row is the report page. Never create a separate report page plus a register row.

Always discover the current Notion MCP tool schema, fetch the hub, fetch the database/data source, and inspect its live properties before querying or writing. Names and option ids in this file are intent, not permission to assume a stale schema.

## 1. Resolve and validate retained evidence

Resolve the argument from the repository root to one real run directory. Reject an absent directory, symlink, traversal outside the repository, or ambiguous path. Require regular files named `report.md` and `provenance.json`. The report must be a completed retained report, not a draft assembled for publication.

Parse `provenance.json` against `src/dev/comparison-provenance.ts`. Require:

- schema version `1`;
- one comparison kind: `elicitation`, `execution`, or `end_to_end`;
- the exact run id and canonical capture timestamp;
- root package name and release version;
- exact tag or `null`;
- full 40-character controller commit, matching clickable commit URL, branch or `null`, and dirty boolean.

The run-directory identity and the provenance run id must agree. Treat a missing, malformed, or mismatched provenance artifact as a hard stop. Never infer historical provenance from the current checkout, current `HEAD`, current package version, a later tag, a report date, or operator memory.

Validate the retained contracts that exist for the declared kind:

- **Elicitation:** require the approved setup snapshot, lane-visible transcripts/interactions, lane terminal and cleanup evidence, and unchanged produced-document references claimed by `report.md`. Distinguish the approachable shared-actor procedure from a rigorous campaign.
- **Execution:** parse every claimed attempt with `src/dev/execution-comparison/artifact-contract.ts`; use only audience-safe attempt packets and the two public case files named by comparison reporting. Require validity, terminal, cleanup, common command/browser, and retained-output references claimed by `report.md`.
- **End-to-end:** validate the study contract, exact-byte handoffs, four-cell matrix or explicitly retained missing cells, requirement ledger, and underlying execution attempts with `src/dev/end-to-end-comparison/` contracts.

Do not recursively inspect controller-only case directories. A missing contract or report claim unsupported by retained evidence stops publication; do not repair evidence, infer a result, or silently downgrade the gap.

## 2. Produce the publication copy

Read `report.md` using comparison reporting's evidence order: study design, provenance, validity before outcomes, common evidence, process evidence, lane-only diagnostics, then bounded interpretation. Preserve failed and invalid attempts.

Create an audience-safe Notion body. Never publish controller-only oracle definitions, hidden fixtures, expected states, selector mappings, reveal material, private controller paths, secrets, or opaque reasoning. Include only aggregate hidden-oracle outcomes and portable evidence references. Private mission text may appear only when the fixed destination has been explicitly approved as an operator/controller audience; otherwise summarize its public concern without reproducing it.

The page must include an **Identity** section containing:

- Run ID and Phase;
- capture timestamp;
- root package name and release version;
- exact tag, or `none`;
- full controller commit SHA as its retained commit URL;
- branch, or `detached`;
- dirty state.

Keep validity before outcomes in the page body. Do not add a winner, score, parity claim, causal claim, or broad benchmark claim that the frozen procedure and valid retained evidence do not support.

## 3. Map live database properties

Map the publication copy to the current live properties:

- `Report`: report-page title;
- `Date`: provenance capture date;
- `Release`: root package version (the Identity section also records the exact tag);
- `Commit`: provenance controller commit URL;
- `Phase`: `Elicitation`, `Execution`, or `End-to-end` from comparison kind;
- `Result`: the report's explicit bounded outcome, using an existing live option;
- `Evidence`: retained-evidence completeness, using an existing live option;
- `Status`: validity/publication status, using an existing live option;
- `Run ID`: exact provenance run id;
- `Case`: exact public case/mission identifier supported by the report.

Do not invent an option or coerce an unsupported classification. If an exact mapping is absent, show the operator the mismatch and stop before mutation.

## 4. Compound upsert

Query the live data source for exact `Run ID + Phase` equality:

- **Zero matches:** create one row in `Comparison Reports` with the mapped properties and the audience-safe report body.
- **One match:** fetch that row page first. Update only changed properties and the generated report content. Preserve comments, child pages/databases, and unrelated child content. Do not replace a full page merely for convenience.
- **More than one match:** stop and report the duplicate row URLs. Never pick one, merge them, or create another row.

Use the smallest safe mutation. Keep the row's existing page identity on update so repeated publication is idempotent.

## 5. Verify every write

Re-query the database and fetch the report page after every write. Confirm:

1. exactly one row matches `Run ID + Phase`;
2. every mapped property has the intended typed value;
3. the Identity section contains the immutable release, full SHA/link, tag, branch, and dirty state;
4. validity precedes outcomes and retained evidence links resolve;
5. controller-only material is absent;
6. existing comments, child pages/databases, and unrelated content remain; and
7. a second publication would update the same page rather than create another.

Report completion only after this readback. Return the row URL, compound identity, create/update disposition, release, full commit SHA, and verification result.
